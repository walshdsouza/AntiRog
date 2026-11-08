import { useDatabase } from '@nozbe/watermelondb/react';
import { hasUnsyncedChanges } from '@nozbe/watermelondb/sync';
import { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { GuardianSharing } from '@/components/guardian-sharing';
import { useSession } from '@/hooks/use-session';
import { signOutAndClear } from '@/lib/local-data';
import { syncData } from '@/lib/sync';

export default function ProfileScreen() {
  const session = useSession();
  const database = useDatabase();
  const [syncing, setSyncing] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);

  async function sync() {
    setSyncing(true);
    setSyncMessage(null);
    const result = await syncData();
    setSyncing(false);
    if (result.ok) setSyncMessage('Synced just now.');
    else if (result.offline) setSyncMessage('You are offline. Your changes are saved and will sync later.');
    else if (result.skipped) setSyncMessage('Sign in to sync.');
    else setSyncMessage(`Sync failed: ${result.error instanceof Error ? result.error.message : 'unknown error'}`);
  }

  async function signOut() {
    try {
      await signOutAndClear();
    } catch (e) {
      setSigningOut(false);
      Alert.alert('Could not sign out', e instanceof Error ? e.message : 'Something went wrong.');
    }
  }

  // Signing out deletes the vault from this phone, so back it up first and warn if that fails.
  async function confirmSignOut() {
    setSigningOut(true);
    await syncData();
    let unsynced = true;
    try {
      unsynced = await hasUnsyncedChanges({ database });
    } catch {
      // Assume the worst and warn.
    }
    if (!unsynced) {
      await signOut();
      return;
    }
    setSigningOut(false);
    Alert.alert(
      'Changes not backed up',
      'Some changes on this phone have not synced to your account yet, probably because you are offline. Signing out removes your vault from this phone, and those changes will be lost.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign Out Anyway',
          style: 'destructive',
          onPress: () => {
            setSigningOut(true);
            void signOut();
          },
        },
      ],
    );
  }

  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-white dark:bg-black">
      <ScrollView contentContainerClassName="px-6 pb-6 pt-4" contentInsetAdjustmentBehavior="automatic">
        <Text className="mb-4 text-2xl font-bold text-gray-900 dark:text-white">Profile</Text>

        <View className="mb-6 rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 dark:border-gray-800 dark:bg-gray-900">
          <Text className="text-sm text-gray-500 dark:text-gray-400">Signed in as</Text>
          <Text selectable className="text-base font-semibold text-gray-900 dark:text-white">
            {session?.user.email ?? 'Unknown account'}
          </Text>
        </View>

        <View className="mb-6">
          <GuardianSharing />
        </View>

        <Text className="mb-1 text-lg font-semibold text-gray-900 dark:text-white">Sync</Text>
        <Text className="mb-3 text-sm text-gray-500 dark:text-gray-400">
          Your vault syncs automatically when you open the app. You can also sync now.
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ busy: syncing, disabled: syncing }}
          disabled={syncing}
          onPress={sync}
          className={`items-center rounded-xl border border-blue-500 py-3.5 active:opacity-80 ${syncing ? 'opacity-60' : ''}`}>
          {syncing ? (
            <ActivityIndicator color="#3b82f6" />
          ) : (
            <Text className="text-base font-semibold text-blue-500">Sync Now</Text>
          )}
        </Pressable>
        <Text accessibilityLiveRegion="polite" className="mb-6 mt-2 min-h-5 text-sm text-gray-500 dark:text-gray-400">
          {syncMessage ?? ' '}
        </Text>

        <Pressable
          accessibilityRole="button"
          accessibilityState={{ busy: signingOut, disabled: signingOut }}
          disabled={signingOut}
          onPress={confirmSignOut}
          className={`items-center rounded-xl border border-red-500 py-3.5 active:opacity-80 ${signingOut ? 'opacity-60' : ''}`}>
          {signingOut ? (
            <ActivityIndicator color="#ef4444" />
          ) : (
            <Text className="text-base font-semibold text-red-500">Sign Out</Text>
          )}
        </Pressable>
        <Text className="mt-2 text-sm text-gray-500 dark:text-gray-400">
          Signing out removes your vault from this phone. It stays backed up in your account.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}
