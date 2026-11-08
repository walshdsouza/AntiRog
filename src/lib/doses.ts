import { Q, type Database, type Model } from '@nozbe/watermelondb';

import type { PrescriptionRecord } from '@/lib/prescriptions';
import { supabase } from '@/lib/supabase';
import { syncData } from '@/lib/sync';

/*
 * Dose logging (Step 4.2). Each prescription with a daily reminder has one scheduled dose per day,
 * at its reminder time. The patient records it as taken or skipped; the record is saved locally
 * (works offline) and pushed to Supabase public.dose_events, which guardians receive over Realtime.
 */

export type LoggableDoseStatus = 'taken' | 'skipped';

// The model class is plain JS (database/DoseEvent.js), so describe its fields here.
export type DoseEventRecord = Model & {
  prescriptionId: string;
  userId: string;
  /** ms */
  scheduledAt: number;
  /** 'taken' | 'skipped', or 'missed' if the server ever records one. */
  status: string;
  /** ms */
  recordedAt: number;
};

export const DAY_MS = 24 * 60 * 60 * 1000;

/** Local midnight at the start of the day containing `at`. */
export function startOfDay(at: number = Date.now()) {
  const date = new Date(at);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
}

/** Next local midnight after `dayStart`. Not always 24 hours later (daylight saving time). */
export function nextDayStart(dayStart: number) {
  const date = new Date(dayStart);
  date.setDate(date.getDate() + 1);
  return date.getTime();
}

/** The dose's time on the given day, from minutes after local midnight. */
export function scheduledTime(dayStart: number, minutes: number) {
  const date = new Date(dayStart);
  date.setHours(Math.floor(minutes / 60), minutes % 60, 0, 0);
  return date.getTime();
}

/** One id per dose, so the same dose logged on two devices ends up as one record (and one server row). */
function doseId(prescriptionId: string, scheduledAt: number) {
  return `${prescriptionId}_${scheduledAt}`;
}

async function currentUserId() {
  // getSession() reads the session cached on the device, so this works offline.
  const { data } = await supabase.auth.getSession();
  return data.session?.user.id ?? '';
}

/**
 * Records the outcome of a prescription's dose for the day starting at `dayStart`. If that day's
 * dose was already logged (even at an earlier reminder time), its outcome is changed instead.
 */
export async function logDose(
  database: Database,
  {
    prescription,
    dayStart,
    status,
  }: { prescription: PrescriptionRecord; dayStart: number; status: LoggableDoseStatus },
) {
  if (!prescription.reminderEnabled || prescription.reminderMinutes == null) {
    throw new Error('Turn on a daily reminder for this medication to log its doses.');
  }
  const scheduledAt = scheduledTime(dayStart, prescription.reminderMinutes);
  const userId = prescription.userId || (await currentUserId());
  const collection = database.get<DoseEventRecord>('dose_events');

  await database.write(async () => {
    const existing = await collection
      .query(
        Q.where('prescription_id', prescription.id),
        Q.where('scheduled_at', Q.gte(dayStart)),
        Q.where('scheduled_at', Q.lt(nextDayStart(dayStart))),
        // Matches what the UI shows if the reminder time changed after an earlier log.
        Q.sortBy('recorded_at', Q.desc),
      )
      .fetch();

    if (existing.length) {
      await existing[0].update((r) => {
        r.status = status;
        r.recordedAt = Date.now();
      });
      return;
    }

    await collection.create((r) => {
      r._raw.id = doseId(prescription.id, scheduledAt);
      r.prescriptionId = prescription.id;
      r.userId = userId;
      r.scheduledAt = scheduledAt;
      r.status = status;
      r.recordedAt = Date.now();
    });
  });

  // Push right away so guardians hear about it; offline, it stays queued until the next sync.
  void syncData();
}
