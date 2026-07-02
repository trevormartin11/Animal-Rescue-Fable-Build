-- Supabase's managed PostgREST only serves dashboard-exposed schemas, so the
-- biscuit schema is reached through auto-updatable security_invoker views in
-- public. RLS on the base tables still applies (invoker security), and access
-- stays gated by biscuit.is_app_user().

create or replace view public.biscuit_app_users with (security_invoker = true) as
  select * from biscuit.app_users;
create or replace view public.biscuit_owners with (security_invoker = true) as
  select * from biscuit.owners;
create or replace view public.biscuit_cases with (security_invoker = true) as
  select * from biscuit.cases;
create or replace view public.biscuit_case_photos with (security_invoker = true) as
  select * from biscuit.case_photos;
create or replace view public.biscuit_receipts with (security_invoker = true) as
  select * from biscuit.receipts;
create or replace view public.biscuit_emails with (security_invoker = true) as
  select * from biscuit.emails;
create or replace view public.biscuit_app_settings with (security_invoker = true) as
  select * from biscuit.app_settings;
create or replace view public.biscuit_gmail_tokens with (security_invoker = true) as
  select * from biscuit.gmail_tokens;
create or replace view public.biscuit_recaps with (security_invoker = true) as
  select * from biscuit.recaps;
create or replace view public.biscuit_activity_log with (security_invoker = true) as
  select * from biscuit.activity_log;

grant select, insert, update, delete on
  public.biscuit_app_users,
  public.biscuit_owners,
  public.biscuit_cases,
  public.biscuit_case_photos,
  public.biscuit_receipts,
  public.biscuit_emails,
  public.biscuit_app_settings,
  public.biscuit_gmail_tokens,
  public.biscuit_recaps,
  public.biscuit_activity_log
to authenticated, service_role;

revoke all on
  public.biscuit_app_users,
  public.biscuit_owners,
  public.biscuit_cases,
  public.biscuit_case_photos,
  public.biscuit_receipts,
  public.biscuit_emails,
  public.biscuit_app_settings,
  public.biscuit_gmail_tokens,
  public.biscuit_recaps,
  public.biscuit_activity_log
from anon;
