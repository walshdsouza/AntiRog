import { Pressable, Text, View } from 'react-native';

/** VisionCamera and TFLite are native-only; the web build gets a notice instead. */
export function PillScanner({ onClose }: { onClose: () => void; onDoseLogged?: () => void }) {
  return (
    <View className="flex-1 items-center justify-center gap-4 bg-white px-6 dark:bg-black">
      <Text className="text-center text-base text-gray-600 dark:text-gray-400">
        Pill identification runs on your phone&apos;s hardware. Open AntiRog on iOS or Android to use it.
      </Text>
      <Pressable accessibilityRole="button" onPress={onClose} className="active:opacity-70">
        <Text className="text-base font-semibold text-blue-500">Close</Text>
      </Pressable>
    </View>
  );
}
