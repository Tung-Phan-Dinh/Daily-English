// One-off dictionary build from kaikki.org Wiktextract dumps (CC BY-SA, Wiktionary).
//   node --env-file=.env.local scripts/build-dictionary.ts --vi data/vi-extract.jsonl.gz [--en data/en-extract.jsonl.gz] [--max 40000]
//
//   --vi  Vietnamese Wiktionary extract: English headwords with Vietnamese glosses, POS, IPA
//   --en  English Wiktionary extract (optional, large): English definitions, examples, IPA
// Entries are merged by (lemma, pos) and ranked by NGSL/NAWL frequency (import word lists first).
// Learner-friendly definitions: topic words get them from generate-topic-vocab.ts; any other
// word missing a Vietnamese gloss is filled on demand by the dictionary's AI fallback (cached).
import { createReadStream } from "node:fs";
import { createInterface } from "node:readline";
import { createGunzip } from "node:zlib";
import { admin, chunk } from "./_shared.ts";

const db = admin();
const arg = (n: string) => {
  const i = process.argv.indexOf(`--${n}`);
  return i > -1 ? process.argv[i + 1] : undefined;
};
const MAX = Number(arg("max") ?? 40_000);

type Row = { lemma: string; pos: string; ipa: string; gloss_vi: string[]; definition_en: string; examples: string[] };
type Wikt = {
  word?: string; lang_code?: string; pos?: string;
  sounds?: { ipa?: string }[];
  senses?: { glosses?: string[]; examples?: { text?: string }[]; tags?: string[] }[];
};
const POS: Record<string, string> = { noun: "noun", verb: "verb", adj: "adjective", adv: "adverb", prep: "preposition", conj: "conjunction", pron: "pronoun", phrase: "phrase", intj: "interjection" };

async function* lines(path: string) {
  const input = path.endsWith(".gz") ? createReadStream(path).pipe(createGunzip()) : createReadStream(path);
  for await (const line of createInterface({ input, crlfDelay: Infinity })) if (line) yield line;
}

const clean = (s: string) => s.replace(/\s+/g, " ").replace(/^\(.*?\)\s*/, "").trim();
const merged = new Map<string, Row>();
const key = (lemma: string, pos: string) => `${lemma}|${pos}`;

const { data: listRows } = await db.from("word_lists").select("lemma, list, rank");
const rank = new Map<string, number>();
for (const r of listRows ?? []) rank.set(r.lemma, Math.min(rank.get(r.lemma) ?? 1e9, r.list === "ngsl" ? r.rank : 3000 + r.rank));

const viPath = arg("vi");
if (!viPath) throw new Error("--vi path is required");
let n = 0;
for await (const line of lines(viPath)) {
  const e = JSON.parse(line) as Wikt;
  if (e.lang_code !== "en" || !e.word || !/^[A-Za-z][A-Za-z' -]{0,40}$/.test(e.word)) continue;
  const lemma = e.word.toLowerCase();
  const pos = POS[e.pos ?? ""] ?? e.pos ?? "";
  const glosses = (e.senses ?? []).flatMap((s) => s.glosses ?? []).map(clean).filter((g) => g && g.length < 80);
  if (!glosses.length) continue;
  const k = key(lemma, pos);
  const row = merged.get(k) ?? { lemma, pos, ipa: "", gloss_vi: [], definition_en: "", examples: [] };
  row.gloss_vi = [...new Set([...row.gloss_vi, ...glosses])].slice(0, 4);
  row.ipa ||= e.sounds?.find((s) => s.ipa)?.ipa ?? "";
  merged.set(k, row);
  if (++n % 20000 === 0) console.log(`vi: ${n} English entries`);
}
console.log(`vi: ${merged.size} lemma+pos with Vietnamese glosses`);

const enPath = arg("en");
if (enPath) {
  const wanted = new Set([...merged.values()].map((r) => r.lemma).concat([...rank.keys()]));
  let m = 0;
  for await (const line of lines(enPath)) {
    if (!line.includes('"lang_code": "en"') && !line.includes('"lang_code":"en"')) continue;
    const e = JSON.parse(line) as Wikt;
    const lemma = e.word?.toLowerCase();
    if (!lemma || !wanted.has(lemma)) continue;
    const pos = POS[e.pos ?? ""] ?? e.pos ?? "";
    const sense = (e.senses ?? []).find((s) => s.glosses?.length && !(s.tags ?? []).some((t) => /obsolete|archaic|rare/.test(t)));
    if (!sense) continue;
    const k = key(lemma, pos);
    const row = merged.get(k) ?? { lemma, pos, ipa: "", gloss_vi: [], definition_en: "", examples: [] };
    row.definition_en ||= clean(sense.glosses![0]).slice(0, 200);
    row.examples = row.examples.length ? row.examples : (sense.examples ?? []).map((x) => x.text ?? "").filter((t) => t && t.length < 160).slice(0, 2);
    row.ipa ||= e.sounds?.find((s) => s.ipa)?.ipa ?? "";
    merged.set(k, row);
    if (++m % 20000 === 0) console.log(`en: ${m} matched`);
  }
}

const rows = [...merged.values()]
  .sort((a, b) => (rank.get(a.lemma) ?? 1e9) - (rank.get(b.lemma) ?? 1e9) || a.lemma.length - b.lemma.length)
  .slice(0, MAX)
  .map((r) => ({ ...r, freq_rank: rank.get(r.lemma) ?? null, source_list: "wiktionary", collocations: [], word_family: {} }));

let done = 0;
for (const c of chunk(rows, 500)) {
  // ignoreDuplicates: never overwrite curated seed rows or AI-reviewed entries.
  const { error } = await db.from("dictionary_entries").upsert(c, { onConflict: "lemma,pos", ignoreDuplicates: true });
  if (error) throw new Error(error.message);
  done += c.length;
  if (done % 5000 === 0) console.log(`upserted ${done}/${rows.length}`);
}
console.log(`Dictionary built: ${rows.length} rows. Credit Wiktionary and kaikki.org (see /about).`);
