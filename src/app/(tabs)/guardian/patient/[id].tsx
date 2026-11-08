import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, Text, View } from 'react-native';

import { ConnectionPill, StateBadge } from '@/components/guardian-ui';
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
      <Text className="text-lg font-semibold text-gray-900 dark:text-white">{title}</Text>
      {children}
    </View>
  );
}

function Empty({ children }: { children: string }) {
  return <Text className="text-sm text-gray-500 dark:text-gray-400">{children}</Text>;
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
      <View className="flex-1 items-center justify-center bg-white dark:bg-black">
        <ActivityIndicator />
      </View>
    );
  }

  if (!link) {
    return (
      <View className="flex-1 items-center justify-center bg-white px-6 dark:bg-black">
        <Stack.Screen options={{ title: 'Patient' }} />
        <Text className="text-center text-base text-gray-500 dark:text-gray-400">
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
      className="flex-1 bg-white dark:bg-black"
      contentContainerClassName="gap-6 p-6"
      contentInsetAdjustmentBehavior="automatic">
      <Stack.Screen options={{ title: patientLabel(link) }} />

      <View className="flex-row items-center justify-between">
        <Text className="text-sm text-gray-500 dark:text-gray-400">
          Following since {new Date(link.created_at).toLocaleDateString(undefined, { dateStyle: 'medium' })}
        </Text>
        <ConnectionPill status={status} />
      </View>

      <Section title="Today">
        {rows.length === 0 && <Empty>No daily reminders are set, so there are no scheduled doses.</Empty>}
        {rows.map((row) => (
          <View
            key={row.prescription.id}
            className="flex-row items-center gap-3 rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 dark:border-gray-800 dark:bg-gray-900">
            <View className="flex-1">
              <Text className="text-base font-semibold text-gray-900 dark:text-white">
                {row.prescription.medication}
              </Text>
              <Text className="text-sm text-gray-600 dark:text-gray-400">
                Due {formatTime(row.scheduledAt)}
                {row.recordedAt != null && ` · logged ${formatTime(row.recordedAt)}`}
              </Text>
            </View>
            <StateBadge state={row.state} />
          </View>
        ))}
      </Section>

      <Section title="Medications">
        {own.length === 0 && <Empty>No medications in their vault.</Empty>}
        {own.map((p) => (
          <View
            key={p.id}
            className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 dark:border-gray-800 dark:bg-gray-900">
            <View className="flex-row items-center gap-2">
              <Text className="flex-1 text-base font-semibold text-gray-900 dark:text-white">{p.medication}</Text>
              {p.is_high_risk && (
                <View className="rounded-full bg-red-100 px-2.5 py-0.5 dark:bg-red-950">
                  <Text className="text-xs font-semibold text-red-700 dark:text-red-400">High risk</Text>
                </View>
              )}
            </View>
            <Text className="text-sm text-gray-600 dark:text-gray-400">
              {p.dosage}
              {p.reminder_enabled && p.reminder_minutes != null
                ? ` · daily at ${formatTime(scheduledTime(dayStart, p.reminder_minutes))}`
                : ' · no reminder'}
            </Text>
          </View>
        ))}
      </Section>

      <Section title="Past 7 days">
        {history.length === 0 && <Empty>No doses logged in the past week.</Empty>}
        {history.map((dose) => (
          <View key={dose.id} className="flex-row items-center gap-3">
            <View className="flex-1">
              <Text className="text-sm text-gray-900 dark:text-white">
                {nameById.get(dose.prescription_id) ?? 'Removed medication'}
              </Text>
              <Text className="text-xs text-gray-500 dark:text-gray-400">
                {formatDay(dose.scheduled_at)} · due {formatTime(dose.scheduled_at)}
              </Text>
            </View>
            <StateBadge state={dose.status as DoseState} />
          </View>
        ))}
      </Section>

      <Pressable
        accessibilityRole="button"
        accessibilityState={{ busy: removing, disabled: removing }}
        disabled={removing}
        onPress={() => confirmUnlink(link)}
        className={`items-center rounded-xl border border-red-500 py-3.5 active:opacity-80 ${removing ? 'opacity-60' : ''}`}>
        {removing ? (
          <ActivityIndicator color="#ef4444" />
        ) : (
          <Text className="text-base font-semibold text-red-500">Stop Following</Text>
        )}
      </Pressable>
    </ScrollView>
  );
}
