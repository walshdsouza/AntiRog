import { useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useSession } from '@/hooks/use-session';
import { supabase } from '@/lib/supabase';
import { syncData } from '@/lib/sync';

export default function ProfileScreen() {
  const session = useSession();
  const [syncing, setSyncing] = useState(false);
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

  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-white px-6 pt-4 dark:bg-black">
      <Text className="mb-4 text-2xl font-bold text-gray-900 dark:text-white">Profile</Text>

      <View className="mb-6 rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 dark:border-gray-800 dark:bg-gray-900">
        <Text className="text-sm text-gray-500 dark:text-gray-400">Signed in as</Text>
        <Text selectable className="text-base font-semibold text-gray-900 dark:text-white">
          {session?.user.email ?? 'Unknown account'}
        </Text>
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
        onPress={() => supabase.auth.signOut()}
        className="items-center rounded-xl border border-red-500 py-3.5 active:opacity-80">
        <Text className="text-base font-semibold text-red-500">Sign Out</Text>
      </Pressable>
    </SafeAreaView>
  );
}
