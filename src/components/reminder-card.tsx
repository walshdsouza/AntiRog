import { Host, Switch } from '@expo/ui';
import TimePicker from '@expo/ui/community/datetime-picker';
import { useDatabase } from '@nozbe/watermelondb/react';
import { useState } from 'react';
import { Alert, Linking, Platform, Pressable, Text, View } from 'react-native';

import type { PrescriptionRecord } from '@/lib/prescriptions';
import {
  DEFAULT_REMINDER_MINUTES,
  dateFromMinutes,
  ensureReminderPermission,
  formatReminderTime,
  minutesFromDate,
  setReminder,
} from '@/lib/reminders';

type Props = {
  record: PrescriptionRecord;
  enabled: boolean;
  minutes: number | null;
};

/** Daily reminder toggle and time for one prescription. */
export function ReminderCard({ record, enabled, minutes }: Props) {
  const database = useDatabase();
  const time = minutes ?? DEFAULT_REMINDER_MINUTES;
  const [busy, setBusy] = useState(false);
  // Android shows the time picker as a dialog that is open while mounted.
  const [pickerOpen, setPickerOpen] = useState(false);

  async function save(next: { enabled: boolean; minutes: number }) {
    try {
      await setReminder(database, record, next);
    } catch (e) {
      Alert.alert('Could not update reminder', e instanceof Error ? e.message : 'Something went wrong.');
    }
  }

  async function toggle(next: boolean) {
    if (busy) return;
    setBusy(true);
    try {
      if (next) {
        const permission = await ensureReminderPermission();
        if (permission !== 'granted') {
          showPermissionHelp(permission === 'blocked');
          return;
        }
      }
      await save({ enabled: next, minutes: time });
    } finally {
      setBusy(false);
    }
  }

  function pickTime(date: Date) {
    setPickerOpen(false);
    void save({ enabled, minutes: minutesFromDate(date) });
  }

  return (
    <View className="gap-3">
      <Text className="text-lg font-semibold text-gray-900 dark:text-white">Reminder</Text>
      <View className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-4 dark:border-gray-800 dark:bg-gray-900">
        <View className="flex-row items-center gap-3">
          <View className="flex-1">
            <Text className="text-base font-semibold text-gray-900 dark:text-white">Daily reminder</Text>
            <Text className="text-sm text-gray-600 dark:text-gray-400">
              {enabled ? `Every day at ${formatReminderTime(time)}` : 'Off'}
            </Text>
          </View>
          <Host matchContents>
            <Switch value={enabled} onValueChange={toggle} disabled={busy} testID="reminder-switch" />
          </Host>
        </View>

        {enabled && Platform.OS === 'ios' && (
          <View className="mt-3 flex-row items-center justify-between">
            <Text className="text-base text-gray-900 dark:text-white">Time</Text>
            <TimePicker
              mode="time"
              display="compact"
              value={dateFromMinutes(time)}
              onValueChange={(_event, date) => pickTime(date)}
            />
          </View>
        )}

        {enabled && Platform.OS === 'android' && (
          <>
            <Pressable
              accessibilityRole="button"
              onPress={() => setPickerOpen(true)}
              className="mt-3 items-center rounded-lg border border-blue-500 py-2.5 active:opacity-80">
              <Text className="text-sm font-semibold text-blue-500">Change time</Text>
            </Pressable>
            {pickerOpen && (
              <TimePicker
                mode="time"
                value={dateFromMinutes(time)}
                onValueChange={(_event, date) => pickTime(date)}
                onDismiss={() => setPickerOpen(false)}
              />
            )}
          </>
        )}
      </View>
    </View>
  );
}

function showPermissionHelp(blocked: boolean) {
  if (!blocked) {
    Alert.alert('Notifications are off', 'Allow notifications to get daily medication reminders.');
    return;
  }
  Alert.alert('Notifications are off', 'Allow notifications for AntiRog in Settings to get daily reminders.', [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Open Settings', onPress: () => void Linking.openSettings() },
  ]);
}
