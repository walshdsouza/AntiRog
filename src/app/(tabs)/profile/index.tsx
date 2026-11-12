import { useDatabase } from '@nozbe/watermelondb/react';
import { hasUnsyncedChanges } from '@nozbe/watermelondb/sync';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, Text, View } from 'react-native';

import { ConnectionPill } from '@/components/guardian-ui';
import { GuardianSharing } from '@/components/guardian-sharing';
import { Badge, Card, Chevron, NeuButton, Note, PressableCard, Screen, SectionTitle, Segmented } from '@/components/neu';
import { useGuardian } from '@/hooks/use-guardian-context';
import { useSession } from '@/hooks/use-session';
import { useThemePreference, type ThemePreference } from '@/hooks/use-theme-preference';
import { useDayStart, useNow } from '@/hooks/use-todays-doses';
import { needsAttention, todayRows } from '@/lib/guardian-status';
import { signOutAndClear } from '@/lib/local-data';
import { syncData } from '@/lib/sync';

const THEME_OPTIONS: { value: ThemePreference; label: string }[] = [
  { value: 'system', label: 'System' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
];

export default function ProfileScreen() {
  const session = useSession();
  const database = useDatabase();
  const { preference, setPreference } = useThemePreference();
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

  // Signing out deletes this phone's data, so back it up first and warn if that fails.
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
      'Some changes on this phone have not synced to your account yet, probably because you are offline. Signing out removes your data from this phone, and those changes will be lost.',
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
    <Screen title="Profile">
      <Card>
        <Text className="text-sm text-muted dark:text-muted-dark">Signed in as</Text>
        <Text selectable className="text-base font-semibold text-ink dark:text-ink-dark">
          {session?.user.email ?? 'Unknown account'}
        </Text>
      </Card>

      <View className="gap-3">
        <SectionTitle>Appearance</SectionTitle>
        <Segmented
          options={THEME_OPTIONS}
          value={preference}
          onChange={setPreference}
          accessibilityLabel="Appearance"
        />
      </View>

      <GuardianSharing />

      <LookAfterEntry />

      <View className="gap-3">
        <SectionTitle>Sync</SectionTitle>
        <Note>Your medications and visits sync automatically when you open the app. You can also sync now.</Note>
        <NeuButton title="Sync Now" loading={syncing} onPress={sync} />
        <Text accessibilityLiveRegion="polite" className="min-h-5 px-1 text-sm text-muted dark:text-muted-dark">
          {syncMessage ?? ' '}
        </Text>
      </View>

      <View className="gap-3">
        <NeuButton title="Sign Out" variant="danger" loading={signingOut} onPress={confirmSignOut} />
        <Note>
          Signing out removes your medications, visits and their documents from this phone. Records stay backed
          up in your account; document files are kept only on the phone that attached them.
        </Note>
      </View>
    </Screen>
  );
}

/** Entry to the guardian monitoring screens: who you look after and whether anyone needs attention. */
function LookAfterEntry() {
  const router = useRouter();
  const { links, loaded, prescriptions, doses, status } = useGuardian();
  const dayStart = useDayStart();
  const now = useNow();

  const attention = links.filter((link) =>
    needsAttention(todayRows(link.patient_id, prescriptions, doses, dayStart, now)),
  ).length;

  let detail = 'Follow a family member’s medications with their invite code.';
  if (!loaded) detail = 'Loading…';
  else if (links.length) {
    detail = `${links.length} ${links.length === 1 ? 'person' : 'people'}`;
    if (attention) detail += ` · ${attention} need${attention === 1 ? 's' : ''} attention`;
  }

  return (
    <View className="gap-3">
      <SectionTitle>Guardian monitoring</SectionTitle>
      <PressableCard
        tone={attention ? 'warning' : 'default'}
        accessibilityHint="Opens the people you look after"
        onPress={() => router.push('/profile/guardian')}>
        <View className="flex-row items-center gap-3">
          <View className="flex-1">
            <Text className="text-base font-semibold text-ink dark:text-ink-dark">People you look after</Text>
            <Text className="text-sm text-muted dark:text-muted-dark">{detail}</Text>
          </View>
          {links.length > 0 ? <ConnectionPill status={status} /> : <Badge label="Set up" />}
          <Chevron />
        </View>
      </PressableCard>
    </View>
  );
}
