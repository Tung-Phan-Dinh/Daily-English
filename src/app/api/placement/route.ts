import { NextResponse } from "next/server";
import { PLACEMENT_WRITING_PROMPT, PSEUDO_WORDS, VOCAB_CHECK_BANDS, scoreVocabCheck } from "@content/placement";
import { apiViewer, handle, HttpError, readJson } from "@/lib/auth";
import { AiUnavailableError, callStructured } from "@/lib/ai/client";
import { aiCheckAnswer } from "@/lib/ai/services";
import { WRITING_GRADER_VERSION, WritingFeedbackSchema, writingGraderSystem } from "@/lib/ai/prompts/writing-grader";
import { ERROR_CODES } from "@/lib/curriculum";
import { countWords } from "@/lib/normalize";
import { errorDensity, validateErrorOffsets, type OffsetError } from "@/lib/offsets";
import { weaknessFromPlacement } from "@/lib/progress-rules";
import { checkGrammarExact, instructionFor, publicGrammarItem, type GrammarItem } from "@/lib/session/check";
import { seededRandom, shuffle } from "@/lib/session/plan";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { localDate } from "@/lib/time";

export const maxDuration = 120;

const RECOGNITION = ["mcq", "spot_error", "word_order"];
const PRODUCTION = ["typed_gap", "word_form"];

/** 36 items: 3 per error code, mixing recognition and production. */
async function placementItems(userId: string): Promise<GrammarItem[]> {
  const db = await createClient();
  const { data } = await db.from("grammar_items").select("*").is("owner_id", null).eq("source", "seed");
  const items = (data ?? []) as GrammarItem[];
  const rand = seededRandom(`placement:${userId}`);
  const out: GrammarItem[] = [];
  for (const code of ERROR_CODES) {
    const pool = shuffle(items.filter((i) => i.error_code === code && i.difficulty <= 2), rand);
    const pick: GrammarItem[] = [];
    const take = (formats: string[] | null) => {
      const it = pool.find((i) => !pick.includes(i) && (!formats || formats.includes(i.format)));
      if (it) pick.push(it);
    };
    take(RECOGNITION);
    take(PRODUCTION);
    take(null);
    while (pick.length < 3) {
      const before = pick.length;
      take(null);
      if (pick.length === before) break;
    }
    out.push(...pick);
  }
  return shuffle(out, rand);
}

export const GET = handle(async () => {
  const viewer = await apiViewer(["learner"]);
  const items = await placementItems(viewer.id);
  const rand = seededRandom(`vocab:${viewer.id}`);
  const words = shuffle([...VOCAB_CHECK_BANDS.flatMap((b) => b.words), ...PSEUDO_WORDS], rand);
  const db = await createClient();
  const { data: existing } = await db.from("placements").select("completed_at").eq("user_id", viewer.id).maybeSingle();
  return NextResponse.json({
    items: items.map((i) => ({ ...publicGrammarItem(i), instruction: instructionFor(i) })),
    words,
    writing_prompt: PLACEMENT_WRITING_PROMPT,
    completed_at: existing?.completed_at ?? null,
  });
});

export const POST = handle(async (req: Request) => {
  const viewer = await apiViewer(["learner"]);
  const body = await readJson<{ grammar: Record<string, string>; vocab: Record<string, boolean>; writing: string }>(req);
  const db = await createClient();
  const admin = createAdminClient();
  const today = localDate(viewer.timezone);

  // Grammar ------------------------------------------------------------------
  const items = await placementItems(viewer.id);
  const perCode: Record<string, { wrong: number; total: number }> = {};
  const attempts = [];
  for (const it of items) {
    const response = String(body.grammar?.[it.id] ?? "");
    let { correct, needsAi } = checkGrammarExact(it, response);
    if (!correct && needsAi && response.trim()) {
      const ai = await aiCheckAnswer(it, response, viewer.id);
      if (ai) correct = ai.correct;
      needsAi = false;
    }
    const c = (perCode[it.error_code] ??= { wrong: 0, total: 0 });
    c.total++;
    if (!correct) c.wrong++;
    attempts.push({
      user_id: viewer.id, session_id: null, item_kind: "placement", item_id: it.id, grammar_point_id: it.grammar_point_id,
      format: it.format, response: response.slice(0, 500), correct, error_code: it.error_code, duration_ms: 0, local_date: today,
    });
  }
  await db.from("attempts").insert(attempts);

  // Writing sample (optional AI) -------------------------------------------------
  const text = (body.writing ?? "").trim();
  let density: Record<string, number> = {};
  let writingFeedback: unknown = null;
  if (countWords(text) >= 30) {
    try {
      const fb = await callStructured({
        route: "/api/placement",
        userId: viewer.id,
        tier: "grader",
        system: writingGraderSystem({ weakCodes: [], taskPrompt: PLACEMENT_WRITING_PROMPT, targetWords: [], grammarPoint: "any", fullCriteria: false }),
        user: text,
        schema: WritingFeedbackSchema,
        schemaName: "writing_feedback",
        promptVersion: WRITING_GRADER_VERSION,
        maxOutputTokens: 6000,
      });
      const errors = validateErrorOffsets(text, fb.errors as OffsetError[]);
      density = errorDensity(errors, countWords(text));
      writingFeedback = { bands: fb.bands, errors, strengths: fb.strengths };
    } catch (e) {
      if (!(e instanceof AiUnavailableError)) throw e;
    }
  }

  // Weakness model + compressed phase-1 points --------------------------------------
  const weakness = ERROR_CODES.map((code) => ({
    user_id: viewer.id,
    error_code: code,
    score: weaknessFromPlacement(perCode[code]?.wrong ?? 1, perCode[code]?.total ?? 2, density[code] ?? 0),
    samples: perCode[code]?.total ?? 0,
    updated_at: new Date().toISOString(),
  }));
  await admin.from("weakness").upsert(weakness);

  const { data: points } = await db.from("grammar_points").select("id, phase, error_codes");
  const masteredCodes = new Set(ERROR_CODES.filter((c) => perCode[c] && perCode[c].wrong === 0 && (density[c] ?? 0) < 1));
  const compressed = (points ?? [])
    .filter((p) => p.phase === 1 && (p.error_codes as string[]).every((c) => masteredCodes.has(c as (typeof ERROR_CODES)[number])))
    .map((p) => p.id);

  // Vocabulary ----------------------------------------------------------------------
  const vocab = scoreVocabCheck(body.vocab ?? {});

  const { error } = await db.from("placements").upsert({
    user_id: viewer.id,
    grammar_results: { per_code: perCode, compressed_points: compressed },
    vocab_results: { bands: vocab.bands, fake_yes_rate: vocab.fakeYesRate },
    known_lemmas: vocab.knownLemmas,
    writing_sample: text || null,
    writing_feedback: writingFeedback,
    completed_at: new Date().toISOString(),
  });
  if (error) throw new HttpError(500, "Could not save the placement results.");

  return NextResponse.json({
    per_code: perCode,
    compressed_points: compressed.length,
    vocab_bands: vocab.bands,
    writing_graded: Boolean(writingFeedback),
  });
});
