import { useDatabase } from '@nozbe/watermelondb/react';
import { Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ObservedPrescriptionList } from '@/components/prescription-list';

export default function VaultScreen() {
  const database = useDatabase();

  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-white px-6 pt-4 dark:bg-black">
      <ObservedPrescriptionList
        database={database}
        header={<Text className="mb-4 text-2xl font-bold text-gray-900 dark:text-white">Vault</Text>}
      />
    </SafeAreaView>
  );
}
