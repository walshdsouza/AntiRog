import { useDatabase } from '@nozbe/watermelondb/react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, Text, View } from 'react-native';

import { deletePrescription, type PrescriptionRecord } from '@/lib/prescriptions';

export default function PrescriptionDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const database = useDatabase();
  const router = useRouter();
  // undefined = loading, null = not found (or deleted).
  const [record, setRecord] = useState<PrescriptionRecord | null | undefined>(undefined);

  useEffect(() => {
    const subscription = database
      .get<PrescriptionRecord>('prescriptions')
      .findAndObserve(id)
      .subscribe({ next: setRecord, error: () => setRecord(null) });
    return () => subscription.unsubscribe();
  }, [database, id]);

  if (record === undefined) {
    return (
      <View className="flex-1 items-center justify-center bg-white dark:bg-black">
        <ActivityIndicator />
      </View>
    );
  }

  if (record === null) {
    return (
      <View className="flex-1 items-center justify-center bg-white px-6 dark:bg-black">
        <Text className="text-center text-base text-gray-500 dark:text-gray-400">
          This prescription is no longer in your vault.
        </Text>
      </View>
    );
  }

  function confirmDelete(item: PrescriptionRecord) {
    Alert.alert('Delete prescription?', `${item.medication} will be removed from your vault on all devices.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await deletePrescription(database, item);
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
      contentContainerClassName="gap-4 p-6"
      contentInsetAdjustmentBehavior="automatic">
      <View>
        <Text selectable className="text-3xl font-bold text-gray-900 dark:text-white">
          {record.medication}
        </Text>
        <Text selectable className="mt-1 text-lg text-gray-600 dark:text-gray-400">
          {record.dosage}
        </Text>
      </View>

      <Text className="text-sm text-gray-500 dark:text-gray-400">
        Added {record.createdAt.toLocaleDateString(undefined, { dateStyle: 'medium' })}
      </Text>

      <View className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 dark:border-gray-800 dark:bg-gray-900">
        <Text className="text-sm text-gray-600 dark:text-gray-400">
          Side effects and warnings for this medication will appear here.
        </Text>
      </View>

      <Pressable
        accessibilityRole="button"
        onPress={() => confirmDelete(record)}
        className="mt-4 items-center rounded-xl border border-red-500 py-3.5 active:opacity-80">
        <Text className="text-base font-semibold text-red-500">Delete Prescription</Text>
      </Pressable>
    </ScrollView>
  );
}
