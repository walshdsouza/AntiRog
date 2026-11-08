-- Step 4.1: Guardian Sync.
--
-- A patient links a guardian with a one-time invite code. Once linked, the guardian can READ (never
-- write) the patient's prescriptions and dose events, and receives changes to them over Supabase
-- Realtime. Realtime postgres_changes applies each subscriber's SELECT policies, so these RLS
-- policies are what decide who hears about what.
--
-- Assumes the objects from the server contract in src/lib/sync.js already exist:
-- public.prescriptions and public.sync_now().

-- ---------------------------------------------------------------------------------------------
-- Links
-- ---------------------------------------------------------------------------------------------

create table public.guardian_links (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references auth.users (id) on delete cascade,
  guardian_id uuid not null references auth.users (id) on delete cascade,
  -- Copied from auth.users when the invite is accepted, so each side can see who the other is
  -- without being given read access to auth.users.
  patient_email text not null default '',
  guardian_email text not null default '',
  created_at timestamptz not null default now(),
  unique (patient_id, guardian_id),
  check (patient_id <> guardian_id)
);

create index guardian_links_guardian_id_idx on public.guardian_links (guardian_id);

alter table public.guardian_links enable row level security;

-- Both sides can see the link and either side can end it. Links are only created through
-- accept_guardian_invite(), so there are no insert or update policies.
create policy "Linked users read their links"
  on public.guardian_links for select to authenticated
  using ((select auth.uid()) in (patient_id, guardian_id));

create policy "Linked users remove their links"
  on public.guardian_links for delete to authenticated
  using ((select auth.uid()) in (patient_id, guardian_id));

-- Used by the policies below. SECURITY DEFINER so the check does not depend on (or recurse into)
-- the caller's own policies on guardian_links.
create function public.is_guardian_of(p_patient_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.guardian_links
    where patient_id = p_patient_id
      and guardian_id = (select auth.uid())
  );
$$;

revoke execute on function public.is_guardian_of(uuid) from public, anon;
grant execute on function public.is_guardian_of(uuid) to authenticated;

-- ---------------------------------------------------------------------------------------------
-- Invites
-- ---------------------------------------------------------------------------------------------

create table public.guardian_invites (
  code text primary key,
  patient_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '24 hours',
  used_at timestamptz,
  used_by uuid references auth.users (id) on delete set null
);

create index guardian_invites_patient_id_idx on public.guardian_invites (patient_id);

alter table public.guardian_invites enable row level security;

-- Patients can see and revoke their own invites. Codes are created and redeemed only through the
-- functions below, so nobody can list or guess other people's codes through the API.
create policy "Patients read their invites"
  on public.guardian_invites for select to authenticated
  using (patient_id = (select auth.uid()));

create policy "Patients revoke their invites"
  on public.guardian_invites for delete to authenticated
  using (patient_id = (select auth.uid()));

-- Returns a fresh 8-character code (about 40 bits from a CSPRNG, valid for 24 hours) and revokes
-- any earlier unused code, so each patient has at most one live invite.
create function public.create_guardian_invite()
returns public.guardian_invites
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  -- 32 characters (no I, O, 0, 1), so `byte % 32` picks each one with equal probability.
  v_alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  v_uid uuid := auth.uid();
  v_bytes bytea;
  v_code text;
  v_invite public.guardian_invites;
begin
  if v_uid is null then
    raise exception 'Sign in to invite a guardian.' using errcode = '42501';
  end if;

  delete from public.guardian_invites where patient_id = v_uid and used_at is null;

  loop
    v_bytes := extensions.gen_random_bytes(8);
    v_code := '';
    for i in 0..7 loop
      v_code := v_code || substr(v_alphabet, 1 + get_byte(v_bytes, i) % 32, 1);
    end loop;
    begin
      insert into public.guardian_invites (code, patient_id)
      values (v_code, v_uid)
      returning * into v_invite;
      return v_invite;
    exception when unique_violation then
      null; -- Astronomically unlikely; just draw another code.
    end;
  end loop;
end;
$$;

-- Called by the guardian. Accepts the code with or without spaces or dashes, in any case.
create function public.accept_guardian_invite(p_code text)
returns public.guardian_links
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_code text := upper(regexp_replace(coalesce(p_code, ''), '[^A-Za-z0-9]', '', 'g'));
  v_invite public.guardian_invites;
  v_link public.guardian_links;
