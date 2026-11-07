import { Q, type Database } from '@nozbe/watermelondb';
import { withObservables } from '@nozbe/watermelondb/react';
import { Link } from 'expo-router';
import type { ReactElement } from 'react';
import { FlatList, Pressable, Text } from 'react-native';

import type { PrescriptionRecord } from '@/lib/prescriptions';

function PrescriptionList({
  prescriptions,
  header,
}: {
  prescriptions: PrescriptionRecord[];
  header?: ReactElement;
}) {
  return (
    <FlatList
      data={prescriptions}
      keyExtractor={(item) => item.id}
      contentContainerClassName="gap-3 pb-6"
      contentInsetAdjustmentBehavior="automatic"
      keyboardShouldPersistTaps="handled"
      ListHeaderComponent={header}
      ListEmptyComponent={
        <Text className="mt-6 text-center text-gray-500 dark:text-gray-400">
          No prescriptions yet. Scan or add one from the Scan tab.
        </Text>
      }
      renderItem={({ item }) => (
        <Link href={{ pathname: '/prescription/[id]', params: { id: item.id } }} asChild>
          <Pressable
            accessibilityRole="button"
            accessibilityHint="Opens prescription details"
            className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 active:opacity-70 dark:border-gray-800 dark:bg-gray-900">
            <Text className="text-base font-semibold text-gray-900 dark:text-white">{item.medication}</Text>
            <Text className="text-sm text-gray-600 dark:text-gray-400">{item.dosage}</Text>
          </Pressable>
        </Link>
      )}
    />
  );
}

// Re-renders whenever prescriptions are added, removed, or their medication/dosage change
// (including changes that arrive from a sync).
const enhance = withObservables([], ({ database }: { database: Database; header?: ReactElement }) => ({
  prescriptions: database
    .get<PrescriptionRecord>('prescriptions')
    .query(Q.sortBy('created_at', Q.desc))
    .observeWithColumns(['medication', 'dosage']),
}));

export const ObservedPrescriptionList = enhance(PrescriptionList);
