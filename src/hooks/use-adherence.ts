import { Q } from '@nozbe/watermelondb';
import { useDatabase } from '@nozbe/watermelondb/react';
import { useEffect, useState } from 'react';

import { useDayStart } from '@/hooks/use-todays-doses';
import { ADHERENCE_DAYS, computeAdherence, windowStart, type AdherenceSummary } from '@/lib/adherence';
import type { DoseEventRecord } from '@/lib/doses';
import type { PrescriptionRecord } from '@/lib/prescriptions';

/**
 * Live adherence for the last `days` days (today included), from the local dose log. Recomputes on
 * local changes, synced changes, and when the day rolls over. `undefined` while loading.
 */
export function useAdherence(days = ADHERENCE_DAYS) {
  const database = useDatabase();
  const today = useDayStart();
  const [summary, setSummary] = useState<AdherenceSummary | undefined>(undefined);

  useEffect(() => {
    let prescriptions: PrescriptionRecord[] | undefined;
    let events: DoseEventRecord[] | undefined;

    const publish = () => {
      if (prescriptions && events) setSummary(computeAdherence(prescriptions, events, today, days));
    };

    const rxSubscription = database
      .get<PrescriptionRecord>('prescriptions')
      .query()
      .observeWithColumns(['medication', 'dosage', 'reminder_enabled', 'reminder_minutes'])
      .subscribe((records) => {
        prescriptions = records;
        publish();
      });

    const eventSubscription = database
      .get<DoseEventRecord>('dose_events')
      .query(Q.where('scheduled_at', Q.gte(windowStart(today, days))))
      .observeWithColumns(['status', 'recorded_at'])
      .subscribe((records) => {
        events = records;
        publish();
      });

    return () => {
      rxSubscription.unsubscribe();
      eventSubscription.unsubscribe();
    };
  }, [database, today, days]);

  return summary;
}
