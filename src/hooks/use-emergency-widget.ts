import { useEffect, useEffectEvent } from 'react';
import { AppState } from 'react-native';

import { useEmergencyProfile } from '@/hooks/use-emergency-profile';
import { hideEmergencyNotification, showEmergencyNotification } from '@/lib/emergency-notification';
import { ageOn, formatDateOfBirth } from '@/lib/emergency-profile';
import { pushEmergencyWidget } from '@/lib/emergency-widget';
import { EMPTY_WIDGET_PROPS, type EmergencyWidgetProps } from '@/widgets/emergency-widget.types';

/*
 * Keeps the Medical ID home screen widget, and on Android the lock screen notification, in step with
 * WatermelonDB: runs whenever the profile changes,
 * whether saved on this phone or pulled by sync from another. Mounted in the tabs layout, so only
 * while signed in (the database must have no subscribers when sign-out wipes it; that wipe clears the
 * widget itself, see src/lib/local-data.ts).
 *
 * Privacy: both are readable without unlocking the phone, so details are only shown when the patient
 * has turned on "Show on Home Screen & Lock Screen".
 */
export function useEmergencyWidget() {
  const profile = useEmergencyProfile();

  // Android 14+ lets users swipe even ongoing notifications away, and a reboot clears them; put the
  // lock screen Medical ID back whenever AntiRog comes to the foreground.
  const syncNotification = useEffectEvent(() => {
    if (profile === undefined) return;
    if (profile?.showOnWidget) {
      void showEmergencyNotification({
        name: profile.fullName,
        age: ageOn(profile.dateOfBirth),
        bloodType: profile.bloodType,
        allergies: profile.knownAllergies,
        conditions: profile.chronicConditions,
        contact: profile.emergencyContactNumber,
      });
    } else {
      void hideEmergencyNotification();
    }
  });
  useEffect(() => {
    if (profile === undefined) return; // still loading; don't blank the widget meanwhile
    let props: EmergencyWidgetProps;
    if (!profile) {
      props = EMPTY_WIDGET_PROPS;
    } else if (!profile.showOnWidget) {
      props = { ...EMPTY_WIDGET_PROPS, state: 'hidden' };
    } else {
      const age = ageOn(profile.dateOfBirth);
      props = {
        state: 'ready',
        name: profile.fullName,
        bloodType: profile.bloodType,
        born: profile.dateOfBirth
          ? [age != null ? `${age} yrs` : null, formatDateOfBirth(profile.dateOfBirth)].filter(Boolean).join(' · ')
          : '',
        allergies: profile.knownAllergies,
        conditions: profile.chronicConditions,
        contact: profile.emergencyContactNumber,
      };
    }
    pushEmergencyWidget(props);
    syncNotification();
  }, [profile]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') syncNotification();
    });
    return () => subscription.remove();
  }, []);
}
