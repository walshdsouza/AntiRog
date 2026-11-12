import { Stack } from 'expo-router';

import { useStackScreenOptions } from '@/theme/navigation';

export default function MedicationsLayout() {
  const options = useStackScreenOptions();
  return (
    <Stack screenOptions={options}>
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="prescription/[id]" options={{ title: 'Medication' }} />
    </Stack>
  );
}
