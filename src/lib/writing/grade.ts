import "server-only";
import { ERROR_CODES } from "@/lib/curriculum";
import { Rating, review } from "@/lib/fsrs";
import { errorDensity, sentenceAround } from "@/lib/offsets";
import { postProcessFeedback, type ProcessedFeedback } from "./feedback";
import { weaknessFromDensity } from "@/lib/progress-rules";
import { createAdminClient } from "@/lib/supabase/admin";
import { addDays, dayOfWeek, dayStart } from "@/lib/time";
import { callStructuredStream } from "@/lib/ai/client";
import { WRITING_GRADER_VERSION, WritingFeedbackSchema, writingGraderSystem } from "@/lib/ai/prompts/writing-grader";

export type { ProcessedFeedback };

export type WritingContext = {
  task_prompt: string;
  task_type: string;
  target_words: string[];
  grammar_point: string;
  weak_codes: string[];
};

/**
 * Grade a stored submission (used by the live route and by the cron for
 * queued submissions). Streams raw text progress via onText.
 */
export async function gradeSubmission(submissionId: string, onText?: (t: string) => void) {
  const admin = createAdminClient();
  const { data: sub } = await admin.from("writing_submissions").select("*").eq("id", submissionId).single();
  if (!sub) throw new Error("Submission not found");
  const ctx = sub.context as WritingContext;
  const fullCriteria = ctx.task_type === "essay";

  const raw = await callStructuredStream({
    route: "/api/writing/grade",
    userId: sub.user_id,
    tier: "grader",
    system: writingGraderSystem({
      weakCodes: ctx.weak_codes,
      taskPrompt: ctx.task_prompt,
      targetWords: ctx.target_words,
      grammarPoint: ctx.grammar_point,
      fullCriteria,
    }),
    user: sub.text,
    schema: WritingFeedbackSchema,
    schemaName: "writing_feedback",
    promptVersion: WRITING_GRADER_VERSION,
    maxOutputTokens: 8000,
    onText: onText ?? (() => {}),
  });

  const fb = postProcessFeedback(sub.text, raw, ctx.weak_codes, fullCriteria);
  const density = errorDensity(fb.errors, sub.word_count);

  await admin.from("writing_errors").delete().eq("submission_id", sub.id);
  if (fb.errors.length) {
    await admin.from("writing_errors").insert(
      fb.errors.map((e) => ({
        submission_id: sub.id, user_id: sub.user_id, start_pos: e.start, end_pos: e.end, code: e.code, severity: e.severity,
        original: e.original, correction: e.correction, explain_en: e.explain_en, explain_vi: e.explain_vi, is_focus: e.is_focus,
      })),
    );
  }
  await admin
    .from("writing_submissions")
    .update({
      status: "graded",
      feedback: fb,
      band_gra: fb.bands.gra,
      band_lr: fb.bands.lr,
      band_tr: fb.bands.tr,
      band_cc: fb.bands.cc,
      error_density: density,
      prompt_version: WRITING_GRADER_VERSION,
      graded_at: new Date().toISOString(),
    })
    .eq("id", sub.id);

  await Promise.all([
    updateWeaknessFromWriting(sub.user_id, density),
    createPersonalDrills(sub.user_id, sub.text, fb, sub.local_date, ctx),
  ]);
  return { ...sub, status: "graded", feedback: fb, band_gra: fb.bands.gra, band_lr: fb.bands.lr, band_tr: fb.bands.tr, band_cc: fb.bands.cc, error_density: density };
}

async function updateWeaknessFromWriting(userId: string, density: Record<string, number>) {
  const admin = createAdminClient();
  const { data } = await admin.from("weakness").select("error_code, score, samples").eq("user_id", userId);
  const prev = new Map((data ?? []).map((r) => [r.error_code as string, r]));
  const rows = ERROR_CODES.map((code) => ({
    user_id: userId,
    error_code: code,
    score: weaknessFromDensity(prev.get(code)?.score ?? 0.5, density[code] ?? 0),
    samples: (prev.get(code)?.samples ?? 0) + 1,
    updated_at: new Date().toISOString(),
  }));
  await admin.from("weakness").upsert(rows);
}

