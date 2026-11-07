import { useDatabase } from '@nozbe/watermelondb/react';
import type { Database } from '@nozbe/watermelondb';
import { useEffect } from 'react';
import { AppState } from 'react-native';

import { ensureInteractionTable, matchPrescriptions } from '@/lib/interactions';
import { syncData } from '@/lib/sync';

/**
 * Seeds the interaction table, matches prescriptions to standard drug names, and syncs. Runs once
 * when mounted and again every time the app returns to the foreground.
 */
let inFlight: Promise<void> | null = null;

function refresh(database: Database) {
  // Overlapping runs could seed the table twice, so share the one already running.
  inFlight ??= runRefresh(database).finally(() => {
    inFlight = null;
  });
  return inFlight;
}

async function runRefresh(database: Database) {
  try {
    await ensureInteractionTable(database);
    await matchPrescriptions(database);
    await syncData();
    // Records pulled from other devices may need matching too; push those results right away.
    if (await matchPrescriptions(database)) await syncData();
  } catch (e) {
    console.log('[refresh] Failed:', e instanceof Error ? e.message : e);
  }
}

export function useAutoSync() {
  const database = useDatabase();

  useEffect(() => {
    void refresh(database);
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') void refresh(database);
    });
    return () => subscription.remove();
  }, [database]);
}
