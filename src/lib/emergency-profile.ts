import type { Database, Model } from '@nozbe/watermelondb';

import { supabase } from '@/lib/supabase';
import { syncData } from '@/lib/sync';

/*
 * Emergency Medical ID: name, date of birth, blood type, allergies, conditions and an emergency
 * contact. Stored in WatermelonDB (works offline), synced to Supabase public.emergency_profile, and,
 * when the patient opts in, mirrored to the home screen widget (src/hooks/use-emergency-widget.ts).
 *
 * One record per user, and its id is the user's id, so two phones never create two profiles.
 */

export const BLOOD_TYPES = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'] as const;
export type BloodType = (typeof BLOOD_TYPES)[number];

// The model class is plain JS (database/EmergencyProfile.js); describe its fields here.
export type EmergencyProfileRecord = Model & {
  userId: string;
  fullName: string;
  /** 'YYYY-MM-DD' or ''. */
  dateOfBirth: string;
  /** A BloodType, or '' when unknown. */
  bloodType: string;
  knownAllergies: string;
  chronicConditions: string;
  emergencyContactNumber: string;
  showOnWidget: boolean;
  /** ms */
  updatedAt: number;
};

export type EmergencyProfileInput = {
  fullName: string;
  dateOfBirth: string;
  bloodType: string;
  knownAllergies: string;
  chronicConditions: string;
  emergencyContactNumber: string;
  showOnWidget: boolean;
};

export const EMPTY_PROFILE: EmergencyProfileInput = {
  fullName: '',
  dateOfBirth: '',
  bloodType: '',
  knownAllergies: '',
  chronicConditions: '',
  emergencyContactNumber: '',
  showOnWidget: false,
};

export function toInput(record: EmergencyProfileRecord | null | undefined): EmergencyProfileInput {
  if (!record) return EMPTY_PROFILE;
  return {
    fullName: record.fullName,
    dateOfBirth: record.dateOfBirth,
    bloodType: record.bloodType,
    knownAllergies: record.knownAllergies,
    chronicConditions: record.chronicConditions,
    emergencyContactNumber: record.emergencyContactNumber,
    showOnWidget: Boolean(record.showOnWidget),
  };
}

// ---- Dates (calendar dates, no time zone) -------------------------------------------------------

export function dateToIso(date: Date) {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** Local midnight of an ISO calendar date, or null. */
export function isoToDate(iso: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return null;
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

export function formatDateOfBirth(iso: string) {
  const date = isoToDate(iso);
  return date ? date.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : '';
}

export function ageOn(iso: string, now = new Date()): number | null {
  const dob = isoToDate(iso);
  if (!dob) return null;
  let age = now.getFullYear() - dob.getFullYear();
  if (now.getMonth() < dob.getMonth() || (now.getMonth() === dob.getMonth() && now.getDate() < dob.getDate())) age--;
  return age >= 0 ? age : null;
}

// ---- Saving -------------------------------------------------------------------------------------

function clean(input: EmergencyProfileInput): EmergencyProfileInput {
  const out: EmergencyProfileInput = {
    fullName: input.fullName.trim(),
    dateOfBirth: input.dateOfBirth,
    bloodType: (BLOOD_TYPES as readonly string[]).includes(input.bloodType) ? input.bloodType : '',
    knownAllergies: input.knownAllergies.trim(),
    chronicConditions: input.chronicConditions.trim(),
    // Keep what a dialer understands: digits, +, spaces, dashes, brackets.
    emergencyContactNumber: input.emergencyContactNumber.replace(/[^\d+\s()-]/g, '').trim(),
    showOnWidget: input.showOnWidget,
  };
  if (!out.fullName) throw new Error('Enter your full name so responders know who you are.');
  if (out.dateOfBirth) {
    const dob = isoToDate(out.dateOfBirth);
    if (!dob || dob.getTime() > Date.now()) throw new Error('The date of birth can’t be in the future.');
  }
  const digits = out.emergencyContactNumber.replace(/\D/g, '');
  if (out.emergencyContactNumber && (digits.length < 6 || digits.length > 15)) {
    throw new Error('Check the emergency contact number.');
  }
  return out;
}

/** Creates or updates the Medical ID. Throws an Error with a user-facing message. */
export async function saveEmergencyProfile(database: Database, input: EmergencyProfileInput) {
  const values = clean(input);
  // getSession() reads the session cached on the device, so this works offline.
  const { data } = await supabase.auth.getSession();
  const userId = data.session?.user.id;
  if (!userId) throw new Error('Sign in again to save your Medical ID.');

  const collection = database.get<EmergencyProfileRecord>('emergency_profile');
  await database.write(async () => {
    const existing = await collection.find(userId).catch(() => null);
    const assign = (r: EmergencyProfileRecord) => {
      Object.assign(r, values);
      r.updatedAt = Date.now();
    };
    if (existing) {
      await existing.update(assign);
    } else {
      await collection.create((r) => {
        r._raw.id = userId;
        r.userId = userId;
        assign(r);
      });
    }
  });
  void syncData();
}
