import "server-only";
import { toFile } from "openai";
import { z } from "zod";
import { callStructured, estimateCost, logAiCall, modelFor, openai, zodTextFormat } from "@/lib/ai/client";
import {
  CONTENT_GENERATOR_SYSTEM, CONTENT_GENERATOR_VERSION, DayContentSchema, type DayContent,
} from "@/lib/ai/prompts/content-generator";
import { WRITING_ROTATION } from "@/lib/curriculum";
import { quoteToOffsets } from "@/lib/offsets";
import { chooseGrammarPoint } from "@/lib/session/plan";
import { weakestCodes } from "@/lib/progress-rules";
import { createAdminClient } from "@/lib/supabase/admin";
import { addDays, localDate, weekStart } from "@/lib/time";

type Admin = ReturnType<typeof createAdminClient>;

/** Monday of the coming week for the (single) learner. */
async function learnerContext(admin: Admin) {
  const { data: learner } = await admin.from("profiles").select("id, timezone").eq("role", "learner").limit(1).maybeSingle();
  if (!learner) return null;
  const today = localDate(learner.timezone);
  const nextMonday = addDays(weekStart(today), 7);
  return { learner, today, nextMonday };
}

async function topicForWeek(admin: Admin, learnerId: string, monday: string) {
  const [{ data: placement }, { data: first }, { data: topics }] = await Promise.all([
    admin.from("placements").select("completed_at").eq("user_id", learnerId).maybeSingle(),
    admin.from("sessions").select("local_date").eq("user_id", learnerId).order("local_date").limit(1),
    admin.from("topics").select("*").order("week_order"),
  ]);
  const start = [first?.[0]?.local_date, placement?.completed_at ? String(placement.completed_at).slice(0, 10) : null, monday]
    .filter(Boolean)
    .sort()[0] as string;
  const idx = Math.max(0, Math.round((Date.parse(monday) - Date.parse(weekStart(start))) / (7 * 86_400_000)));
  return topics?.[idx % topics.length] ?? null;
}

/** Sunday job: one Batch API request per day of the coming week (Mon–Sat). */
export async function submitWeeklyBatch() {
  const admin = createAdminClient();
  const ctx = await learnerContext(admin);
  if (!ctx) return { skipped: "no learner" };
  const { data: existing } = await admin.from("content_batches").select("id").eq("week_start", ctx.nextMonday).maybeSingle();
  if (existing) return { skipped: "already submitted", week_start: ctx.nextMonday };

  const topic = await topicForWeek(admin, ctx.learner.id, ctx.nextMonday);
  if (!topic) return { skipped: "no topics" };

  // Words: the next 40 unseen words of the topic, 8 per weekday.
  const [{ data: cards }, { data: vocab }, { data: points }, { data: sessions }, { data: weak }, { data: lists }] = await Promise.all([
    admin.from("cards").select("item_id").eq("user_id", ctx.learner.id).eq("item_type", "vocab"),
    admin.from("vocab_items").select("id, lemma").eq("topic_id", topic.id).is("owner_id", null).order("frequency_rank").limit(200),
    admin.from("grammar_points").select("id, sort, title, error_codes").order("sort"),
    admin.from("sessions").select("plan").eq("user_id", ctx.learner.id),
    admin.from("weakness").select("error_code, score").eq("user_id", ctx.learner.id),
    admin.from("word_lists").select("lemma").order("rank").limit(3800),
  ]);
  const have = new Set((cards ?? []).map((c) => c.item_id));
  const words = (vocab ?? []).filter((v) => !have.has(v.id)).map((v) => v.lemma);
  const perPoint = new Map<number, number>();
  for (const s of sessions ?? []) {
    const pid = (s.plan as { grammar?: { point_id: number } })?.grammar?.point_id;
    if (pid) perPoint.set(pid, (perPoint.get(pid) ?? 0) + 1);
  }
  const allowed = (lists ?? []).map((l) => l.lemma);

  const lines: string[] = [];
  for (let d = 1; d <= 6; d++) {
    // Project the grammar point forward a session at a time.
    const choice = chooseGrammarPoint((points ?? []) as { id: number; sort: number; error_codes: string[] }[], {
      sessionsPerPoint: perPoint, mastered: new Set(), compressed: new Set(),
      weakestCodes: weakestCodes((weak ?? []) as { error_code: string; score: number }[]),
    });
    perPoint.set(choice.pointId, (perPoint.get(choice.pointId) ?? 0) + 1);
    const point = (points ?? []).find((p) => p.id === choice.pointId)!;
    const dayWords = words.slice((d - 1) * 8, d * 8);
    const rotation = WRITING_ROTATION[d];
    const body = {
      model: modelFor("fast"),
      instructions: CONTENT_GENERATOR_SYSTEM,
      input: JSON.stringify({
        topic: topic.name_en,
        target_words: dayWords,
        grammar_point: point.title,
        grammar_error_codes: point.error_codes,
        writing_task_type: rotation.type,
        writing_length: `${rotation.min}–${rotation.max} words`,
        allowed_vocabulary: allowed.length ? allowed.slice(0, 1500).join(" ") : "Use common words from the New General Service List and New Academic Word List.",
        include_reading: d <= 5,
      }),
      max_output_tokens: 6000,
      text: { format: zodTextFormat(DayContentSchema, "day_content") },
      ...(/^(gpt-5|o\d)/.test(modelFor("fast")) ? { reasoning: { effort: "low" } } : { temperature: 0.4 }),
    };
    lines.push(JSON.stringify({
      custom_id: JSON.stringify({ date: addDays(ctx.nextMonday, d - 1), day: d, point_id: point.id, topic_id: topic.id, words: dayWords }),
      method: "POST",
      url: "/v1/responses",
      body,
    }));
  }

  const file = await openai().files.create({ file: await toFile(Buffer.from(lines.join("\n")), "week.jsonl"), purpose: "batch" });
  const batch = await openai().batches.create({ input_file_id: file.id, endpoint: "/v1/responses", completion_window: "24h" });
  await admin.from("content_batches").insert({
    openai_batch_id: batch.id, input_file_id: file.id, week_start: ctx.nextMonday, topic_id: topic.id, status: batch.status,
  });
  return { submitted: batch.id, week_start: ctx.nextMonday, requests: lines.length };
}

