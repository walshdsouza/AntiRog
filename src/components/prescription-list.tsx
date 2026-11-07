import { Q, type Database, type Model } from '@nozbe/watermelondb';
import { withObservables } from '@nozbe/watermelondb/react';
import type { ReactElement } from 'react';
import { FlatList, Text, View } from 'react-native';

// The model classes are plain JS (database/Prescription.js), so describe the fields we read here.
type PrescriptionRow = Model & {
  medication: string;
  dosage: string;
};

function PrescriptionList({ prescriptions, header }: { prescriptions: Model[]; header?: ReactElement }) {
  return (
    <FlatList
      data={prescriptions as PrescriptionRow[]}
      keyExtractor={(item) => item.id}
      contentContainerClassName="gap-3 pb-6"
      keyboardShouldPersistTaps="handled"
      // Passed as an element (not a component) so the form inputs keep focus across renders.
      ListHeaderComponent={header}
      ListEmptyComponent={
        <Text className="mt-6 text-center text-gray-500 dark:text-gray-400">
          No prescriptions yet. Add one above.
        </Text>
      }
      renderItem={({ item }) => (
        <View className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 dark:border-gray-800 dark:bg-gray-900">
          <Text className="text-base font-semibold text-gray-900 dark:text-white">
            {item.medication}
          </Text>
          <Text className="text-sm text-gray-600 dark:text-gray-400">{item.dosage}</Text>
        </View>
      )}
    />
  );
}

// Re-renders whenever prescriptions are added, removed, or their medication/dosage change
// (including changes that arrive from a sync).
const enhance = withObservables([], ({ database }: { database: Database; header?: ReactElement }) => ({
  prescriptions: database
    .get('prescriptions')
    .query(Q.sortBy('created_at', Q.desc))
    .observeWithColumns(['medication', 'dosage']),
}));

export const ObservedPrescriptionList = enhance(PrescriptionList);
