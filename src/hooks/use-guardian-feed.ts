import type { RealtimeChannel, RealtimePostgresChangesPayload } from '@supabase/supabase-js';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';

import { useSession } from '@/hooks/use-session';
import {
  fetchLinks,
  fetchPatientSnapshot,
  toDoseEvent,
  toPrescription,
  type DoseEvent,
  type DoseStatus,
  type GuardianLink,
  type PatientPrescription,
} from '@/lib/guardian';
import { supabase } from '@/lib/supabase';

export type GuardianAlert =
  | {
      kind: `dose-${DoseStatus}`;
      link: GuardianLink;
      dose: DoseEvent;
      /** Undefined if the prescription hasn't reached this device yet. */
      prescription: PatientPrescription | undefined;
    }
  | {
      kind: 'prescription-added' | 'prescription-updated' | 'prescription-removed';
      link: GuardianLink;
      prescription: PatientPrescription;
    };

/**
 * - `idle`: signed out, or not the guardian of anyone.
 * - `connecting`: opening the WebSocket subscription.
 * - `live`: subscribed; changes arrive as they happen.
 * - `reconnecting`: the subscription dropped; supabase-js is rejoining. Data may be stale.
 */
export type GuardianFeedStatus = 'idle' | 'connecting' | 'live' | 'reconnecting';

export type GuardianFeed = {
  /** Patients this account is a guardian of. */
  links: GuardianLink[];
  /** Live prescriptions of every linked patient, newest first. */
  prescriptions: PatientPrescription[];
  /** Dose events of every linked patient from the last week, newest scheduled time first. */
  doses: DoseEvent[];
  status: GuardianFeedStatus;
  /** Last failure to load data. Cleared by the next successful load. */
  error: Error | null;
  /** Reloads links and data, e.g. for pull-to-refresh. */
  refresh: () => void;
};

type Row = Record<string, unknown>;
type Change = RealtimePostgresChangesPayload<Row>;

const NO_LINKS: GuardianLink[] = [];
const NO_PRESCRIPTIONS: PatientPrescription[] = [];
const NO_DOSES: DoseEvent[] = [];

/** Data is tagged with the account / patient set it was loaded for, so stale data is never shown. */
type LinkState = { userId: string; links: GuardianLink[] };
type FeedState = {
  key: string;
  prescriptions: PatientPrescription[];
  doses: DoseEvent[];
  status: GuardianFeedStatus;
};

let topicCounter = 0;
// supabase.channel() returns an existing channel with the same topic, which may still be closing.
const uniqueTopic = (name: string) => `${name}:${++topicCounter}`;

function asError(e: unknown) {
  return e instanceof Error ? e : new Error(String(e));
}

/**
 * Guardian-side Realtime listener. Subscribes over WebSocket to the prescriptions and dose events
 * of every patient this account guards, keeps an in-memory copy, and calls `onAlert` for each
 * change that arrives live (not for the initial load). RLS on the server decides what is sent.
 *
 * Mount only while signed in. Missed realtime events (app in the background, network loss) are
 * recovered by reloading a snapshot whenever the channel (re)joins or the app returns to the
 * foreground; alerts are only raised for changes received live.
 */
