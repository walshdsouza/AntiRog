-- Lab results: biomarker readings read on the phone from a lab report (on-device OCR, see
-- src/lib/ocr.ts and src/lib/report-parser.ts) and saved by the patient. Synced with WatermelonDB
-- (src/lib/sync.js) exactly like visits. Only the extracted values are stored; the report image never
-- leaves the phone.
--
-- Private to the patient, like visits: guardians get no access to this table.
--
-- Assumes public.sync_now() from the server contract in src/lib/sync.js.
--
-- Run this BEFORE shipping the app version with schema v8: the app pulls public.lab_results on every
-- sync, and sync fails while the table is missing.

create table public.lab_results (
  id text primary key,                          -- WatermelonDB record id
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  biomarker text not null,                      -- BiomarkerKey, e.g. 'hba1c', 'blood_pressure'
  value double precision not null,              -- canonical unit; systolic for blood pressure
  value2 double precision,                      -- diastolic, blood pressure only
  unit text not null default '',                -- e.g. 'mg/dL', '%', 'mmHg'
  flag text not null default 'normal' check (flag in ('low', 'normal', 'high')),
  measured_at bigint not null,                  -- ms, local midnight of the report date
  report_name text not null default '',         -- file name / label of the source report
  created_at bigint not null,                   -- ms, set by the app
  server_created_at bigint not null default 0,  -- ms, set by trigger
  last_modified_at bigint not null default 0,   -- ms, set by trigger
  deleted_at bigint                             -- ms, soft delete
);

create index lab_results_user_modified_idx on public.lab_results (user_id, last_modified_at);
create index lab_results_user_biomarker_idx on public.lab_results (user_id, biomarker, measured_at);

-- ---------------------------------------------------------------------------------------------
-- Sync timestamps
-- ---------------------------------------------------------------------------------------------

create function public.lab_results_touch()
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

create trigger lab_results_touch
  before insert or update on public.lab_results
  for each row execute function public.lab_results_touch();

-- ---------------------------------------------------------------------------------------------
-- Row-level security: owner only. Soft deletes are updates, so there is no DELETE policy.
-- ---------------------------------------------------------------------------------------------

alter table public.lab_results enable row level security;

create policy "Owners read their lab results"
  on public.lab_results for select to authenticated
  using (user_id = (select auth.uid()));

create policy "Owners add lab results"
  on public.lab_results for insert to authenticated
  with check (user_id = (select auth.uid()));

create policy "Owners update their lab results"
  on public.lab_results for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
