import { Stack } from 'expo-router';

import { useStackScreenOptions } from '@/theme/navigation';

export default function ProfileLayout() {
  const options = useStackScreenOptions();
  return (
    <Stack screenOptions={options}>
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="guardian/index" options={{ title: 'People You Look After' }} />
      <Stack.Screen name="guardian/patient/[id]" options={{ title: 'Patient' }} />
      <Stack.Screen name="guardian/link" options={{ title: 'Add a Patient', presentation: 'modal' }} />
    </Stack>
  );
}
