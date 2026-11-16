import { Q } from '@nozbe/watermelondb';
import { useDatabase } from '@nozbe/watermelondb/react';
import { useEffect, useState } from 'react';

import type { LabResultRecord } from '@/lib/lab-results';
import type { BiomarkerFlag, BiomarkerKey } from '@/lib/report-parser';

// Observables emit the same model instances on change; snapshot the fields so React re-renders.
export type LabReading = {
  id: string;
  value: number;
  value2: number | null;
  unit: string;
  flag: BiomarkerFlag;
  /** ms, local midnight of the report date. */
  measuredAt: number;
  reportName: string;
};

/**
 * Saved readings for one biomarker, oldest first. Live: updates on local and synced changes.
 * `undefined` while loading.
 */
export function useLabResults(biomarker: BiomarkerKey) {
  const database = useDatabase();
  // Tagged with the biomarker so a switch shows "loading" instead of the previous biomarker's data.
  const [state, setState] = useState<{ biomarker: BiomarkerKey; readings: LabReading[] } | undefined>(undefined);

  useEffect(() => {
    const subscription = database
      .get<LabResultRecord>('lab_results')
      .query(Q.where('biomarker', biomarker), Q.sortBy('measured_at', Q.asc))
      .observeWithColumns(['value', 'value2', 'unit', 'flag', 'measured_at', 'report_name'])
      .subscribe((records) => {
        setState({
          biomarker,
          readings: records.map((r) => ({
            id: r.id,
            value: r.value,
            value2: r.value2 ?? null,
            unit: r.unit,
            flag: r.flag,
            measuredAt: r.measuredAt,
            reportName: r.reportName,
          })),
        });
      });
    return () => subscription.unsubscribe();
  }, [database, biomarker]);

  return state?.biomarker === biomarker ? state.readings : undefined;
}
