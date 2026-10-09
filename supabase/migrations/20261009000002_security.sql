-- Daily English — row-level security, grants, RPCs and dashboard views.
--
-- Rules (see spec "Row-level security rules"):
--   learner  reads own rows; writes only own progress rows, and session-scoped
--            rows only for today's in-progress session
--   viewer   reads linked learners' rows (minus hidden writing); never writes
--   admin    reads everything; writes content tables
--   service  bypasses RLS (API routes after server-side checks, cron, scripts)

-- ---------------------------------------------------------------------------
-- Role helpers (security definer so policies don't recurse through profiles)
-- ---------------------------------------------------------------------------

create or replace function public.my_role() returns text
language sql stable security definer
set search_path = ''
as $$ select role from public.profiles where id = auth.uid() $$;

create or replace function public.is_admin() returns boolean
language sql stable security definer
set search_path = ''
as $$ select coalesce((select role = 'admin' from public.profiles where id = auth.uid()), false) $$;

create or replace function public.is_learner() returns boolean
language sql stable security definer
set search_path = ''
as $$ select coalesce((select role = 'learner' from public.profiles where id = auth.uid()), false) $$;

create or replace function public.can_view(learner uuid) returns boolean
language sql stable security definer
set search_path = ''
as $$
  select auth.uid() = learner
      or exists (select 1 from public.family_links
                 where viewer_id = auth.uid() and learner_id = learner)
      or coalesce((select role = 'admin' from public.profiles where id = auth.uid()), false)
      -- cron/scripts use the service role (views run as owner, so they need this explicitly)
      or coalesce(auth.jwt() ->> 'role', '') = 'service_role'
$$;

create or replace function public.learner_today(uid uuid) returns date
language sql stable security definer
set search_path = ''
as $$ select public.local_day(timezone) from public.profiles where id = uid $$;

create or replace function public.is_today_session(sid uuid) returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.sessions s
    where s.id = sid
      and s.user_id = auth.uid()
      and s.status = 'in_progress'
      and s.local_date = public.learner_today(auth.uid())
  )
$$;

-- ---------------------------------------------------------------------------
-- Grants: deny by default, then open exactly what policies need.
-- ---------------------------------------------------------------------------

revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;
grant select on all tables in schema public to authenticated;
grant usage on all sequences in schema public to authenticated;

grant insert, update on public.sessions, public.cards, public.lookups, public.placements, public.settings
  to authenticated;
grant insert on public.review_logs, public.attempts to authenticated;
grant update (hidden_from_viewers) on public.writing_submissions to authenticated;

grant insert, update, delete on public.topics, public.grammar_points, public.grammar_items,
  public.dictionary_entries, public.vocab_items, public.reading_passages,
  public.reading_questions, public.writing_tasks, public.word_lists
  to authenticated;

alter default privileges in schema public revoke all on tables from anon, authenticated;

-- ---------------------------------------------------------------------------
-- Enable RLS everywhere
-- ---------------------------------------------------------------------------

do $$
declare t text;
begin
  for t in select tablename from pg_tables where schemaname = 'public' loop
    execute format('alter table public.%I enable row level security', t);
  end loop;
end $$;

-- People ---------------------------------------------------------------------

create policy "profiles: self, linked, admin" on public.profiles for select
  to authenticated using (id = auth.uid() or public.can_view(id) or public.is_admin());

create policy "family_links: participants" on public.family_links for select
  to authenticated using (viewer_id = auth.uid() or learner_id = auth.uid() or public.is_admin());

create policy "settings: read own or linked" on public.settings for select
  to authenticated using (public.can_view(user_id));
create policy "settings: learner/admin insert own" on public.settings for insert
  to authenticated with check (user_id = auth.uid() and public.my_role() in ('learner', 'admin'));
create policy "settings: learner/admin update own" on public.settings for update
  to authenticated using (user_id = auth.uid() and public.my_role() in ('learner', 'admin'))
  with check (user_id = auth.uid());

-- Content ----------------------------------------------------------------------

create policy "topics: read" on public.topics for select to authenticated using (true);
create policy "grammar_points: read" on public.grammar_points for select to authenticated using (true);
create policy "dictionary: read" on public.dictionary_entries for select to authenticated using (true);
create policy "word_lists: read" on public.word_lists for select to authenticated using (true);

create policy "grammar_items: read live or own" on public.grammar_items for select to authenticated
  using ((owner_id is null and public.is_live(status, created_at))
         or (owner_id is not null and public.can_view(owner_id))
         or public.is_admin());
create policy "vocab_items: read live or own" on public.vocab_items for select to authenticated
  using ((owner_id is null and public.is_live(status, created_at))
         or (owner_id is not null and public.can_view(owner_id))
         or public.is_admin());
