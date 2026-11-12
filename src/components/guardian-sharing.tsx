import { useState } from 'react';
import { Alert, Pressable, Share, Text, View } from 'react-native';

import { Card, NeuButton, Note, SectionTitle, Spinner } from '@/components/neu';

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
      <SectionTitle>Guardians</SectionTitle>
      <Note>
        A guardian can see your medications and whether you&apos;ve logged today&apos;s doses. They can&apos;t
        change anything, and they can&apos;t see your visits.
      </Note>

      {guardians === undefined && !error && <Spinner className="py-2" />}

      {error && (
        <Pressable accessibilityRole="button" onPress={reload} className="active:opacity-70">
          <Text className="text-sm text-danger dark:text-danger-dark">
            {friendlyError(error)} Tap to retry.
          </Text>
        </Pressable>
      )}

      {guardians?.map((link) => (
        <Card key={link.id} className="flex-row items-center gap-3 px-4 py-3">
          <View className="flex-1">
            <Text selectable className="text-base font-semibold text-ink dark:text-ink-dark">
              {guardianLabel(link)}
            </Text>
            <Text className="text-sm text-muted dark:text-muted-dark">
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
            <Text className="text-sm font-semibold text-danger dark:text-danger-dark">Remove</Text>
          </Pressable>
        </Card>
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
          <NeuButton
            title="Invite a Guardian"
            loading={busy}
            onPress={() => void run(createInvite, 'Could not create a code')}
          />
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
        `I'd like you to be my guardian on AntiRog. Open Profile › People you look after, tap Add and enter ` +
        `this code: ${code}\n\nIt works once and expires ${formatExpiry(invite.expires_at)}.`,
    });
  }

  return (
    <Card tone="accent" className="items-center gap-3 px-4 py-5">
      <Text className="text-sm text-muted dark:text-muted-dark">Ask your guardian to enter this code</Text>
      <Text
        selectable
        accessibilityLabel={`Invite code ${invite.code.split('').join(' ')}`}
        className="font-mono text-4xl font-bold tracking-widest text-ink dark:text-ink-dark">
        {code}
      </Text>
      <Text className="text-sm text-muted dark:text-muted-dark">
        Works once · expires {formatExpiry(invite.expires_at)}
      </Text>

      <View className="mt-1 w-full flex-row gap-3">
        <NeuButton className="flex-1" size="sm" variant="primary" title="Share Code" disabled={busy} onPress={share} />
        <NeuButton className="flex-1" size="sm" title="New Code" disabled={busy} onPress={onNewCode} />
      </View>
      <Pressable accessibilityRole="button" disabled={busy} onPress={onCancel} hitSlop={8} className="active:opacity-60">
        <Text className="text-sm font-semibold text-muted dark:text-muted-dark">Cancel Invite</Text>
      </Pressable>
    </Card>
  );
}
