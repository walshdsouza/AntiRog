import { Q } from '@nozbe/watermelondb';
import { useDatabase } from '@nozbe/watermelondb/react';
import { useEffect, useState } from 'react';
import { AppState } from 'react-native';

import { nextDayStart, scheduledTime, startOfDay, type DoseEventRecord } from '@/lib/doses';
import type { PrescriptionRecord } from '@/lib/prescriptions';

export type TodaysDose = {
  prescription: PrescriptionRecord;
  medication: string;
  dosage: string;
  /** ms, today at the reminder time. */
  scheduledAt: number;
  /** Outcome logged for today, if any. */
  logged: { status: string; recordedAt: number } | null;
};

/** Current time in ms, refreshed every `intervalMs` while mounted (for "due" / "overdue" labels). */
export function useNow(intervalMs = 60_000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), intervalMs);
    const appState = AppState.addEventListener('change', (state) => {
      if (state === 'active') setNow(Date.now());
    });
    return () => {
      clearInterval(timer);
      appState.remove();
    };
  }, [intervalMs]);
  return now;
}

/** Local midnight of the current day. Moves on at midnight and when the app returns to the foreground. */
export function useDayStart() {
  const [dayStart, setDayStart] = useState(startOfDay);

  useEffect(() => {
    const check = () => setDayStart((prev) => (startOfDay() === prev ? prev : startOfDay()));
    // A little past midnight, so the clock has definitely rolled over.
    const timer = setTimeout(check, nextDayStart(dayStart) - Date.now() + 1000);
    const appState = AppState.addEventListener('change', (state) => {
      if (state === 'active') check();
    });
    return () => {
      clearTimeout(timer);
      appState.remove();
    };
  }, [dayStart]);

  return dayStart;
}

/**
 * Today's scheduled doses (one per prescription with a daily reminder) and what has been logged
 * for them, earliest first. Pass `prescriptionId` to get only that prescription's dose.
 * Updates on local changes and on changes pulled by a sync.
 */
export function useTodaysDoses(prescriptionId?: string) {
  const database = useDatabase();
  const dayStart = useDayStart();
  const [doses, setDoses] = useState<TodaysDose[] | undefined>(undefined);

  useEffect(() => {
    let prescriptions: PrescriptionRecord[] | undefined;
    let events: DoseEventRecord[] | undefined;

    // Observables emit the same model instances on change, so build fresh objects every time.
    const publish = () => {
      if (!prescriptions || !events) return;
      const byPrescription = new Map(events.map((e) => [e.prescriptionId, e]));
      const next = prescriptions
        .filter((p) => p.reminderEnabled && p.reminderMinutes != null)
        .map((p): TodaysDose => {
          const event = byPrescription.get(p.id);
          return {
            prescription: p,
            medication: p.medication,
            dosage: p.dosage,
            scheduledAt: scheduledTime(dayStart, p.reminderMinutes!),
            logged: event ? { status: event.status, recordedAt: event.recordedAt } : null,
          };
        })
        .sort((a, b) => a.scheduledAt - b.scheduledAt);
      setDoses(next);
    };

    const only = prescriptionId ? [Q.where('id', prescriptionId)] : [];

    const rxSubscription = database
      .get<PrescriptionRecord>('prescriptions')
      .query(...only)
      .observeWithColumns(['medication', 'dosage', 'reminder_enabled', 'reminder_minutes'])
      .subscribe((records) => {
        prescriptions = records;
        publish();
      });

    const eventSubscription = database
      .get<DoseEventRecord>('dose_events')
      .query(
        ...(prescriptionId ? [Q.where('prescription_id', prescriptionId)] : []),
        Q.where('scheduled_at', Q.gte(dayStart)),
        Q.where('scheduled_at', Q.lt(nextDayStart(dayStart))),
        // If the reminder time changed after logging, keep the most recently recorded outcome.
        Q.sortBy('recorded_at', Q.asc),
      )
      .observeWithColumns(['status', 'recorded_at'])
      .subscribe((records) => {
        events = records;
        publish();
      });

    return () => {
      rxSubscription.unsubscribe();
      eventSubscription.unsubscribe();
    };
  }, [database, dayStart, prescriptionId]);

  return { doses, dayStart };
}
