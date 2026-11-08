import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';

import { useSession } from '@/hooks/use-session';
import {
  createGuardianInvite,
  fetchActiveInvite,
  fetchLinks,
  removeLink,
  revokeInvites,
  type GuardianInvite,
  type GuardianLink,
} from '@/lib/guardian';
import { supabase } from '@/lib/supabase';

type State = { userId: string; guardians: GuardianLink[]; invite: GuardianInvite | null };

let topicCounter = 0;

/**
 * Patient side of Guardian Sync: who can see this vault, and the current invite code. Listens on
 * Realtime, so a code turns into a linked guardian on screen the moment it is redeemed.
 */
export function usePatientGuardians() {
  const session = useSession();
  const userId = session?.user.id;
  const [state, setState] = useState<State | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  const current = userId && state?.userId === userId ? state : null;
  const guardiansRef = useRef<GuardianLink[]>([]);
  useEffect(() => {
    guardiansRef.current = current?.guardians ?? [];
  }, [current]);

  const reload = useCallback(() => setReloadToken((n) => n + 1), []);

  useEffect(() => {
    if (!userId) return;
    let active = true;

    const load = async () => {
      try {
        const [guardians, invite] = await Promise.all([fetchLinks(userId, 'patient'), fetchActiveInvite(userId)]);
        if (!active) return;
        setState({ userId, guardians, invite });
        setError(null);
      } catch (e) {
        if (!active) return;
        setError(e instanceof Error ? e : new Error(String(e)));
      }
    };
    void load();

    const channel = supabase
      .channel(`patient-guardians:${userId}:${++topicCounter}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'guardian_links', filter: `patient_id=eq.${userId}` },
        () => void load(),
      )
      // DELETE events can't be filtered and only carry the primary key, so check it against ours.
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'guardian_links' }, (payload) => {
        const id = (payload.old as { id?: string }).id;
        if (guardiansRef.current.some((g) => g.id === id)) void load();
      })
      .subscribe();

    const appState = AppState.addEventListener('change', (next) => {
      if (next === 'active') void load();
    });

    return () => {
      active = false;
      appState.remove();
      void supabase.removeChannel(channel);
    };
  }, [userId, reloadToken]);

  /** Makes a new code (the old unused one stops working). */
  const createInvite = useCallback(async () => {
    const invite = await createGuardianInvite();
    if (userId) setState((prev) => ({ userId, guardians: prev?.userId === userId ? prev.guardians : [], invite }));
    return invite;
  }, [userId]);

  const cancelInvite = useCallback(async () => {
    if (!userId) return;
    await revokeInvites(userId);
    setState((prev) => (prev?.userId === userId ? { ...prev, invite: null } : prev));
  }, [userId]);

  const removeGuardian = useCallback(
    async (linkId: string) => {
      await removeLink(linkId);
      if (!userId) return;
      setState((prev) =>
        prev?.userId === userId ? { ...prev, guardians: prev.guardians.filter((g) => g.id !== linkId) } : prev,
      );
    },
    [userId],
  );

  return {
    /** `undefined` while the first load is in flight. */
    guardians: current?.guardians,
    invite: current?.invite ?? null,
    error,
    reload,
    createInvite,
    cancelInvite,
    removeGuardian,
  };
}
