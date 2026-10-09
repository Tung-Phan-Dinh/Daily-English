import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { ERROR_LABELS, type AnyErrorCode, SKIP_NEW_WORDS_THRESHOLD } from "@/lib/curriculum";
import { vocabState } from "@/lib/fsrs";
import { computeStreak, pointStatus, type AttemptLite } from "@/lib/progress-rules";
import { addDays, dayOfWeek, localDate, nextBoundary, weekStart } from "@/lib/time";

type DB = SupabaseClient;

export type DayDot = { date: string; status: "done" | "short" | "partial" | "missed" | "rest" | "today" | "future" | "none" };

export type Insight = { tone: "good" | "warn" | "info"; en: string; vi: string };

export async function getDashboardData(db: DB, learnerId: string, tz: string) {
  const today = localDate(tz);
  const monday = weekStart(today);
  const since84 = addDays(today, -83);
  const since14 = addDays(today, -13);

  const [
    { data: sessions },
    { data: cards },
    { data: points },
    { data: grammarAttempts },
    { data: readingByType },
    { data: density },
    { data: writing },
    { data: recall },
    { data: snapshots },
    { data: summaries },
    { data: lookups },
    { data: readingSessions },
  ] = await Promise.all([
    db.from("v_daily_activity").select("*").eq("user_id", learnerId).gte("local_date", addDays(today, -400)).order("local_date"),
    db.from("cards").select("item_type, state, stability, due").eq("user_id", learnerId),
    db.from("grammar_points").select("id, slug, title, title_vi, phase, sort, error_codes").order("sort"),
    db.from("attempts").select("grammar_point_id, correct, format, local_date").eq("user_id", learnerId).eq("item_kind", "grammar").order("created_at", { ascending: false }).limit(4000),
    db.from("v_reading_by_type").select("*").eq("user_id", learnerId),
    db.from("v_error_density_weekly").select("*").eq("user_id", learnerId).order("week_start"),
    db.from("writing_submissions").select("id, local_date, text, word_count, status, band_gra, band_lr, band_tr, band_cc, feedback, hidden_from_viewers, created_at").eq("user_id", learnerId).order("created_at", { ascending: false }).limit(60),
    db.from("v_review_recall_weekly").select("*").eq("user_id", learnerId).order("week_start"),
    db.from("vocab_snapshots").select("local_date, learning, review, mastered").eq("user_id", learnerId).gte("local_date", since84).order("local_date"),
    db.from("weekly_summaries").select("week_start, body_en, body_vi").eq("learner_id", learnerId).order("week_start", { ascending: false }).limit(1),
    db.from("lookups").select("lemma, query, local_date, saved, context").eq("user_id", learnerId).gte("local_date", since14).limit(2000),
    db.from("sessions").select("local_date, progress").eq("user_id", learnerId).gte("local_date", since84).order("local_date"),
  ]);

  const days = (sessions ?? []) as {
    local_date: string; status: string; minutes: number; short_day: boolean; streak_ok: boolean; xp: number; skipped_blocks: string[]; kind: string;
  }[];
  const byDate = new Map(days.map((d) => [d.local_date, d]));

  // Status strip ---------------------------------------------------------------
  // Days before the first session are neutral, not "missed".
  const firstDay = days[0]?.local_date ?? today;
  const week: DayDot[] = Array.from({ length: 7 }, (_, i) => {
    const date = addDays(monday, i);
    const s = byDate.get(date);
    let status: DayDot["status"];
    if (date > today) status = "future";
    else if (date < firstDay && !s) status = "none";
    else if (s?.status === "completed") status = s.short_day ? "short" : "done";
    else if (s?.status === "partial") status = s.streak_ok ? "short" : "partial";
    else if (date === today) status = s ? "today" : "today";
    else if (dayOfWeek(date) === 0) status = "rest";
    else status = "missed";
    if (date === today && s?.status === "completed") status = s.short_day ? "short" : "done";
    return { date, status };
  });
  const weekMinutes = days.filter((d) => d.local_date >= monday).reduce((s, d) => s + d.minutes, 0);
  const weekXp = days.filter((d) => d.local_date >= monday).reduce((s, d) => s + d.xp, 0);
  const weekSkips = days.filter((d) => d.local_date >= monday).flatMap((d) => d.skipped_blocks ?? []);
  const streak = computeStreak(days, today);

  // Vocabulary --------------------------------------------------------------------
  const vocabCards = (cards ?? []).filter((c) => c.item_type === "vocab" && c.state !== 0);
  const vocabCounts = { learning: 0, review: 0, mastered: 0 };
  for (const c of vocabCards) vocabCounts[vocabState(c)]++;
  const weekAgoSnap = (snapshots ?? []).filter((s) => s.local_date <= addDays(today, -7)).at(-1);
  const masteredDelta = vocabCounts.mastered - (weekAgoSnap?.mastered ?? 0);
  const dayEnd = nextBoundary(tz).toISOString();
  const dueCount = (cards ?? []).filter((c) => c.due <= dayEnd).length;

  // Grammar map -------------------------------------------------------------------
  const byPoint = new Map<number, AttemptLite[]>();
  for (const a of grammarAttempts ?? []) {
    if (!a.grammar_point_id) continue;
    const l = byPoint.get(a.grammar_point_id) ?? [];
    l.push(a as AttemptLite);
    byPoint.set(a.grammar_point_id, l);
  }
  const grammarMap = (points ?? []).map((p) => {
    const list = byPoint.get(p.id) ?? [];
    const last = list.slice(0, 20);
    return {
      id: p.id, slug: p.slug, title: p.title, title_vi: p.title_vi, phase: p.phase, sort: p.sort,
      status: pointStatus(list),
      accuracy: last.length ? Math.round((last.filter((a) => a.correct).length / last.length) * 100) : null,
    };
  });
  const pointsMastered = grammarMap.filter((g) => g.status === "mastered").length;

  // Reading -------------------------------------------------------------------------
  const readingTypes = new Map<string, { correct: number; total: number }>();
  for (const r of readingByType ?? []) {
    const t = readingTypes.get(r.type) ?? { correct: 0, total: 0 };
    t.correct += r.correct;
    t.total += r.total;
    readingTypes.set(r.type, t);
  }
  const readingRows = (readingSessions ?? [])
    .map((s) => {
      const data = (s.progress as { blocks?: { reading?: { data?: { wpm?: number; results?: Record<string, { correct: boolean }> } } } })?.blocks?.reading?.data;
      if (!data?.wpm) return null;
      const res = Object.values(data.results ?? {});
      return { date: s.local_date as string, wpm: data.wpm, correct: res.filter((r) => r.correct).length, total: res.length };
    })
    .filter(Boolean) as { date: string; wpm: number; correct: number; total: number }[];
  const last7Reading = readingRows.filter((r) => r.date > addDays(today, -7));
  const readingAccuracy = last7Reading.reduce((s, r) => s + r.total, 0)
    ? Math.round((last7Reading.reduce((s, r) => s + r.correct, 0) / last7Reading.reduce((s, r) => s + r.total, 0)) * 100)
    : null;

  // Writing bands: 7-day rolling average (single AI scores are noisy) ---------------------
  const graded = (writing ?? []).filter((w) => w.status === "graded" && w.band_gra !== null).slice().reverse();
  const writingBands = graded.map((w) => {
    const window = graded.filter((x) => x.local_date <= w.local_date && x.local_date > addDays(w.local_date, -7));
    const avg = (k: "band_gra" | "band_lr") => Math.round((window.reduce((s, x) => s + Number(x[k]), 0) / window.length) * 4) / 4;
    return { date: w.local_date as string, gra: avg("band_gra"), lr: avg("band_lr") };
  });
  const latestBand = writingBands.at(-1) ?? null;

  // Mistakes over time: top 5 codes -------------------------------------------------------------
  const densityRows = (density ?? []) as { week_start: string; code: string; per_100_words: number }[];
  const totals = new Map<string, number>();
  for (const r of densityRows) totals.set(r.code, (totals.get(r.code) ?? 0) + Number(r.per_100_words));
  const topCodes = [...totals.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([c]) => c);
  const weeks = [...new Set(densityRows.map((r) => r.week_start))].sort();
  const mistakes = weeks.map((w) => {
    const row: Record<string, string | number> = { week: w };
    for (const c of topCodes) row[c] = Number(densityRows.find((r) => r.week_start === w && r.code === c)?.per_100_words ?? 0);
    return row;
  });

  // Calendar heatmap ------------------------------------------------------------------------------
  const calendar = Array.from({ length: 84 }, (_, i) => {
    const date = addDays(since84, i);
    return { date, minutes: byDate.get(date)?.minutes ?? 0, future: date > today };
  });

  // Lookups ---------------------------------------------------------------------------------------------
  const wordLookups = (lookups ?? []).filter((l) => (l.context as { kind?: string })?.kind !== "phrase" && l.lemma);
  const lookupCounts = new Map<string, number>();
  for (const l of wordLookups) lookupCounts.set(l.lemma!, (lookupCounts.get(l.lemma!) ?? 0) + 1);
  const topLookups = [...lookupCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([lemma, n]) => ({ lemma, n }));
  const lookupsPerDay = Array.from({ length: 14 }, (_, i) => {
    const date = addDays(since14, i);
    return { date, n: wordLookups.filter((l) => l.local_date === date).length };
  });

  const insights = buildInsights({
    week, today, dueCount, streak: streak.current, densityRows, topCodes, weekSkips, mastered: vocabCounts.mastered,
  });

  return {
    today,
    learnerTz: tz,
    week,
    weekMinutes,
    weekXp,
    weekSkips,
    streak: streak.current,
    frozenDays: streak.frozen,
    dueCount,
    headline: {
      wordsMastered: vocabCounts.mastered,
      wordsMasteredDelta: masteredDelta,
      wordsInReview: vocabCounts.review + vocabCounts.mastered + vocabCounts.learning,
      pointsMastered,
      pointsTotal: grammarMap.length,
      readingAccuracy,
      writingBand: latestBand,
    },
    vocabCounts,
    charts: {
      calendar,
      mistakes: { rows: mistakes, codes: topCodes },
      grammarMap,
      vocabGrowth: (snapshots ?? []) as { local_date: string; learning: number; review: number; mastered: number }[],
      recall: ((recall ?? []) as { week_start: string; correct: number; total: number }[]).map((r) => ({
        week: r.week_start, pct: r.total ? Math.round((r.correct / r.total) * 100) : 0, total: r.total,
      })),
      readingByType: [...readingTypes.entries()].map(([type, v]) => ({ type, pct: Math.round((v.correct / v.total) * 100), total: v.total })),
      readingSpeed: readingRows.map((r) => ({ date: r.date, wpm: r.wpm })),
      writingBands,
    },
    recentWriting: (writing ?? []).filter((w) => w.status === "graded").slice(0, 5),
    summary: summaries?.[0] ?? null,
    lookups: { perDay: lookupsPerDay, top: topLookups },
    insights,
  };
}

