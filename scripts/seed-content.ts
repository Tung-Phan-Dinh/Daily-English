// Seeds topics, grammar points + items, week-1 vocab/reading/writing and the
// starter dictionary. Idempotent: safe to re-run after editing /content.
//   node --env-file=.env.local scripts/seed-content.ts
import { TOPICS } from "../content/topics.ts";
import { GRAMMAR_POINTS } from "../content/grammar-points.ts";
import { ITEMS_A } from "../content/grammar-items-a.ts";
import { ITEMS_B } from "../content/grammar-items-b.ts";
import { VOCAB_EDUCATION } from "../content/vocab-education.ts";
import { WEEK1_PASSAGES, WEEK1_WRITING } from "../content/week1.ts";
import { DICTIONARY_SEED } from "../content/dictionary-seed.ts";
import { quoteToOffsets } from "../src/lib/offsets.ts";
import { admin, chunk, must, stableId } from "./_shared.ts";

const db = admin();
const strip = (s: string) => s.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, "").toLowerCase();

async function main() {
  // Topics ------------------------------------------------------------------
  must(await db.from("topics").upsert(TOPICS, { onConflict: "slug" }), "topics");
  const topics = must(await db.from("topics").select("id, slug"), "topics read");
  const topicId = (slug: string) => topics.find((t) => t.slug === slug)!.id;

  // Grammar points ---------------------------------------------------------------
  must(await db.from("grammar_points").upsert(GRAMMAR_POINTS, { onConflict: "slug" }), "grammar_points");
  const points = must(await db.from("grammar_points").select("id, slug"), "points read");
  const pointId = (slug: string) => {
    const p = points.find((x) => x.slug === slug);
    if (!p) throw new Error(`Unknown grammar point ${slug}`);
    return p.id;
  };

  // Grammar items ----------------------------------------------------------------
  const items = [...ITEMS_A, ...ITEMS_B].map((it) => {
    let answers = it.a;
    if (it.f === "spot_error") {
      const wrong = strip(String(it.m?.wrong ?? ""));
      const idx = it.q.split(" ").findIndex((t) => strip(t) === wrong);
      if (idx < 0) throw new Error(`spot_error token "${it.m?.wrong}" not found in: ${it.q}`);
      answers = [String(idx)];
    }
    if ((it.f === "mcq") && !(it.o ?? []).includes(it.a[0])) throw new Error(`mcq answer not in options: ${it.q}`);
    return {
      id: stableId("grammar_item", it.p, it.q),
      grammar_point_id: pointId(it.p),
      error_code: it.c,
      format: it.f,
      difficulty: it.d,
      topic_id: null,
      prompt: it.q,
      options: it.o ?? null,
      answers,
      meta: it.m ?? {},
      explanation_en: it.e,
      explanation_vi: it.v,
      trap_note_vi: it.t ?? "",
      source: "seed",
      status: "approved",
    };
  });
  for (const c of chunk(items, 200)) must(await db.from("grammar_items").upsert(c), "grammar_items");

  // Dictionary -----------------------------------------------------------------------
  const dictRows = DICTIONARY_SEED.trim().split("\n").map((line) => {
    const [lemma, pos, ipa, vi, def, ex] = line.split("|");
    return {
      lemma, pos, ipa, gloss_vi: vi.split(";"), definition_en: def,
      examples: ex ? [ex] : [], collocations: [], word_family: {}, source_list: "seed",
    };
  });
  const vocabDict = VOCAB_EDUCATION.map((v, i) => ({
    lemma: v.lemma, pos: v.pos, ipa: v.ipa, gloss_vi: v.vi.split(/,\s*/), definition_en: v.def,
    examples: v.ex, collocations: v.coll, word_family: v.family, source_list: "topic", freq_rank: 5000 + i,
  }));
  const allDict = [...dictRows, ...vocabDict];
  const seen = new Set<string>();
  const uniqueDict = allDict.filter((r) => {
    const k = `${r.lemma}|${r.pos}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
  for (const c of chunk(uniqueDict, 200)) {
    must(await db.from("dictionary_entries").upsert(c, { onConflict: "lemma,pos" }), "dictionary_entries");
  }
  const entries = must(await db.from("dictionary_entries").select("id, lemma, pos").in("lemma", VOCAB_EDUCATION.map((v) => v.lemma)), "dict read");

  // Vocab (education) -----------------------------------------------------------------
  const edu = topicId("education");
  const vocab = VOCAB_EDUCATION.map((v, i) => ({
    id: stableId("vocab", "education", v.lemma),
    entry_id: entries.find((e) => e.lemma === v.lemma && e.pos === v.pos)?.id ?? null,
    lemma: v.lemma, pos: v.pos, ipa: v.ipa, definition_en: v.def, gloss_vi: v.vi,
    word_family: v.family, collocations: v.coll, examples: v.ex, register: v.reg ?? "neutral",
    common_mistake_vi: v.mistake ?? null, topic_id: edu, source_list: "topic", frequency_rank: i + 1,
    status: "approved",
  }));
  must(await db.from("vocab_items").upsert(vocab), "vocab_items");

  // Reading -------------------------------------------------------------------------
  for (const p of WEEK1_PASSAGES) {
    const passageId = stableId("passage", "education", String(p.day_index));
    must(await db.from("reading_passages").upsert({
      id: passageId, topic_id: edu, day_index: p.day_index, title: p.title, body: p.body,
      target_words: p.target_words, grammar_point_id: pointId(p.grammar_slug), source: "seed", status: "approved",
    }), "reading_passages");
    const qs = p.questions.map((q, i) => {
      const off = quoteToOffsets(p.body, q.evidence_quote);
      if (!off) throw new Error(`Evidence quote not found in "${p.title}": ${q.evidence_quote}`);
      return {
        id: stableId("question", passageId, String(i)), passage_id: passageId, sort: i + 1, type: q.type,
        prompt: q.prompt, options: q.options ?? null, answer: q.answer, accept: q.accept ?? [],
        evidence_start: off.start, evidence_end: off.end, paraphrase_pairs: q.paraphrase_pairs,
        explain_en: q.explain_en, explain_vi: q.explain_vi,
      };
    });
    must(await db.from("reading_questions").upsert(qs), "reading_questions");
  }

  // Writing tasks ---------------------------------------------------------------------
  const tasks = WEEK1_WRITING.map((w) => ({
    id: stableId("writing_task", "education", w.type),
    topic_id: edu, type: w.type, prompt: w.prompt, min_words: w.min_words, max_words: w.max_words,
    target_words: w.target_words, grammar_point_id: pointId(w.grammar_slug), chart_data: w.chart_data ?? null,
    source: "seed", status: "approved",
  }));
  must(await db.from("writing_tasks").upsert(tasks), "writing_tasks");

  console.log(
    `Seeded ${TOPICS.length} topics, ${GRAMMAR_POINTS.length} grammar points, ${items.length} items, ` +
      `${uniqueDict.length} dictionary entries, ${vocab.length} vocab items, ${WEEK1_PASSAGES.length} passages, ${tasks.length} writing tasks.`,
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
