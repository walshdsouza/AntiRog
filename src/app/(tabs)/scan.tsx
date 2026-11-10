import { Link } from 'expo-router';
import { Pressable, ScrollView, Text } from 'react-native';
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
        <Link href="/pill-scanner" asChild>
          <Pressable
            accessibilityRole="button"
            accessibilityHint="Opens the camera to identify a loose pill on this device"
            className="mb-6 rounded-xl border border-gray-200 bg-gray-50 px-4 py-4 active:opacity-70 dark:border-gray-800 dark:bg-gray-900">
            <Text className="text-base font-semibold text-gray-900 dark:text-white">Identify a Pill</Text>
            <Text className="text-sm text-gray-600 dark:text-gray-400">
              Point your camera at a loose pill. Works offline; nothing leaves your phone.
            </Text>
          </Pressable>
        </Link>
        <ScanPrescription />
        <ManualEntryForm />
      </ScrollView>
    </SafeAreaView>
  );
}
