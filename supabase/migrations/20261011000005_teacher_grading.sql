-- The admin can grade a writing submission by hand. A teacher grade is shown to
-- the learner and family and takes precedence over the AI estimate in charts.
alter table public.writing_submissions
  add column if not exists teacher_bands jsonb,          -- {gra, lr, tr, cc} in 0.5 steps (tr/cc optional)
  add column if not exists teacher_comment text,
  add column if not exists teacher_id uuid references public.profiles (id) on delete set null,
  add column if not exists teacher_graded_at timestamptz;

-- Written only by the admin through the API (service role); learners keep their
-- single column grant (hidden_from_viewers), viewers none.

-- Keep what he actually typed/chose on review cards, so the admin can see it.
alter table public.review_logs add column if not exists response text;
