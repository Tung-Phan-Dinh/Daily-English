-- Daily English — core schema
-- Shared content (dictionary, grammar, reading, writing) is separated from
-- per-learner progress. RLS lives in the next migration.

create extension if not exists unaccent with schema extensions;
create extension if not exists pg_trgm with schema extensions;

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

-- unaccent() is only STABLE; wrap it so it can be used in indexes and triggers.
-- Vietnamese đ/Đ are mapped explicitly because some unaccent rule files skip them.
create or replace function public.vi_fold(t text) returns text
language sql immutable parallel safe
set search_path = ''
as $$
  select lower(extensions.unaccent('extensions.unaccent'::regdictionary,
         translate(coalesce(t, ''), 'đĐ', 'dD')))
$$;

-- A learner "day" runs 04:00 → 04:00 in their stored time zone.
create or replace function public.local_day(tz text, ts timestamptz default now())
returns date
language sql stable parallel safe
set search_path = ''
as $$
  select ((ts at time zone coalesce(tz, 'Asia/Ho_Chi_Minh')) - interval '4 hours')::date
$$;

create or replace function public.touch_updated_at() returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end $$;

-- ---------------------------------------------------------------------------
-- People
-- ---------------------------------------------------------------------------

create table public.profiles (
  id            uuid primary key references auth.users (id) on delete cascade,
  display_name  text not null default '',
  role          text not null default 'viewer' check (role in ('learner', 'viewer', 'admin')),
  ui_lang       text not null default 'en' check (ui_lang in ('en', 'vi')),
  timezone      text not null default 'Asia/Ho_Chi_Minh',
  created_at    timestamptz not null default now()
);

create table public.family_links (
  viewer_id   uuid not null references public.profiles (id) on delete cascade,
  learner_id  uuid not null references public.profiles (id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (viewer_id, learner_id)
);

create table public.settings (
  user_id            uuid primary key references public.profiles (id) on delete cascade,
  target_band        numeric(2,1) not null default 6.5 check (target_band between 5 and 9),
  new_words_per_day  int not null default 8 check (new_words_per_day between 5 and 15),
  accent             text not null default 'en-GB' check (accent in ('en-GB', 'en-US')),
  explain_lang       text not null default 'en' check (explain_lang in ('en', 'vi')),
  spellcheck         boolean not null default false,
  theme              text not null default 'system' check (theme in ('system', 'light', 'dark')),
  text_size          int not null default 100 check (text_size between 100 and 130),
  weekly_xp_goal     int not null default 400 check (weekly_xp_goal between 50 and 5000),
  sound              boolean not null default false,
  updated_at         timestamptz not null default now()
);

-- Every new auth user gets a least-privilege profile; the admin invite route
-- then promotes it (role, name, links) with the service role.
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(split_part(new.email, '@', 1), ''))
  on conflict (id) do nothing;
  insert into public.settings (user_id) values (new.id) on conflict do nothing;
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Content
-- ---------------------------------------------------------------------------

create table public.topics (
  id          serial primary key,
  slug        text not null unique,
  name_en     text not null,
  name_vi     text not null,
  week_order  int not null unique
);

create table public.grammar_points (
  id           serial primary key,
  slug         text not null unique,
  phase        int not null check (phase between 1 and 4),
  sort         int not null unique,
  title        text not null,
  title_vi     text not null default '',
  error_codes  text[] not null,
  rule_en      text not null,
  rule_vi      text not null,
  examples     jsonb not null default '[]',   -- [{en, vi}]
  trap         jsonb not null default '{}'    -- {wrong, right, note_vi}
);

create table public.grammar_items (
  id                uuid primary key default gen_random_uuid(),
  grammar_point_id  int references public.grammar_points (id) on delete cascade,
  error_code        text not null,
  format            text not null check (format in (
                      'mcq', 'typed_gap', 'spot_error', 'correct_error', 'transform',
                      'combine', 'word_form', 'translate', 'word_order', 'upgrade')),
  difficulty        int not null default 2 check (difficulty between 1 and 3),
  topic_id          int references public.topics (id),
  prompt            text not null,
  options           jsonb,
  answers           text[] not null default '{}',
  meta              jsonb not null default '{}',  -- hint, keyword, base word, tokens
  explanation_en    text not null default '',
  explanation_vi    text not null default '',
  trap_note_vi      text not null default '',
  source            text not null default 'seed' check (source in ('seed', 'generated', 'personal')),
  status            text not null default 'approved' check (status in ('draft', 'approved', 'retired')),
  owner_id          uuid references public.profiles (id) on delete cascade, -- personal drills only
  why_cache         jsonb,
  variant_votes     jsonb not null default '{}',
  created_at        timestamptz not null default now(),
  constraint personal_has_owner check (source <> 'personal' or owner_id is not null)
);
create index grammar_items_point_idx on public.grammar_items (grammar_point_id, status);
create index grammar_items_code_idx on public.grammar_items (error_code);
create index grammar_items_owner_idx on public.grammar_items (owner_id) where owner_id is not null;

