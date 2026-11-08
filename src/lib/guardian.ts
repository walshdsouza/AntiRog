import { supabase } from '@/lib/supabase';

/*
 * Guardian Sync (Step 4.1). Server side: supabase/migrations/20261108000000_guardian_sync.sql.
 * A patient creates an invite code, the guardian redeems it, and from then on the guardian can read
 * (never change) the patient's prescriptions and dose events. Guardian data is read straight from
 * Supabase and kept in memory; it never goes into the guardian's own WatermelonDB vault.
 */

export type GuardianLink = {
  id: string;
  patient_id: string;
  guardian_id: string;
  patient_email: string;
  guardian_email: string;
  created_at: string;
};

export type GuardianInvite = {
  code: string;
  patient_id: string;
  created_at: string;
  expires_at: string;
  used_at: string | null;
};

/** A prescription row as it is stored in Supabase (see the server contract in src/lib/sync.js). */
export type PatientPrescription = {
  id: string;
  user_id: string;
  medication: string;
  dosage: string;
  standard_name: string;
  is_high_risk: boolean;
  reminder_enabled: boolean;
  reminder_minutes: number | null;
  created_at: number;
  last_modified_at: number;
  deleted_at: number | null;
};

export type DoseStatus = 'taken' | 'skipped' | 'missed';

export type DoseEvent = {
  id: string;
  user_id: string;
  prescription_id: string;
  scheduled_at: number;
  status: DoseStatus;
  recorded_at: number;
  last_modified_at: number;
};

/** How far back the guardian's initial snapshot of dose events reaches. */
export const DOSE_HISTORY_MS = 7 * 24 * 60 * 60 * 1000;
const DOSE_HISTORY_LIMIT = 500;

function toError(error: { message?: string; code?: string } | Error) {
  if (error instanceof Error) return error;
  const err = new Error(error.message || 'Supabase request failed') as Error & { code?: string };
  err.code = error.code;
  return err;
}

// Postgres bigint columns can arrive as strings; the app works in numbers.
function toNumber(value: unknown) {
  return typeof value === 'number' ? value : Number(value);
}

export function toPrescription(row: Record<string, unknown>): PatientPrescription {
  return {
    id: String(row.id),
    user_id: String(row.user_id),
    medication: String(row.medication ?? ''),
    dosage: String(row.dosage ?? ''),
    standard_name: String(row.standard_name ?? ''),
    is_high_risk: Boolean(row.is_high_risk),
    reminder_enabled: Boolean(row.reminder_enabled),
    reminder_minutes: row.reminder_minutes == null ? null : toNumber(row.reminder_minutes),
    created_at: toNumber(row.created_at),
    last_modified_at: toNumber(row.last_modified_at),
    deleted_at: row.deleted_at == null ? null : toNumber(row.deleted_at),
  };
}

export function toDoseEvent(row: Record<string, unknown>): DoseEvent {
  return {
    id: String(row.id),
    user_id: String(row.user_id),
    prescription_id: String(row.prescription_id),
    scheduled_at: toNumber(row.scheduled_at),
    status: row.status as DoseStatus,
    recorded_at: toNumber(row.recorded_at),
    last_modified_at: toNumber(row.last_modified_at),
  };
}

// ---- Patient side --------------------------------------------------------------------------

/** Creates a one-time code (valid 24 hours) for a guardian to enter. Revokes any earlier unused code. */
export async function createGuardianInvite(): Promise<GuardianInvite> {
  const { data, error } = await supabase.rpc('create_guardian_invite');
  if (error) throw toError(error);
  return data as GuardianInvite;
}

// ---- Guardian side -------------------------------------------------------------------------

/** Links this account as a guardian of the patient who created `code`. */
export async function acceptGuardianInvite(code: string): Promise<GuardianLink> {
  const { data, error } = await supabase.rpc('accept_guardian_invite', { p_code: code });
  if (error) throw toError(error);
  return data as GuardianLink;
}

// ---- Both sides ----------------------------------------------------------------------------

/** Links where `userId` is the guardian (`as: 'guardian'`) or the patient (`as: 'patient'`). */
export async function fetchLinks(userId: string, as: 'guardian' | 'patient'): Promise<GuardianLink[]> {
  const { data, error } = await supabase
    .from('guardian_links')
    .select('*')
    .eq(as === 'guardian' ? 'guardian_id' : 'patient_id', userId)
    .order('created_at');
  if (error) throw toError(error);
  return data as GuardianLink[];
}

/** Ends a link. Either the patient or the guardian may do this. */
export async function removeLink(linkId: string) {
  const { error } = await supabase.from('guardian_links').delete().eq('id', linkId);
  if (error) throw toError(error);
}

/** Current prescriptions and recent dose events of the given patients (RLS limits it to linked ones). */
export async function fetchPatientSnapshot(patientIds: string[]) {
  if (!patientIds.length) return { prescriptions: [], doses: [] };

  const [prescriptions, doses] = await Promise.all([
    supabase
      .from('prescriptions')
      .select('*')
      .in('user_id', patientIds)
      .is('deleted_at', null)
      .order('created_at', { ascending: false }),
    supabase
      .from('dose_events')
      .select('*')
      .in('user_id', patientIds)
      .gte('scheduled_at', Date.now() - DOSE_HISTORY_MS)
      .order('scheduled_at', { ascending: false })
      .limit(DOSE_HISTORY_LIMIT),
  ]);
  if (prescriptions.error) throw toError(prescriptions.error);
  if (doses.error) throw toError(doses.error);

  return {
    prescriptions: prescriptions.data.map(toPrescription),
    doses: doses.data.map(toDoseEvent),
  };
}
