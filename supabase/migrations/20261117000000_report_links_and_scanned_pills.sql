-- Schema v9 of the app:
--   1. Lab results remember which saved report they came from (lab_results.document_id), so deleting
--      a report from Reports › Tests also deletes its readings.
--   2. Lab reports scanned in Reports › Tests are saved as visit_documents with no visit
--      (visit_id = ''), so every lab report appears in one list. No schema change needed for that.
--   3. A history of pills identified with the pill scanner (public.scanned_pills).
--
-- Synced with WatermelonDB (src/lib/sync.js). Assumes public.sync_now() from the server contract in
-- src/lib/sync.js, and public.lab_results from 20261116000000_lab_results.sql.
--
-- Run this BEFORE shipping the app version with schema v9: the app pulls public.scanned_pills on
-- every sync, and sync fails while the table is missing.

-- ---------------------------------------------------------------------------------------------
-- Lab results: the report they were read from
-- ---------------------------------------------------------------------------------------------

-- No foreign key on purpose: a reading created offline may reach the server before its document.
alter table public.lab_results add column if not exists document_id text;

create index if not exists lab_results_document_id_idx on public.lab_results (document_id);

-- ---------------------------------------------------------------------------------------------
-- Scanned pills
-- ---------------------------------------------------------------------------------------------

create table if not exists public.scanned_pills (
  id text primary key,                          -- WatermelonDB record id
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null default '',                -- display name: medication name or model label
  label text not null default '',               -- the model's raw class label
  drug text not null default '',                -- standard drug name, '' if not a known medication
  confidence double precision not null default 0 check (confidence >= 0 and confidence <= 1),
  scanned_at bigint not null,                   -- ms, when the pill was identified
  server_created_at bigint not null default 0,  -- ms, set by trigger
  last_modified_at bigint not null default 0,   -- ms, set by trigger
  deleted_at bigint                             -- ms, soft delete
);

create index if not exists scanned_pills_user_modified_idx on public.scanned_pills (user_id, last_modified_at);
create index if not exists scanned_pills_user_scanned_idx on public.scanned_pills (user_id, scanned_at desc);

-- ---------------------------------------------------------------------------------------------
-- Sync timestamps
-- ---------------------------------------------------------------------------------------------

create or replace function public.scanned_pills_touch()
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

drop trigger if exists scanned_pills_touch on public.scanned_pills;
create trigger scanned_pills_touch
  before insert or update on public.scanned_pills
  for each row execute function public.scanned_pills_touch();

-- ---------------------------------------------------------------------------------------------
-- Row-level security: owner only, like visits. Soft deletes are updates, so there is no DELETE
-- policy.
-- ---------------------------------------------------------------------------------------------

alter table public.scanned_pills enable row level security;

create policy "Owners read their scanned pills"
  on public.scanned_pills for select to authenticated
  using (user_id = (select auth.uid()));

create policy "Owners add scanned pills"
  on public.scanned_pills for insert to authenticated
  with check (user_id = (select auth.uid()));

create policy "Owners update their scanned pills"
  on public.scanned_pills for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
