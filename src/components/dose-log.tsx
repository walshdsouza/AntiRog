import { useDatabase } from '@nozbe/watermelondb/react';
import { useState } from 'react';
import { Alert, Pressable, Text, View } from 'react-native';

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
    <View className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-4 dark:border-gray-800 dark:bg-gray-900">
      {showName && (
        <Text className="text-base font-semibold text-gray-900 dark:text-white">
          {dose.medication} <Text className="font-normal text-gray-600 dark:text-gray-400">{dose.dosage}</Text>
        </Text>
      )}
      <Text
        className={`text-sm ${overdue ? 'text-amber-600 dark:text-amber-400' : 'text-gray-600 dark:text-gray-400'}`}>
        {statusLine(dose, now)}
      </Text>

      <View className="mt-3 flex-row gap-3">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Skip ${dose.medication}`}
          accessibilityState={{ selected: status === 'skipped', disabled: busy }}
          disabled={busy}
          onPress={() => log('skipped')}
          className={`flex-1 items-center rounded-lg border py-2.5 active:opacity-80 ${
            status === 'skipped' ? 'border-gray-600 bg-gray-600' : 'border-gray-400 dark:border-gray-600'
          }`}>
          <Text
            className={`text-sm font-semibold ${
              status === 'skipped' ? 'text-white' : 'text-gray-700 dark:text-gray-300'
            }`}>
            {status === 'skipped' ? 'Skipped' : 'Skip'}
          </Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Mark ${dose.medication} as taken`}
          accessibilityState={{ selected: status === 'taken', disabled: busy }}
          disabled={busy}
          onPress={() => log('taken')}
          className={`flex-1 items-center rounded-lg border py-2.5 active:opacity-80 ${
            status === 'taken' ? 'border-green-600 bg-green-600' : 'border-blue-500 bg-blue-500'
          }`}>
          <Text className="text-sm font-semibold text-white">{status === 'taken' ? '✓ Taken' : 'Taken'}</Text>
        </Pressable>
      </View>
    </View>
  );
}

/** Today's dose for one prescription (prescription detail screen). Renders nothing without a reminder. */
export function DoseLogCard({ prescriptionId }: { prescriptionId: string }) {
  const { doses, dayStart } = useTodaysDoses(prescriptionId);
  const dose = doses?.[0];
  if (!dose) return null;

  return (
    <View className="gap-3">
      <Text className="text-lg font-semibold text-gray-900 dark:text-white">Today&apos;s dose</Text>
      <DoseLogRow dose={dose} dayStart={dayStart} showName={false} />
    </View>
  );
}

/** Every dose scheduled today (Vault screen). Renders nothing when no reminders are on. */
export function TodaysDoses() {
  const { doses, dayStart } = useTodaysDoses();
  if (!doses?.length) return null;

  const done = doses.filter((d) => d.logged).length;
  return (
    <View className="mb-6 gap-3">
      <View className="flex-row items-baseline justify-between">
        <Text className="text-lg font-semibold text-gray-900 dark:text-white">Today</Text>
        <Text className="text-sm text-gray-500 dark:text-gray-400">
          {done} of {doses.length} logged
        </Text>
      </View>
      {doses.map((dose) => (
        <DoseLogRow key={dose.prescription.id} dose={dose} dayStart={dayStart} showName />
      ))}
    </View>
  );
}