create table public.dictionary_entries (
  id             bigserial primary key,
  lemma          text not null,
  pos            text not null default '',
  ipa            text not null default '',
  gloss_vi       text[] not null default '{}',
  definition_en  text not null default '',
  examples       jsonb not null default '[]',
  collocations   text[] not null default '{}',
  word_family    jsonb not null default '{}',
  freq_rank      int,
  source_list    text,
  ai_generated   boolean not null default false,
  gloss_vi_folded text not null default '',
  search_vi      tsvector,
  created_at     timestamptz not null default now(),
  unique (lemma, pos)
);
create index dictionary_lemma_idx on public.dictionary_entries (lower(lemma) text_pattern_ops);
create index dictionary_search_vi_idx on public.dictionary_entries using gin (search_vi);
create index dictionary_gloss_trgm_idx on public.dictionary_entries using gin (gloss_vi_folded extensions.gin_trgm_ops);

create or replace function public.dictionary_fold() returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.gloss_vi_folded = public.vi_fold(array_to_string(new.gloss_vi, ' ; '));
  new.search_vi = to_tsvector('simple', new.gloss_vi_folded);
  return new;
end $$;

create trigger dictionary_fold_trg
  before insert or update of gloss_vi on public.dictionary_entries
  for each row execute function public.dictionary_fold();

-- NGSL / NAWL lists: used for placement and for the reading coverage check.
create table public.word_lists (
  lemma      text not null,
  list       text not null check (list in ('ngsl', 'nawl')),
  rank       int not null,
  primary key (lemma, list)
);

create table public.vocab_items (
  id                 uuid primary key default gen_random_uuid(),
  entry_id           bigint references public.dictionary_entries (id) on delete set null,
  lemma              text not null,
  pos                text not null default '',
  ipa                text not null default '',
  definition_en      text not null,
  gloss_vi           text not null,
  word_family        jsonb not null default '{}',
  collocations       text[] not null default '{}',
  examples           text[] not null default '{}',
  register           text not null default 'neutral' check (register in ('formal', 'neutral', 'informal')),
  common_mistake_vi  text,
  topic_id           int references public.topics (id),
  source_list        text not null default 'topic' check (source_list in ('ngsl', 'nawl', 'topic', 'personal')),
  frequency_rank     int,
  owner_id           uuid references public.profiles (id) on delete cascade,
  status             text not null default 'approved' check (status in ('draft', 'approved', 'retired')),
  created_at         timestamptz not null default now()
);
create unique index vocab_items_shared_lemma_idx on public.vocab_items (lower(lemma), coalesce(topic_id, 0)) where owner_id is null;
create unique index vocab_items_personal_lemma_idx on public.vocab_items (owner_id, lower(lemma)) where owner_id is not null;
create index vocab_items_topic_idx on public.vocab_items (topic_id);

create table public.reading_passages (
  id                uuid primary key default gen_random_uuid(),
  topic_id          int not null references public.topics (id),
  day_index         int not null default 1 check (day_index between 1 and 7),
  scheduled_for     date,
  title             text not null,
  body              text not null,
  target_words      text[] not null default '{}',
  grammar_point_id  int references public.grammar_points (id),
  source            text not null default 'seed' check (source in ('seed', 'generated')),
  status            text not null default 'approved' check (status in ('draft', 'approved', 'retired')),
  batch_id          uuid,
  created_at        timestamptz not null default now()
);
create index reading_passages_topic_idx on public.reading_passages (topic_id, day_index);

