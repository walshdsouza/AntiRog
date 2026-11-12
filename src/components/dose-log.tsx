import { useDatabase } from '@nozbe/watermelondb/react';
import { useState } from 'react';
import { Alert, Text, View } from 'react-native';

import { Card, NeuButton, SectionTitle } from '@/components/neu';
import { useNow, useTodaysDoses, type TodaysDose } from '@/hooks/use-todays-doses';
import { logDose, type LoggableDoseStatus } from '@/lib/doses';

function formatTime(ms: number) {
  return new Date(ms).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

function statusLine(dose: TodaysDose, now: number) {
  if (dose.logged?.status === 'taken') return `Taken at ${formatTime(dose.logged.recordedAt)}`;
  if (dose.logged?.status === 'skipped') return `Skipped at ${formatTime(dose.logged.recordedAt)}`;
  if (dose.logged?.status === 'missed') return 'Missed';
  const due = `Due ${formatTime(dose.scheduledAt)}`;
  return now > dose.scheduledAt ? `${due} · not logged yet` : due;
}

/** Taken / Skip buttons for one of today's doses. The logged outcome stays highlighted and can be changed. */
export function DoseLogRow({ dose, dayStart, showName }: { dose: TodaysDose; dayStart: number; showName: boolean }) {
  const database = useDatabase();
  const [busy, setBusy] = useState(false);
  const now = useNow();
  const status = dose.logged?.status;
  const overdue = !dose.logged && now > dose.scheduledAt;

  async function log(next: LoggableDoseStatus) {
    if (busy || status === next) return;
    setBusy(true);
    try {
      await logDose(database, { prescription: dose.prescription, dayStart, status: next });
    } catch (e) {
      Alert.alert('Could not log dose', e instanceof Error ? e.message : 'Something went wrong.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      {showName && (
        <Text className="text-base font-semibold text-ink dark:text-ink-dark">
          {dose.medication} <Text className="font-normal text-muted dark:text-muted-dark">{dose.dosage}</Text>
        </Text>
      )}
      <Text className={`text-sm ${overdue ? 'text-warning dark:text-warning-dark' : 'text-muted dark:text-muted-dark'}`}>
        {statusLine(dose, now)}
      </Text>

      <View className="mt-4 flex-row gap-3">
        <NeuButton
          className="flex-1"
          size="sm"
          title={status === 'skipped' ? 'Skipped' : 'Skip'}
          selected={status === 'skipped'}
          selectedTone="warning"
          accessibilityLabel={`Skip ${dose.medication}`}
          disabled={busy}
          onPress={() => log('skipped')}
        />
        <NeuButton
          className="flex-1"
          size="sm"
          variant="primary"
          title={status === 'taken' ? '✓ Taken' : 'Taken'}
          selected={status === 'taken'}
          selectedTone="success"
          accessibilityLabel={`Mark ${dose.medication} as taken`}
          disabled={busy}
          onPress={() => log('taken')}
        />
      </View>
    </Card>
  );
}

/** Today's dose for one prescription (medication detail screen). Renders nothing without a reminder. */
export function DoseLogCard({ prescriptionId }: { prescriptionId: string }) {
  const { doses, dayStart } = useTodaysDoses(prescriptionId);
  const dose = doses?.[0];
  if (!dose) return null;

  return (
    <View className="gap-3">
      <SectionTitle>Today&apos;s dose</SectionTitle>
      <DoseLogRow dose={dose} dayStart={dayStart} showName={false} />
    </View>
  );
}

/** Every dose scheduled today (Medications screen). Renders nothing when no reminders are on. */
export function TodaysDoses() {
  const { doses, dayStart } = useTodaysDoses();
  if (!doses?.length) return null;

  const done = doses.filter((d) => d.logged).length;
  return (
    <View className="gap-3">
      <SectionTitle
        right={
          <Text className="text-sm text-muted dark:text-muted-dark">
            {done} of {doses.length} logged
          </Text>
        }>
        Today
      </SectionTitle>
      {doses.map((dose) => (
        <DoseLogRow key={dose.prescription.id} dose={dose} dayStart={dayStart} showName />
      ))}
    </View>
  );
}
