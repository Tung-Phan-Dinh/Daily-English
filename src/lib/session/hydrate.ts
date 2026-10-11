import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { instructionFor, publicGrammarItem, type GrammarItem } from "./check";
import { grammarSequence } from "./progress";
import type { SessionRow } from "./types";
import { buildVocabExercise, publicExercise, type VocabItem } from "./vocab-exercise";

type DB = SupabaseClient;

export const VOCAB_COLUMNS =
  "id, lemma, pos, ipa, definition_en, gloss_vi, word_family, collocations, examples, register, common_mistake_vi";

export async function vocabPool(db: DB, extraIds: string[] = []): Promise<VocabItem[]> {
  const [{ data: pool }, { data: extra }] = await Promise.all([
    db.from("vocab_items").select(VOCAB_COLUMNS).is("owner_id", null).order("lemma").limit(120),
    extraIds.length ? db.from("vocab_items").select(VOCAB_COLUMNS).in("id", extraIds) : Promise.resolve({ data: [] }),
  ]);
  const map = new Map<string, VocabItem>();
  for (const v of [...(pool ?? []), ...(extra ?? [])] as VocabItem[]) map.set(v.id, v);
  return [...map.values()];
}

export function exerciseSeed(sessionId: string, key: string) {
  return `${sessionId}:${key}`;
}

function publicGrammar(item: GrammarItem) {
  return { ...publicGrammarItem(item), instruction: instructionFor(item) };
}

export async function hydrateSession(db: DB, s: SessionRow) {
  const plan = s.plan;
  const progress = s.progress;

  const reviewVocabIds = plan.review.entries.filter((e) => e.item_type === "vocab").map((e) => e.item_id);
  const reviewGrammarIds = plan.review.entries.filter((e) => e.item_type === "grammar").map((e) => e.item_id);
  const newIds = plan.new_words?.vocab_ids ?? [];
  const grammarIds = [
    ...(plan.grammar ? [...plan.grammar.head, ...plan.grammar.tail_normal, ...plan.grammar.tail_hard] : []),
    ...(plan.check?.item_ids ?? []),
    ...reviewGrammarIds,
  ];

  const [pool, { data: grammarRows }, point, reading, writing] = await Promise.all([
    vocabPool(db, [...reviewVocabIds, ...newIds]),
    grammarIds.length ? db.from("grammar_items").select("*").in("id", [...new Set(grammarIds)]) : Promise.resolve({ data: [] }),
    plan.grammar
      ? db.from("grammar_points").select("id, slug, title, title_vi, rule_en, rule_vi, examples, trap, error_codes").eq("id", plan.grammar.point_id).single().then((r) => r.data)
      : Promise.resolve(null),
    plan.reading ? loadReading(db, plan.reading.passage_id, progress.blocks.reading?.status === "done") : Promise.resolve(null),
    plan.writing ? loadWriting(db, s) : Promise.resolve(null),
  ]);

  const vocabById = new Map(pool.map((v) => [v.id, v]));
  const grammarById = new Map(((grammarRows ?? []) as GrammarItem[]).map((g) => [g.id, g]));

  const review = plan.review.entries.map((e) => {
    if (e.item_type === "grammar") {
      const g = grammarById.get(e.item_id);
      return { card_id: e.card_id, item_type: e.item_type, stage: e.stage, grammar: g ? publicGrammar(g) : null };
    }
    const v = vocabById.get(e.item_id);
    const kind = e.exercise === "grammar" ? "meaning_mcq" : e.exercise;
    return {
      card_id: e.card_id,
      item_type: e.item_type,
      stage: e.stage,
      vocab: v ?? null,
      exercise: v ? publicExercise(buildVocabExercise(kind, v, pool, exerciseSeed(s.id, e.card_id))) : null,
    };
  });

  const newWords = plan.new_words
    ? {
        words: plan.new_words.vocab_ids.map((id) => vocabById.get(id)).filter(Boolean) as VocabItem[],
        checks: plan.new_words.check_ids
          .map((id) => vocabById.get(id))
          .filter(Boolean)
          .map((v) => ({
            vocab_id: v!.id,
            exercise: publicExercise(buildVocabExercise("meaning_mcq", v!, pool, exerciseSeed(s.id, `new:${v!.id}`))),
          })),
      }
    : null;

  const grammar = plan.grammar
    ? {
        point,
        sequence: grammarSequence(plan, progress),
        items: Object.fromEntries(
          [...plan.grammar.head, ...plan.grammar.tail_normal, ...plan.grammar.tail_hard]
            .map((id) => grammarById.get(id))
            .filter(Boolean)
            .map((g) => [g!.id, publicGrammar(g!)]),
        ),
      }
    : null;

  const check = plan.check
    ? {
        sequence: plan.check.item_ids,
        items: Object.fromEntries(
          plan.check.item_ids.map((id) => grammarById.get(id)).filter(Boolean).map((g) => [g!.id, publicGrammar(g!)]),
        ),
      }
    : null;

  return {
    session: {
      id: s.id,
      local_date: s.local_date,
      kind: s.kind,
      status: s.status,
      short_day: s.short_day,
      skipped_blocks: s.skipped_blocks,
      xp: s.xp,
      streak_ok: s.streak_ok,
      progress,
      blocks: plan.blocks,
      topic: plan.topic,
      due_total: plan.review.due_total,
      new_words_skipped_reason: plan.new_words_skipped_reason ?? null,
      active_ms: Number(s.active_ms ?? 0),
    },
    review,
    grammar,
    new_words: newWords,
    reading,
    writing,
    check,
  };
}

