// Pure session-planning functions. No I/O — the loader in builder.ts feeds them.

import { GRAMMAR_ITEMS_PER_SESSION, REVIEW_CAP, SESSIONS_PER_POINT, SKIP_NEW_WORDS_THRESHOLD } from "@/lib/curriculum";
import { stageFor, type CardRow } from "@/lib/fsrs";
import type { DayKind } from "@/lib/time";
import type { Plan, ReviewEntry, SessionBlock, VocabExercise } from "./types";

export type Rand = () => number;

/** Deterministic PRNG so a plan can be rebuilt identically in tests. */
export function seededRandom(seed: string): Rand {
  let h = 1779033703 ^ seed.length;
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(h ^ seed.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return () => {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  };
}

export function shuffle<T>(arr: readonly T[], rand: Rand): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ---------------------------------------------------------------------------
// Grammar point choice
// ---------------------------------------------------------------------------

export type PointInfo = { id: number; sort: number; error_codes: string[] };

/**
 * Walk the 24 points in order; stay on a point for SESSIONS_PER_POINT sessions
 * (1 if placement showed it's already mastered) unless it becomes mastered.
 * Once every point has been introduced, cycle the five weakest codes.
 */
export function chooseGrammarPoint(
  points: PointInfo[],
  ctx: { sessionsPerPoint: Map<number, number>; mastered: Set<number>; compressed: Set<number>; weakestCodes: string[] },
): { pointId: number; mode: "sequence" | "cycle" } {
  const ordered = points.slice().sort((a, b) => a.sort - b.sort);
  for (const p of ordered) {
    const used = ctx.sessionsPerPoint.get(p.id) ?? 0;
    const target = ctx.compressed.has(p.id) ? 1 : SESSIONS_PER_POINT;
    if (used >= target) continue;
    if (ctx.mastered.has(p.id) && used > 0) continue;
    return { pointId: p.id, mode: "sequence" };
  }
  const weak = ctx.weakestCodes.slice(0, 5);
  const candidates = ordered.filter((p) => p.error_codes.some((c) => weak.includes(c)));
  const pool = candidates.length ? candidates : ordered;
  // Prefer the weakest code, then the least-practised point.
  pool.sort((a, b) => {
    const ra = Math.min(...a.error_codes.map((c) => (weak.indexOf(c) === -1 ? 99 : weak.indexOf(c))));
    const rb = Math.min(...b.error_codes.map((c) => (weak.indexOf(c) === -1 ? 99 : weak.indexOf(c))));
    if (ra !== rb) return ra - rb;
    return (ctx.sessionsPerPoint.get(a.id) ?? 0) - (ctx.sessionsPerPoint.get(b.id) ?? 0);
  });
  return { pointId: pool[0].id, mode: "cycle" };
}

// ---------------------------------------------------------------------------
// Grammar items: 10 mixed items, first 5 decide whether the tail gets harder
// ---------------------------------------------------------------------------

export type ItemInfo = { id: string; format: string; difficulty: number; grammar_point_id: number | null };

const HARD_FORMATS = new Set(["combine", "transform", "translate"]);

function pickVaried(pool: ItemInfo[], n: number, seen: Set<string>, rand: Rand, taken: Set<string>): ItemInfo[] {
  const avail = shuffle(pool.filter((i) => !taken.has(i.id)), rand);
  avail.sort((a, b) => Number(seen.has(a.id)) - Number(seen.has(b.id)));
  const out: ItemInfo[] = [];
  const formats = new Set<string>();
  // First pass: one per format, unseen first.
  for (const it of avail) {
    if (out.length >= n) break;
    if (formats.has(it.format)) continue;
    out.push(it);
    formats.add(it.format);
  }
  for (const it of avail) {
    if (out.length >= n) break;
    if (!out.includes(it)) out.push(it);
  }
  out.forEach((i) => taken.add(i.id));
  return out;
}

export function pickGrammarItems(
  current: ItemInfo[],
  earlier: ItemInfo[],
  seen: Set<string>,
  rand: Rand,
): { head: string[]; tail_normal: string[]; tail_hard: string[] } {
  const half = GRAMMAR_ITEMS_PER_SESSION / 2;
  const all = [...current, ...earlier];

  /** Top a list up to `size` from the bank, never reusing anything in `exclude`. */
  const fill = (list: ItemInfo[], size: number, exclude: Set<string>) => {
    const ids = list.map((i) => i.id).filter((id) => !exclude.has(id));
    for (const it of shuffle(all, rand)) {
      if (ids.length >= size) break;
      if (!ids.includes(it.id) && !exclude.has(it.id)) ids.push(it.id);
    }
    return ids.slice(0, size);
  };

  // Head: 4 easier items on today's point + 1 from an earlier point.
  const takenHead = new Set<string>();
  const easy = current.filter((i) => i.difficulty <= 2 && !HARD_FORMATS.has(i.format));
  const headPick = [
    ...pickVaried(easy.length >= 4 ? easy : current, 4, seen, rand, takenHead),
    ...pickVaried(earlier, 1, seen, rand, takenHead),
  ];
  const head = fill(headPick, half, new Set());
  const headSet = new Set(head);

  // Hard tail: sentence combining / transformation first.
  const takenHard = new Set(headSet);
  const hardPool = current.filter((i) => i.difficulty === 3 || HARD_FORMATS.has(i.format));
  const hardPick = [...pickVaried(hardPool, 3, seen, rand, takenHard), ...pickVaried(current, 3, seen, rand, takenHard)].slice(0, 3);
  const earlierHard = pickVaried(earlier, 2, seen, rand, new Set(takenHard));
  const tail_hard = fill(interleave(hardPick, earlierHard), half, headSet);

  // Normal tail: more of today's point, mixed with earlier points.
  const takenNormal = new Set(headSet);
  const normalPick = pickVaried(current, 3, seen, rand, takenNormal);
  const earlierNormal = pickVaried(earlier, 2, seen, rand, takenNormal);
  const tail_normal = fill(interleave(normalPick, earlierNormal), half, headSet);

  return { head, tail_normal, tail_hard };
}

function interleave<T>(a: T[], b: T[]): T[] {
  const out: T[] = [];
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    if (a[i] !== undefined) out.push(a[i]);
    if (b[i] !== undefined) out.push(b[i]);
  }
  return out;
}

