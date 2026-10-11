import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { XP } from "@/lib/curriculum";
import { HttpError, type Viewer } from "@/lib/auth";
import { deriveRating, Rating, review, type CardRow } from "@/lib/fsrs";
import { containsTarget } from "@/lib/inflect";
import { countWords, normalizeAnswer } from "@/lib/normalize";
import { weaknessFromAttempt } from "@/lib/progress-rules";
import { createAdminClient } from "@/lib/supabase/admin";
import { localDate } from "@/lib/time";
import { aiCheckAnswer, aiCheckOwnSentence } from "@/lib/ai/services";
import { checkGrammarExact, displayAnswer, type GrammarItem } from "./check";
import { exerciseSeed, vocabPool } from "./hydrate";
import { blockLength, completeBlock, grammarSequence, streakOk } from "./progress";
import type { Progress, SessionBlock, SessionRow } from "./types";
import { buildVocabExercise } from "./vocab-exercise";

type DB = SupabaseClient;

const MAX_ITEM_MS = 120_000;

/** Load today's open session for this learner or throw a clear error. */
export async function loadOpenSession(db: DB, viewer: Viewer, sessionId: string): Promise<SessionRow> {
  const { data } = await db.from("sessions").select("*").eq("id", sessionId).maybeSingle();
  const s = data as SessionRow | null;
  if (!s || s.user_id !== viewer.id) throw new HttpError(404, "Session not found.");
  const today = localDate(viewer.timezone);
  if (s.local_date !== today) throw new HttpError(409, "This session has ended. A new day has started.", { code: "stale_session" });
  if (s.status !== "in_progress") throw new HttpError(409, "You're done for today.", { code: "done_for_today" });
  return s;
}

/** Persist progress with an optimistic lock so two tabs can't double-advance. */
export async function saveProgress(
  db: DB,
  s: SessionRow & { updated_at?: string },
  progress: Progress,
  extra: Record<string, unknown> = {},
) {
  const update = {
    progress,
    xp: progress.xp,
    streak_ok: s.streak_ok || streakOk(s.plan, progress),
    // minutes/active_ms are maintained by the time heartbeat (add_session_time), not here.
    ...extra,
  };
  const { data, error } = await db
    .from("sessions")
    .update(update)
    .eq("id", s.id)
    .eq("updated_at", s.updated_at!)
    .select("id, updated_at");
  if (error) throw new HttpError(500, "Could not save your progress.");
  if (!data?.length) throw new HttpError(409, "Your session changed in another tab. Reloading…", { code: "conflict" });
  return data[0];
}

async function updateWeakness(userId: string, code: string, correct: boolean) {
  const admin = createAdminClient();
  const { data } = await admin.from("weakness").select("score, samples").eq("user_id", userId).eq("error_code", code).maybeSingle();
  const score = weaknessFromAttempt(data?.score ?? 0.5, correct);
  await admin.from("weakness").upsert({
    user_id: userId, error_code: code, score, samples: (data?.samples ?? 0) + 1, updated_at: new Date().toISOString(),
  });
}

/** Accepted AI variants join the answer list after two identical acceptances. */
async function recordVariant(item: GrammarItem, response: string) {
  const admin = createAdminClient();
  const { data } = await admin.from("grammar_items").select("variant_votes, answers").eq("id", item.id).single();
  if (!data) return;
  const key = normalizeAnswer(response);
  const votes = { ...(data.variant_votes as Record<string, number>), [key]: ((data.variant_votes as Record<string, number>)?.[key] ?? 0) + 1 };
  const answers = data.answers as string[];
  const promote = votes[key] >= 2 && !answers.some((a) => normalizeAnswer(a) === key);
  await admin.from("grammar_items").update({ variant_votes: votes, ...(promote ? { answers: [...answers, response.trim()] } : {}) }).eq("id", item.id);
}

type GrammarResult = {
  correct: boolean;
  checked_by: "exact" | "ai" | "fallback";
  correct_answer: string;
  explanation_en: string;
  explanation_vi: string;
  trap_note_vi: string;
  feedback_en?: string;
  feedback_vi?: string;
  error_code: string;
};

async function evaluateGrammar(item: GrammarItem, response: string, userId: string): Promise<GrammarResult> {
  const exact = checkGrammarExact(item, response);
  let correct = exact.correct;
  let checked_by: GrammarResult["checked_by"] = "exact";
  let feedback_en: string | undefined;
  let feedback_vi: string | undefined;
  if (!exact.correct && exact.needsAi) {
    const ai = await aiCheckAnswer(item, response, userId);
    if (ai) {
      correct = ai.correct;
      checked_by = "ai";
      feedback_en = ai.feedback_en || undefined;
      feedback_vi = ai.feedback_vi || undefined;
      if (ai.correct && ai.acceptable_variant) await recordVariant(item, response);
    } else {
      checked_by = "fallback";
      feedback_en = "Checked against the answer list only (AI checking is unavailable right now).";
    }
  }
  return {
    correct,
    checked_by,
    correct_answer: displayAnswer(item),
    explanation_en: item.explanation_en,
    explanation_vi: item.explanation_vi,
    trap_note_vi: item.trap_note_vi,
    feedback_en,
    feedback_vi,
    error_code: item.error_code,
  };
}

