import { useDatabase } from '@nozbe/watermelondb/react';
import { ScrollView, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { InteractionReport } from '@/components/interaction-report';

export default function InteractionsScreen() {
  const database = useDatabase();

  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-white dark:bg-black">
      <ScrollView contentContainerClassName="px-6 pb-6 pt-4" contentInsetAdjustmentBehavior="automatic">
        <Text className="mb-4 text-2xl font-bold text-gray-900 dark:text-white">Interactions</Text>
        <InteractionReport database={database} />
      </ScrollView>
    </SafeAreaView>
  );
}
