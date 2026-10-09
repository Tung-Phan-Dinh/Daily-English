import type { Metadata } from "next";
import Link from "next/link";
import {
  BookOpenText, Check, ChevronRight, Flag, Flame, ListChecks, Moon, PenLine, Repeat, Shapes, SkipForward, Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Countdown } from "@/components/progress/countdown";
import { ProgressRing } from "@/components/progress/progress-ring";
import { WeekDots } from "@/components/progress/week-dots";
import { Avatar } from "@/components/shell/avatar";
import { requireViewer } from "@/lib/auth";
import { BLOCK_META, ERROR_LABELS, type AnyErrorCode } from "@/lib/curriculum";
import { getDashboardData } from "@/lib/dashboard/stats";
import { expireOldSessions, todaysSession, topicForDate } from "@/lib/session/builder";
import type { SessionBlock } from "@/lib/session/types";
import { createClient } from "@/lib/supabase/server";
import { addDays, dayKind, localDate, nextBoundary } from "@/lib/time";
import { cn } from "@/lib/utils";
import { OpenDictionaryButton } from "./open-dictionary";
import { StartButtons } from "./start-buttons";

export const metadata: Metadata = { title: "Today" };

const WEEKDAY_BLOCKS: SessionBlock[] = ["review", "grammar", "new_words", "reading", "writing", "wrapup"];
const BLOCK_ICON: Record<SessionBlock, typeof Repeat> = {
  review: Repeat, grammar: Shapes, new_words: Sparkles, reading: BookOpenText, writing: PenLine, check: ListChecks, wrapup: Flag,
};
const BLOCK_SUB: Record<SessionBlock, string> = {
  review: "Due words and missed grammar",
  grammar: "Rule card + 10 questions",
  new_words: "8 words with audio and examples",
  reading: "Short passage, 4 IELTS questions",
  writing: "One paragraph with AI feedback",
  check: "10 questions from this week",
  wrapup: "Score, streak, words learned",
};
// Category chip colours (always dark text on a light accent)
const CHIP = ["bg-orange", "bg-pink", "bg-lavender", "bg-lime"];

function greeting(tz: string) {
  const h = Number(new Intl.DateTimeFormat("en-GB", { timeZone: tz, hour: "numeric", hourCycle: "h23" }).format(new Date()));
  return h < 12 && h >= 4 ? "Good morning" : h < 18 && h >= 12 ? "Good afternoon" : "Good evening";
}

