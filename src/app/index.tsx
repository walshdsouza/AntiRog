import { ActivityIndicator, View } from 'react-native';

import { AuthScreen } from '@/components/auth-screen';
import { PrescriptionsScreen } from '@/components/prescriptions-screen';
import { useSession } from '@/hooks/use-session';

export default function HomeScreen() {
  const session = useSession();

  // Still reading the stored session from the device.
  if (session === undefined) {
    return (
      <View className="flex-1 items-center justify-center bg-white dark:bg-black">
        <ActivityIndicator />
      </View>
    );
  }

  return session ? <PrescriptionsScreen /> : <AuthScreen />;
}
