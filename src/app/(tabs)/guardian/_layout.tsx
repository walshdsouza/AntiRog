import { Stack } from 'expo-router';

export default function GuardianLayout() {
  return (
    <Stack>
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="patient/[id]" options={{ title: 'Patient' }} />
      <Stack.Screen name="link" options={{ title: 'Add a Patient', presentation: 'modal' }} />
    </Stack>
  );
}
