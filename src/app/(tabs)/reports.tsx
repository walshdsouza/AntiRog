import { useState } from 'react';

import { LabTestsReport } from '@/components/lab-tests-report';
import { MedicationReport } from '@/components/medication-report';
import { Screen, Segmented } from '@/components/neu';
import { useAdherence } from '@/hooks/use-adherence';
import { formatShortDate } from '@/lib/adherence';

/*
 * Reports: a segmented switch between Medications (30-day adherence + PDF export) and Tests
 * (on-device lab report reading). Everything is computed on the phone.
 */

type ReportView = 'medications' | 'tests';

const VIEWS: { value: ReportView; label: string }[] = [
  { value: 'medications', label: 'Medications' },
  { value: 'tests', label: 'Tests' },
];

export default function ReportsScreen() {
  const [view, setView] = useState<ReportView>('medications');
  // Loaded here so the header can show the adherence window while Medications is selected.
  const summary = useAdherence();

  const subtitle =
    view === 'tests'
      ? 'Checkups and lab results'
      : summary
        ? `${formatShortDate(summary.from)} – ${formatShortDate(summary.to)}`
        : 'Your health over time';

  return (
    <Screen title="Reports" subtitle={subtitle}>
      <Segmented options={VIEWS} value={view} onChange={setView} accessibilityLabel="Report type" />
      {view === 'medications' ? <MedicationReport summary={summary} /> : <LabTestsReport />}
    </Screen>
  );
}
