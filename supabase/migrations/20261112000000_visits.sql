-- Visits: hospital and clinic visits, the documents attached to them, and prescriptions added from a
-- visit. Synced with WatermelonDB (src/lib/sync.js) exactly like prescriptions.
--
-- Only document METADATA is stored here. The files themselves (photos, PDFs) stay on the phone that
-- attached them, at a path derived from the document id (see src/lib/visits.ts); they are never
-- uploaded. Visits are private to the patient: guardians get no access to these tables.
--
-- Assumes public.sync_now() from the server contract in src/lib/sync.js.

-- ---------------------------------------------------------------------------------------------
-- Prescriptions: the visit they were added from (optional)
-- ---------------------------------------------------------------------------------------------

-- No foreign key on purpose: a prescription created offline may reach the server before its visit.
alter table public.prescriptions add column if not exists visit_id text;

-- ---------------------------------------------------------------------------------------------
-- Visits
-- ---------------------------------------------------------------------------------------------

create table public.visits (
  id text primary key,                          -- WatermelonDB record id
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  visited_at bigint not null,                   -- ms, date of the visit (local midnight)
  facility text not null default '',            -- hospital or clinic
  doctor text not null default '',
  reason text not null default '',
  notes text not null default '',
  created_at bigint not null,                   -- ms, set by the app
  server_created_at bigint not null default 0,  -- ms, set by trigger
  last_modified_at bigint not null default 0,   -- ms, set by trigger
  deleted_at bigint                             -- ms, soft delete
);

create index visits_user_modified_idx on public.visits (user_id, last_modified_at);

-- ---------------------------------------------------------------------------------------------
-- Visit documents (metadata only)
-- ---------------------------------------------------------------------------------------------

-- visit_id has no foreign key for the same reason as prescriptions.visit_id.
create table public.visit_documents (
  id text primary key,                          -- WatermelonDB record id; also names the local file
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  visit_id text not null,
  kind text not null default 'other' check (kind in ('prescription', 'lab_report', 'other')),
  name text not null default '',                -- original file name, for display
  mime_type text not null default '',
  size bigint not null default 0,               -- bytes
  extension text not null default '',           -- e.g. '.pdf', so the file path can be rebuilt
  uploaded_at bigint not null,                  -- ms, when it was attached (kept for history)
  server_created_at bigint not null default 0,  -- ms, set by trigger
  last_modified_at bigint not null default 0,   -- ms, set by trigger
  deleted_at bigint                             -- ms, soft delete
);

create index visit_documents_user_modified_idx on public.visit_documents (user_id, last_modified_at);
create index visit_documents_visit_id_idx on public.visit_documents (visit_id);

-- ---------------------------------------------------------------------------------------------
-- Sync timestamps
-- ---------------------------------------------------------------------------------------------

create function public.visits_touch()
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

create trigger visits_touch
  before insert or update on public.visits
  for each row execute function public.visits_touch();

create trigger visit_documents_touch
  before insert or update on public.visit_documents
  for each row execute function public.visits_touch();

-- ---------------------------------------------------------------------------------------------
-- Row-level security: owner only. Soft deletes are updates, so there is no DELETE policy.
-- ---------------------------------------------------------------------------------------------

alter table public.visits enable row level security;
alter table public.visit_documents enable row level security;

create policy "Owners read their visits"
  on public.visits for select to authenticated
  using (user_id = (select auth.uid()));

create policy "Owners add visits"
  on public.visits for insert to authenticated
  with check (user_id = (select auth.uid()));

create policy "Owners update their visits"
  on public.visits for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy "Owners read their visit documents"
  on public.visit_documents for select to authenticated
  using (user_id = (select auth.uid()));

create policy "Owners add visit documents"
  on public.visit_documents for insert to authenticated
  with check (user_id = (select auth.uid()));

create policy "Owners update their visit documents"
  on public.visit_documents for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
