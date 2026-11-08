import * as Notifications from 'expo-notifications';
import { AndroidImportance, AndroidNotificationVisibility } from 'expo-notifications';
import { createContext, use, type ReactNode } from 'react';
import { Platform } from 'react-native';

import { useGuardianFeed, type GuardianAlert, type GuardianFeed } from '@/hooks/use-guardian-feed';
import { formatTime } from '@/lib/guardian-status';
import { patientLabel } from '@/lib/guardian';

const GuardianFeedContext = createContext<GuardianFeed | null>(null);

const CHANNEL_ID = 'guardian-alerts';

async function ensureChannel() {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
    name: 'Guardian alerts',
    description: 'When someone you look after skips or misses a dose.',
    importance: AndroidImportance.HIGH,
    // Medication names are health data: hide the content on the lock screen.
    lockscreenVisibility: AndroidNotificationVisibility.PRIVATE,
  });
}

/** Asks for notification permission (once) so guardian alerts can be shown. Never throws. */
export async function requestGuardianAlertPermission() {
  try {
    await ensureChannel(); // Android needs a channel before it can ask.
    const current = await Notifications.getPermissionsAsync();
    if (!current.granted && current.canAskAgain) await Notifications.requestPermissionsAsync();
  } catch (e) {
    console.log('[guardian] Permission request failed:', e instanceof Error ? e.message : e);
  }
}

/**
 * Shows a notification when a linked patient skips or misses a dose. Only works while the app is
 * running (Realtime needs an open connection); taken doses and prescription changes just update the feed.
 */
async function notify(alert: GuardianAlert) {
  if (alert.kind !== 'dose-skipped' && alert.kind !== 'dose-missed') return;
  const permission = await Notifications.getPermissionsAsync();
  if (!permission.granted) return;
  await ensureChannel();

  const who = patientLabel(alert.link);
  const medication = alert.prescription?.medication ?? 'a medication';
  const when = formatTime(alert.dose.scheduled_at);
  await Notifications.scheduleNotificationAsync({
    content: {
      title: alert.kind === 'dose-missed' ? `${who} missed a dose` : `${who} skipped a dose`,
      body: `${medication}, due ${when}`,
      sound: 'default',
      data: { url: `/guardian/patient/${alert.link.patient_id}` },
    },
    // Show now, on the guardian channel.
    trigger: Platform.OS === 'android' ? { channelId: CHANNEL_ID } : null,
  });
}

/** One Realtime subscription for the whole signed-in app, so alerts arrive on any tab. */
export function GuardianFeedProvider({ children }: { children: ReactNode }) {
  const feed = useGuardianFeed({
    onAlert: (alert) => {
      notify(alert).catch((e) => console.log('[guardian] Could not show alert:', e instanceof Error ? e.message : e));
    },
  });
  return <GuardianFeedContext value={feed}>{children}</GuardianFeedContext>;
}

export function useGuardian() {
  const feed = use(GuardianFeedContext);
  if (!feed) throw new Error('useGuardian() must be used inside GuardianFeedProvider.');
  return feed;
}
