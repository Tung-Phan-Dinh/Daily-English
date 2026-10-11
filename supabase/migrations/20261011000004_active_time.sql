-- Accurate session time: the client reports active time (tab visible + recent
-- input) every ~20 s. Stored separately so it never disturbs the optimistic
-- lock on session progress.

alter table public.sessions add column if not exists active_ms bigint not null default 0;

-- Bump updated_at (the optimistic-lock version) only when something other than
-- the time counters changes, so time heartbeats can't conflict with answers.
create or replace function public.sessions_touch() returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (to_jsonb(new) - 'active_ms' - 'minutes' - 'updated_at')
     is distinct from (to_jsonb(old) - 'active_ms' - 'minutes' - 'updated_at') then
    new.updated_at = now();
  end if;
  return new;
end $$;

drop trigger if exists sessions_touch on public.sessions;
create trigger sessions_touch before update on public.sessions
  for each row execute function public.sessions_touch();

-- Add active time to today's session (owner only, at most ~1 minute per call).
create or replace function public.add_session_time(sid uuid, ms integer)
returns bigint
language plpgsql security definer
set search_path = ''
as $$
declare total bigint;
begin
  update public.sessions s
     set active_ms = s.active_ms + least(greatest(coalesce(ms, 0), 0), 65000),
         minutes   = greatest(s.minutes, round((s.active_ms + least(greatest(coalesce(ms, 0), 0), 65000)) / 60000.0)::int)
   where s.id = sid
     and s.user_id = auth.uid()
     -- 'completed' too: the last heartbeat arrives just after he taps Done.
     and s.status in ('in_progress', 'completed')
     and s.local_date = public.learner_today(auth.uid())
  returning s.active_ms into total;
  return total;  -- null when the session isn't today's open session
end $$;

revoke execute on function public.add_session_time(uuid, integer) from public, anon;
grant execute on function public.add_session_time(uuid, integer) to authenticated, service_role;
