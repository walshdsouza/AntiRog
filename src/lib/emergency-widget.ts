import { hideEmergencyNotification } from '@/lib/emergency-notification';
import type EmergencyWidgetModule from '@/widgets/emergency-widget';
import { EMPTY_WIDGET_PROPS, type EmergencyWidgetProps } from '@/widgets/emergency-widget.types';

/*
 * Bridge to the Medical ID home screen widget (src/widgets/emergency-widget.*). Widgets run outside the
 * app and can't open WatermelonDB, so the app pushes a snapshot: expo-widgets stores it in the shared
 * App Group on iOS and in the widget's state on Android, and the widget renders from that.
 */

let widget: typeof EmergencyWidgetModule | null | undefined;

/** The widget, or null in builds without expo-widgets (an older dev build, Expo Go, web). */
function loadWidget() {
  if (widget !== undefined) return widget;
  try {
    // Lazy so a build without the native module fails here, inside try, not at app start.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    widget = (require('@/widgets/emergency-widget') as { default: typeof EmergencyWidgetModule }).default;
  } catch (e) {
    console.log('[widget] Medical ID widget unavailable in this build:', e instanceof Error ? e.message : e);
    widget = null;
  }
  return widget;
}

/** Shows these details on every Medical ID widget. Never throws. */
export function pushEmergencyWidget(props: EmergencyWidgetProps) {
  try {
    loadWidget()?.updateSnapshot(props);
  } catch (e) {
    console.log('[widget] Could not update the Medical ID widget:', e instanceof Error ? e.message : e);
  }
}

/**
 * Resets the widget to "Not set up" and removes the Android lock screen notification. Called when
 * the local data is wiped (sign-out).
 */
export function clearEmergencyWidget() {
  pushEmergencyWidget(EMPTY_WIDGET_PROPS);
  void hideEmergencyNotification();
}
