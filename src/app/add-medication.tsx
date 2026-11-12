import { useDatabase } from '@nozbe/watermelondb/react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Text } from 'react-native';

import { ManualEntryForm } from '@/components/manual-entry-form';
import { Card, NeuButton, Note, Screen } from '@/components/neu';
import { ScanPrescription } from '@/components/scan-prescription';
import { formatVisitDate, visitTitle, type VisitRecord } from '@/lib/visits';

/**
 * Add a medication by hand or from a prescription photo. Opened from Medications, or from a visit
 * with ?visitId=, in which case everything saved here is linked to that visit.
 */
export default function AddMedicationScreen() {
  const router = useRouter();
  const database = useDatabase();
  const { visitId } = useLocalSearchParams<{ visitId?: string }>();
  const [visit, setVisit] = useState<string | null>(null);

  useEffect(() => {
    if (!visitId) return;
    let active = true;
    database
      .get<VisitRecord>('visits')
      .find(visitId)
      .then((v) => active && setVisit(`${visitTitle(v)} · ${formatVisitDate(v.visitedAt)}`))
      .catch(() => active && setVisit(null));
    return () => {
      active = false;
    };
  }, [database, visitId]);

  return (
    <Screen
      title="Add Medication"
      edges={['top', 'bottom']}
      right={<NeuButton size="sm" title="Done" onPress={() => router.back()} />}>
      {visitId && visit && (
        <Card tone="accent">
          <Text className="text-xs uppercase tracking-wide text-accent dark:text-accent-dark">From visit</Text>
          <Text className="mt-1 text-base font-semibold text-ink dark:text-ink-dark">{visit}</Text>
        </Card>
      )}
      <ScanPrescription visitId={visitId} />
      <ManualEntryForm visitId={visitId} />
      <Note>Medications you add are checked against each other in Medications › Interactions.</Note>
    </Screen>
  );
}