// ---------------------------------------------------------------------------
// Ingest: poll, validate, insert as draft (live after 24h unless the admin acts)
// ---------------------------------------------------------------------------

const BlindAnswerSchema = z.object({ answer: z.string(), supporting_quote: z.string() });

/** Fraction of passage tokens inside the allowed list (NGSL + NAWL + learner's words). */
export function vocabCoverage(body: string, allowed: Set<string>, extra: string[]): number {
  const toks = body.toLowerCase().match(/[a-z]+/g) ?? [];
  if (!toks.length) return 0;
  const extraSet = new Set(extra.flatMap((w) => w.toLowerCase().split(/\s+/)));
  const ok = toks.filter((t) => {
    if (allowed.has(t) || extraSet.has(t) || t.length <= 3) return true;
    const stems = [t.replace(/(ies)$/, "y"), t.replace(/(es|s|ed|ing|ly|er|est)$/, ""), t.replace(/(ed|ing|er|est)$/, "e"), t.replace(/(ied)$/, "y")];
    return stems.some((s) => allowed.has(s) || extraSet.has(s));
  });
  return ok.length / toks.length;
}

async function blindCheck(passage: string, q: DayContent["questions"][number]): Promise<boolean> {
  const out = await callStructured({
    route: "/api/cron/ingest",
    userId: null,
    tier: "fast",
    system:
      "Answer an IELTS reading question using only the passage. For TRUE/FALSE/NOT GIVEN answer exactly TRUE, FALSE or NOT GIVEN. For multiple choice give the exact option text. For completion give at most two words copied from the passage. supporting_quote: the exact sentence that proves the answer, or empty for NOT GIVEN.",
    user: JSON.stringify({ passage, question: q.prompt, type: q.type, options: q.options }),
    schema: BlindAnswerSchema,
    schemaName: "blind_answer",
    promptVersion: "blind-check@1",
    maxOutputTokens: 600,
    skipBudget: true,
  });
  const same = out.answer.trim().toLowerCase() === q.answer.trim().toLowerCase();
  // A NOT GIVEN item for which the model finds a supporting span is ambiguous.
  const ngConflict = q.answer.toUpperCase() === "NOT GIVEN" && out.supporting_quote.trim().length > 0 && out.answer.toUpperCase() !== "NOT GIVEN";
  return same && !ngConflict;
}