export type AnswerInput = {
  session_id: string;
  block: SessionBlock;
  ref: string;
  response: string;
  duration_ms: number;
  used_hint?: boolean;
};

export async function submitAnswer(db: DB, viewer: Viewer, input: AnswerInput) {
  const s = (await loadOpenSession(db, viewer, input.session_id)) as SessionRow & { updated_at: string };
  const plan = s.plan;
  let progress: Progress = structuredClone(s.progress);
  const block = input.block;
  if (progress.current !== block) throw new HttpError(409, "That part of the session is already finished.", { code: "wrong_block" });
  const bp = progress.blocks[block]!;
  const index = bp.index;
  const durationMs = Math.max(0, Math.min(Number(input.duration_ms) || 0, MAX_ITEM_MS));
  const today = s.local_date;
  const now = new Date();

  let result: Record<string, unknown> = {};
  let correct = false;
  const sideEffects: (() => Promise<unknown>)[] = [];

  if (block === "grammar" || block === "check") {
    const seq = block === "grammar" ? grammarSequence(plan, progress) : plan.check?.item_ids ?? [];
    if (seq[index] !== input.ref) return duplicateOrConflict(seq, index, input.ref, progress);
    const { data: item } = await db.from("grammar_items").select("*").eq("id", input.ref).single();
    if (!item) throw new HttpError(404, "Item not found.");
    const r = await evaluateGrammar(item as GrammarItem, input.response, viewer.id);
    correct = r.correct;
    result = r;
    const g = item as GrammarItem;
    sideEffects.push(
      async () => db.from("attempts").insert({
        user_id: viewer.id, session_id: s.id, item_kind: "grammar", item_id: g.id, grammar_point_id: g.grammar_point_id,
        format: g.format, response: input.response.slice(0, 1000), correct, error_code: g.error_code, duration_ms: durationMs, local_date: today,
      }),
      async () => updateWeakness(viewer.id, g.error_code, correct),
    );
    if (!correct) {
      // Missed items come back in review on an FSRS schedule.
      sideEffects.push(async () => {
        const { data: existing } = await db.from("cards").select("id").eq("user_id", viewer.id).eq("item_type", "grammar").eq("item_id", g.id).maybeSingle();
        if (!existing) {
          await db.from("cards").insert({ user_id: viewer.id, item_type: "grammar", item_id: g.id, ...review(null, Rating.Again, now) });
        }
      });
    }
  } else if (block === "review") {
    const entry = plan.review.entries[index];
    if (!entry || entry.card_id !== input.ref) {
      return duplicateOrConflict(plan.review.entries.map((e) => e.card_id), index, input.ref, progress);
    }
    const { data: card } = await db.from("cards").select("*").eq("id", entry.card_id).single();
    let production = false;
    if (entry.item_type === "grammar") {
      const { data: item } = await db.from("grammar_items").select("*").eq("id", entry.item_id).single();
      if (!item) throw new HttpError(404, "Item not found.");
      const g = item as GrammarItem;
      const r = await evaluateGrammar(g, input.response, viewer.id);
      correct = r.correct;
      result = r;
      production = ["typed_gap", "correct_error", "transform", "combine", "word_form", "translate", "upgrade"].includes(g.format);
      sideEffects.push(
        async () => db.from("attempts").insert({
          user_id: viewer.id, session_id: s.id, item_kind: "grammar", item_id: g.id, grammar_point_id: g.grammar_point_id,
          format: g.format, response: input.response.slice(0, 1000), correct, error_code: g.error_code, duration_ms: durationMs, local_date: today,
        }),
        async () => updateWeakness(viewer.id, g.error_code, correct),
      );
    } else {
      const pool = await vocabPool(db, [entry.item_id]);
      const item = pool.find((v) => v.id === entry.item_id);
      if (!item) throw new HttpError(404, "Word not found.");
      const kind = entry.exercise === "grammar" ? "meaning_mcq" : entry.exercise;
      const ex = buildVocabExercise(kind, item, pool, exerciseSeed(s.id, entry.card_id));
      production = ex.production;
      if (ex.kind === "own_sentence") {
        const ai = await aiCheckOwnSentence(item.lemma, item.definition_en, input.response, viewer.id);
        correct = ai ? ai.correct : containsTarget(input.response, item.lemma) && countWords(input.response) >= 5;
        result = { feedback_en: ai?.feedback_en, feedback_vi: ai?.feedback_vi, checked_by: ai ? "ai" : "fallback" };
        progress.own_sentence_count = (progress.own_sentence_count ?? 0) + 1;
      } else if (ex.options) {
        correct = input.response === ex.answer;
      } else {
        correct = normalizeAnswer(input.response) === normalizeAnswer(ex.answer);
      }
      result = {
        ...result,
        correct_answer: ex.kind === "own_sentence" ? item.examples[0] ?? "" : ex.answer,
        lemma: item.lemma,
        gloss_vi: item.gloss_vi,
        definition_en: item.definition_en,
        example: item.examples[0] ?? "",
      };
    }
    const grade = deriveRating({ correct, usedHint: input.used_hint, durationMs, production });
    const next = review(card as CardRow, grade, now);
    sideEffects.push(
      async () => db.from("cards").update(next).eq("id", entry.card_id),
      async () => db.from("review_logs").insert({
        card_id: entry.card_id, user_id: viewer.id, session_id: s.id, rating: grade,
        exercise_type: entry.exercise, correct, duration_ms: durationMs, response: input.response.slice(0, 1000),
      }),
    );
    result.rating = grade;
  } else if (block === "new_words") {
    const words = plan.new_words?.vocab_ids ?? [];
    const checks = plan.new_words?.check_ids ?? [];
    const checkIndex = index - words.length;
    if (checkIndex < 0) throw new HttpError(409, "Finish looking at the new words first.", { code: "learn_phase" });
    if (checks[checkIndex] !== input.ref) return duplicateOrConflict(checks.map((c) => c), checkIndex, input.ref, progress);
    const pool = await vocabPool(db, [input.ref]);
    const item = pool.find((v) => v.id === input.ref)!;
    const ex = buildVocabExercise("meaning_mcq", item, pool, exerciseSeed(s.id, `new:${item.id}`));
    correct = input.response === ex.answer;
    result = { correct_answer: ex.answer, lemma: item.lemma, gloss_vi: item.gloss_vi };
    bp.data = { ...(bp.data ?? {}), checks: { ...((bp.data?.checks as Record<string, boolean>) ?? {}), [item.id]: correct } };
    sideEffects.push(async () =>
      db.from("attempts").insert({
        user_id: viewer.id, session_id: s.id, item_kind: "vocab_check", item_id: item.id, format: "meaning_mcq",
        response: input.response.slice(0, 500), correct, duration_ms: durationMs, local_date: today,
      }),
    );
    if (checkIndex === checks.length - 1) {
      // Block finished: every new word becomes an FSRS card.
      const results = bp.data.checks as Record<string, boolean>;
      sideEffects.push(async () => {
        const rows = words.map((id) => ({
          user_id: viewer.id, item_type: "vocab", item_id: id,
          ...review(null, results[id] === false ? Rating.Again : Rating.Good, now),
        }));
        await db.from("cards").upsert(rows, { onConflict: "user_id,item_type,item_id", ignoreDuplicates: true });
      });
      progress.words_learned = words.length;
      progress.xp += XP.newWord * words.length;
    }
  } else {
    throw new HttpError(400, "This block doesn't take answers here.");
  }

  // Advance --------------------------------------------------------------------
  bp.index = index + 1;
  bp.answered += 1;
  bp.correct += correct ? 1 : 0;
  bp.ms += durationMs;
  progress.blocks[block] = bp;
  const xpGained = correct ? XP.correct : 0;
  progress.xp += xpGained;

  let nextSequence: string[] | undefined;
  if (block === "grammar" && bp.index === 5 && plan.grammar) {
    // First five right → the last five switch to harder items.
    progress.grammar_tail = bp.correct === 5 ? "hard" : "normal";
    nextSequence = grammarSequence(plan, progress);
  }
  if (bp.index >= blockLength(plan, progress, block)) {
    progress = completeBlock(plan, progress, block, s.short_day);
  }

  await saveProgress(db, s, progress);
  await Promise.all(sideEffects.map((f) => f().catch((e) => console.error("answer side effect", e))));

  return { correct, ...result, xp_gained: xpGained, progress, grammar_sequence: nextSequence };
}

function duplicateOrConflict(seq: string[], index: number, ref: string, progress: Progress) {
  const pos = seq.indexOf(ref);
  if (pos >= 0 && pos < index) return { duplicate: true, progress };
  throw new HttpError(409, "That question isn't the current one. Reloading…", { code: "out_of_order" });
}