create policy "reading_passages: read live" on public.reading_passages for select to authenticated
  using (public.is_live(status, created_at) or public.is_admin());
create policy "reading_questions: read with passage" on public.reading_questions for select to authenticated
  using (exists (select 1 from public.reading_passages p where p.id = passage_id));
create policy "writing_tasks: read live" on public.writing_tasks for select to authenticated
  using (public.is_live(status, created_at) or public.is_admin());

do $$
declare t text;
begin
  foreach t in array array['topics', 'grammar_points', 'grammar_items', 'dictionary_entries',
                           'vocab_items', 'reading_passages', 'reading_questions',
                           'writing_tasks', 'word_lists'] loop
    execute format('create policy "%s: admin insert" on public.%I for insert to authenticated with check (public.is_admin())', t, t);
    execute format('create policy "%s: admin update" on public.%I for update to authenticated using (public.is_admin()) with check (public.is_admin())', t, t);
    execute format('create policy "%s: admin delete" on public.%I for delete to authenticated using (public.is_admin())', t, t);
  end loop;
end $$;

-- Progress -------------------------------------------------------------------

create policy "sessions: read own or linked" on public.sessions for select
  to authenticated using (public.can_view(user_id));
create policy "sessions: learner starts today" on public.sessions for insert
  to authenticated with check (
    user_id = auth.uid() and public.is_learner()
    and local_date = public.learner_today(auth.uid())
    and status = 'in_progress');
create policy "sessions: learner updates today's open session" on public.sessions for update
  to authenticated
  using (user_id = auth.uid() and public.is_learner()
         and status = 'in_progress' and local_date = public.learner_today(auth.uid()))
  with check (user_id = auth.uid() and local_date = public.learner_today(auth.uid()));

create policy "cards: read own or linked" on public.cards for select
  to authenticated using (public.can_view(user_id));
create policy "cards: learner insert own" on public.cards for insert
  to authenticated with check (user_id = auth.uid() and public.is_learner());
create policy "cards: learner update own" on public.cards for update
  to authenticated using (user_id = auth.uid() and public.is_learner())
  with check (user_id = auth.uid());

create policy "review_logs: read own or linked" on public.review_logs for select
  to authenticated using (public.can_view(user_id));
create policy "review_logs: today's session only" on public.review_logs for insert
  to authenticated with check (
    user_id = auth.uid() and public.is_learner() and public.is_today_session(session_id));

create policy "attempts: read own or linked" on public.attempts for select
  to authenticated using (public.can_view(user_id));
create policy "attempts: today's session or placement" on public.attempts for insert
  to authenticated with check (
    user_id = auth.uid() and public.is_learner()
    and (public.is_today_session(session_id) or (item_kind = 'placement' and session_id is null)));

create policy "writing: read own, linked unless hidden" on public.writing_submissions for select
  to authenticated using (
    auth.uid() = user_id or public.is_admin()
    or (public.can_view(user_id) and not hidden_from_viewers));
create policy "writing: learner hides own" on public.writing_submissions for update
  to authenticated using (user_id = auth.uid() and public.is_learner())
  with check (user_id = auth.uid());

create policy "writing_errors: follow submission" on public.writing_errors for select
  to authenticated using (exists (select 1 from public.writing_submissions s where s.id = submission_id));

create policy "weakness: read own or linked" on public.weakness for select
  to authenticated using (public.can_view(user_id));

create policy "lookups: read own or linked" on public.lookups for select
  to authenticated using (public.can_view(user_id));
create policy "lookups: learner insert own" on public.lookups for insert
  to authenticated with check (user_id = auth.uid() and public.is_learner());
create policy "lookups: learner update own" on public.lookups for update
  to authenticated using (user_id = auth.uid() and public.is_learner())
  with check (user_id = auth.uid());

create policy "placements: read own or linked" on public.placements for select
  to authenticated using (public.can_view(user_id));
create policy "placements: learner insert own" on public.placements for insert
  to authenticated with check (user_id = auth.uid() and public.is_learner());
create policy "placements: learner update own" on public.placements for update
  to authenticated using (user_id = auth.uid() and public.is_learner())
  with check (user_id = auth.uid());

-- Family + ops -----------------------------------------------------------------

create policy "summaries: read linked" on public.weekly_summaries for select
  to authenticated using (public.can_view(learner_id));
create policy "ai_calls: admin read" on public.ai_calls for select
  to authenticated using (public.is_admin());
create policy "session_resets: admin read" on public.session_resets for select
  to authenticated using (public.is_admin());
