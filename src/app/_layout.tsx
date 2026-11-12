import '../../global.css';

import { DatabaseProvider } from '@nozbe/watermelondb/DatabaseProvider';
import { Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useColorScheme } from 'react-native';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import { SessionProvider, useSession } from '@/hooks/use-session';
import { ThemePreferenceProvider } from '@/hooks/use-theme-preference';
import { configureNotifications } from '@/lib/reminders';
import { NAV_THEME } from '@/theme/navigation';
import { database } from '../../database';

// Keep the native splash up until we know whether the user is signed in.
SplashScreen.preventAutoHideAsync();
configureNotifications();

export default function RootLayout() {
  const colorScheme = useColorScheme();
  return (
    <DatabaseProvider database={database}>
      <ThemePreferenceProvider>
        <SessionProvider>
          <ThemeProvider value={NAV_THEME[colorScheme === 'dark' ? 'dark' : 'light']}>
            <RootNavigator />
          </ThemeProvider>
        </SessionProvider>
      </ThemePreferenceProvider>
    </DatabaseProvider>
  );
}

function RootNavigator() {
  const session = useSession();
  const signedIn = !!session;

  return (
    <>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Protected guard={signedIn}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="pill-scanner" options={{ presentation: 'fullScreenModal', animation: 'slide_from_bottom' }} />
          <Stack.Screen name="report-scanner" options={{ presentation: 'fullScreenModal', animation: 'slide_from_bottom' }} />
          {/* Add a medication by hand or from a prescription photo; ?visitId= links it to a visit. */}
          <Stack.Screen name="add-medication" options={{ presentation: 'modal' }} />
        </Stack.Protected>
        <Stack.Protected guard={!signedIn}>
          <Stack.Screen name="sign-in" />
        </Stack.Protected>
      </Stack>
      {/* The overlay hides the native splash, so mount it only once the session has loaded. */}
      {session !== undefined && <AnimatedSplashOverlay />}
    </>
  );
}
