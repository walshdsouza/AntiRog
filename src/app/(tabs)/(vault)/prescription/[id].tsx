import { useDatabase } from '@nozbe/watermelondb/react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, Text, View } from 'react-native';

import { DrugProfileCard } from '@/components/drug-profile-card';
import { deletePrescription, type PrescriptionRecord } from '@/lib/prescriptions';

// findAndObserve emits the same model instance on every change, and React skips re-rendering for an
// identical state value, so keep a fresh snapshot of the fields this screen shows.
type Snapshot = {
  record: PrescriptionRecord;
  medication: string;
  dosage: string;
  createdAt: Date;
  standardName: string;
  isHighRisk: boolean;
};

function snapshot(record: PrescriptionRecord): Snapshot {
  return {
    record,
    medication: record.medication,
    dosage: record.dosage,
    createdAt: record.createdAt,
    standardName: record.standardName ?? '',
    isHighRisk: !!record.isHighRisk,
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
      <View className="flex-1 items-center justify-center bg-white dark:bg-black">
        <ActivityIndicator />
      </View>
    );
  }

  if (item === null) {
    return (
      <View className="flex-1 items-center justify-center bg-white px-6 dark:bg-black">
        <Text className="text-center text-base text-gray-500 dark:text-gray-400">
          This prescription is no longer in your vault.
        </Text>
      </View>
    );
  }

  function confirmDelete({ record, medication }: Snapshot) {
    Alert.alert('Delete prescription?', `${medication} will be removed from your vault on all devices.`, [
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
      className="flex-1 bg-white dark:bg-black"
      contentContainerClassName="gap-6 p-6"
      contentInsetAdjustmentBehavior="automatic">
      <View>
        <Text selectable className="text-3xl font-bold text-gray-900 dark:text-white">
          {item.medication}
        </Text>
        <Text selectable className="mt-1 text-lg text-gray-600 dark:text-gray-400">
          {item.dosage}
        </Text>
        <Text className="mt-2 text-sm text-gray-500 dark:text-gray-400">
          Added {item.createdAt.toLocaleDateString(undefined, { dateStyle: 'medium' })}
        </Text>
      </View>

      <DrugProfileCard standardName={item.standardName} isHighRisk={item.isHighRisk} />

      <Pressable
        accessibilityRole="button"
        onPress={() => confirmDelete(item)}
        className="items-center rounded-xl border border-red-500 py-3.5 active:opacity-80">
        <Text className="text-base font-semibold text-red-500">Delete Prescription</Text>
      </Pressable>
    </ScrollView>
  );
}
