import type { Database } from '@nozbe/watermelondb';

import { supabase } from '@/lib/supabase';

/** Saves one prescription to WatermelonDB for the signed-in user. Throws an Error with a user-facing message. */
export async function savePrescription(
  database: Database,
  { medication, dosage }: { medication: string; dosage: string },
) {
  const med = medication.trim();
  const dose = dosage.trim();
  if (!med || !dose) throw new Error('Enter both a medication and a dosage.');

  // getUser() asks the server, which fails offline; fall back to the session cached on the device.
  let userId: string | undefined;
  try {
    const { data } = await supabase.auth.getUser();
    userId = data.user?.id;
  } catch {
    // Offline: use the cached session below.
  }
  if (!userId) {
    const { data } = await supabase.auth.getSession();
    userId = data.session?.user.id;
  }
  if (!userId) throw new Error('Sign in again to save prescriptions.');

  await database.write(async () => {
    await database.get('prescriptions').create((record: any) => {
      record.medication = med;
      record.dosage = dose;
      record.userId = userId;
    });
  });
}
