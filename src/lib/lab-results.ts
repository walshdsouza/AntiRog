import { Q, type Database, type Model } from '@nozbe/watermelondb';

import { startOfDay } from '@/lib/doses';
import type { Biomarker, BiomarkerFlag, BiomarkerKey } from '@/lib/report-parser';
import { supabase } from '@/lib/supabase';
import { syncData } from '@/lib/sync';

/*
 * Saved lab results: biomarker readings the patient confirmed after a report was read on the phone.
 * Stored locally in WatermelonDB (works offline) and synced to Supabase public.lab_results. Only the
 * values are stored; the report image stays where it was.
 *
 * One reading per biomarker per report date: saving the same report twice (or a second report for
 * the same day) updates that day's values instead of adding duplicate points to the trend.
 */

// The model class is plain JS (database/LabResult.js); describe its fields here.
export type LabResultRecord = Model & {
  userId: string;
  biomarker: BiomarkerKey;
  value: number;
  value2: number | null;
  unit: string;
  flag: BiomarkerFlag;
  /** ms, local midnight of the report date. */
  measuredAt: number;
  reportName: string;
  createdAt: Date;
};

async function currentUserId() {
  // getSession() reads the session cached on the device, so this works offline.
  const { data } = await supabase.auth.getSession();
  const userId = data.session?.user.id;
  if (!userId) throw new Error('Sign in again to save lab results.');
  return userId;
}

/**
 * Saves the readings from one report, dated `measuredAt` (any time on the report day). Throws an
 * Error with a user-facing message. Returns how many readings were saved.
 */
export async function saveLabResults(
  database: Database,
  { biomarkers, measuredAt, reportName }: { biomarkers: Biomarker[]; measuredAt: number; reportName: string },
): Promise<number> {
  if (!biomarkers.length) throw new Error('There are no values to save.');
  const day = startOfDay(measuredAt);
  if (day > Date.now()) throw new Error('The report date can’t be in the future.');
  const userId = await currentUserId();
  const collection = database.get<LabResultRecord>('lab_results');

  await database.write(async () => {
    const existing = await collection
      .query(
        Q.where('measured_at', day),
        Q.where('biomarker', Q.oneOf(biomarkers.map((b) => b.key))),
      )
      .fetch();
    const byKey = new Map(existing.map((r) => [r.biomarker, r]));

    const assign = (r: LabResultRecord, b: Biomarker) => {
      r.value = b.value;
      r.value2 = b.value2 ?? null;
      r.unit = b.unit;
      r.flag = b.flag;
      r.reportName = reportName;
    };

    await database.batch(
      biomarkers.map((b) => {
        const current = byKey.get(b.key);
        if (current) return current.prepareUpdate((r) => assign(r, b));
        return collection.prepareCreate((r) => {
          r.userId = userId;
          r.biomarker = b.key;
          r.measuredAt = day;
          assign(r, b);
        });
      }),
    );
  });

  void syncData();
  return biomarkers.length;
}