export type SessionPayload = Awaited<ReturnType<typeof hydrateSession>>;

async function loadReading(db: DB, passageId: string, submitted: boolean) {
  const [{ data: passage }, { data: questions }] = await Promise.all([
    db.from("reading_passages").select("id, title, body, target_words").eq("id", passageId).single(),
    db.from("reading_questions").select("*").eq("passage_id", passageId).order("sort"),
  ]);
  if (!passage) return null;
  return {
    passage,
    questions: (questions ?? []).map((q) => ({
      id: q.id as string,
      sort: q.sort as number,
      type: q.type as string,
      prompt: q.prompt as string,
      options: q.options as string[] | null,
      // Answers and evidence only after submission.
      ...(submitted
        ? {
            answer: q.answer as string,
            evidence_start: q.evidence_start as number | null,
            evidence_end: q.evidence_end as number | null,
            paraphrase_pairs: q.paraphrase_pairs as [string, string][],
            explain_en: q.explain_en as string,
            explain_vi: q.explain_vi as string,
          }
        : {}),
    })),
  };
}

export async function loadWriting(db: DB, s: SessionRow) {
  const taskId = s.plan.writing?.task_id;
  if (!taskId) return null;
  const [{ data: task }, { data: submission }] = await Promise.all([
    db.from("writing_tasks").select("*, grammar_points(title)").eq("id", taskId).single(),
    db.from("writing_submissions").select("*").eq("session_id", s.id).maybeSingle(),
  ]);
  if (!task) return null;
  // Today's new words are the target words when there are any; otherwise the task's own list.
  const newWordLemmas = s.plan.new_words?.vocab_ids.length
    ? ((await db.from("vocab_items").select("lemma").in("id", s.plan.new_words.vocab_ids)).data ?? []).map((v) => v.lemma as string)
    : [];
  const target_words = newWordLemmas.length ? newWordLemmas : (task.target_words as string[]);
  return {
    task: {
      id: task.id as string,
      type: task.type as string,
      prompt: task.prompt as string,
      min_words: task.min_words as number,
      max_words: task.max_words as number,
      chart_data: task.chart_data as { title: string; unit: string; points: { label: string; value: number }[] } | null,
      grammar_point: (task.grammar_points as { title?: string } | null)?.title ?? "",
      optional: Boolean(s.plan.writing?.optional),
    },
    target_words,
    submission: submission ? publicSubmission(submission) : null,
  };
}

/** The model version stays locked until the rewrite step is finished. */
export function publicSubmission(sub: Record<string, unknown>) {
  const feedback = (sub.feedback ?? null) as Record<string, unknown> | null;
  const rewriteDone = sub.rewrite_ok === true || Number(sub.rewrite_attempts ?? 0) >= 2;
  return {
    id: sub.id as string,
    text: sub.text as string,
    word_count: sub.word_count as number,
    status: sub.status as string,
    feedback: feedback ? { ...feedback, model_version: rewriteDone ? feedback.model_version : null } : null,
    band_gra: sub.band_gra,
    band_lr: sub.band_lr,
    band_tr: sub.band_tr,
    band_cc: sub.band_cc,
    rewrite_text: sub.rewrite_text as string | null,
    rewrite_ok: sub.rewrite_ok as boolean | null,
    rewrite_attempts: sub.rewrite_attempts as number,
    rewrite_done: rewriteDone,
    hidden_from_viewers: sub.hidden_from_viewers as boolean,
  };
}
