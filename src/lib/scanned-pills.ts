import type { Database, Model } from '@nozbe/watermelondb';

import { supabase } from '@/lib/supabase';
import { syncData } from '@/lib/sync';

/*
 * Pill history: every pill the scanner locks onto is logged here (name, confidence, date), stored in
 * WatermelonDB (works offline) and synced to Supabase public.scanned_pills. Camera frames are never
 * stored; only the result.
 */

// The model class is plain JS (database/ScannedPill.js); describe its fields here.
export type ScannedPillRecord = Model & {
  userId: string;
  /** Display name: the medication's name, or the model's label when it isn't a known medication. */
  name: string;
  /** The model's raw class label. */
  label: string;
  /** Standard drug name, '' when the label isn't a medication AntiRog knows. */
  drug: string;
  /** 0..1 */
  confidence: number;
  /** ms */
  scannedAt: number;
};

/**
 * Logs one identification. Never throws: the history is a convenience and must not interrupt the
 * scanner (for example when signed out).
 */
export async function recordScannedPill(
  database: Database,
  { name, label, drug, confidence }: { name: string; label: string; drug: string; confidence: number },
) {
  try {
    // getSession() reads the session cached on the device, so this works offline.
    const { data } = await supabase.auth.getSession();
    const userId = data.session?.user.id;
    if (!userId) return;

    await database.write(() =>
      database.get<ScannedPillRecord>('scanned_pills').create((r) => {
        r.userId = userId;
        r.name = name;
        r.label = label;
        r.drug = drug;
        r.confidence = Math.min(1, Math.max(0, confidence));
        r.scannedAt = Date.now();
      }),
    );
    void syncData();
  } catch (e) {
    console.log('[scanned-pills] Could not save scan:', e instanceof Error ? e.message : e);
  }
}
