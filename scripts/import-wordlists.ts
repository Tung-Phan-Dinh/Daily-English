// Imports NGSL 1.2 and NAWL 1.2 (CC BY-SA 4.0) from the CSV files published at
// newgeneralservicelist.com. Row order = frequency rank; the first column is the lemma.
//   node --env-file=.env.local scripts/import-wordlists.ts --ngsl data/NGSL_1.2.csv --nawl data/NAWL_1.2.csv
// NAWL words that already have a dictionary entry (with a Vietnamese gloss) also become
// shared vocab items (source_list = "nawl"), so sessions can teach them after the topic sets.
import { readFileSync } from "node:fs";
import { admin, chunk, must } from "./_shared.ts";

const db = admin();
const arg = (name: string) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? process.argv[i + 1] : undefined;
};

function readList(path: string): string[] {
  const rows = readFileSync(path, "utf8").split(/\r?\n/).map((l) => l.split(",")[0]?.replace(/^"|"$/g, "").trim().toLowerCase());
  return rows.filter((w, i) => w && /^[a-z][a-z' -]*$/.test(w) && !(i === 0 && /lemma|word|headword/.test(w)));
}

for (const list of ["ngsl", "nawl"] as const) {
  const path = arg(list);
  if (!path) continue;
  const words = [...new Set(readList(path))];
  const rows = words.map((lemma, i) => ({ lemma, list, rank: i + 1 }));
  for (const c of chunk(rows, 500)) must(await db.from("word_lists").upsert(c, { onConflict: "lemma,list" }), "word_lists");
  console.log(`${list}: ${rows.length} words`);

  if (list === "nawl") {
    let added = 0;
    for (const c of chunk(words, 200)) {
      const entries = must(
        await db.from("dictionary_entries").select("id, lemma, pos, ipa, gloss_vi, definition_en, examples, collocations, word_family").in("lemma", c),
        "dictionary read",
      );
      const items = entries
        .filter((e) => e.gloss_vi?.length && e.definition_en)
        .map((e) => ({
          entry_id: e.id, lemma: e.lemma, pos: e.pos, ipa: e.ipa, definition_en: e.definition_en, gloss_vi: e.gloss_vi.join(", "),
          word_family: e.word_family, collocations: e.collocations, examples: (e.examples as string[]).slice(0, 2),
          source_list: "nawl", frequency_rank: 10_000 + words.indexOf(e.lemma), status: "approved",
        }));
      const seen = new Set<string>();
      const unique = items.filter((i) => !seen.has(i.lemma) && seen.add(i.lemma));
      if (unique.length) {
        const { error } = await db.from("vocab_items").insert(unique);
        if (!error) added += unique.length;
      }
    }
    console.log(`nawl: ${added} shared vocab items created from dictionary entries`);
  }
}
