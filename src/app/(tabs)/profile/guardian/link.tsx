import { useRouter } from 'expo-router';
import { ScrollView, Text } from 'react-native';

import { LinkPatientForm } from '@/components/link-patient-form';
import { Card } from '@/components/neu';

export default function LinkPatientScreen() {
  const router = useRouter();

  return (
    <ScrollView
      className="flex-1 bg-canvas dark:bg-canvas-dark"
      contentContainerClassName="gap-5 px-5 py-6"
      keyboardShouldPersistTaps="handled"
      contentInsetAdjustmentBehavior="automatic">
      <Text className="text-base text-muted dark:text-muted-dark">
        Ask the person you look after to open Profile › Guardians › Invite a Guardian, then enter the code they
        give you.
      </Text>
      {/* The new patient shows up on the feed right away. */}
      <Card className="px-4 py-5">
        <LinkPatientForm onLinked={() => router.back()} />
      </Card>
    </ScrollView>
  );
}
