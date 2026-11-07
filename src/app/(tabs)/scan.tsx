import { ScrollView, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ManualEntryForm } from '@/components/manual-entry-form';
import { ScanPrescription } from '@/components/scan-prescription';

export default function ScanScreen() {
  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-white dark:bg-black">
      <ScrollView
        contentContainerClassName="px-6 pb-6 pt-4"
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets>
        <Text className="mb-4 text-2xl font-bold text-gray-900 dark:text-white">Scan</Text>
        <ScanPrescription />
        <ManualEntryForm />
      </ScrollView>
    </SafeAreaView>
  );
}
