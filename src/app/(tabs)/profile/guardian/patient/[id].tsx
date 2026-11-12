import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, ScrollView, Text, View } from 'react-native';

import { ConnectionPill, StateBadge } from '@/components/guardian-ui';
import { Badge, Card, NeuButton, SectionTitle, Spinner } from '@/components/neu';
import { useGuardian } from '@/hooks/use-guardian-context';
import { useDayStart, useNow } from '@/hooks/use-todays-doses';
import { friendlyError, patientLabel, removeLink, type GuardianLink } from '@/lib/guardian';
import { scheduledTime } from '@/lib/doses';
import { formatTime, todayRows, type DoseState } from '@/lib/guardian-status';

function formatDay(ms: number) {
  return new Date(ms).toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View className="gap-3">
      <SectionTitle>{title}</SectionTitle>
      {children}
    </View>
  );
}

function Empty({ children }: { children: string }) {
  return <Text className="px-1 text-sm text-muted dark:text-muted-dark">{children}</Text>;
}

export default function GuardianPatientScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { links, loaded, prescriptions, doses, status, refresh } = useGuardian();
  const dayStart = useDayStart();
  const now = useNow();
  const [removing, setRemoving] = useState(false);

  const link = links.find((l) => l.patient_id === id);

  if (!loaded) {
    return (
      <View className="flex-1 items-center justify-center bg-canvas dark:bg-canvas-dark">
        <Spinner />
      </View>
    );
  }

  if (!link) {
    return (
      <View className="flex-1 items-center justify-center bg-canvas px-6 dark:bg-canvas-dark">
        <Stack.Screen options={{ title: 'Patient' }} />
        <Text className="text-center text-base text-muted dark:text-muted-dark">
          You&apos;re no longer linked to this person.
        </Text>
      </View>
    );
  }

  const rows = todayRows(link.patient_id, prescriptions, doses, dayStart, now);
  const own = prescriptions.filter((p) => p.user_id === link.patient_id);
  const nameById = new Map(own.map((p) => [p.id, p.medication]));
  const history = doses.filter((d) => d.user_id === link.patient_id && d.scheduled_at < dayStart);

  function confirmUnlink(target: GuardianLink) {
    Alert.alert(
      'Stop following?',
      `You'll no longer see ${patientLabel(target)}'s medications. They'd need to send you a new code to link again.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Stop Following',
          style: 'destructive',
          onPress: async () => {
            setRemoving(true);
            try {
              await removeLink(target.id);
              refresh();
              router.back();
            } catch (e) {
              setRemoving(false);
              Alert.alert('Could not unlink', friendlyError(e));
            }
          },
        },
      ],
    );
  }

  return (
    <ScrollView
      className="flex-1 bg-canvas dark:bg-canvas-dark"
      contentContainerClassName="gap-6 px-5 pb-10 pt-4"
      contentInsetAdjustmentBehavior="automatic">
      <Stack.Screen options={{ title: patientLabel(link) }} />

      <View className="flex-row items-center justify-between">
        <Text className="text-sm text-muted dark:text-muted-dark">
          Following since {new Date(link.created_at).toLocaleDateString(undefined, { dateStyle: 'medium' })}
        </Text>
        <ConnectionPill status={status} />
      </View>

      <Section title="Today">
        {rows.length === 0 && <Empty>No daily reminders are set, so there are no scheduled doses.</Empty>}
        {rows.map((row) => (
          <Card key={row.prescription.id} className="flex-row items-center gap-3 px-4 py-3">
            <View className="flex-1">
              <Text className="text-base font-semibold text-ink dark:text-ink-dark">
                {row.prescription.medication}
              </Text>
              <Text className="text-sm text-muted dark:text-muted-dark">
                Due {formatTime(row.scheduledAt)}
                {row.recordedAt != null && ` · logged ${formatTime(row.recordedAt)}`}
              </Text>
            </View>
            <StateBadge state={row.state} />
          </Card>
        ))}
      </Section>

      <Section title="Medications">
        {own.length === 0 && <Empty>No medications in their list.</Empty>}
        {own.map((p) => (
          <Card key={p.id} className="px-4 py-3">
            <View className="flex-row items-center gap-2">
              <Text className="flex-1 text-base font-semibold text-ink dark:text-ink-dark">{p.medication}</Text>
              {p.is_high_risk && <Badge label="High risk" tone="danger" />}
            </View>
            <Text className="text-sm text-muted dark:text-muted-dark">
              {p.dosage}
              {p.reminder_enabled && p.reminder_minutes != null
                ? ` · daily at ${formatTime(scheduledTime(dayStart, p.reminder_minutes))}`
                : ' · no reminder'}
            </Text>
          </Card>
        ))}
      </Section>

      <Section title="Past 7 days">
        {history.length === 0 && <Empty>No doses logged in the past week.</Empty>}
        {history.map((dose) => (
          <View key={dose.id} className="flex-row items-center gap-3">
            <View className="flex-1">
              <Text className="text-sm text-ink dark:text-ink-dark">
                {nameById.get(dose.prescription_id) ?? 'Removed medication'}
              </Text>
              <Text className="text-xs text-muted dark:text-muted-dark">
                {formatDay(dose.scheduled_at)} · due {formatTime(dose.scheduled_at)}
              </Text>
            </View>
            <StateBadge state={dose.status as DoseState} />
          </View>
        ))}
      </Section>

      <NeuButton title="Stop Following" variant="danger" loading={removing} onPress={() => confirmUnlink(link)} />
    </ScrollView>
  );
}
