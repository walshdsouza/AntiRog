import { nextDayStart, scheduledTime, startOfDay, type DoseEventRecord } from '@/lib/doses';
import type { PrescriptionRecord } from '@/lib/prescriptions';

/*
 * Adherence over a window of days, built from the local dose log.
 *
 * Only outcomes the patient logged are stored (taken / skipped). A dose with no record is counted
 * as MISSED when its day is over, for every prescription that currently has a daily reminder and
 * already existed at that day's reminder time. Today's unlogged doses are "pending" and are left out
 * of the percentage, so the score doesn't drop every morning before the reminder fires.
 *
 * Known limit: reminder settings aren't versioned, so a reminder that was turned off later stops
 * producing missed doses for past days (its logged outcomes still count).
 */

export const ADHERENCE_DAYS = 30;

export type DoseOutcome = 'taken' | 'skipped' | 'missed';

export type Tally = { taken: number; skipped: number; missed: number };

export type DayAdherence = Tally & {
  /** Local midnight. */
  dayStart: number;
  /** Doses still to come today (not counted). */
  pending: number;
  /** 0-100, or null when nothing was due that day. */
  percent: number | null;
};

export type MedicationAdherence = Tally & {
  prescriptionId: string;
  medication: string;
  dosage: string;
  /** Minutes after midnight, or null when no reminder is set. */
  reminderMinutes: number | null;
  percent: number | null;
};

export type AdherenceSummary = Tally & {
  /** First day of the window (local midnight). */
  from: number;
  /** Last day of the window (local midnight, today). */
  to: number;
  percent: number | null;
  days: DayAdherence[];
  medications: MedicationAdherence[];
};

/** Local midnight `days` days before `dayStart` (calendar days, safe across daylight saving). */
export function addDays(dayStart: number, days: number) {
  const date = new Date(dayStart);
  date.setDate(date.getDate() + days);
  return date.getTime();
}

export function windowStart(today: number, days = ADHERENCE_DAYS) {
  return addDays(today, -(days - 1));
}

export function percentOf({ taken, skipped, missed }: Tally): number | null {
  const total = taken + skipped + missed;
  return total ? Math.round((taken / total) * 100) : null;
}

function normalize(status: string): DoseOutcome | null {
  return status === 'taken' || status === 'skipped' || status === 'missed' ? status : null;
}

/**
 * Builds the summary. `events` should cover the window; anything outside it is ignored.
 * `today` is local midnight of the current day.
 */
export function computeAdherence(
  prescriptions: PrescriptionRecord[],
  events: DoseEventRecord[],
  today: number = startOfDay(),
  dayCount = ADHERENCE_DAYS,
): AdherenceSummary {
  const from = windowStart(today, dayCount);
  const end = nextDayStart(today);

  // Day -> prescription -> outcome. One outcome per prescription per day; the most recently
  // recorded one wins (matches logDose).
  const outcomes = new Map<number, Map<string, { status: DoseOutcome; recordedAt: number }>>();
  for (const e of events) {
    if (e.scheduledAt < from || e.scheduledAt >= end) continue;
    const status = normalize(e.status);
    if (!status) continue;
    const day = startOfDay(e.scheduledAt);
    let byRx = outcomes.get(day);
    if (!byRx) outcomes.set(day, (byRx = new Map()));
    const prev = byRx.get(e.prescriptionId);
    if (!prev || e.recordedAt >= prev.recordedAt) byRx.set(e.prescriptionId, { status, recordedAt: e.recordedAt });
  }

  const scheduled = prescriptions.filter((p) => p.reminderEnabled && p.reminderMinutes != null);
  const perMed = new Map<string, Tally>(prescriptions.map((p) => [p.id, { taken: 0, skipped: 0, missed: 0 }]));
  const days: DayAdherence[] = [];

  for (let day = from; day < end; day = nextDayStart(day)) {
    const tally: DayAdherence = { dayStart: day, taken: 0, skipped: 0, missed: 0, pending: 0, percent: null };
    const logged = outcomes.get(day) ?? new Map();

    // Logged outcomes, including ones for medications that no longer have a reminder (or were removed).
    for (const [prescriptionId, { status }] of logged) {
      tally[status as DoseOutcome] += 1;
      const med = perMed.get(prescriptionId);
      if (med) med[status as DoseOutcome] += 1;
    }

    // Scheduled doses with nothing logged.
    for (const p of scheduled) {
      if (logged.has(p.id)) continue;
      const at = scheduledTime(day, p.reminderMinutes!);
      if (at < p.createdAt.getTime()) continue; // the medication wasn't added yet
      if (day === today) {
        tally.pending += 1;
        continue;
      }
      tally.missed += 1;
      perMed.get(p.id)!.missed += 1;
    }

    tally.percent = percentOf(tally);
    days.push(tally);
  }

  const totals = days.reduce<Tally>(
    (acc, d) => ({ taken: acc.taken + d.taken, skipped: acc.skipped + d.skipped, missed: acc.missed + d.missed }),
    { taken: 0, skipped: 0, missed: 0 },
  );

  const medications = prescriptions
    .map((p): MedicationAdherence => {
      const t = perMed.get(p.id)!;
      return {
        prescriptionId: p.id,
        medication: p.medication,
        dosage: p.dosage,
        reminderMinutes: p.reminderEnabled ? p.reminderMinutes : null,
        ...t,
        percent: percentOf(t),
      };
    })
    .sort((a, b) => a.medication.localeCompare(b.medication));

  return { from, to: today, ...totals, percent: percentOf(totals), days, medications };
}

export function formatShortDate(ms: number) {
  return new Date(ms).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}

/** Status color for an adherence percentage (in-app chart and PDF use the same thresholds). */
export function adherenceTone(percent: number | null): 'success' | 'warning' | 'danger' | 'none' {
  if (percent == null) return 'none';
  if (percent >= 80) return 'success';
  if (percent >= 50) return 'warning';
  return 'danger';
}
