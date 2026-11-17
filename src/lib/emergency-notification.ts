import * as Notifications from 'expo-notifications';
import { AndroidImportance, AndroidNotificationVisibility } from 'expo-notifications';
import { Platform } from 'react-native';

/*
 * Android lock screen Medical ID: a persistent ("ongoing"), silent notification with the patient's
 * name, age, blood type and allergies. Android doesn't allow home screen widgets on the lock screen,
 * so this is how the details reach a first responder without unlocking the phone. iOS uses the
 * lock screen widget instead (src/widgets/emergency-widget.ios.tsx), so everything here is a no-op
 * there.
 *
 * Shown while "Show on Home Screen & Lock Screen" is on (src/hooks/use-emergency-widget.ts), removed
 * when it's turned off or on sign-out.
 *
 * Android limits:
 *  - Android 14+ lets users swipe away even ongoing notifications. The app re-posts it every time it
 *    comes to the foreground, so it comes back the next time AntiRog is opened.
 *  - Posted notifications don't survive a reboot; it reappears when AntiRog is next opened.
 */

/** Identifier of the notification (re-posting it updates it in place). */
export const EMERGENCY_NOTIFICATION_ID = 'medical-id';
const CHANNEL_ID = 'medical-id';

export type EmergencyNotificationDetails = {
  name: string;
  age: number | null;
  bloodType: string;
  allergies: string;
  conditions: string;
  contact: string;
};

let channelReady: Promise<unknown> | null = null;

/**
 * DEFAULT importance, not LOW: many phones (Pixel included) hide "silent" low-importance
 * notifications from the lock screen by default. Sound and vibration are switched off on the
 * channel instead, so it is still silent.
 *
 * Lock screen content: Android does not let apps set a channel's lock screen visibility (it is
 * reset to "no override"; checked on device), and expo-notifications can't set it per notification.
 * The full text therefore shows when the phone's lock screen setting is "Show all notification
 * content" (the usual default) and is redacted if the user picked "Hide sensitive content".
 * PUBLIC is still requested in case a future Android version honours it.
 */
function ensureChannel() {
  channelReady ??= Notifications.setNotificationChannelAsync(CHANNEL_ID, {
    name: 'Medical ID on lock screen',
    description: 'Keeps your emergency details on the lock screen for first responders.',
    importance: AndroidImportance.DEFAULT,
    lockscreenVisibility: AndroidNotificationVisibility.PUBLIC,
    sound: null,
    enableVibrate: false,
    vibrationPattern: null,
    showBadge: false,
  }).catch((e: unknown) => {
    channelReady = null;
    throw e;
  });
  return channelReady;
}

/**
 * Asks for notification permission (Android 13+ needs it). Call from a user action, such as saving
 * the Medical ID with the lock screen option on. Resolves true when notifications may be shown.
 */
export async function requestEmergencyNotificationPermission(): Promise<boolean> {
  if (Platform.OS !== 'android') return true;
  await ensureChannel();
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  if (!current.canAskAgain) return false;
  return (await Notifications.requestPermissionsAsync()).granted;
}

function bodyFor(d: EmergencyNotificationDetails) {
  const lines = [
    [d.bloodType ? `Blood ${d.bloodType}` : null, d.age != null ? `${d.age} yrs` : null].filter(Boolean).join(' · '),
    `Allergies: ${d.allergies || 'none known'}`,
    d.conditions ? `Conditions: ${d.conditions}` : null,
    d.contact ? `Emergency contact: ${d.contact}` : null,
  ];
  return lines.filter(Boolean).join('\n');
}

/** Posts or updates the lock screen Medical ID. Never throws; does nothing without permission. */
export async function showEmergencyNotification(details: EmergencyNotificationDetails) {
  if (Platform.OS !== 'android') return;
  try {
    // Never prompt from here: this runs on app start and after syncs, not from a user action.
    if (!(await Notifications.getPermissionsAsync()).granted) return;
    await ensureChannel();
    await Notifications.scheduleNotificationAsync({
      identifier: EMERGENCY_NOTIFICATION_ID,
      content: {
        title: `Medical ID: ${details.name}`,
        body: bodyFor(details),
        sticky: true,
        autoDismiss: false,
        color: '#A61E2D',
        data: { kind: 'medical-id' },
      },
      trigger: { channelId: CHANNEL_ID },
    });
  } catch (e) {
    console.log('[medical-id] Could not show the lock screen notification:', e instanceof Error ? e.message : e);
  }
}

/** Removes the lock screen Medical ID. Never throws. */
export async function hideEmergencyNotification() {
  if (Platform.OS !== 'android') return;
  try {
    await Notifications.dismissNotificationAsync(EMERGENCY_NOTIFICATION_ID);
  } catch (e) {
    console.log('[medical-id] Could not remove the lock screen notification:', e instanceof Error ? e.message : e);
  }
}