export function useGuardianFeed(options: { onAlert?: (alert: GuardianAlert) => void } = {}): GuardianFeed {
  const session = useSession();
  const userId = session?.user.id;

  const [linkState, setLinkState] = useState<LinkState | null>(null);
  const [feed, setFeed] = useState<FeedState | null>(null);
  const [error, setError] = useState<Error | null>(null);

  const links = userId && linkState?.userId === userId ? linkState.links : NO_LINKS;
  const [refreshToken, setRefreshToken] = useState(0);

  const onAlertRef = useRef(options.onAlert);
  useEffect(() => {
    onAlertRef.current = options.onAlert;
  });

  // Declared before the effects that read it, so it is current by the time they run.
  const linksRef = useRef(links);
  useEffect(() => {
    linksRef.current = links;
  }, [links]);

  const refresh = useCallback(() => setRefreshToken((n) => n + 1), []);

  // ---- Links: who this account guards -----------------------------------------------------

  useEffect(() => {
    if (!userId) return;
    let active = true;

    const load = () =>
      fetchLinks(userId, 'guardian').then(
        (next) => {
          if (!active) return;
          setLinkState({ userId, links: next });
          setError(null);
        },
        (e) => {
          if (!active) return;
          console.log('[guardian] Could not load links:', asError(e).message);
          setError(asError(e));
        },
      );

    void load();

    const channel = supabase
      .channel(uniqueTopic(`guardian-links:${userId}`))
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'guardian_links', filter: `guardian_id=eq.${userId}` }, load)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'guardian_links', filter: `guardian_id=eq.${userId}` }, load)
      // DELETE events can't be filtered and only carry the primary key, so check it against ours.
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'guardian_links' }, (payload: Change) => {
        const id = (payload.old as Row).id;
        if (linksRef.current.some((link) => link.id === id)) void load();
      })
      .subscribe((state, err) => {
        if (state === 'CHANNEL_ERROR' || state === 'TIMED_OUT') console.log('[guardian] Links channel:', state, err);
      });

    const appState = AppState.addEventListener('change', (next) => {
      if (next === 'active') void load();
    });

    return () => {
      active = false;
      appState.remove();
      void supabase.removeChannel(channel);
    };
  }, [userId, refreshToken]);

  // ---- Patient data: snapshot + live changes ----------------------------------------------

  // Resubscribe only when the set of patients changes, not on every links reload.
  const patientKey = useMemo(() => [...new Set(links.map((l) => l.patient_id))].sort().join(','), [links]);
  const feedKey = userId && patientKey ? `${userId}|${patientKey}` : '';

  useEffect(() => {
    if (!userId || !patientKey) return;
    const key = `${userId}|${patientKey}`;
    const patientIds = patientKey.split(',');
    let active = true;

    // Kept here rather than in React state so incoming events can be compared with the latest data.
    let rxById = new Map<string, PatientPrescription>();
    let dosesById = new Map<string, DoseEvent>();

    const publish = () => {
      if (!active) return;
      const prescriptions = [...rxById.values()].sort((a, b) => b.created_at - a.created_at);
      const doses = [...dosesById.values()].sort((a, b) => b.scheduled_at - a.scheduled_at);
      setFeed((prev) => ({
        key,
        prescriptions,
        doses,
        status: prev?.key === key ? prev.status : 'connecting',
      }));
    };

    const setStatus = (status: GuardianFeedStatus) =>
      setFeed((prev) =>
        prev?.key === key ? { ...prev, status } : { key, prescriptions: NO_PRESCRIPTIONS, doses: NO_DOSES, status },
      );

    const linkFor = (patientId: string) => linksRef.current.find((l) => l.patient_id === patientId);

    const alert = (next: GuardianAlert) => {
      try {
        onAlertRef.current?.(next);
      } catch (e) {
        console.log('[guardian] onAlert threw:', asError(e).message);
      }
    };

    /** Applies one change. Ignores anything not newer than what we hold. Returns true if it applied. */
    function apply(change: Change, raiseAlert: boolean) {
      if (change.eventType === 'DELETE') return false; // Rows are soft-deleted, never removed.
      const row = change.new as Row;

      if (change.table === 'prescriptions') {
        const next = toPrescription(row);
        const prev = rxById.get(next.id);
        if (prev && prev.last_modified_at >= next.last_modified_at) return false;
        if (next.deleted_at != null) {
          if (!prev) return false;
          rxById.delete(next.id);
        } else {
          rxById.set(next.id, next);
        }
        const link = linkFor(next.user_id);
        if (raiseAlert && link) {
          const kind = next.deleted_at != null ? 'prescription-removed' : prev ? 'prescription-updated' : 'prescription-added';
          alert({ kind, link, prescription: next });
        }
        return true;
      }

      if (change.table === 'dose_events') {
        const next = toDoseEvent(row);
        const prev = dosesById.get(next.id);
        if (prev && prev.last_modified_at >= next.last_modified_at) return false;
        dosesById.set(next.id, next);
        const link = linkFor(next.user_id);
        // A re-save with the same outcome is not news.
        if (raiseAlert && link && prev?.status !== next.status) {
          alert({ kind: `dose-${next.status}`, link, dose: next, prescription: rxById.get(next.prescription_id) });
        }
        return true;
      }
      return false;
    }

    // Events that arrive while a snapshot is loading are replayed on top of it, so neither
    // overwrites newer data with older.
    let loading = false;
    let reloadAgain = false;
    let pending: Change[] = [];

    async function loadSnapshot() {
      if (loading) {
        reloadAgain = true;
        return;
      }
      loading = true;
      try {
        do {
          reloadAgain = false;
          const snapshot = await fetchPatientSnapshot(patientIds);
          if (!active) return;
          rxById = new Map(snapshot.prescriptions.map((p) => [p.id, p]));
          dosesById = new Map(snapshot.doses.map((d) => [d.id, d]));
        } while (reloadAgain && active);
        setError(null);
      } catch (e) {
        if (!active) return;
        console.log('[guardian] Could not load patient data:', asError(e).message);
        setError(asError(e));
      } finally {
        loading = false;
        const replay = pending;
        pending = [];
        for (const change of replay) apply(change, true);
        publish();
      }
    }

    const onChange = (change: Change) => {
      if (!active) return;
      if (loading) {
        pending.push(change);
        return;
      }
      if (apply(change, true)) publish();
    };

    const filter = `user_id=in.(${patientKey})`;
    const channel: RealtimeChannel = supabase
      // `wait` holds SUBSCRIBED until the server is really streaming changes, so the snapshot
      // taken on SUBSCRIBED can't miss anything in between.
      .channel(uniqueTopic(`guardian-feed:${userId}`), { config: { postgres_changes_options: { wait: true } } })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'prescriptions', filter }, onChange)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'dose_events', filter }, onChange)
      .subscribe((state, err) => {
        if (!active) return;
        if (state === 'SUBSCRIBED') {
          setStatus('live');
          // First join, or a rejoin after the socket dropped: catch up on anything missed.
          void loadSnapshot();
        } else if (state === 'CHANNEL_ERROR' || state === 'TIMED_OUT') {
          console.log('[guardian] Feed channel:', state, err);
          setStatus('reconnecting');
        }
      });

    // The OS may suspend the socket in the background; reload on return in case events were lost.
    const appState = AppState.addEventListener('change', (next) => {
      if (next === 'active') void loadSnapshot();
    });

    return () => {
      active = false;
      appState.remove();
      void supabase.removeChannel(channel);
    };
  }, [userId, patientKey, refreshToken]);

  const current = feedKey && feed?.key === feedKey ? feed : null;
  return {
    links,
    prescriptions: current?.prescriptions ?? NO_PRESCRIPTIONS,
    doses: current?.doses ?? NO_DOSES,
    status: !feedKey ? 'idle' : (current?.status ?? 'connecting'),
    error,
    refresh,
  };
}
