import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { WRITING_ROTATION } from "@/lib/curriculum";
import { isPointMastered, weakestCodes, type AttemptLite } from "@/lib/progress-rules";
import { createAdminClient } from "@/lib/supabase/admin";
import { addDays, daysBetween, dayKind, dayOfWeek, localDate, nextBoundary, weekStart } from "@/lib/time";
import type { Viewer } from "@/lib/auth";
import { buildPlan, chooseGrammarPoint, seededRandom, shuffle, type DueCard, type ItemInfo } from "./plan";
import { emptyProgress, type Plan, type SessionRow } from "./types";

type DB = SupabaseClient;

export type StartResult =
  | { status: "resumed" | "created"; session: SessionRow }
  | { status: "done_for_today"; session: SessionRow; next_start: string; tomorrow_topic: { name_en: string; name_vi: string } | null };

/** Close yesterday's (or older) unfinished sessions: they become `partial`. */
export async function expireOldSessions(userId: string, today: string) {
  const admin = createAdminClient();
  await admin
    .from("sessions")
    .update({ status: "partial" })
    .eq("user_id", userId)
    .eq("status", "in_progress")
    .lt("local_date", today);
}

export async function todaysSession(db: DB, userId: string, today: string): Promise<SessionRow | null> {
  const { data } = await db.from("sessions").select("*").eq("user_id", userId).eq("local_date", today).maybeSingle();
  return (data as SessionRow) ?? null;
}

/**
 * Return today's session (resume) or build it. Never creates a second session
 * for the same day: the unique (user_id, local_date) constraint makes a racing
 * second insert fail, and we then return the row that won.
 */
export async function getOrStartSession(db: DB, viewer: Viewer, opts: { shortDay?: boolean } = {}): Promise<StartResult> {
  const today = localDate(viewer.timezone);
  await expireOldSessions(viewer.id, today);

  const existing = await todaysSession(db, viewer.id, today);
  if (existing) return describe(db, viewer, existing, today);

  const plan = await planForToday(db, viewer, today);
  const progress = emptyProgress(plan.blocks);
  const { data, error } = await db
    .from("sessions")
    .insert({
      user_id: viewer.id,
      local_date: today,
      kind: plan.kind,
      plan,
      progress,
      short_day: Boolean(opts.shortDay) && plan.kind === "weekday",
    })
    .select("*")
    .single();
  if (error) {
    // 23505 = unique violation: another tab or device started it first.
    const again = await todaysSession(db, viewer.id, today);
    if (again) return describe(db, viewer, again, today);
    throw new Error(`Could not start session: ${error.message}`);
  }
  return { status: "created", session: data as SessionRow };
}

async function describe(db: DB, viewer: Viewer, s: SessionRow, today: string): Promise<StartResult> {
  if (s.status === "in_progress") return { status: "resumed", session: s };
  return {
    status: "done_for_today",
    session: s,
    next_start: nextBoundary(viewer.timezone).toISOString(),
    tomorrow_topic: await topicForDate(db, viewer.id, addDays(today, 1)),
  };
}

// ---------------------------------------------------------------------------
// Topic and programme week
// ---------------------------------------------------------------------------

export async function programStart(db: DB, userId: string, today: string): Promise<string> {
  const [{ data: placement }, { data: first }] = await Promise.all([
    db.from("placements").select("completed_at").eq("user_id", userId).maybeSingle(),
    db.from("sessions").select("local_date").eq("user_id", userId).order("local_date").limit(1),
  ]);
  const candidates = [today];
  if (first?.[0]?.local_date) candidates.push(first[0].local_date);
  if (placement?.completed_at) candidates.push(String(placement.completed_at).slice(0, 10));
  return candidates.sort()[0];
}

export async function weekIndexFor(db: DB, userId: string, date: string): Promise<number> {
  const start = await programStart(db, userId, date);
  return Math.max(0, Math.floor(daysBetween(weekStart(start), weekStart(date)) / 7));
}

export async function topicForDate(db: DB, userId: string, date: string) {
  const idx = await weekIndexFor(db, userId, date);
  const { data: topics } = await db.from("topics").select("id, slug, name_en, name_vi, week_order").order("week_order");
  if (!topics?.length) return null;
  return topics[idx % topics.length] as { id: number; slug: string; name_en: string; name_vi: string };
}

// ---------------------------------------------------------------------------
// Plan for today
// ---------------------------------------------------------------------------

