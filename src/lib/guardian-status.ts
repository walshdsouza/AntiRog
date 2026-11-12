import { nextDayStart, scheduledTime } from '@/lib/doses';
import type { DoseEvent, PatientPrescription } from '@/lib/guardian';

/*
 * Turns the guardian feed's raw rows into "how is today going" for one patient.
 * Times are worked out in the guardian's time zone, so a patient in another zone shows shifted
 * due times (the server doesn't store the patient's zone yet).
 */

/** `unlogged`: the time has passed and nothing was recorded. `upcoming`: not due yet. */
export type DoseState = 'taken' | 'skipped' | 'missed' | 'unlogged' | 'upcoming';

export type TodayRow = {
  prescription: PatientPrescription;
  scheduledAt: number;
  state: DoseState;
  /** When the patient recorded the outcome; null if they haven't. */
  recordedAt: number | null;
};

export function todayRows(
  patientId: string,
  prescriptions: PatientPrescription[],
  doses: DoseEvent[],
  dayStart: number,
  now: number,
): TodayRow[] {
  const dayEnd = nextDayStart(dayStart);

  // Latest outcome per prescription today (a reminder time may have changed after an earlier log).
  const logged = new Map<string, DoseEvent>();
  for (const dose of doses) {
    if (dose.user_id !== patientId || dose.scheduled_at < dayStart || dose.scheduled_at >= dayEnd) continue;
    const prev = logged.get(dose.prescription_id);
    if (!prev || dose.recorded_at > prev.recorded_at) logged.set(dose.prescription_id, dose);
  }

  return prescriptions
    .filter((p) => p.user_id === patientId && p.reminder_enabled && p.reminder_minutes != null)
    .map((p): TodayRow => {
      const scheduledAt = scheduledTime(dayStart, p.reminder_minutes!);
      const event = logged.get(p.id);
      if (event) return { prescription: p, scheduledAt, state: event.status, recordedAt: event.recorded_at };
      return { prescription: p, scheduledAt, state: now > scheduledAt ? 'unlogged' : 'upcoming', recordedAt: null };
    })
    .sort((a, b) => a.scheduledAt - b.scheduledAt);
}

export function countStates(rows: TodayRow[]) {
  const counts: Record<DoseState, number> = { taken: 0, skipped: 0, missed: 0, unlogged: 0, upcoming: 0 };
  for (const row of rows) counts[row.state] += 1;
  return counts;
}

/** Whether a patient's day needs the guardian's attention. */
export function needsAttention(rows: TodayRow[]) {
  return rows.some((r) => r.state === 'missed' || r.state === 'skipped' || r.state === 'unlogged');
}

export const STATE_LABEL: Record<DoseState, string> = {
  taken: 'Taken',
  skipped: 'Skipped',
  missed: 'Missed',
  unlogged: 'Not logged yet',
  upcoming: 'Upcoming',
};

/** NativeWind classes for a state's badge. */
export function formatTime(ms: number) {
  return new Date(ms).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}