begin
  if v_uid is null then
    raise exception 'Sign in to accept an invite.' using errcode = '42501';
  end if;

  -- Lock the invite so two guardians can't redeem the same code at once.
  select * into v_invite from public.guardian_invites where code = v_code for update;

  if not found or v_invite.used_at is not null or v_invite.expires_at < now() then
    raise exception 'This invite code is invalid or has expired.' using errcode = 'P0001';
  end if;
  if v_invite.patient_id = v_uid then
    raise exception 'You can''t be your own guardian.' using errcode = 'P0001';
  end if;

  insert into public.guardian_links (patient_id, guardian_id, patient_email, guardian_email)
  values (
    v_invite.patient_id,
    v_uid,
    coalesce((select email from auth.users where id = v_invite.patient_id), ''),
    coalesce((select email from auth.users where id = v_uid), '')
  )
  -- Already linked: refresh the emails and return the existing link.
  on conflict (patient_id, guardian_id) do update
    set patient_email = excluded.patient_email,
        guardian_email = excluded.guardian_email
  returning * into v_link;

  update public.guardian_invites set used_at = now(), used_by = v_uid where code = v_code;

  return v_link;
end;
$$;

revoke execute on function public.create_guardian_invite() from public, anon;
revoke execute on function public.accept_guardian_invite(text) from public, anon;
grant execute on function public.create_guardian_invite() to authenticated;
grant execute on function public.accept_guardian_invite(text) to authenticated;

-- ---------------------------------------------------------------------------------------------
-- Dose events
-- ---------------------------------------------------------------------------------------------

-- One row per scheduled dose the patient's device has an outcome for. Shaped like prescriptions
-- (text ids, ms timestamps, server-set last_modified_at) so it can join the WatermelonDB sync later.
-- prescription_id has no foreign key on purpose: a dose logged offline may reach the server before
-- the prescription it belongs to.
create table public.dose_events (
  id text primary key default gen_random_uuid()::text,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  prescription_id text not null,
  scheduled_at bigint not null,                 -- ms, the dose's reminder time
  status text not null check (status in ('taken', 'skipped', 'missed')),
  recorded_at bigint not null,                  -- ms, device clock when the outcome was recorded
  server_created_at bigint not null default 0,  -- ms, set by trigger
  last_modified_at bigint not null default 0,   -- ms, set by trigger
  unique (prescription_id, scheduled_at)
);

create index dose_events_user_scheduled_idx on public.dose_events (user_id, scheduled_at desc);

create function public.dose_events_touch()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    new.server_created_at := public.sync_now();
  end if;
  new.last_modified_at := public.sync_now();
  return new;
end;
$$;

create trigger dose_events_touch
  before insert or update on public.dose_events
  for each row execute function public.dose_events_touch();

alter table public.dose_events enable row level security;

create policy "Patients read their dose events"
  on public.dose_events for select to authenticated
  using (user_id = (select auth.uid()));

create policy "Guardians read linked dose events"
  on public.dose_events for select to authenticated
  using (public.is_guardian_of(user_id));

create policy "Patients record their dose events"
  on public.dose_events for insert to authenticated
  with check (user_id = (select auth.uid()));

create policy "Patients update their dose events"
  on public.dose_events for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- ---------------------------------------------------------------------------------------------
-- Prescriptions: owner-only access, plus read access for guardians
-- ---------------------------------------------------------------------------------------------

-- Replace whatever policies exist. A broad "authenticated users can read" policy (as the old setup
-- note suggested) would let every account read every vault and make the guardian check pointless.
do $$
declare
  p record;
begin
  for p in
    select policyname from pg_policies where schemaname = 'public' and tablename = 'prescriptions'
  loop
    execute format('drop policy %I on public.prescriptions', p.policyname);
  end loop;
end;
$$;

alter table public.prescriptions enable row level security;

create index if not exists prescriptions_user_id_idx on public.prescriptions (user_id);

create policy "Owners read their prescriptions"
  on public.prescriptions for select to authenticated
  using (user_id = (select auth.uid()));

create policy "Guardians read linked prescriptions"
  on public.prescriptions for select to authenticated
  using (public.is_guardian_of(user_id));

create policy "Owners add prescriptions"
  on public.prescriptions for insert to authenticated
  with check (user_id = (select auth.uid()));

-- Covers soft deletes too (they set deleted_at). There is deliberately no DELETE policy.
create policy "Owners update their prescriptions"
  on public.prescriptions for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- ---------------------------------------------------------------------------------------------
-- Realtime
-- ---------------------------------------------------------------------------------------------

do $$
declare
  t text;
begin
  foreach t in array array['prescriptions', 'dose_events', 'guardian_links'] loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end;
$$;
