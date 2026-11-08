import { synchronize } from '@nozbe/watermelondb/sync'

import { supabase } from '@/lib/supabase'

import { database } from '../../database'

/*
 * Server contract (run once in the Supabase SQL editor; adjust RLS to your needs).
 *
 *   create table public.prescriptions (
 *     id text primary key,                         -- WatermelonDB record id
 *     medication text not null default '',
 *     dosage text not null default '',
 *     created_at bigint not null,                  -- ms, set by the app
 *     user_id uuid not null references auth.users (id),
 *     standard_name text not null default '',      -- schema v3
 *     is_high_risk boolean not null default false, -- schema v3
 *     reminder_enabled boolean not null default false, -- schema v5
 *     reminder_minutes integer,                     -- schema v5, minutes after local midnight
 *     server_created_at bigint not null default 0, -- ms, set by trigger
 *     last_modified_at bigint not null default 0,  -- ms, set by trigger
 *     deleted_at bigint                            -- ms, soft delete
 *   );
 *
 *   create function public.sync_now() returns bigint language sql stable as $$
 *     select (extract(epoch from clock_timestamp()) * 1000)::bigint
 *   $$;
 *
 *   create function public.prescriptions_touch() returns trigger language plpgsql as $$
 *   begin
 *     if tg_op = 'INSERT' then new.server_created_at := public.sync_now(); end if;
 *     new.last_modified_at := public.sync_now();
 *     return new;
 *   end $$;
 *
 *   create trigger prescriptions_touch before insert or update
 *     on public.prescriptions for each row execute function public.prescriptions_touch();
 *
 *   alter table public.prescriptions enable row level security;
 *
 * Row-level security policies (owner-only, plus read access for linked guardians) live in
 * supabase/migrations/.
 */

const TABLE = 'prescriptions'
const PAGE_SIZE = 1000

const OFFLINE_PATTERN =
  /network request failed|failed to fetch|fetch failed|network error|networkerror|internet connection|timed out|timeout|offline|enotfound|econnrefused/i

function isOfflineError(error) {
  return OFFLINE_PATTERN.test(String(error?.message ?? error ?? ''))
}

// Supabase returns plain error objects; turn them into real Errors so they can be thrown and inspected.
function toError(error) {
  if (error instanceof Error) return error
  const err = new Error(error?.message || 'Supabase request failed')
  err.code = error?.code
  return err
}

function toRaw(row) {
  return {
    id: row.id,
    medication: row.medication,
    dosage: row.dosage,
    created_at: Number(row.created_at),
    user_id: row.user_id ?? '',
    // Must round-trip through Supabase: a pull replaces the whole local row, so a column the server
    // doesn't send would be reset to its default on every sync.
    standard_name: row.standard_name ?? '',
    is_high_risk: Boolean(row.is_high_risk),
    reminder_enabled: Boolean(row.reminder_enabled),
    reminder_minutes: row.reminder_minutes == null ? null : Number(row.reminder_minutes),
  }
}

// PostgREST caps responses (1000 rows by default), so page through the changes.
// Filtered to the signed-in user: RLS also lets guardians read their patients' prescriptions, and
// those must never land in the guardian's own vault.
async function fetchChangedRows(userId, since) {
  const rows = []
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await supabase
      .from(TABLE)
      .select('*')
      .eq('user_id', userId)
      .gt('last_modified_at', since)
      .order('last_modified_at')
      .order('id')
      .range(from, from + PAGE_SIZE - 1)
    if (error) throw toError(error)
    rows.push(...data)
    if (data.length < PAGE_SIZE) break
  }
  return rows
}

async function pullChanges(userId, { lastPulledAt }) {
  const since = lastPulledAt ?? 0

  // The timestamp must come from the server and be taken BEFORE reading changes.
  const { data: timestamp, error: timeError } = await supabase.rpc('sync_now')
  if (timeError) throw toError(timeError)

  const rows = await fetchChangedRows(userId, since)

  // Everything live is sent as "updated" (with sendCreatedAsUpdated). Records this device pushed come back
  // on the next pull; sending them as "created" would make WatermelonDB log an error for each one.
  const updated = []
  const deleted = []
  for (const row of rows) {
    if (row.deleted_at != null) {
      // Nothing to delete locally on the very first pull.
      if (lastPulledAt) deleted.push(row.id)
    } else {
      updated.push(toRaw(row))
    }
  }

  return { changes: { [TABLE]: { created: [], updated, deleted } }, timestamp: Number(timestamp) }
}