export async function planForToday(db: DB, viewer: Viewer, today: string): Promise<Plan> {
  const userId = viewer.id;
  const kind = dayKind(today);
  const rand = seededRandom(`${userId}:${today}`);
  const weekIndex = await weekIndexFor(db, userId, today);
  const topic = (await topicForDate(db, userId, today)) ?? { id: 0, slug: "general", name_en: "General", name_vi: "Chung" };
  const dayEnd = nextBoundary(viewer.timezone).toISOString();

  const [{ data: due }, { data: pastSessions }, { data: weak }, { data: placement }] = await Promise.all([
    db.from("cards").select("*").eq("user_id", userId).lte("due", dayEnd).order("due").limit(200),
    db.from("sessions").select("local_date, plan").eq("user_id", userId).order("local_date", { ascending: false }).limit(400),
    db.from("weakness").select("error_code, score").eq("user_id", userId),
    db.from("placements").select("grammar_results, known_lemmas").eq("user_id", userId).maybeSingle(),
  ]);

  const history = (pastSessions ?? []) as { local_date: string; plan: Plan }[];
  const seenPassages = new Set(history.map((s) => s.plan?.reading?.passage_id).filter(Boolean) as string[]);
  const seenTasks = new Set(history.map((s) => s.plan?.writing?.task_id).filter(Boolean) as string[]);

  const base = {
    localDate: today,
    kind,
    topic: { id: topic.id, slug: topic.slug, name_en: topic.name_en, name_vi: topic.name_vi },
    weekIndex,
    due: (due ?? []) as DueCard[],
    newPerDay: viewer.settings.new_words_per_day,
    rand,
  };

  if (kind === "sunday") {
    return buildPlan({ ...base, newVocabIds: [], checkItemIds: await weeklyCheckItems(db, history, today, rand) });
  }

  if (kind === "saturday") {
    const taskId = await pickWritingTask(db, topic.id, "essay", today, seenTasks);
    return buildPlan({ ...base, newVocabIds: [], taskId });
  }

  // Grammar point ------------------------------------------------------------
  const { data: points } = await db.from("grammar_points").select("id, sort, error_codes").order("sort");
  const sessionsPerPoint = new Map<number, number>();
  for (const s of history) {
    const pid = s.plan?.grammar?.point_id;
    if (pid) sessionsPerPoint.set(pid, (sessionsPerPoint.get(pid) ?? 0) + 1);
  }
  const { data: attempts } = await db
    .from("attempts")
    .select("item_id, grammar_point_id, correct, format, local_date")
    .eq("user_id", userId)
    .eq("item_kind", "grammar")
    .order("created_at", { ascending: false })
    .limit(3000);
  const byPoint = new Map<number, AttemptLite[]>();
  for (const a of attempts ?? []) {
    if (!a.grammar_point_id) continue;
    const list = byPoint.get(a.grammar_point_id) ?? [];
    list.push(a as AttemptLite);
    byPoint.set(a.grammar_point_id, list);
  }
  const mastered = new Set([...byPoint.entries()].filter(([, l]) => isPointMastered(l)).map(([id]) => id));
  const compressed = new Set<number>(((placement?.grammar_results as { compressed_points?: number[] })?.compressed_points ?? []));
  const choice = chooseGrammarPoint((points ?? []) as { id: number; sort: number; error_codes: string[] }[], {
    sessionsPerPoint,
    mastered,
    compressed,
    weakestCodes: weakestCodes((weak ?? []) as { error_code: string; score: number }[]),
  });
  const currentPoint = (points ?? []).find((p) => p.id === choice.pointId);
  // Interleave with earlier points; the very first point borrows from the rest of its phase.
  let earlierIds = (points ?? []).filter((p) => currentPoint && p.sort < currentPoint.sort).map((p) => p.id);
  if (earlierIds.length === 0 && currentPoint) {
    const { data: phase } = await db.from("grammar_points").select("id, phase").eq("phase", 1);
    earlierIds = (phase ?? []).filter((p) => p.id !== currentPoint.id).map((p) => p.id);
  }
  const [{ data: currentItems }, { data: earlierItems }] = await Promise.all([
    db.from("grammar_items").select("id, format, difficulty, grammar_point_id").eq("grammar_point_id", choice.pointId).is("owner_id", null).neq("status", "retired"),
    earlierIds.length
      ? db.from("grammar_items").select("id, format, difficulty, grammar_point_id").in("grammar_point_id", earlierIds).is("owner_id", null).neq("status", "retired").limit(400)
      : Promise.resolve({ data: [] as ItemInfo[] }),
  ]);
  const seenItems = new Set((attempts ?? []).map((a) => a.item_id as string));

  // New words ----------------------------------------------------------------
  const newVocabIds = await pickNewWords(db, userId, topic.id, viewer.settings.new_words_per_day, (placement?.known_lemmas as string[]) ?? []);

  // Reading + writing -------------------------------------------------------
  const dow = dayOfWeek(today);
  const { data: newLemmas } = newVocabIds.length
    ? await db.from("vocab_items").select("lemma").in("id", newVocabIds)
    : { data: [] as { lemma: string }[] };
  const passageId = await pickPassage(db, topic.id, dow, today, seenPassages, (newLemmas ?? []).map((v) => v.lemma));
  const taskId = await pickWritingTask(db, topic.id, WRITING_ROTATION[dow]?.type ?? "opinion", today, seenTasks);

  return buildPlan({
    ...base,
    grammar: {
      pointId: choice.pointId,
      current: (currentItems ?? []) as ItemInfo[],
      earlier: shuffle((earlierItems ?? []) as ItemInfo[], rand).slice(0, 60),
      seen: seenItems,
    },
    newVocabIds,
    passageId,
    taskId,
  });
}