create table public.reading_questions (
  id                uuid primary key default gen_random_uuid(),
  passage_id        uuid not null references public.reading_passages (id) on delete cascade,
  sort              int not null,
  type              text not null check (type in ('tfng', 'mcq', 'completion', 'headings', 'summary')),
  prompt            text not null,
  options           jsonb,
  answer            text not null,
  accept            text[] not null default '{}',
  evidence_start    int,
  evidence_end      int,
  paraphrase_pairs  jsonb not null default '[]',
  explain_en        text not null default '',
  explain_vi        text not null default '',
  unique (passage_id, sort)
);

create table public.writing_tasks (
  id                uuid primary key default gen_random_uuid(),
  topic_id          int not null references public.topics (id),
  type              text not null check (type in ('opinion', 'chart', 'paraphrase', 'problem_solution', 'adv_disadv', 'essay')),
  prompt            text not null,
  min_words         int not null,
  max_words         int not null,
  target_words      text[] not null default '{}',
  grammar_point_id  int references public.grammar_points (id),
  chart_data        jsonb,
  scheduled_for     date,
  source            text not null default 'seed' check (source in ('seed', 'generated')),
  status            text not null default 'approved' check (status in ('draft', 'approved', 'retired')),
  batch_id          uuid,
  created_at        timestamptz not null default now()
);
create index writing_tasks_topic_idx on public.writing_tasks (topic_id, type);

-- Unapproved generated content goes live after 24 hours so the learner is never blocked.
create or replace function public.is_live(status text, created_at timestamptz)
returns boolean
language sql stable parallel safe
set search_path = ''
as $$
  select status = 'approved' or (status = 'draft' and created_at < now() - interval '24 hours')
$$;

-- ---------------------------------------------------------------------------
-- Progress
-- ---------------------------------------------------------------------------

create table public.sessions (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references public.profiles (id) on delete cascade,
  local_date      date not null,
  kind            text not null default 'weekday' check (kind in ('weekday', 'saturday', 'sunday')),
  status          text not null default 'in_progress' check (status in ('in_progress', 'completed', 'partial')),
  plan            jsonb not null,
  progress        jsonb not null default '{}',
  minutes         int not null default 0,
  short_day       boolean not null default false,
  skipped_blocks  text[] not null default '{}',
  streak_ok       boolean not null default false,  -- blocks 1 and 2 done
  xp              int not null default 0,
  started_at      timestamptz not null default now(),
  completed_at    timestamptz,
  updated_at      timestamptz not null default now(),
  unique (user_id, local_date)
);
create trigger sessions_touch before update on public.sessions
  for each row execute function public.touch_updated_at();

create table public.cards (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references public.profiles (id) on delete cascade,
  item_type       text not null check (item_type in ('vocab', 'grammar')),
  item_id         uuid not null,
  due             timestamptz not null default now(),
  stability       double precision not null default 0,
  difficulty      double precision not null default 0,
  elapsed_days    int not null default 0,
  scheduled_days  int not null default 0,
  learning_steps  int not null default 0,
  reps            int not null default 0,
  lapses          int not null default 0,
  state           smallint not null default 0,  -- 0 new, 1 learning, 2 review, 3 relearning
  last_review     timestamptz,
  created_at      timestamptz not null default now(),
  unique (user_id, item_type, item_id)
);
create index cards_due_idx on public.cards (user_id, due);

create table public.review_logs (
  id             bigserial primary key,
  card_id        uuid not null references public.cards (id) on delete cascade,
  user_id        uuid not null references public.profiles (id) on delete cascade,
  session_id     uuid references public.sessions (id) on delete set null,
  rating         smallint not null check (rating between 1 and 4),
  exercise_type  text not null,
  correct        boolean not null,
  duration_ms    int not null default 0,
  created_at     timestamptz not null default now()
);
create index review_logs_user_idx on public.review_logs (user_id, created_at);

create table public.attempts (
  id                bigserial primary key,
  user_id           uuid not null references public.profiles (id) on delete cascade,
  session_id        uuid references public.sessions (id) on delete set null,
  item_kind         text not null check (item_kind in ('grammar', 'reading', 'placement', 'vocab_check')),
  item_id           uuid,
  grammar_point_id  int references public.grammar_points (id),
  format            text,
  response          text,
  correct           boolean not null,
  error_code        text,
  duration_ms       int not null default 0,
  local_date        date not null,
  created_at        timestamptz not null default now()
);
create index attempts_user_idx on public.attempts (user_id, created_at);
create index attempts_point_idx on public.attempts (user_id, grammar_point_id, created_at desc);

