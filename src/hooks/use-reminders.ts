import { useDatabase } from '@nozbe/watermelondb/react';
import * as Notifications from 'expo-notifications';
import { useRouter, type Href } from 'expo-router';
import { useEffect } from 'react';
import { AppState } from 'react-native';

import type { PrescriptionRecord } from '@/lib/prescriptions';
import { reconcileReminders } from '@/lib/reminders';

/**
 * Keeps scheduled notifications in step with the vault: reminders toggled here, edited on another
 * device and synced, or removed with a deleted prescription. Mount only while signed in.
 */
export function useReminderScheduler() {
  const database = useDatabase();

  useEffect(() => {
    let latest: PrescriptionRecord[] = [];
    let active = true;
    const reconcile = () => {
      if (!active) return;
      reconcileReminders(latest).catch((e) =>
        console.log('[reminders] Reconcile failed:', e instanceof Error ? e.message : e),
      );
    };

    const subscription = database
      .get<PrescriptionRecord>('prescriptions')
      .query()
      .observeWithColumns(['medication', 'dosage', 'reminder_enabled', 'reminder_minutes'])
      .subscribe((records) => {
        latest = records;
        reconcile();
      });

    // Notification permission can change in Settings while the app is in the background.
    const appState = AppState.addEventListener('change', (state) => {
      if (state === 'active') reconcile();
    });

    return () => {
      active = false;
      subscription.unsubscribe();
      appState.remove();
    };
  }, [database]);
}

/** Screens a notification may open: reminders open a prescription, guardian alerts open a patient. */
const TAP_TARGETS = ['/prescription/', '/guardian/patient/'];

/** Opens the screen a notification points to when tapped, including when the tap launched the app. */
export function useReminderTaps() {
  const router = useRouter();

  useEffect(() => {
    let active = true;

    function open(response: Notifications.NotificationResponse | null) {
      const url = response?.notification.request.content.data?.url;
      if (typeof url === 'string' && TAP_TARGETS.some((prefix) => url.startsWith(prefix))) {
        router.push(url as Href);
      }
      void Notifications.clearLastNotificationResponseAsync();
    }

    Notifications.getLastNotificationResponseAsync().then((response) => {
      if (active && response) open(response);
    });
    const subscription = Notifications.addNotificationResponseReceivedListener(open);

    return () => {
      active = false;
      subscription.remove();
    };
  }, [router]);
}
