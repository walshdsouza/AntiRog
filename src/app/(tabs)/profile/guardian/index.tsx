import { Link, Stack } from 'expo-router';
import { Pressable, ScrollView, Text, View } from 'react-native';

import { ConnectionPill, StateBadge } from '@/components/guardian-ui';
import { LinkPatientForm } from '@/components/link-patient-form';
import { Card, Note, PressableCard, Spinner } from '@/components/neu';
import { useGuardian } from '@/hooks/use-guardian-context';
import { useDayStart, useNow } from '@/hooks/use-todays-doses';
import { friendlyError, patientLabel, type GuardianLink, type PatientPrescription, type DoseEvent } from '@/lib/guardian';
import { countStates, formatTime, needsAttention, todayRows } from '@/lib/guardian-status';

export default function GuardianFeedScreen() {
  const { links, loaded, prescriptions, doses, status, error, refresh } = useGuardian();
  const dayStart = useDayStart();
  const now = useNow();

  return (
    <ScrollView
      className="flex-1 bg-canvas dark:bg-canvas-dark"
      contentContainerClassName="gap-5 px-5 pb-10 pt-4"
      contentInsetAdjustmentBehavior="automatic"
      keyboardShouldPersistTaps="handled">
      <Stack.Screen
        options={{
          headerRight:
            links.length > 0
              ? () => (
                  <Link href="/profile/guardian/link" asChild>
                    <Pressable accessibilityRole="button" accessibilityLabel="Add a patient" hitSlop={8}>
                      <Text className="text-base font-semibold text-accent dark:text-accent-dark">Add</Text>
                    </Pressable>
                  </Link>
                )
              : undefined,
        }}
      />
        {links.length > 0 && (
          <View className="flex-row items-center justify-between">
            <Text className="text-sm text-muted dark:text-muted-dark">Updates arrive as they happen</Text>
            <ConnectionPill status={status} />
          </View>
        )}

        {error && (
          <Pressable accessibilityRole="button" onPress={refresh} className="active:opacity-70">
            <Text className="text-sm text-danger dark:text-danger-dark">{friendlyError(error)} Tap to retry.</Text>
          </Pressable>
        )}

        {!loaded && !error && <Spinner className="mt-6" />}

        {loaded && links.length === 0 && (
          <Card className="gap-4 px-4 py-5">
            <Text className="text-base text-ink dark:text-ink-dark">
              Look after a family member&apos;s medications. Once they share an invite code with you, you&apos;ll
              see their medications and today&apos;s doses here as they log them.
            </Text>
            <Note>They can create a code in Profile › Guardians › Invite a Guardian.</Note>
            <LinkPatientForm />
          </Card>
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
    <Link href={{ pathname: '/profile/guardian/patient/[id]', params: { id: link.patient_id } }} asChild>
      <PressableCard
        tone={attention ? 'warning' : 'default'}
        accessibilityHint="Opens this person's medications and dose history"
        className="gap-3 px-4 py-4">
        <View>
          <Text numberOfLines={1} className="text-base font-semibold text-ink dark:text-ink-dark">
            {patientLabel(link)}
          </Text>
          <Text className="text-sm text-muted dark:text-muted-dark">
            {summary} · {activeCount} {activeCount === 1 ? 'medication' : 'medications'}
          </Text>
        </View>

        {rows.map((row) => (
          <View key={row.prescription.id} className="flex-row items-center gap-3">
            <Text className="w-16 text-sm tabular-nums text-muted dark:text-muted-dark">
              {formatTime(row.scheduledAt)}
            </Text>
            <Text numberOfLines={1} className="flex-1 text-sm text-ink dark:text-ink-dark">
              {row.prescription.medication}
            </Text>
            <StateBadge state={row.state} />
          </View>
        ))}
      </PressableCard>
    </Link>
  );
}
