import { Stack } from 'expo-router';

import { useStackScreenOptions } from '@/theme/navigation';

export default function VisitsLayout() {
  const options = useStackScreenOptions();
  return (
    <Stack screenOptions={options}>
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="[id]" options={{ title: 'Visit' }} />
      {/* New visit, or edit one with ?id= */}
      <Stack.Screen name="edit" options={{ title: 'New Visit', presentation: 'modal' }} />
    </Stack>
  );
}
