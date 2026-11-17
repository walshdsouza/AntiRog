import { useDatabase } from '@nozbe/watermelondb/react';
import { useEffect, useState } from 'react';

import { toInput, type EmergencyProfileInput, type EmergencyProfileRecord } from '@/lib/emergency-profile';

const COLUMNS = [
  'full_name',
  'date_of_birth',
  'blood_type',
  'known_allergies',
  'chronic_conditions',
  'emergency_contact_number',
  'show_on_widget',
  'updated_at',
];

/**
 * The Medical ID on this phone, or null if it hasn't been filled in. Live: updates on local and synced
 * changes. `undefined` while loading.
 */
export function useEmergencyProfile() {
  const database = useDatabase();
  const [profile, setProfile] = useState<(EmergencyProfileInput & { updatedAt: number }) | null | undefined>(
    undefined,
  );

  useEffect(() => {
    // The local database only ever holds the signed-in user's data, so there is at most one row.
    const subscription = database
      .get<EmergencyProfileRecord>('emergency_profile')
      .query()
      .observeWithColumns(COLUMNS)
      .subscribe((records) => {
        const record = records[0];
        setProfile(record ? { ...toInput(record), updatedAt: record.updatedAt } : null);
      });
    return () => subscription.unsubscribe();
  }, [database]);

  return profile;
}
