import '../../global.css';

import { DatabaseProvider } from '@nozbe/watermelondb/DatabaseProvider';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useColorScheme } from 'react-native';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import { SessionProvider, useSession } from '@/hooks/use-session';
import { configureNotifications } from '@/lib/reminders';
import { database } from '../../database';

// Keep the native splash up until we know whether the user is signed in.
SplashScreen.preventAutoHideAsync();
configureNotifications();

export default function RootLayout() {
  const colorScheme = useColorScheme();
  return (
    <DatabaseProvider database={database}>
      <SessionProvider>
        <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
          <RootNavigator />
        </ThemeProvider>
      </SessionProvider>
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
