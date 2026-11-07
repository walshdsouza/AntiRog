import type { Database } from '@nozbe/watermelondb';
import * as Notifications from 'expo-notifications';
import { AndroidImportance, AndroidNotificationVisibility, IosAuthorizationStatus } from 'expo-notifications';
import { Platform } from 'react-native';

import type { PrescriptionRecord } from '@/lib/prescriptions';
import { syncData } from '@/lib/sync';

/*
 * Daily medication reminders, scheduled as local notifications (no server, works offline).
 * WatermelonDB is the source of truth (prescriptions.reminder_enabled / reminder_minutes, synced to
 * Supabase so reminders come back after signing in again). The OS schedule is reconciled to match it.
 */

const CHANNEL_ID = 'medication-reminders';
const ID_PREFIX = 'reminder:';
export const DEFAULT_REMINDER_MINUTES = 9 * 60;

/** Call once at startup: shows reminders even while the app is open. */
export function configureNotifications() {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
}

/** Android needs a channel before it can show notifications, or even ask for permission. */
async function ensureChannel() {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
    name: 'Medication reminders',
    description: 'Daily reminders to take your medications.',
    importance: AndroidImportance.HIGH,
    // Medication names are health data: hide the content on the lock screen.
    lockscreenVisibility: AndroidNotificationVisibility.PRIVATE,
  });
}

function isGranted(status: Notifications.NotificationPermissionsStatus) {
  return status.granted || status.ios?.status === IosAuthorizationStatus.PROVISIONAL;
}

/** 'blocked' means the user has to allow notifications in system Settings. */
export async function ensureReminderPermission(): Promise<'granted' | 'denied' | 'blocked'> {
  await ensureChannel();
  const current = await Notifications.getPermissionsAsync();
  if (isGranted(current)) return 'granted';
  if (!current.canAskAgain) return 'blocked';
  const next = await Notifications.requestPermissionsAsync({
    ios: { allowAlert: true, allowSound: true, allowBadge: false },
  });
  if (isGranted(next)) return 'granted';
  return next.canAskAgain ? 'denied' : 'blocked';
}

/** Turns a reminder on or off, or changes its time. The scheduler picks up the change. */
export async function setReminder(
  database: Database,
  record: PrescriptionRecord,
  { enabled, minutes }: { enabled: boolean; minutes: number },
) {
  await database.write(async () => {
    await record.update((r) => {
      r.reminderEnabled = enabled;
      r.reminderMinutes = minutes;
    });
  });
  void syncData();
}

export function dateFromMinutes(minutes: number) {
  const date = new Date();
  date.setHours(Math.floor(minutes / 60), minutes % 60, 0, 0);
  return date;
}

export function minutesFromDate(date: Date) {
  return date.getHours() * 60 + date.getMinutes();
}

export function formatReminderTime(minutes: number) {
  return dateFromMinutes(minutes).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

// Reconciles and the sign-out cleanup must never interleave, or a reconcile that was already
// running could re-schedule the previous account's reminders after they were cancelled.
let queue: Promise<unknown> = Promise.resolve();
function exclusive<T>(task: () => Promise<T>): Promise<T> {
  const result = queue.then(task);
  queue = result.catch(() => {});
  return result;
}

type Wanted = { content: Notifications.NotificationContentInput; hour: number; minute: number; key: string };

/** Makes the OS schedule match the reminders stored in the database. */
export function reconcileReminders(prescriptions: PrescriptionRecord[]) {
  return exclusive(async () => {
    const wanted = new Map<string, Wanted>();
    // Without permission nothing would be shown, so leave nothing scheduled.
    if (isGranted(await Notifications.getPermissionsAsync())) {
      for (const p of prescriptions) {
        if (!p.reminderEnabled || p.reminderMinutes == null) continue;
        const minutes = p.reminderMinutes;
        // Rescheduling only when something visible changes avoids churning the OS schedule.
        const key = `${minutes}|${p.medication}|${p.dosage}`;
        wanted.set(`${ID_PREFIX}${p.id}`, {
          key,
          hour: Math.floor(minutes / 60),
          minute: minutes % 60,
          content: {
            title: `Time for ${p.medication}`,
            body: p.dosage,
            sound: 'default',
            data: { url: `/prescription/${p.id}`, key },
          },
        });
      }
    }

    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    for (const request of scheduled) {
      if (!request.identifier.startsWith(ID_PREFIX)) continue;
      const want = wanted.get(request.identifier);
      if (want && request.content.data?.key === want.key) {
        wanted.delete(request.identifier); // Already scheduled as wanted.
      } else {
        await Notifications.cancelScheduledNotificationAsync(request.identifier);
      }
    }

    if (wanted.size) await ensureChannel();
    for (const [identifier, want] of wanted) {
      await Notifications.scheduleNotificationAsync({
        identifier,
        content: want.content,
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DAILY,
          hour: want.hour,
          minute: want.minute,
          channelId: CHANNEL_ID,
        },
      });
    }
  });
}

/** On sign-out: cancel every scheduled reminder and clear delivered ones from the notification tray. */
export function cancelAllReminders() {
  return exclusive(async () => {
    await Notifications.cancelAllScheduledNotificationsAsync();
    await Notifications.dismissAllNotificationsAsync();
  });
}