export type DashboardData = Awaited<ReturnType<typeof getDashboardData>>;

/** Plain-language, rule-based, bilingual — at most three. */
export function buildInsights(p: {
  week: DayDot[];
  today: string;
  dueCount: number;
  streak: number;
  densityRows: { week_start: string; code: string; per_100_words: number }[];
  topCodes: string[];
  weekSkips: string[];
  mastered: number;
}): Insight[] {
  const out: Insight[] = [];

  const top = p.topCodes[0];
  if (top) {
    const label = ERROR_LABELS[top as AnyErrorCode] ?? { en: top, vi: top };
    const latestWeek = [...new Set(p.densityRows.map((r) => r.week_start))].sort().at(-1)!;
    const now = p.densityRows.find((r) => r.code === top && r.week_start === latestWeek)?.per_100_words;
    const before = p.densityRows.find((r) => r.code === top && r.week_start < latestWeek && r.week_start >= addDays(latestWeek, -21))?.per_100_words;
    if (now !== undefined) {
      const trendEn = before !== undefined ? `, ${Number(now) <= Number(before) ? "down" : "up"} from ${before}` : "";
      const trendVi = before !== undefined ? `, ${Number(now) <= Number(before) ? "giảm" : "tăng"} so với ${before}` : "";
      out.push({
        tone: before !== undefined && Number(now) < Number(before) ? "good" : "info",
        en: `${label.en} is still the top error: ${now} per 100 words${trendEn}.`,
        vi: `${label.vi} vẫn là lỗi nhiều nhất: ${now} lỗi/100 từ${trendVi}.`,
      });
    }
  }

  const missed = p.week.filter((d) => d.status === "missed").length;
  if (missed >= 2) {
    out.push({ tone: "warn", en: `Missed ${missed} days this week.`, vi: `Tuần này đã bỏ lỡ ${missed} ngày.` });
  } else if (missed === 0 && p.week.some((d) => d.status === "done" || d.status === "short")) {
    out.push({ tone: "good", en: "No missed days so far this week.", vi: "Tuần này chưa bỏ lỡ ngày nào." });
  }

  if (p.dueCount > SKIP_NEW_WORDS_THRESHOLD) {
    out.push({
      tone: "warn",
      en: `${p.dueCount} reviews due — suggest a short day to catch up.`,
      vi: `Có ${p.dueCount} thẻ cần ôn — nên học buổi ngắn để bắt kịp.`,
    });
  }
  if (p.weekSkips.length >= 2) {
    out.push({ tone: "info", en: `${p.weekSkips.length} blocks skipped this week.`, vi: `Tuần này đã bỏ qua ${p.weekSkips.length} phần.` });
  }
  if (p.streak >= 7) {
    out.push({ tone: "good", en: `${p.streak}-day streak — great consistency.`, vi: `Chuỗi ${p.streak} ngày liên tiếp — rất đều đặn.` });
  }
  return out.slice(0, 3);
}
