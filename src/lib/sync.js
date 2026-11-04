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
 *   -- plus policies, e.g. allow select/insert/update for authenticated users.
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
  }
}

// PostgREST caps responses (1000 rows by default), so page through the changes.
async function fetchChangedRows(since) {
  const rows = []
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await supabase
      .from(TABLE)
      .select('*')
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

async function pullChanges({ lastPulledAt }) {
  const since = lastPulledAt ?? 0

  // The timestamp must come from the server and be taken BEFORE reading changes.
  const { data: timestamp, error: timeError } = await supabase.rpc('sync_now')
  if (timeError) throw toError(timeError)

  const rows = await fetchChangedRows(since)

  const created = []
  const updated = []
  const deleted = []
  for (const row of rows) {
    if (row.deleted_at !== null) {
      // Nothing to delete locally on the very first pull.
      if (lastPulledAt) deleted.push(row.id)
    } else if (Number(row.server_created_at) > since) {
      created.push(toRaw(row))
    } else {
      updated.push(toRaw(row))
    }
  }

  return { changes: { [TABLE]: { created, updated, deleted } }, timestamp: Number(timestamp) }
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

  if (deleted.length) {
    const { error } = await supabase.from(TABLE).update({ deleted_at: Date.now() }).in('id', deleted)
    if (error) throw toError(error)
  }
}

async function run() {
  try {
    const { data, error } = await supabase.auth.getSession()
    if (error) throw error
    if (!data.session) return { ok: false, skipped: true, reason: 'not-signed-in' }

    await synchronize({ database, pullChanges, pushChanges })
    return { ok: true }
  } catch (error) {
    if (isOfflineError(error)) {
      // Expected when the device has no connection: local data is untouched, try again later.
      console.log('[sync] Offline, skipping sync.')
      return { ok: false, offline: true }
    }
    console.warn('[sync] Sync failed:', error)
    return { ok: false, error }
  }
}

let inFlight = null

/**
 * Syncs the local WatermelonDB with Supabase. Never throws.
 * Resolves to { ok: true } or { ok: false, offline | skipped | error }.
 */
export function syncData() {
  // Overlapping syncs would race each other, so share the one already running.
  if (!inFlight) {
    inFlight = run().finally(() => {
      inFlight = null
    })
  }
  return inFlight
}
