-- Biscuit: PACC 911 rescue case tracker for the Rowley Family Charitable Giving Trust
-- Lives in its own "biscuit" schema inside a shared Supabase project.
-- Access is gated to an explicit allow-list of emails (biscuit.app_users).

create extension if not exists pgcrypto;

create schema if not exists biscuit;

-- ---------------------------------------------------------------------------
-- Access control: only allow-listed emails may touch biscuit data.
-- The shared project hosts other apps whose users share auth.users.
-- ---------------------------------------------------------------------------

create table biscuit.app_users (
  email text primary key,
  display_name text,
  created_at timestamptz not null default now()
);

create or replace function biscuit.is_app_user()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from biscuit.app_users
    where email = lower(coalesce(auth.jwt() ->> 'email', ''))
  );
$$;

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------

create type biscuit.case_status as enum (
  'new',              -- ingested from Barry's email, draft queued
  'accepted',         -- Chelsea committed to help (intro email sent or sending)
  'owner_contacted',  -- intro email sent to the owner
  'vet_account_set',  -- Chelsea added to the animal's vet account
  'paid',             -- payment made to the vet
  'closed',           -- all done
  'denied'            -- declined; reason recorded
);

create type biscuit.email_kind as enum ('case_request', 'receipt', 'other');

-- ---------------------------------------------------------------------------
-- Owners: the people whose animals we help (repeat players matter)
-- ---------------------------------------------------------------------------