create policy "content_batches: admin read" on public.content_batches for select
  to authenticated using (public.is_admin());

-- ---------------------------------------------------------------------------
-- Dictionary search RPCs
-- ---------------------------------------------------------------------------

-- Vietnamese → English, accent-insensitive: "o nhiem" finds "ô nhiễm".
create or replace function public.dict_search_vi(q text, lim int default 12)
returns setof public.dictionary_entries
language sql stable
set search_path = ''
as $$
  with folded as (select public.vi_fold(q) as f)
  select d.* from public.dictionary_entries d, folded
  where d.search_vi @@ phraseto_tsquery('simple', folded.f)
     or d.gloss_vi_folded like '%' || folded.f || '%'
  order by (d.search_vi @@ phraseto_tsquery('simple', folded.f)) desc,
           position(folded.f in d.gloss_vi_folded),
           d.freq_rank nulls last
  limit lim
$$;

-- English prefix search on lemma.
create or replace function public.dict_prefix(q text, lim int default 12)
returns setof public.dictionary_entries
language sql stable
set search_path = ''
as $$
  select d.* from public.dictionary_entries d
  where lower(d.lemma) like lower(q) || '%'
  order by (lower(d.lemma) = lower(q)) desc, d.freq_rank nulls last, length(d.lemma)
  limit lim
$$;

revoke execute on all functions in schema public from anon;
grant execute on function public.dict_search_vi(text, int), public.dict_prefix(text, int),
  public.can_view(uuid), public.is_admin(), public.is_learner(), public.my_role(),
  public.learner_today(uuid), public.local_day(text, timestamptz)
  to authenticated;

-- ---------------------------------------------------------------------------
-- Dashboard views
-- These run with owner rights so hidden writing still counts in metrics
-- (spec: "hidden pieces still count in the metrics"); each filters by can_view().
-- ---------------------------------------------------------------------------

create table public.vocab_snapshots (
  user_id     uuid not null references public.profiles (id) on delete cascade,
  local_date  date not null,
  learning    int not null default 0,
  review      int not null default 0,
  mastered    int not null default 0,
  primary key (user_id, local_date)
);
alter table public.vocab_snapshots enable row level security;
grant select on public.vocab_snapshots to authenticated;
create policy "vocab_snapshots: read linked" on public.vocab_snapshots for select
  to authenticated using (public.can_view(user_id));

create view public.v_daily_activity as
  select s.user_id, s.local_date, s.kind, s.status, s.minutes, s.short_day,
         s.streak_ok, s.xp, s.skipped_blocks
  from public.sessions s
  where public.can_view(s.user_id);

create view public.v_error_density_weekly as
  with subs as (
    select w.id, w.user_id, date_trunc('week', w.local_date)::date as week_start, w.word_count
    from public.writing_submissions w
    where w.status = 'graded' and public.can_view(w.user_id)
  ), words as (
    select user_id, week_start, sum(word_count)::numeric as words
    from subs group by 1, 2
  ), errs as (
    select s.user_id, s.week_start, e.code, count(*)::numeric as n
    from subs s join public.writing_errors e on e.submission_id = s.id
    group by 1, 2, 3
  )
  select e.user_id, e.week_start, e.code,
         round(e.n * 100 / nullif(w.words, 0), 2) as per_100_words,
         e.n::int as errors, w.words::int as words
  from errs e join words w using (user_id, week_start);

create view public.v_vocab_states as
  select c.user_id,
         count(*) filter (where c.state in (0, 1, 3) or (c.state = 2 and c.stability < 2)) as learning,
         count(*) filter (where c.state = 2 and c.stability >= 2 and c.stability < 21) as review,
         count(*) filter (where c.state = 2 and c.stability >= 21) as mastered
  from public.cards c
  where c.item_type = 'vocab' and public.can_view(c.user_id)
  group by c.user_id;

create view public.v_reading_by_type as
  select a.user_id, date_trunc('week', a.local_date)::date as week_start, q.type,
         count(*) filter (where a.correct)::int as correct, count(*)::int as total
  from public.attempts a
  join public.reading_questions q on q.id = a.item_id
  where a.item_kind = 'reading' and public.can_view(a.user_id)
  group by 1, 2, 3;

create view public.v_review_recall_weekly as
  select r.user_id, date_trunc('week', r.created_at)::date as week_start,
         count(*) filter (where r.correct)::int as correct, count(*)::int as total
  from public.review_logs r
  where public.can_view(r.user_id)
  group by 1, 2;

grant select on public.v_daily_activity, public.v_error_density_weekly, public.v_vocab_states,
  public.v_reading_by_type, public.v_review_recall_weekly to authenticated;