export default async function TodayPage() {
  const viewer = await requireViewer(["learner"]);
  const db = await createClient();
  const today = localDate(viewer.timezone);
  await expireOldSessions(viewer.id, today);

  const [session, topic, tomorrowTopic, dash, { data: placement }] = await Promise.all([
    todaysSession(db, viewer.id, today),
    topicForDate(db, viewer.id, today),
    topicForDate(db, viewer.id, addDays(today, 1)),
    getDashboardData(db, viewer.id, viewer.timezone),
    db.from("placements").select("completed_at").eq("user_id", viewer.id).maybeSingle(),
  ]);
  const { data: point } = session?.plan.grammar
    ? await db.from("grammar_points").select("title").eq("id", session.plan.grammar.point_id).single()
    : { data: null };

  const kind = dayKind(today);
  const done = Boolean(session && session.status !== "in_progress");
  const blocks: SessionBlock[] = session?.plan.blocks ?? (kind === "saturday" ? ["review", "writing", "wrapup"] : kind === "sunday" ? ["check", "wrapup"] : WEEKDAY_BLOCKS);
  const doneCount = blocks.filter((b) => ["done", "skipped"].includes(session?.progress.blocks[b]?.status ?? "")).length;
  const xpGoal = viewer.settings.weekly_xp_goal;
  const xpPct = Math.min(1, dash.weekXp / xpGoal);
  const weakCodes = dash.charts.mistakes.codes.slice(0, 3) as AnyErrorCode[];
  const dateLabel = new Intl.DateTimeFormat("en-GB", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" }).format(new Date(today));

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px] lg:gap-8">
      <div className="min-w-0 space-y-5">
        {/* Greeting */}
        <div className="flex items-center gap-3">
          <Avatar name={viewer.display_name} size={56} progress={xpPct} />
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-2xl font-bold tracking-tight sm:text-3xl">
              {greeting(viewer.timezone)}, {viewer.display_name}
            </h1>
            <p className="text-muted-foreground">
              {dateLabel}
              {!done && (
                <span className="ml-2 rounded-full bg-streak-soft px-2.5 py-0.5 text-sm font-medium text-streak">
                  {kind === "sunday" ? "Rest or weekly check" : "1 session today"}
                </span>
              )}
            </p>
          </div>
        </div>

        <OpenDictionaryButton />

        {!placement && (
          <section className="surface grid grid-cols-[auto_1fr] items-center gap-x-4 gap-y-3 p-5 sm:grid-cols-[auto_1fr_auto]" aria-labelledby="placement-h">
            <span className="grid size-12 place-items-center rounded-full bg-lime text-on-accent" aria-hidden>
              <ListChecks className="size-5" />
            </span>
            <div className="min-w-0 flex-1">
              <h2 id="placement-h" className="font-semibold">Start with a 15-minute placement</h2>
              <p className="text-muted-foreground">It finds your weak points so every session targets them.</p>
            </div>
            <Button asChild variant="soft" className="col-span-2 sm:col-span-1">
              <Link href="/placement">Take the placement</Link>
            </Button>
          </section>
        )}

        {/* Hero: topic + today's session */}
        <section className="hero-card relative overflow-hidden p-6 sm:p-7" aria-labelledby="hero-h">
          <div className="flex items-start justify-between gap-4">
            <span className="grid size-12 place-items-center rounded-full bg-white text-on-accent" aria-hidden>
              {done ? <Check className="size-5" strokeWidth={3} /> : <Sparkles className="size-5" />}
            </span>
            <ProgressRing
              value={blocks.length ? doneCount / blocks.length : 0}
              size={64}
              stroke={4}
              label={`${doneCount} of ${blocks.length} blocks done`}
              className="text-on-accent"
              trackClassName="stroke-white/45"
              barClassName="stroke-[#14161c]"
            >
              <span className="text-base font-bold tabular-nums">
                {doneCount}/{blocks.length}
              </span>
            </ProgressRing>
          </div>
          <p className="mt-5 text-sm font-semibold tracking-wide uppercase opacity-80">This week&apos;s topic</p>
          <h2 id="hero-h" className="text-3xl font-bold tracking-tight sm:text-4xl">
            {topic?.name_en ?? "General English"}
            {topic && <span lang="vi" className="ml-2 align-middle text-lg font-medium opacity-75">· {topic.name_vi}</span>}
          </h2>
          {point?.title && <p className="mt-1 text-base">Grammar today: <strong>{point.title}</strong></p>}

          {done ? (
            <div className="mt-6 space-y-3" aria-live="polite">
              <h3 className="text-lg font-semibold">
                Done for today{session?.short_day ? " (short day)" : ""} · +{session?.xp} XP
              </h3>
              <p className="text-base">
                Next session in <strong><Countdown to={nextBoundary(viewer.timezone).toISOString()} /></strong>
                {tomorrowTopic && <> · Tomorrow: <strong>{tomorrowTopic.name_en}</strong></>}
              </p>
              <div className="flex flex-wrap gap-3">
                {session?.short_day && <StartButtons mode="continue_full" sessionId={session.id} />}
                <Button asChild variant="outline" className="border-transparent bg-white text-on-accent hover:bg-white/85">
                  <Link href="/progress">See my progress</Link>
                </Button>
              </div>
            </div>
          ) : (
            <div className="mt-6">
              <StartButtons mode={session ? "resume" : "start"} kind={kind} />
              {dash.dueCount > 40 && !session && (
                <p className="mt-3 text-sm font-medium">{dash.dueCount} reviews are due, so new words are skipped today — a short day is a good idea.</p>
              )}
            </div>
          )}
        </section>

        {/* Week strip */}
        <section className="surface px-5 py-4" aria-labelledby="week-h">
          <div className="mb-3 flex items-center justify-between">
            <h2 id="week-h" className="font-semibold">This week</h2>
            <span className="flex items-center gap-1.5 text-sm font-semibold text-streak">
              <Flame className="size-4" aria-hidden /> {dash.streak}-day streak
            </span>
          </div>
          <WeekDots days={dash.week} labelsOnTop />
        </section>

        {/* Blocks, styled like the course list */}
        <section aria-labelledby="blocks-h">
          <div className="mb-3 flex items-center justify-between">
            <h2 id="blocks-h" className="text-lg font-bold">{kind === "sunday" ? "Weekly check" : "Today's blocks"}</h2>
            <span className="text-sm text-muted-foreground">≈ {blocks.reduce((s, b) => s + BLOCK_META[b].minutes, 0)} min</span>
          </div>
          <ol className="space-y-2.5">
            {blocks.map((b) => {
              const st = session?.progress.blocks[b]?.status;
              const isCurrent = session?.status === "in_progress" && session.progress.current === b;
              const Icon = st === "done" ? Check : st === "skipped" ? SkipForward : BLOCK_ICON[b];
              return (
                <li
                  key={b}
                  className={cn(
                    "flex min-h-18 items-center gap-4 rounded-full py-2.5 pr-3 pl-2.5",
                    isCurrent ? "bg-primary text-primary-foreground" : st === "done" ? "bg-brand-soft" : "surface",
                  )}
                >
                  <span
                    className={cn(
                      "grid size-12 shrink-0 place-items-center rounded-full",
                      isCurrent ? "bg-primary-foreground text-primary" : st === "done" ? "bg-periwinkle text-on-accent" : "bg-muted",
                    )}
                    aria-hidden
                  >
                    <Icon className="size-5" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-semibold">
                      {BLOCK_META[b].title}
                      <span lang="vi" className={cn("ml-2 text-sm font-normal", isCurrent ? "opacity-75" : "text-muted-foreground")}>{BLOCK_META[b].titleVi}</span>
                    </span>
                    <span className={cn("block truncate text-sm", isCurrent ? "opacity-80" : "text-muted-foreground")}>{BLOCK_SUB[b]}</span>
                  </span>
                  <span className={cn("shrink-0 text-sm tabular-nums", isCurrent ? "" : "text-muted-foreground")}>
                    {st === "done" ? "Done" : st === "skipped" ? "Skipped" : isCurrent ? "Up next" : `${BLOCK_META[b].minutes} min`}
                  </span>
                  {isCurrent && (
                    <span className="grid size-9 shrink-0 place-items-center rounded-full bg-white/15" aria-hidden>
                      <ChevronRight className="size-4" />
                    </span>
                  )}
                </li>
              );
            })}
          </ol>
          {session?.plan.new_words_skipped_reason && <p className="mt-3 text-sm text-muted-foreground">{session.plan.new_words_skipped_reason}</p>}
          {kind === "sunday" && !session && (
            <p className="mt-3 flex items-center gap-2 text-muted-foreground"><Moon className="size-4" aria-hidden /> Resting today is fine — Sundays never break your streak.</p>
          )}
        </section>
      </div>

      {/* Right rail (below on phones) */}
      <aside className="space-y-4" aria-label="Your numbers">
        <section className="surface p-5 text-center" aria-labelledby="goal-h">
          <h2 id="goal-h" className="text-left font-semibold">Weekly XP goal</h2>
          <ProgressRing value={xpPct} size={176} stroke={12} label={`${Math.round(xpPct * 100)}% of the weekly XP goal`} className="mx-auto mt-3 text-brand" trackClassName="stroke-muted">
            <span className="text-5xl font-bold tracking-tight tabular-nums">
              {Math.round(xpPct * 100)}<span className="text-2xl">%</span>
            </span>
          </ProgressRing>
          <p className="mt-2 text-sm text-muted-foreground tabular-nums">
            {dash.weekXp} / {xpGoal} XP · {dash.weekMinutes} min this week
          </p>
        </section>

        <div className="grid grid-cols-2 gap-4">
          <section className="surface p-4" aria-label="Words mastered">
            <p className="text-sm text-muted-foreground">Words mastered</p>
            <p className="mt-1 text-4xl font-bold tracking-tight tabular-nums">{dash.headline.wordsMastered}</p>
            <p className="text-sm text-muted-foreground">{dash.headline.wordsInReview} in deck · {dash.dueCount} due</p>
          </section>
          <section className="surface p-4" aria-label="Grammar points mastered">
            <p className="text-sm text-muted-foreground">Grammar</p>
            <p className="mt-1 text-4xl font-bold tracking-tight tabular-nums">
              {dash.headline.pointsMastered}<span className="text-xl text-muted-foreground">/{dash.headline.pointsTotal}</span>
            </p>
            <p className="text-sm text-muted-foreground">points mastered</p>
          </section>
        </div>

        <section className="surface p-5" aria-labelledby="weak-h">
          <h2 id="weak-h" className="font-semibold">Focus areas</h2>
          {weakCodes.length ? (
            <ul className="mt-3 flex flex-wrap gap-2">
              {weakCodes.map((c, i) => (
                <li key={c} className={cn("rounded-full px-3.5 py-2 text-sm font-semibold text-on-accent", CHIP[i % CHIP.length])}>
                  {ERROR_LABELS[c]?.en ?? c}
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-1 text-sm text-muted-foreground">Your top mistake types appear here after your first graded writing.</p>
          )}
          <Link href="/grammar" className="mt-3 inline-flex min-h-11 items-center gap-1 text-sm font-semibold text-brand hover:underline">
            Grammar map <ChevronRight className="size-4" aria-hidden />
          </Link>
        </section>
      </aside>
    </div>
  );
}
