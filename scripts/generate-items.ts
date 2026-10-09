// Fills each grammar point's item bank toward a target (default 20; the spec's long-term target is 60).
// Each generated item is checked by a second, blind model pass; disagreements are dropped.
// Survivors are inserted as drafts for the admin's 10% spot-check (they go live after 24 h).
//   node --env-file=.env.local scripts/generate-items.ts [--target 20] [--point articles]
import { z } from "zod";
import { admin, must } from "./_shared.ts";
import { structured } from "./_ai.ts";

const db = admin();
const arg = (n: string) => {
  const i = process.argv.indexOf(`--${n}`);
  return i > -1 ? process.argv[i + 1] : undefined;
};
const TARGET = Number(arg("target") ?? 20);
const FORMATS = ["mcq", "typed_gap", "spot_error", "correct_error", "transform", "combine", "word_form", "translate", "word_order"] as const;

const Item = z.object({
  format: z.enum(FORMATS), prompt: z.string(), options: z.array(z.string()).nullable(), answers: z.array(z.string()),
  error_code: z.string(), difficulty: z.number().int(), explain_en: z.string(), explain_vi: z.string(), trap_note_vi: z.string(),
  keyword: z.string().nullable(), hint: z.string().nullable(),
});
const Batch = z.object({ items: z.array(Item) });
const Blind = z.object({ answer: z.string() });

const SYSTEM = `Write grammar exercises for a Vietnamese learner at IELTS band 5–5.5 on ONE grammar point.
Mix formats (at least four different ones), from recognition to production. Use "___" for gaps. Tag each item with one
error code from the point's list. Rules per format: mcq → 3–4 options and answers = [exact correct option];
spot_error → answers = [0-based index of the wrong word when the prompt is split on single spaces];
word_order → options = shuffled tiles, answers = correct sentence(s); transform → keyword in CAPITALS and the
instruction "→ Use KEYWORD:"; word_form → prompt starts with the base word in brackets, e.g. "(ECONOMY)".
Give every acceptable answer you can think of for open formats. Explanations: English under 40 words, natural Vietnamese;
trap_note_vi: one Vietnamese sentence on why Vietnamese speakers make this mistake. Topics: IELTS themes, no real people.`;

const norm = (s: string) => s.toLowerCase().replace(/[’']/g, "'").replace(/[.!?]+$/, "").replace(/\s+/g, " ").trim();

const points = must(await db.from("grammar_points").select("id, slug, title, rule_en, error_codes").order("sort"), "points");
const failed: string[] = [];
for (const p of arg("point") ? points.filter((x) => x.slug === arg("point")) : points) {
  try {
    const existing = must(await db.from("grammar_items").select("prompt").eq("grammar_point_id", p.id).is("owner_id", null).neq("status", "retired"), "existing");
    const need = TARGET - existing.length;
    if (need <= 0) {
      console.log(`${p.slug}: ${existing.length} items, ok`);
      continue;
    }
    const out = await structured({
      system: SYSTEM,
      user: JSON.stringify({ grammar_point: p.title, rule: p.rule_en, error_codes: p.error_codes, how_many: need + 4, avoid_prompts: existing.map((e) => e.prompt) }),
      schema: Batch,
      name: "grammar_items",
      route: "script/generate-items",
    });

    const kept = [];
    for (const it of out.items) {
      if (!it.prompt || !it.answers.length || !p.error_codes.includes(it.error_code)) continue;
      if (it.format === "mcq" && !(it.options ?? []).includes(it.answers[0])) continue;
      if (it.format === "spot_error" && !/^\d+$/.test(it.answers[0])) continue;
      // Blind validation: a second pass answers without seeing the key; recognition items must agree exactly.
      if (["mcq", "spot_error", "typed_gap", "word_form"].includes(it.format)) {
        const blind = await structured({
          system: "Answer this English grammar exercise. Return only the answer (for spot-the-error: the 0-based index of the wrong word when the sentence is split on spaces).",
          user: JSON.stringify({ format: it.format, prompt: it.prompt, options: it.options }),
          schema: Blind,
          name: "blind_answer",
          route: "script/generate-items",
          maxTokens: 2000,
        });
        if (!it.answers.some((a) => norm(a) === norm(blind.answer))) continue;
      }
      kept.push({
        grammar_point_id: p.id, error_code: it.error_code, format: it.format, difficulty: Math.min(3, Math.max(1, it.difficulty)),
        prompt: it.prompt, options: it.options, answers: it.answers,
        meta: { ...(it.keyword ? { keyword: it.keyword } : {}), ...(it.hint ? { hint: it.hint } : {}) },
        explanation_en: it.explain_en, explanation_vi: it.explain_vi, trap_note_vi: it.trap_note_vi,
        source: "generated", status: "draft",
      });
      if (kept.length >= need) break;
    }
    if (kept.length) must(await db.from("grammar_items").insert(kept).select("id"), "insert items");
    console.log(`${p.slug}: +${kept.length} drafts (${out.items.length - kept.length} dropped by validation)`);
  } catch (e) {
    failed.push(p.slug);
    console.error(`${p.slug}: FAILED — ${(e as Error).message}`);
  }
}

if (failed.length) {
  console.error(`\n${failed.length} point(s) failed: ${failed.join(", ")}. Re-run to retry; full points are skipped.`);
  process.exitCode = 1;
}
