import { Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function InteractionsScreen() {
  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-white px-6 pt-4 dark:bg-black">
      <Text className="mb-4 text-2xl font-bold text-gray-900 dark:text-white">Interactions</Text>
      <View className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-4 dark:border-gray-800 dark:bg-gray-900">
        <Text className="text-base font-semibold text-gray-900 dark:text-white">Coming soon</Text>
        <Text className="mt-1 text-sm text-gray-600 dark:text-gray-400">
          AntiRog will check the medications in your vault against a built-in list of high-risk
          combinations and foods to avoid. The checks run on your device, so they work offline.
        </Text>
      </View>
    </SafeAreaView>
  );
}
