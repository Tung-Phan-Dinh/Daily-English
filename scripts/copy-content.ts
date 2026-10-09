// Copies AI-generated shared content from one Supabase project to another
// (e.g. local → production) so it doesn't have to be generated (and paid for) twice.
//   node scripts/copy-content.ts --from .env.local --to .env.production.local
// Copies: shared topic vocab items and AI/topic dictionary entries. Topics are matched by
// slug, so run `scripts/seed-content.ts` against the target first. Re-running is safe
// (rows are upserted by id / (lemma, pos)); review statuses are copied as they are.
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { chunk } from "./_shared.ts";

function envFile(path: string) {
  const out: Record<string, string> = {};
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m) out[m[1]] = m[2].trim();
  }
  return out;
}
function client(path: string) {
  const e = envFile(path);
  if (!e.NEXT_PUBLIC_SUPABASE_URL || !e.SUPABASE_SERVICE_ROLE_KEY) throw new Error(`${path}: needs NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY`);
  return { db: createClient(e.NEXT_PUBLIC_SUPABASE_URL, e.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } }), url: e.NEXT_PUBLIC_SUPABASE_URL };
}
const arg = (n: string) => {
  const i = process.argv.indexOf(`--${n}`);
  return i > -1 ? process.argv[i + 1] : undefined;
};

const from = client(arg("from") ?? ".env.local");
const to = client(arg("to") ?? ".env.production.local");
if (from.url === to.url) throw new Error("--from and --to point at the same project.");
console.log(`Copying ${from.url} → ${to.url}`);

// Topic ids differ between projects: map by slug.
const [{ data: srcTopics }, { data: dstTopics }] = await Promise.all([
  from.db.from("topics").select("id, slug"),
  to.db.from("topics").select("id, slug"),
]);
if (!dstTopics?.length) throw new Error("Target has no topics — run scripts/seed-content.ts against it first.");
const topicMap = new Map((srcTopics ?? []).map((t) => [t.id, dstTopics.find((d) => d.slug === t.slug)?.id ?? null]));

// Dictionary entries created by the topic generator or the AI fallback.
const { data: dict, error: dErr } = await from.db
  .from("dictionary_entries")
  .select("lemma, pos, ipa, gloss_vi, definition_en, examples, collocations, word_family, freq_rank, source_list, ai_generated")
  .or("ai_generated.eq.true,source_list.eq.topic")
  .limit(20000);
if (dErr) throw dErr;
for (const c of chunk(dict ?? [], 500)) {
  const { error } = await to.db.from("dictionary_entries").upsert(c, { onConflict: "lemma,pos", ignoreDuplicates: true });
  if (error) throw error;
}
console.log(`dictionary entries: ${dict?.length ?? 0} copied (existing rows left untouched)`);

// Shared vocab items that aren't part of the repo seed (seed rows are re-created by seed-content).
const { data: vocab, error: vErr } = await from.db
  .from("vocab_items")
  .select("id, lemma, pos, ipa, definition_en, gloss_vi, word_family, collocations, examples, register, common_mistake_vi, topic_id, source_list, frequency_rank, status, created_at")
  .is("owner_id", null)
  .neq("status", "retired")
  .limit(20000);
if (vErr) throw vErr;
const { data: dstExisting } = await to.db.from("vocab_items").select("lemma, topic_id").is("owner_id", null).limit(20000);
const taken = new Set((dstExisting ?? []).map((v) => `${v.lemma.toLowerCase()}|${v.topic_id ?? 0}`));
const rows = (vocab ?? [])
  .map((v) => ({ ...v, topic_id: v.topic_id ? topicMap.get(v.topic_id) ?? null : null, entry_id: null }))
  .filter((v) => !taken.has(`${v.lemma.toLowerCase()}|${v.topic_id ?? 0}`));
for (const c of chunk(rows, 500)) {
  const { error } = await to.db.from("vocab_items").upsert(c, { onConflict: "id", ignoreDuplicates: true });
  if (error) throw error;
}
const byStatus = rows.reduce<Record<string, number>>((m, r) => ((m[r.status] = (m[r.status] ?? 0) + 1), m), {});
console.log(`vocab items: ${rows.length} copied ${JSON.stringify(byStatus)}; ${(vocab?.length ?? 0) - rows.length} already present`);