async function pushChanges({ changes, lastPulledAt }) {
  const { created = [], updated = [], deleted = [] } = changes[TABLE] ?? {}
  if (!created.length && !updated.length && !deleted.length) return

  // If the server changed any of these records after our last pull, abort so the next sync pulls first.
  const touchedIds = [...updated.map((r) => r.id), ...deleted]
  if (touchedIds.length) {
    const { data, error } = await supabase
      .from(TABLE)
      .select('id')
      .in('id', touchedIds)
      .gt('last_modified_at', lastPulledAt ?? 0)
    if (error) throw toError(error)
    if (data.length) throw new Error('Sync conflict: records changed on the server. Will retry after pulling.')
  }

  // Records saved before user_id existed have it empty; they belong to whoever is signed in on this device.
  let fallbackUserId = null
  if ([...created, ...updated].some((r) => !r.user_id)) {
    const { data, error } = await supabase.auth.getSession()
    if (error) throw toError(error)
    fallbackUserId = data.session?.user.id ?? null
  }

  const upserts = [...created, ...updated].map((r) => ({
    ...toRaw(r),
    user_id: r.user_id || fallbackUserId,
  }))
  if (upserts.length) {
    const { error } = await supabase.from(TABLE).upsert(upserts, { onConflict: 'id' })
    if (error) throw toError(error)
  }

  if (deleted.length) await pushDeletions(deleted)
}

/*
 * Deletions are soft: the row stays and gets deleted_at, which bumps last_modified_at via the trigger.
 * That is how other devices learn about the deletion on their next pull (a hard DELETE would leave
 * them holding the record forever). The pull never returns soft-deleted rows as live records.
 */
async function pushDeletions(ids) {
  const { data, error } = await supabase
    .from(TABLE)
    .update({ deleted_at: Date.now() })
    .in('id', ids)
    .select('id')
  if (error) throw toError(error)

  const missing = ids.filter((id) => !data.some((row) => row.id === id))
  if (!missing.length) return

  // Row-level security turns a forbidden UPDATE into a silent no-op. If those rows are still visible,
  // the deletion was blocked, so fail loudly; rows that never reached the server need nothing.
  const { data: blocked, error: checkError } = await supabase.from(TABLE).select('id').in('id', missing)
  if (checkError) throw toError(checkError)
  if (blocked.length) {
    throw new Error(
      `Supabase refused to delete ${blocked.length} prescription(s). Check the UPDATE policy on public.${TABLE}.`,
    )
  }
}

async function run() {
  try {
    const { data, error } = await supabase.auth.getSession()
    if (error) throw error
    if (!data.session) return { ok: false, skipped: true, reason: 'not-signed-in' }

    const userId = data.session.user.id
    await synchronize({
      database,
      pullChanges: (params) => pullChanges(userId, params),
      pushChanges,
      sendCreatedAsUpdated: true,
    })
    return { ok: true }
  } catch (error) {
    if (isOfflineError(error)) {
      // Expected when the device has no connection: local data is untouched, try again later.
      console.log('[sync] Offline, skipping sync.')
      return { ok: false, offline: true }
    }
    // Surfaced to the user via the returned result; log quietly so it doesn't pop a LogBox warning.
    console.log('[sync] Sync failed:', error?.message ?? error)
    return { ok: false, error }
  }
}

let inFlight = null
let queued = null

/**
 * Syncs the local WatermelonDB with Supabase. Never throws.
 * Resolves to { ok: true } or { ok: false, offline | skipped | error }.
 */
export function syncData() {
  // Overlapping syncs would race each other. A sync that is already running may have collected its
  // local changes before this call, so queue exactly one follow-up run instead of sharing it.
  if (inFlight) {
    queued ??= inFlight.then(() => {
      queued = null
      return syncData()
    })
    return queued
  }
  inFlight = run().finally(() => {
    inFlight = null
  })
  return inFlight
}
