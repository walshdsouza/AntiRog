import { Link } from 'expo-router';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ConnectionPill, StateBadge } from '@/components/guardian-ui';
import { LinkPatientForm } from '@/components/link-patient-form';
import { useGuardian } from '@/hooks/use-guardian-context';
import { useDayStart, useNow } from '@/hooks/use-todays-doses';
import { friendlyError, patientLabel, type GuardianLink, type PatientPrescription, type DoseEvent } from '@/lib/guardian';
import { countStates, formatTime, needsAttention, todayRows } from '@/lib/guardian-status';

export default function GuardianFeedScreen() {
  const { links, loaded, prescriptions, doses, status, error, refresh } = useGuardian();
  const dayStart = useDayStart();
  const now = useNow();

  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-white dark:bg-black">
      <ScrollView
        contentContainerClassName="gap-4 px-6 pb-6 pt-4"
        contentInsetAdjustmentBehavior="automatic"
        keyboardShouldPersistTaps="handled">
        <View className="flex-row items-center gap-3">
          <Text className="flex-1 text-2xl font-bold text-gray-900 dark:text-white">Guardian</Text>
          {links.length > 0 && <ConnectionPill status={status} />}
          {links.length > 0 && (
            <Link href="/guardian/link" asChild>
              <Pressable accessibilityRole="button" hitSlop={8} className="active:opacity-60">
                <Text className="text-base font-semibold text-blue-500">Add</Text>
              </Pressable>
            </Link>
          )}
        </View>

        {error && (
          <Pressable accessibilityRole="button" onPress={refresh} className="active:opacity-70">
            <Text className="text-sm text-red-600 dark:text-red-400">{friendlyError(error)} Tap to retry.</Text>
          </Pressable>
        )}

        {!loaded && !error && <ActivityIndicator className="mt-6" />}

        {loaded && links.length === 0 && (
          <View className="gap-4">
            <Text className="text-base text-gray-600 dark:text-gray-400">
              Look after a family member&apos;s medications. Once they share an invite code with you, you&apos;ll
              see their prescriptions and today&apos;s doses here as they log them.
            </Text>
            <Text className="text-sm text-gray-500 dark:text-gray-400">
              They can create a code in Profile → Guardians → Invite a Guardian.
            </Text>
            <LinkPatientForm />
          </View>
        )}

        {links.map((link) => (
          <PatientCard
            key={link.id}
            link={link}
            prescriptions={prescriptions}
            doses={doses}
            dayStart={dayStart}
            now={now}
          />
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

function PatientCard({
  link,
  prescriptions,
  doses,
  dayStart,
  now,
}: {
  link: GuardianLink;
  prescriptions: PatientPrescription[];
  doses: DoseEvent[];
  dayStart: number;
  now: number;
}) {
  const rows = todayRows(link.patient_id, prescriptions, doses, dayStart, now);
  const counts = countStates(rows);
  const activeCount = prescriptions.filter((p) => p.user_id === link.patient_id).length;
  const attention = needsAttention(rows);

  let summary: string;
  if (!rows.length) summary = 'No daily reminders set';
  else if (counts.missed || counts.skipped || counts.unlogged) {
    const parts = [];
    if (counts.missed) parts.push(`${counts.missed} missed`);
    if (counts.skipped) parts.push(`${counts.skipped} skipped`);
    if (counts.unlogged) parts.push(`${counts.unlogged} not logged`);
    summary = parts.join(' · ');
  } else if (counts.upcoming) summary = `${counts.taken} of ${rows.length} taken so far`;
  else summary = 'All doses taken today';

  return (
    <Link href={{ pathname: '/guardian/patient/[id]', params: { id: link.patient_id } }} asChild>
      <Pressable
        accessibilityRole="button"
        accessibilityHint="Opens this person's prescriptions and dose history"
        className={`gap-3 rounded-xl border px-4 py-4 active:opacity-70 ${
          attention
            ? 'border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/40'
            : 'border-gray-200 bg-gray-50 dark:border-gray-800 dark:bg-gray-900'
        }`}>
        <View>
          <Text numberOfLines={1} className="text-base font-semibold text-gray-900 dark:text-white">
            {patientLabel(link)}
          </Text>
          <Text className="text-sm text-gray-600 dark:text-gray-400">
            {summary} · {activeCount} {activeCount === 1 ? 'medication' : 'medications'}
          </Text>
        </View>

        {rows.map((row) => (
          <View key={row.prescription.id} className="flex-row items-center gap-3">
            <Text className="w-16 text-sm tabular-nums text-gray-500 dark:text-gray-400">
              {formatTime(row.scheduledAt)}
            </Text>
            <Text numberOfLines={1} className="flex-1 text-sm text-gray-900 dark:text-white">
              {row.prescription.medication}
            </Text>
            <StateBadge state={row.state} />
          </View>
        ))}
      </Pressable>
    </Link>
  );
}
