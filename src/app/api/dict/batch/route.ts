import { NextResponse } from "next/server";
import { apiViewer, handle } from "@/lib/auth";
import { lemmaCandidates } from "@/lib/dict/lemma";
import { createClient } from "@/lib/supabase/server";

// Prefetch for passages and items: maps each word to its entry (no AI, no logging).
export const GET = handle(async (req: Request) => {
  await apiViewer();
  const words = [...new Set((new URL(req.url).searchParams.get("w") ?? "").split(",").map((w) => w.trim().toLowerCase()).filter(Boolean))].slice(0, 300);
  if (!words.length) return NextResponse.json({ entries: {} });
  const candMap = new Map(words.map((w) => [w, lemmaCandidates(w)]));
  const all = [...new Set([...candMap.values()].flat())];
  const db = await createClient();
  const { data } = await db
    .from("dictionary_entries")
    .select("id, lemma, pos, ipa, gloss_vi, definition_en, examples, collocations, word_family, ai_generated")
    .in("lemma", all);
  const byLemma = new Map<string, unknown>();
  for (const r of data ?? []) if (!byLemma.has(r.lemma)) byLemma.set(r.lemma, r);
  const entries: Record<string, unknown> = {};
  for (const [w, cands] of candMap) {
    const hit = cands.map((c) => byLemma.get(c)).find(Boolean);
    if (hit) entries[w] = hit;
  }
  return NextResponse.json({ entries }, { headers: { "Cache-Control": "private, max-age=3600" } });
});