async function pickNewWords(db: DB, userId: string, topicId: number, n: number, known: string[]): Promise<string[]> {
  const { data: cards } = await db.from("cards").select("item_id").eq("user_id", userId).eq("item_type", "vocab");
  const have = new Set((cards ?? []).map((c) => c.item_id as string));
  const knownSet = new Set(known.map((k) => k.toLowerCase()));
  const fresh = (rows: { id: string; lemma: string }[] | null) =>
    (rows ?? []).filter((r) => !have.has(r.id) && !knownSet.has(r.lemma.toLowerCase())).map((r) => r.id);

  const { data: topical } = await db
    .from("vocab_items")
    .select("id, lemma")
    .eq("topic_id", topicId)
    .is("owner_id", null)
    .neq("status", "retired")
    .order("frequency_rank", { nullsFirst: false })
    .limit(200);
  const ids = fresh(topical);
  if (ids.length >= n) return ids.slice(0, n);
  // Topic set exhausted: fall back to the rest of the shared bank (NAWL, other topics).
  const { data: rest } = await db
    .from("vocab_items")
    .select("id, lemma")
    .is("owner_id", null)
    .neq("status", "retired")
    .order("frequency_rank", { nullsFirst: false })
    .limit(600);
  return [...new Set([...ids, ...fresh(rest)])].slice(0, n);
}

/** Prefer today's scheduled passage, then the topic passage that reuses most of today's new words. */
async function pickPassage(db: DB, topicId: number, dow: number, today: string, seen: Set<string>, newLemmas: string[]): Promise<string | null> {
  const { data } = await db
    .from("reading_passages")
    .select("id, topic_id, day_index, scheduled_for, target_words")
    .neq("status", "retired")
    .order("created_at")
    .limit(500);
  const rows = (data ?? []).filter((p) => !seen.has(p.id));
  const scheduled = rows.find((p) => p.scheduled_for === today);
  if (scheduled) return scheduled.id;
  const want = new Set(newLemmas.map((l) => l.toLowerCase()));
  const overlap = (p: { target_words: string[] }) => (p.target_words ?? []).filter((w) => want.has(w.toLowerCase())).length;
  const topical = rows
    .filter((p) => p.topic_id === topicId)
    .sort((a, b) => overlap(b) - overlap(a) || Number(b.day_index === dow) - Number(a.day_index === dow));
  return (topical[0] ?? rows[0])?.id ?? null;
}

async function pickWritingTask(db: DB, topicId: number, type: string, today: string, seen: Set<string>): Promise<string | null> {
  const { data } = await db
    .from("writing_tasks")
    .select("id, topic_id, type, scheduled_for")
    .neq("status", "retired")
    .order("created_at")
    .limit(500);
  const all = data ?? [];
  const rows = all.filter((t) => !seen.has(t.id));
  const pick =
    rows.find((t) => t.scheduled_for === today) ??
    rows.find((t) => t.topic_id === topicId && t.type === type) ??
    rows.find((t) => t.type === type) ??
    rows.find((t) => t.topic_id === topicId && t.type !== "essay") ??
    // Everything seen: reuse the least recent task of the right type rather than block practice.
    all.find((t) => t.type === type);
  return pick?.id ?? null;
}

async function weeklyCheckItems(
  db: DB,
  history: { local_date: string; plan: Plan }[],
  today: string,
  rand: () => number,
): Promise<string[]> {
  const monday = weekStart(today);
  const pointIds = [...new Set(history.filter((s) => s.local_date >= monday).map((s) => s.plan?.grammar?.point_id).filter(Boolean) as number[])];
  let query = db.from("grammar_items").select("id").is("owner_id", null).neq("status", "retired").limit(200);
  if (pointIds.length) query = query.in("grammar_point_id", pointIds);
  const { data } = await query;
  return shuffle((data ?? []).map((d) => d.id as string), rand).slice(0, 10);
}