/** Each focus error becomes a personal drill from his own sentence; upgrades become weekly upgrade items. */
async function createPersonalDrills(userId: string, text: string, fb: ProcessedFeedback, localDay: string, ctx: WritingContext) {
  const admin = createAdminClient();
  const { data: points } = await admin.from("grammar_points").select("id, error_codes").order("sort");
  const pointFor = (code: string) => (points ?? []).find((p) => (p.error_codes as string[]).includes(code))?.id ?? null;
  const { data: profile } = await admin.from("profiles").select("timezone").eq("id", userId).single();
  const tz = profile?.timezone ?? "Asia/Ho_Chi_Minh";

  const focusErrors = fb.errors.filter((e) => e.is_focus).slice(0, 3);
  const items = focusErrors.map((e, i) => {
    const span = sentenceAround(text, e.start, e.end);
    const sentence = text.slice(span.start, span.end).trim();
    const corrected = (text.slice(span.start, e.start) + e.correction + text.slice(e.end, span.end)).trim();
    const tokens = sentence.split(" ");
    const relStart = e.start - span.start - (text.slice(span.start, span.end).length - text.slice(span.start, span.end).trimStart().length);
    let acc = 0;
    let tokenIndex = -1;
    tokens.forEach((t, idx) => {
      if (tokenIndex === -1 && relStart >= acc && relStart < acc + t.length + 1) tokenIndex = idx;
      acc += t.length + 1;
    });
    const singleToken = !e.original.trim().includes(" ") && tokenIndex >= 0;
    const spot = i % 2 === 0 && singleToken;
    return {
      grammar_point_id: pointFor(e.code),
      error_code: ["SPL", "COL", "WCH", "OTH"].includes(e.code) ? "WFM" : e.code,
      format: spot ? "spot_error" : "correct_error",
      difficulty: 2,
      prompt: sentence,
      answers: spot ? [String(tokenIndex)] : [corrected],
      meta: spot ? { correction: corrected, from_writing: true } : { from_writing: true },
      explanation_en: e.explain_en,
      explanation_vi: e.explain_vi,
      source: "personal",
      status: "approved",
      owner_id: userId,
    };
  });

  const upgrades = fb.upgrades.map((u) => {
    const idx = text.toLowerCase().indexOf(u.original.toLowerCase());
    const span = sentenceAround(text, Math.max(0, idx));
    return {
      grammar_point_id: null,
      error_code: "WFM",
      format: "upgrade",
      difficulty: 2,
      prompt: text.slice(span.start, span.end).trim(),
      answers: [u.better],
      meta: { word: u.original, from_writing: true },
      explanation_en: `A more precise choice: “${u.better}”.`,
      explanation_vi: u.note_vi,
      source: "personal",
      status: "approved",
      owner_id: userId,
    };
  });

  const all = [...items, ...upgrades];
  if (!all.length) return;
  const { data: inserted } = await admin.from("grammar_items").insert(all).select("id, format");
  // Drills are due tomorrow; upgrade items arrive in next Monday's review block.
  const tomorrow = dayStart(tz, addDays(localDay, 1)).toISOString();
  const dow = dayOfWeek(localDay);
  const monday = dayStart(tz, addDays(localDay, dow === 1 ? 7 : (8 - dow) % 7 || 7)).toISOString();
  const cards = (inserted ?? []).map((it) => ({
    user_id: userId,
    item_type: "grammar",
    item_id: it.id,
    ...review(null, Rating.Again, new Date()),
    due: it.format === "upgrade" ? monday : tomorrow,
  }));
  if (cards.length) await admin.from("cards").upsert(cards, { onConflict: "user_id,item_type,item_id", ignoreDuplicates: true });
  void ctx;
}
