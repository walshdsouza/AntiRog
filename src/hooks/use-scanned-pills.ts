import { Q } from '@nozbe/watermelondb';
import { useDatabase } from '@nozbe/watermelondb/react';
import { useEffect, useState } from 'react';

import type { ScannedPillRecord } from '@/lib/scanned-pills';

// Observables emit the same model instances on change; snapshot the fields so React re-renders.
export type ScannedPill = {
  id: string;
  name: string;
  label: string;
  drug: string;
  confidence: number;
  scannedAt: number;
};

/**
 * The most recently identified pills, newest first. Live: updates on local and synced changes.
 * `undefined` while loading.
 */
export function useScannedPills(limit = 50) {
  const database = useDatabase();
  const [pills, setPills] = useState<ScannedPill[] | undefined>(undefined);

  useEffect(() => {
    const subscription = database
      .get<ScannedPillRecord>('scanned_pills')
      .query(Q.sortBy('scanned_at', Q.desc), Q.take(limit))
      .observeWithColumns(['name', 'confidence', 'scanned_at'])
      .subscribe((records) => {
        setPills(
          records.map((r) => ({
            id: r.id,
            name: r.name,
            label: r.label,
            drug: r.drug,
            confidence: r.confidence,
            scannedAt: r.scannedAt,
          })),
        );
      });
    return () => subscription.unsubscribe();
  }, [database, limit]);

  return pills;
}
