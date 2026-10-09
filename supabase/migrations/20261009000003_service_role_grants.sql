-- Explicit grants for the service role (server routes after their own checks, cron, scripts).
-- Supabase normally grants these by default, but projects created with
-- "Automatically expose new tables" turned off may not — so don't rely on it.
-- RLS is still bypassed only by this role; anon/authenticated grants are unchanged.

grant usage on schema public to service_role;
grant all on all tables in schema public to service_role;
grant all on all sequences in schema public to service_role;
grant execute on all functions in schema public to service_role;

alter default privileges in schema public grant all on tables to service_role;
alter default privileges in schema public grant all on sequences to service_role;
alter default privileges in schema public grant execute on functions to service_role;