export async function ingestBatches() {
  const admin = createAdminClient();
  const { data: pending } = await admin.from("content_batches").select("*").in("status", ["validating", "in_progress", "finalizing", "submitted"]);
  const results: unknown[] = [];
  const { data: listRows } = await admin.from("word_lists").select("lemma");
  const allowed = new Set((listRows ?? []).map((r) => r.lemma.toLowerCase()));

  for (const b of pending ?? []) {
    const batch = await openai().batches.retrieve(b.openai_batch_id);
    if (batch.status !== "completed") {
      await admin.from("content_batches").update({ status: batch.status }).eq("id", b.id);
      results.push({ batch: b.openai_batch_id, status: batch.status });
      continue;
    }
    const summary = { days: 0, passages: 0, questions_dropped: 0, passages_rejected: 0, items: 0, tasks: 0, coverage_failures: 0 };
    if (batch.output_file_id) {
      const text = await (await openai().files.content(batch.output_file_id)).text();
      for (const line of text.split("\n").filter(Boolean)) {
        const row = JSON.parse(line);
        const meta = JSON.parse(row.custom_id) as { date: string; day: number; point_id: number; topic_id: number; words: string[] };
        const respBody = row.response?.body;
        const usage = respBody?.usage;
        if (usage) {
          const model = respBody.model ?? modelFor("fast");
          await logAiCall({
            user_id: null, route: "/api/cron/weekly-content", model, input_tokens: usage.input_tokens, output_tokens: usage.output_tokens,
            cost_usd: estimateCost(model, "fast", usage.input_tokens, usage.output_tokens, true), ok: true, prompt_version: CONTENT_GENERATOR_VERSION,
          });
        }
        const outText: string | undefined = respBody?.output?.flatMap((o: { content?: { type: string; text?: string }[] }) => o.content ?? []).find((c: { type: string }) => c.type === "output_text")?.text;
        const parsed = outText ? DayContentSchema.safeParse(JSON.parse(outText)) : null;
        if (!parsed?.success) continue;
        summary.days++;
        await insertDay(admin, b.id, meta, parsed.data, allowed, summary);
      }
    }
    await admin.from("content_batches").update({ status: "ingested", summary }).eq("id", b.id);
    results.push({ batch: b.openai_batch_id, status: "ingested", summary });
  }
  return results;
}

async function insertDay(
  admin: Admin,
  batchId: string,
  meta: { date: string; day: number; point_id: number; topic_id: number; words: string[] },
  c: DayContent,
  allowed: Set<string>,
  summary: Record<string, number>,
) {
  // Reading (weekdays) ----------------------------------------------------------------
  if (meta.day <= 5 && c.passage.body) {
    const coverage = allowed.size ? vocabCoverage(c.passage.body, allowed, meta.words) : 1;
    if (coverage < 0.95) summary.coverage_failures++;
    const questions = [];
    for (const q of c.questions.slice(0, 4)) {
      const off = quoteToOffsets(c.passage.body, q.evidence_quote);
      let ok = Boolean(off);
      if (ok) {
        try {
          ok = await blindCheck(c.passage.body, q);
        } catch {
          ok = true; // validation unavailable: keep, the admin can still review it
        }
      }
      if (!ok) {
        summary.questions_dropped++;
        continue;
      }
      questions.push({ q, off: off! });
    }
    if (questions.length >= 3 && coverage >= 0.9) {
      const { data: passage } = await admin
        .from("reading_passages")
        .insert({
          topic_id: meta.topic_id, day_index: meta.day, scheduled_for: meta.date, title: c.passage.title, body: c.passage.body,
          target_words: c.passage.target_words_used, grammar_point_id: meta.point_id, source: "generated", status: "draft", batch_id: batchId,
        })
        .select("id")
        .single();
      if (passage) {
        await admin.from("reading_questions").insert(
          questions.map(({ q, off }, i) => ({
            passage_id: passage.id, sort: i + 1, type: q.type, prompt: q.prompt, options: q.options, answer: q.answer,
            evidence_start: off.start, evidence_end: off.end, paraphrase_pairs: q.paraphrase_pairs, explain_en: q.explain_en, explain_vi: q.explain_vi,
          })),
        );
        summary.passages++;
      }
    } else {
      summary.passages_rejected++;
    }
  }

  // Grammar items -----------------------------------------------------------------------------
  const items = c.grammar_items
    .filter((g) => g.prompt && (g.format === "spot_error" ? /^\d+$/.test(g.answers[0] ?? "") : g.answers.length > 0))
    .filter((g) => g.format !== "mcq" || (g.options ?? []).includes(g.answers[0]))
    .map((g) => ({
      grammar_point_id: meta.point_id, error_code: g.error_code, format: g.format, difficulty: Math.min(3, Math.max(1, g.difficulty)),
      topic_id: meta.topic_id, prompt: g.prompt, options: g.options, answers: g.answers, explanation_en: g.explain_en,
      explanation_vi: g.explain_vi, trap_note_vi: g.trap_note_vi, source: "generated", status: "draft",
    }));
  if (items.length) {
    await admin.from("grammar_items").insert(items);
    summary.items += items.length;
  }

  // Writing task -------------------------------------------------------------------------------
  const rot = WRITING_ROTATION[meta.day];
  if (rot && c.writing_task.prompt) {
    await admin.from("writing_tasks").insert({
      topic_id: meta.topic_id, type: rot.type, prompt: c.writing_task.prompt, min_words: rot.min, max_words: rot.max,
      target_words: meta.words.slice(0, 4), grammar_point_id: meta.point_id, chart_data: c.writing_task.chart_data,
      scheduled_for: meta.date, source: "generated", status: "draft", batch_id: batchId,
    });
    summary.tasks++;
  }
}
