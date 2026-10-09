// Generates IELTS topic word sets (~60 words/collocations per topic) with the fast model.
// New items are inserted as drafts: they appear in the admin approval queue and go live after 24 h.
//   node --env-file=.env.local scripts/generate-topic-vocab.ts [--topic environment] [--count 60] [--approve]
// Cost: roughly US$0.02–0.05 per topic on the low-cost tier.
import { z } from "zod";
import { admin, must } from "./_shared.ts";
import { structured } from "./_ai.ts";

const db = admin();
const arg = (n: string) => {
  const i = process.argv.indexOf(`--${n}`);
  return i > -1 ? process.argv[i + 1] : undefined;
};
const COUNT = Number(arg("count") ?? 60);
const APPROVE = process.argv.includes("--approve");

const Entry = z.object({
  lemma: z.string(), pos: z.string(), ipa: z.string(), definition_en: z.string(), gloss_vi: z.string(),
  word_family: z.object({ noun: z.string().nullable(), verb: z.string().nullable(), adj: z.string().nullable(), adv: z.string().nullable() }),
  collocations: z.array(z.string()), examples: z.array(z.string()),
  register: z.enum(["formal", "neutral", "informal"]), common_mistake_vi: z.string().nullable(),
});
const Schema = z.object({ items: z.array(Entry) });

const SYSTEM = `You build an IELTS vocabulary set for a Vietnamese learner (band 5–5.5, aiming for 6.5).
Return useful words and short collocations for the topic, ordered from most to least useful for IELTS Writing Task 2.
Avoid very basic words (A1–A2) and avoid rare or proprietary-list-specific items. For each: lemma, part of speech,
British IPA, a learner-friendly English definition under 15 words, a short natural Vietnamese gloss, word family
(null where none), 2–3 common collocations, exactly 2 example sentences (the second on the IELTS topic), register,
and an optional one-sentence Vietnamese note on a common mistake (null if none).`;

const topics = must(await db.from("topics").select("id, slug, name_en").order("week_order"), "topics");
const target = arg("topic") ? topics.filter((t) => t.slug === arg("topic")) : topics;

const PER_CALL = 20; // keeps each reply well under the output-token limit
const failed: string[] = [];

for (const t of target) {
  try {
    const existing = must(await db.from("vocab_items").select("lemma").eq("topic_id", t.id).is("owner_id", null), "existing");
    const have = new Set(existing.map((e) => e.lemma.toLowerCase()));
    let added = 0;
    while (have.size < COUNT) {
      const need = Math.min(PER_CALL, COUNT - have.size);
      const out = await structured({
        system: SYSTEM,
        user: JSON.stringify({ topic: t.name_en, how_many: need + 2, already_have: [...have] }),
        schema: Schema,
        name: "topic_vocab",
        route: "script/generate-topic-vocab",
        maxTokens: 12000,
      });
      const fresh = out.items
        .filter((i) => i.lemma && i.definition_en && i.gloss_vi && !have.has(i.lemma.toLowerCase()))
        .slice(0, need);
      if (!fresh.length) break; // the model has run out of new ideas for this topic
      const rows = fresh.map((i, k) => ({
        lemma: i.lemma, pos: i.pos, ipa: i.ipa, definition_en: i.definition_en, gloss_vi: i.gloss_vi,
        word_family: Object.fromEntries(Object.entries(i.word_family).filter(([, v]) => v)),
        collocations: i.collocations.slice(0, 5), examples: i.examples.slice(0, 2), register: i.register,
        common_mistake_vi: i.common_mistake_vi, topic_id: t.id, source_list: "topic", frequency_rank: have.size + k + 1,
        status: APPROVE ? "approved" : "draft",
      }));
      must(await db.from("vocab_items").insert(rows).select("id"), "insert vocab");
      // Make every new word look-up-able in the dictionary too.
      await db.from("dictionary_entries").upsert(
        fresh.map((i) => ({
          lemma: i.lemma.toLowerCase(), pos: i.pos, ipa: i.ipa, gloss_vi: i.gloss_vi.split(/,\s*/), definition_en: i.definition_en,
          examples: i.examples.slice(0, 2), collocations: i.collocations.slice(0, 3), word_family: {}, ai_generated: true, source_list: "topic",
        })),
        { onConflict: "lemma,pos", ignoreDuplicates: true },
      );
      fresh.forEach((i) => have.add(i.lemma.toLowerCase()));
      added += rows.length;
    }
    console.log(added ? `${t.slug}: +${added} (${APPROVE ? "approved" : "drafts — review in Admin"})` : `${t.slug}: already has ${have.size}`);
  } catch (e) {
    failed.push(t.slug);
    console.error(`${t.slug}: FAILED — ${(e as Error).message}`);
  }
}

if (failed.length) {
  console.error(`\n${failed.length} topic(s) failed: ${failed.join(", ")}. Re-run the same command to retry; finished topics are skipped.`);
  process.exitCode = 1;
}
