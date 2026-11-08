import { useRouter } from 'expo-router';
import { ScrollView, Text } from 'react-native';

import { LinkPatientForm } from '@/components/link-patient-form';

export default function LinkPatientScreen() {
  const router = useRouter();

  return (
    <ScrollView
      className="flex-1 bg-white dark:bg-black"
      contentContainerClassName="gap-4 p-6"
      keyboardShouldPersistTaps="handled"
      contentInsetAdjustmentBehavior="automatic">
      <Text className="text-base text-gray-600 dark:text-gray-400">
        Ask the person you look after to open Profile → Guardians → Invite a Guardian, then enter the code they
        give you.
      </Text>
      {/* The new patient shows up on the feed right away. */}
      <LinkPatientForm onLinked={() => router.back()} />
    </ScrollView>
  );
}
