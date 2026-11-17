-- Emergency Medical ID (schema v10 of the app): the details a first responder needs, shown in
-- Profile › Medical ID and, if the patient opts in, on a home screen widget. Synced with WatermelonDB
-- (src/lib/sync.js) exactly like visits.
--
-- One row per patient: the record id IS the user's id (as text), so two phones that each create the
-- profile offline write the same row instead of two.
--
-- Private to the patient: guardians get no access to this table.
--
-- Assumes public.sync_now() from the server contract in src/lib/sync.js.
--
-- Run this BEFORE shipping the app version with schema v10: the app pulls public.emergency_profile on
-- every sync, and sync fails while the table is missing.

create table if not exists public.emergency_profile (
  id text primary key,                          -- WatermelonDB record id = auth user id
  user_id uuid not null unique default auth.uid() references auth.users (id) on delete cascade,
  full_name text not null default '',
  date_of_birth text not null default '',       -- 'YYYY-MM-DD' (a calendar date, no time zone) or ''
  blood_type text not null default ''
    check (blood_type in ('', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-')),
  known_allergies text not null default '',
  chronic_conditions text not null default '',
  emergency_contact_number text not null default '',
  show_on_widget boolean not null default false, -- opt-in: the widget is visible without unlocking
  updated_at bigint not null,                   -- ms, set by the app
  server_created_at bigint not null default 0,  -- ms, set by trigger
  last_modified_at bigint not null default 0,   -- ms, set by trigger
  deleted_at bigint,                            -- ms, soft delete
  constraint emergency_profile_id_is_user check (id = user_id::text),
  constraint emergency_profile_date_of_birth_format
    check (date_of_birth = '' or date_of_birth ~ '^\d{4}-\d{2}-\d{2}$')
);

create index if not exists emergency_profile_user_modified_idx
  on public.emergency_profile (user_id, last_modified_at);

-- ---------------------------------------------------------------------------------------------
-- Sync timestamps
-- ---------------------------------------------------------------------------------------------

create or replace function public.emergency_profile_touch()
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

drop trigger if exists emergency_profile_touch on public.emergency_profile;
create trigger emergency_profile_touch
  before insert or update on public.emergency_profile
  for each row execute function public.emergency_profile_touch();

-- ---------------------------------------------------------------------------------------------
-- Row-level security: owner only. Soft deletes are updates, so there is no DELETE policy.
-- ---------------------------------------------------------------------------------------------

alter table public.emergency_profile enable row level security;

create policy "Owners read their emergency profile"
  on public.emergency_profile for select to authenticated
  using (user_id = (select auth.uid()));

create policy "Owners add their emergency profile"
  on public.emergency_profile for insert to authenticated
  with check (user_id = (select auth.uid()));

create policy "Owners update their emergency profile"
  on public.emergency_profile for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