create table biscuit.owners (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text,
  phone text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index owners_email_idx on biscuit.owners (lower(email));

-- ---------------------------------------------------------------------------
-- Cases: one request from PACC 911 (an animal needing a procedure/meds)
-- ---------------------------------------------------------------------------

create table biscuit.cases (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references biscuit.owners(id) on delete set null,
  animal_name text,
  species text,
  breed text,
  situation text,                 -- what the animal needs help with
  amount numeric(10,2),           -- approximate cost from Barry's email
  vet_name text,
  vet_phone text,
  status biscuit.case_status not null default 'new',
  denial_reason text,
  source text not null default 'email',  -- 'email' | 'manual'
  gmail_thread_id text,
  gmail_message_id text,          -- Barry's original request message
  draft_gmail_id text,            -- the auto-created Gmail draft reply
  draft_subject text,
  draft_body text,                -- our copy of the drafted reply
  requested_at timestamptz not null default now(),
  accepted_at timestamptz,
  owner_contacted_at timestamptz,
  vet_account_set_at timestamptz,
  paid_at timestamptz,
  closed_at timestamptz,
  denied_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index cases_status_idx on biscuit.cases (status);
create index cases_owner_idx on biscuit.cases (owner_id);
create index cases_requested_at_idx on biscuit.cases (requested_at desc);
create unique index cases_gmail_message_idx on biscuit.cases (gmail_message_id) where gmail_message_id is not null;

-- ---------------------------------------------------------------------------
-- Case photos (only when Barry's email includes them)
-- ---------------------------------------------------------------------------

create table biscuit.case_photos (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references biscuit.cases(id) on delete cascade,
  storage_path text not null,
  filename text,
  content_type text,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Receipts: emailed (auto-filed + forwarded to Dext) or uploaded screenshots
-- ---------------------------------------------------------------------------

create table biscuit.receipts (
  id uuid primary key default gen_random_uuid(),
  case_id uuid references biscuit.cases(id) on delete set null,
  source text not null default 'email',   -- 'email' | 'upload'
  amount numeric(10,2),
  storage_path text,
  filename text,
  content_type text,
  gmail_message_id text,
  email_subject text,
  email_from text,
  forwarded_to_dext_at timestamptz,
  forward_error text,
  received_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index receipts_case_idx on biscuit.receipts (case_id);
create unique index receipts_gmail_message_idx on biscuit.receipts (gmail_message_id) where gmail_message_id is not null;

-- ---------------------------------------------------------------------------
-- Emails: every inbound message we processed (dedupe + audit trail)
-- ---------------------------------------------------------------------------

create table biscuit.emails (
  id uuid primary key default gen_random_uuid(),
  case_id uuid references biscuit.cases(id) on delete set null,
  gmail_message_id text unique,
  gmail_thread_id text,
  kind biscuit.email_kind not null default 'other',
  from_address text,
  to_addresses text,
  subject text,
  snippet text,
  body_text text,
  received_at timestamptz,
  processed_at timestamptz not null default now()
);

create index emails_case_idx on biscuit.emails (case_id);

-- ---------------------------------------------------------------------------
-- App settings (singleton row)
-- ---------------------------------------------------------------------------

create table biscuit.app_settings (
  id int primary key default 1 check (id = 1),
  pacc_sender_emails text[] not null default '{}',    -- Barry, Doug, etc.
  barry_bcc_email text,                               -- BCC'd on owner replies
  dext_email text,                                    -- receipts forwarded here
  family_recipient_emails text[] not null default '{}',
  monthly_recap_enabled boolean not null default false,
  reply_signature text,
  gmail_connected_email text,
  last_synced_at timestamptz,
  updated_at timestamptz not null default now()
);

insert into biscuit.app_settings (id) values (1);

-- ---------------------------------------------------------------------------
-- Gmail OAuth tokens (singleton; the app manages one dedicated mailbox)
-- ---------------------------------------------------------------------------

create table biscuit.gmail_tokens (
  id int primary key default 1 check (id = 1),
  refresh_token text not null,
  access_token text,
  access_token_expires_at timestamptz,
  email text,
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Monthly recaps sent to family
-- ---------------------------------------------------------------------------

create table biscuit.recaps (
  id uuid primary key default gen_random_uuid(),
  period_month date not null unique,   -- first day of the month covered
  narrative text,
  stats jsonb,
  sent_at timestamptz,
  sent_to text[],
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Activity log (case timeline + sync audit)
-- ---------------------------------------------------------------------------

create table biscuit.activity_log (
  id bigint generated always as identity primary key,
  case_id uuid references biscuit.cases(id) on delete cascade,
  event text not null,
  detail text,
  created_at timestamptz not null default now()
);

create index activity_case_idx on biscuit.activity_log (case_id, created_at desc);

-- ---------------------------------------------------------------------------
-- updated_at triggers
-- ---------------------------------------------------------------------------

create or replace function biscuit.set_updated_at() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger owners_updated_at before update on biscuit.owners
  for each row execute function biscuit.set_updated_at();
create trigger cases_updated_at before update on biscuit.cases
  for each row execute function biscuit.set_updated_at();
create trigger settings_updated_at before update on biscuit.app_settings
  for each row execute function biscuit.set_updated_at();
create trigger gmail_tokens_updated_at before update on biscuit.gmail_tokens
  for each row execute function biscuit.set_updated_at();

-- ---------------------------------------------------------------------------
-- Row level security: allow-listed authenticated users only.
-- ---------------------------------------------------------------------------

alter table biscuit.app_users enable row level security;
alter table biscuit.owners enable row level security;
alter table biscuit.cases enable row level security;
alter table biscuit.case_photos enable row level security;
alter table biscuit.receipts enable row level security;
alter table biscuit.emails enable row level security;
alter table biscuit.app_settings enable row level security;
alter table biscuit.gmail_tokens enable row level security;
alter table biscuit.recaps enable row level security;
alter table biscuit.activity_log enable row level security;

create policy app_users_all on biscuit.app_users for all to authenticated
  using (biscuit.is_app_user()) with check (biscuit.is_app_user());
create policy owners_all on biscuit.owners for all to authenticated
  using (biscuit.is_app_user()) with check (biscuit.is_app_user());
create policy cases_all on biscuit.cases for all to authenticated
  using (biscuit.is_app_user()) with check (biscuit.is_app_user());
create policy case_photos_all on biscuit.case_photos for all to authenticated
  using (biscuit.is_app_user()) with check (biscuit.is_app_user());
create policy receipts_all on biscuit.receipts for all to authenticated
  using (biscuit.is_app_user()) with check (biscuit.is_app_user());
create policy emails_all on biscuit.emails for all to authenticated
  using (biscuit.is_app_user()) with check (biscuit.is_app_user());
create policy app_settings_all on biscuit.app_settings for all to authenticated
  using (biscuit.is_app_user()) with check (biscuit.is_app_user());
create policy gmail_tokens_all on biscuit.gmail_tokens for all to authenticated
  using (biscuit.is_app_user()) with check (biscuit.is_app_user());
create policy recaps_all on biscuit.recaps for all to authenticated
  using (biscuit.is_app_user()) with check (biscuit.is_app_user());
create policy activity_all on biscuit.activity_log for all to authenticated
  using (biscuit.is_app_user()) with check (biscuit.is_app_user());

-- ---------------------------------------------------------------------------
-- Grants so PostgREST can serve the schema (RLS still applies)
-- ---------------------------------------------------------------------------

grant usage on schema biscuit to anon, authenticated, service_role;
grant all on all tables in schema biscuit to anon, authenticated, service_role;
grant all on all sequences in schema biscuit to anon, authenticated, service_role;
grant execute on all functions in schema biscuit to anon, authenticated, service_role;
alter default privileges in schema biscuit
  grant all on tables to anon, authenticated, service_role;
alter default privileges in schema biscuit
  grant all on sequences to anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Storage buckets (project-wide namespace, so prefixed with biscuit-)
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public) values
  ('biscuit-receipts', 'biscuit-receipts', false),
  ('biscuit-photos', 'biscuit-photos', false)
on conflict (id) do nothing;

create policy biscuit_storage_all on storage.objects
  for all to authenticated
  using (bucket_id in ('biscuit-receipts', 'biscuit-photos') and biscuit.is_app_user())
  with check (bucket_id in ('biscuit-receipts', 'biscuit-photos') and biscuit.is_app_user());
