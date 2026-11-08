import { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, Share, Text, View } from 'react-native';

import { useNow } from '@/hooks/use-todays-doses';
import { usePatientGuardians } from '@/hooks/use-patient-guardians';
import { formatInviteCode, friendlyError, guardianLabel, type GuardianInvite, type GuardianLink } from '@/lib/guardian';

function formatExpiry(iso: string) {
  return new Date(iso).toLocaleString([], { weekday: 'short', hour: 'numeric', minute: '2-digit' });
}

/** Profile section: invite a guardian with a one-time code, and see or remove linked guardians. */
export function GuardianSharing() {
  const { guardians, invite, error, reload, createInvite, cancelInvite, removeGuardian } = usePatientGuardians();
  const now = useNow();
  const [busy, setBusy] = useState(false);

  const liveInvite = invite && Date.parse(invite.expires_at) > now ? invite : null;

  async function run(task: () => Promise<unknown>, failTitle: string) {
    if (busy) return;
    setBusy(true);
    try {
      await task();
    } catch (e) {
      Alert.alert(failTitle, friendlyError(e));
    } finally {
      setBusy(false);
    }
  }

  function confirmRemove(link: GuardianLink) {
    Alert.alert(
      'Remove guardian?',
      `${guardianLabel(link)} will no longer see your prescriptions or doses.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => void run(() => removeGuardian(link.id), 'Could not remove guardian'),
        },
      ],
    );
  }

  return (
    <View className="gap-3">
      <View>
        <Text className="text-lg font-semibold text-gray-900 dark:text-white">Guardians</Text>
        <Text className="text-sm text-gray-500 dark:text-gray-400">
          A guardian can see your medications and whether you&apos;ve logged today&apos;s doses. They can&apos;t
          change anything.
        </Text>
      </View>

      {guardians === undefined && !error && <ActivityIndicator className="py-2" />}

      {error && (
        <Pressable accessibilityRole="button" onPress={reload} className="active:opacity-70">
          <Text className="text-sm text-red-600 dark:text-red-400">
            {friendlyError(error)} Tap to retry.
          </Text>
        </Pressable>
      )}

      {guardians?.map((link) => (
        <View
          key={link.id}
          className="flex-row items-center gap-3 rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 dark:border-gray-800 dark:bg-gray-900">
          <View className="flex-1">
            <Text selectable className="text-base font-semibold text-gray-900 dark:text-white">
              {guardianLabel(link)}
            </Text>
            <Text className="text-sm text-gray-500 dark:text-gray-400">
              Linked {new Date(link.created_at).toLocaleDateString(undefined, { dateStyle: 'medium' })}
            </Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Remove ${guardianLabel(link)}`}
            disabled={busy}
            onPress={() => confirmRemove(link)}
            hitSlop={8}
            className="active:opacity-60">
            <Text className="text-sm font-semibold text-red-500">Remove</Text>
          </Pressable>
        </View>
      ))}

      {liveInvite ? (
        <InviteCard
          invite={liveInvite}
          busy={busy}
          onNewCode={() => void run(createInvite, 'Could not create a code')}
          onCancel={() => void run(cancelInvite, 'Could not cancel the code')}
        />
      ) : (
        guardians !== undefined && (
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ busy, disabled: busy }}
            disabled={busy}
            onPress={() => void run(createInvite, 'Could not create a code')}
            className={`items-center rounded-xl border border-blue-500 py-3.5 active:opacity-80 ${busy ? 'opacity-60' : ''}`}>
            {busy ? (
              <ActivityIndicator color="#3b82f6" />
            ) : (
              <Text className="text-base font-semibold text-blue-500">Invite a Guardian</Text>
            )}
          </Pressable>
        )
      )}
    </View>
  );
}

function InviteCard({
  invite,
  busy,
  onNewCode,
  onCancel,
}: {
  invite: GuardianInvite;
  busy: boolean;
  onNewCode: () => void;
  onCancel: () => void;
}) {
  const code = formatInviteCode(invite.code);

  function share() {
    void Share.share({
      message:
        `I'd like you to be my guardian on AntiRog. Open the Guardian tab, tap Add Patient and enter ` +
        `this code: ${code}\n\nIt works once and expires ${formatExpiry(invite.expires_at)}.`,
    });
  }

  return (
    <View className="items-center gap-3 rounded-xl border border-blue-200 bg-blue-50 px-4 py-5 dark:border-blue-900 dark:bg-blue-950">
      <Text className="text-sm text-gray-600 dark:text-gray-300">Ask your guardian to enter this code</Text>
      <Text
        selectable
        accessibilityLabel={`Invite code ${invite.code.split('').join(' ')}`}
        className="font-mono text-4xl font-bold tracking-widest text-gray-900 dark:text-white">
        {code}
      </Text>
      <Text className="text-sm text-gray-500 dark:text-gray-400">
        Works once · expires {formatExpiry(invite.expires_at)}
      </Text>

      <View className="mt-1 w-full flex-row gap-3">
        <Pressable
          accessibilityRole="button"
          disabled={busy}
          onPress={share}
          className="flex-1 items-center rounded-lg bg-blue-500 py-2.5 active:opacity-80">
          <Text className="text-sm font-semibold text-white">Share Code</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          disabled={busy}
          onPress={onNewCode}
          className="flex-1 items-center rounded-lg border border-blue-500 py-2.5 active:opacity-80">
          <Text className="text-sm font-semibold text-blue-500">New Code</Text>
        </Pressable>
      </View>
      <Pressable accessibilityRole="button" disabled={busy} onPress={onCancel} hitSlop={8} className="active:opacity-60">
        <Text className="text-sm font-semibold text-gray-500 dark:text-gray-400">Cancel Invite</Text>
      </Pressable>
    </View>
  );
}