// ---------------------------------------------------------------------------
// Review queue: due vocab + missed grammar, interleaved, max 20
// ---------------------------------------------------------------------------

export type DueCard = CardRow & { id: string; item_type: "vocab" | "grammar"; item_id: string };

export function vocabExercise(stage: 1 | 2 | 3 | 4 | 5, key: string, ownSentenceBudget: number): VocabExercise {
  const flip = [...key].reduce((s, c) => s + c.charCodeAt(0), 0) % 2 === 0;
  switch (stage) {
    case 1:
    case 2:
      return "meaning_mcq";
    case 3:
      return "type_word";
    case 4:
      return flip ? "collocation" : "word_form";
    case 5:
      return ownSentenceBudget > 0 && flip ? "own_sentence" : "cloze";
  }
}

export function buildReviewQueue(due: DueCard[], cap = REVIEW_CAP): ReviewEntry[] {
  const sorted = due.slice().sort((a, b) => a.due.localeCompare(b.due)).slice(0, cap);
  const vocab = sorted.filter((c) => c.item_type === "vocab");
  const grammar = sorted.filter((c) => c.item_type === "grammar");
  let ownBudget = 2;
  const toEntry = (c: DueCard): ReviewEntry => {
    const stage = stageFor(c);
    if (c.item_type === "grammar") return { card_id: c.id, item_type: "grammar", item_id: c.item_id, stage, exercise: "grammar" };
    const exercise = vocabExercise(stage, c.item_id, ownBudget);
    if (exercise === "own_sentence") ownBudget--;
    return { card_id: c.id, item_type: "vocab", item_id: c.item_id, stage, exercise };
  };
  // Interleave: two vocab, one grammar, so he must keep switching rules.
  const out: ReviewEntry[] = [];
  let v = 0;
  let g = 0;
  while (v < vocab.length || g < grammar.length) {
    for (let k = 0; k < 2 && v < vocab.length; k++) out.push(toEntry(vocab[v++]));
    if (g < grammar.length) out.push(toEntry(grammar[g++]));
  }
  return out;
}

// ---------------------------------------------------------------------------
// Whole plan
// ---------------------------------------------------------------------------

export type PlanInput = {
  localDate: string;
  kind: DayKind;
  topic: Plan["topic"];
  weekIndex: number;
  due: DueCard[];
  grammar?: { pointId: number; current: ItemInfo[]; earlier: ItemInfo[]; seen: Set<string> };
  newVocabIds: string[];
  newPerDay: number;
  passageId?: string | null;
  taskId?: string | null;
  checkItemIds?: string[];
  rand: Rand;
};

export function buildPlan(input: PlanInput): Plan {
  const review = { entries: buildReviewQueue(input.due), due_total: input.due.length };
  const plan: Plan = {
    v: 1,
    kind: input.kind,
    local_date: input.localDate,
    topic: input.topic,
    week_index: input.weekIndex,
    blocks: [],
    review,
  };

  if (input.kind === "sunday") {
    plan.check = { item_ids: (input.checkItemIds ?? []).slice(0, 10) };
    plan.blocks = ["check", "wrapup"];
    return plan;
  }

  if (input.kind === "saturday") {
    plan.blocks = ["review"];
    if (input.taskId) {
      plan.writing = { task_id: input.taskId, optional: true };
      plan.blocks.push("writing");
    }
    plan.blocks.push("wrapup");
    return plan;
  }

  const blocks: SessionBlock[] = ["review"];
  if (input.grammar) {
    plan.grammar = {
      point_id: input.grammar.pointId,
      ...pickGrammarItems(input.grammar.current, input.grammar.earlier, input.grammar.seen, input.rand),
    };
    blocks.push("grammar");
  }
  if (input.due.length > SKIP_NEW_WORDS_THRESHOLD) {
    plan.new_words_skipped_reason = `${input.due.length} reviews are due, so no new words today — clearing reviews first keeps them from piling up.`;
  } else if (input.newVocabIds.length > 0) {
    const ids = input.newVocabIds.slice(0, input.newPerDay);
    plan.new_words = { vocab_ids: ids, check_ids: shuffle(ids, input.rand).slice(0, 3) };
    blocks.push("new_words");
  }
  if (input.passageId) {
    plan.reading = { passage_id: input.passageId };
    blocks.push("reading");
  }
  if (input.taskId) {
    plan.writing = { task_id: input.taskId };
    blocks.push("writing");
  }
  blocks.push("wrapup");
  plan.blocks = blocks;
  return plan;
}
