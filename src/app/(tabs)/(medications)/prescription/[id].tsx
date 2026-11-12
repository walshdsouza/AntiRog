import { useDatabase } from '@nozbe/watermelondb/react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, ScrollView, Text, View } from 'react-native';

import { DoseLogCard } from '@/components/dose-log';
import { DrugProfileCard } from '@/components/drug-profile-card';
import { NeuButton, PressableCard, Spinner } from '@/components/neu';
import { ReminderCard } from '@/components/reminder-card';
import { deletePrescription, type PrescriptionRecord } from '@/lib/prescriptions';
import { formatVisitDate, visitTitle, type VisitRecord } from '@/lib/visits';

// findAndObserve emits the same model instance on every change, and React skips re-rendering for an
// identical state value, so keep a fresh snapshot of the fields this screen shows.
type Snapshot = {
  record: PrescriptionRecord;
  medication: string;
  dosage: string;
  createdAt: Date;
  standardName: string;
  isHighRisk: boolean;
  reminderEnabled: boolean;
  reminderMinutes: number | null;
  visitId: string | null;
};

function snapshot(record: PrescriptionRecord): Snapshot {
  return {
    record,
    medication: record.medication,
    dosage: record.dosage,
    createdAt: record.createdAt,
    standardName: record.standardName ?? '',
    isHighRisk: !!record.isHighRisk,
    reminderEnabled: !!record.reminderEnabled,
    reminderMinutes: record.reminderMinutes ?? null,
    visitId: record.visitId ?? null,
  };
}

export default function PrescriptionDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const database = useDatabase();
  const router = useRouter();
  // undefined = loading, null = not found (or deleted).
  const [item, setItem] = useState<Snapshot | null | undefined>(undefined);

  useEffect(() => {
    const subscription = database
      .get<PrescriptionRecord>('prescriptions')
      .findAndObserve(id)
      .subscribe({ next: (record) => setItem(snapshot(record)), error: () => setItem(null) });
    return () => subscription.unsubscribe();
  }, [database, id]);

  if (item === undefined) {
    return (
      <View className="flex-1 items-center justify-center bg-canvas dark:bg-canvas-dark">
        <Spinner />
      </View>
    );
  }

  if (item === null) {
    return (
      <View className="flex-1 items-center justify-center bg-canvas px-6 dark:bg-canvas-dark">
        <Text className="text-center text-base text-muted dark:text-muted-dark">
          This medication is no longer in your list.
        </Text>
      </View>
    );
  }

  function confirmDelete({ record, medication }: Snapshot) {
    Alert.alert('Delete medication?', `${medication} will be removed from your medications on all devices.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await deletePrescription(database, record);
            router.back();
          } catch (e) {
            Alert.alert('Could not delete', e instanceof Error ? e.message : 'Something went wrong.');
          }
        },
      },
    ]);
  }

  return (
    <ScrollView
      className="flex-1 bg-canvas dark:bg-canvas-dark"
      contentContainerClassName="gap-6 px-5 pb-10 pt-4"
      contentInsetAdjustmentBehavior="automatic">
      <View className="px-1">
        <Text selectable className="text-3xl font-bold text-ink dark:text-ink-dark">
          {item.medication}
        </Text>
        <Text selectable className="mt-1 text-lg text-muted dark:text-muted-dark">
          {item.dosage}
        </Text>
        <Text className="mt-2 text-sm text-muted dark:text-muted-dark">
          Added {item.createdAt.toLocaleDateString(undefined, { dateStyle: 'medium' })}
        </Text>
      </View>

      {item.visitId && <FromVisit visitId={item.visitId} />}

      <DoseLogCard prescriptionId={item.record.id} />

      <ReminderCard record={item.record} enabled={item.reminderEnabled} minutes={item.reminderMinutes} />

      <DrugProfileCard standardName={item.standardName} isHighRisk={item.isHighRisk} />

      <NeuButton title="Delete Medication" variant="danger" onPress={() => confirmDelete(item)} />
    </ScrollView>
  );
}

/** Link back to the visit this medication was added from. Hidden if the visit is gone. */
function FromVisit({ visitId }: { visitId: string }) {
  const database = useDatabase();
  const router = useRouter();
  const [visit, setVisit] = useState<{ title: string; date: number } | null>(null);

  useEffect(() => {
    const subscription = database
      .get<VisitRecord>('visits')
      .findAndObserve(visitId)
      .subscribe({
        next: (v) => setVisit({ title: visitTitle(v), date: v.visitedAt }),
        error: () => setVisit(null),
      });
    return () => subscription.unsubscribe();
  }, [database, visitId]);

  if (!visit) return null;
  return (
    <PressableCard
      accessibilityHint="Opens the visit this medication was added from"
      onPress={() => router.push({ pathname: '/visits/[id]', params: { id: visitId } })}>
      <Text className="text-xs uppercase tracking-wide text-muted dark:text-muted-dark">Added from visit</Text>
      <Text className="mt-1 text-base font-semibold text-ink dark:text-ink-dark">{visit.title}</Text>
      <Text className="text-sm text-muted dark:text-muted-dark">{formatVisitDate(visit.date)}</Text>
    </PressableCard>
  );
}