create table public.writing_submissions (
  id                   uuid primary key default gen_random_uuid(),
  user_id              uuid not null references public.profiles (id) on delete cascade,
  session_id           uuid unique references public.sessions (id) on delete set null,
  task_id              uuid references public.writing_tasks (id),
  text                 text not null,
  word_count           int not null,
  status               text not null default 'pending' check (status in ('pending', 'graded', 'failed')),
  feedback             jsonb,
  band_gra             numeric(2,1),
  band_lr              numeric(2,1),
  band_tr              numeric(2,1),
  band_cc              numeric(2,1),
  error_density        jsonb not null default '{}',
  rewrite_text         text,
  rewrite_ok           boolean,
  rewrite_attempts     int not null default 0,
  hidden_from_viewers  boolean not null default false,
  assisted_phrases     jsonb not null default '[]',
  context              jsonb not null default '{}',  -- task prompt/type, target words, grammar point, weak codes
  prompt_version       text,
  local_date           date not null,
  created_at           timestamptz not null default now(),
  graded_at            timestamptz
);
create index writing_user_idx on public.writing_submissions (user_id, created_at desc);

create table public.writing_errors (
  id             bigserial primary key,
  submission_id  uuid not null references public.writing_submissions (id) on delete cascade,
  user_id        uuid not null references public.profiles (id) on delete cascade,
  start_pos      int not null,
  end_pos        int not null,
  code           text not null,
  severity       text not null check (severity in ('blocks_meaning', 'noticeable', 'minor')),
  original       text not null,
  correction     text not null,
  explain_en     text not null default '',
  explain_vi     text not null default '',
  is_focus       boolean not null default false
);
create index writing_errors_sub_idx on public.writing_errors (submission_id);

create table public.weakness (
  user_id     uuid not null references public.profiles (id) on delete cascade,
  error_code  text not null,
  score       double precision not null default 0.5 check (score between 0 and 1),
  samples     int not null default 0,
  updated_at  timestamptz not null default now(),
  primary key (user_id, error_code)
);

create table public.lookups (
  id          bigserial primary key,
  user_id     uuid not null references public.profiles (id) on delete cascade,
  query       text not null,
  lemma       text,
  context     jsonb not null default '{}',
  saved       boolean not null default false,
  local_date  date not null,
  created_at  timestamptz not null default now()
);
create index lookups_user_idx on public.lookups (user_id, created_at desc);

create table public.placements (
  user_id          uuid primary key references public.profiles (id) on delete cascade,
  grammar_results  jsonb not null default '{}',
  vocab_results    jsonb not null default '{}',
  known_lemmas     text[] not null default '{}',
  writing_sample   text,
  writing_feedback jsonb,
  completed_at     timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Family + ops
-- ---------------------------------------------------------------------------

create table public.weekly_summaries (
  id          uuid primary key default gen_random_uuid(),
  learner_id  uuid not null references public.profiles (id) on delete cascade,
  week_start  date not null,
  body_en     text not null,
  body_vi     text not null,
  stats       jsonb not null default '{}',
  created_at  timestamptz not null default now(),
  unique (learner_id, week_start)
);

create table public.ai_calls (
  id              bigserial primary key,
  user_id         uuid references public.profiles (id) on delete set null,
  route           text not null,
  model           text not null,
  input_tokens    int not null default 0,
  output_tokens   int not null default 0,
  cost_usd        numeric(10,6) not null default 0,
  ok              boolean not null default true,
  prompt_version  text,
  created_at      timestamptz not null default now()
);
create index ai_calls_created_idx on public.ai_calls (created_at);

create table public.session_resets (
  id          bigserial primary key,
  learner_id  uuid not null references public.profiles (id) on delete cascade,
  local_date  date not null,
  reset_by    uuid not null references public.profiles (id),
  reason      text not null,
  snapshot    jsonb,
  created_at  timestamptz not null default now()
);

create table public.content_batches (
  id               uuid primary key default gen_random_uuid(),
  openai_batch_id  text unique,
  input_file_id    text,
  week_start       date not null,
  topic_id         int references public.topics (id),
  status           text not null default 'submitted',
  summary          jsonb not null default '{}',
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create trigger content_batches_touch before update on public.content_batches
  for each row execute function public.touch_updated_at();
