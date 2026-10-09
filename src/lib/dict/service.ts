import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { AiUnavailableError } from "@/lib/ai/client";
import { aiDictionaryEntry } from "@/lib/ai/services";
import { createAdminClient } from "@/lib/supabase/admin";
import { lemmaCandidates } from "./lemma";

export type DictEntry = {
  id: number | null;
  lemma: string;
  pos: string;
  ipa: string;
  gloss_vi: string[];
  definition_en: string;
  examples: string[];
  collocations: string[];
  word_family: Record<string, string>;
  ai_generated: boolean;
  source?: "db" | "ai" | "freedict";
};

const COLS = "id, lemma, pos, ipa, gloss_vi, definition_en, examples, collocations, word_family, ai_generated, freq_rank";
const VI_CHARS = /[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]/i;

export function looksVietnamese(q: string) {
  return VI_CHARS.test(q);
}

function clean(rows: unknown[] | null): DictEntry[] {
  return ((rows ?? []) as DictEntry[]).map((r) => ({ ...r, examples: (r.examples ?? []) as string[], source: "db" as const }));
}

/** Exact lookup of a word or 2–4 word phrase, mapping inflections to the lemma. */
export async function lookupWord(db: SupabaseClient, q: string): Promise<DictEntry[]> {
  const cands = lemmaCandidates(q);
  if (!cands.length) return [];
  const { data } = await db.from("dictionary_entries").select(COLS).in("lemma", cands).order("freq_rank", { nullsFirst: false }).limit(6);
  const rows = clean(data);
  // Prefer the exact form, then candidates in order.
  return rows.sort((a, b) => cands.indexOf(a.lemma) - cands.indexOf(b.lemma));
}

export async function searchDictionary(db: SupabaseClient, q: string, mode: "auto" | "en" | "vi" = "auto"): Promise<DictEntry[]> {
  const query = q.trim().slice(0, 60);
  if (!query) return [];
  if (mode === "vi" || (mode === "auto" && looksVietnamese(query))) {
    const { data } = await db.rpc("dict_search_vi", { q: query, lim: 12 });
    return clean(data);
  }
  const exact = await lookupWord(db, query);
  const { data } = await db.rpc("dict_prefix", { q: query.toLowerCase(), lim: 12 });
  const seen = new Set(exact.map((e) => e.id));
  const results = [...exact, ...clean(data).filter((e) => !seen.has(e.id))];
  if (results.length === 0 && mode === "auto") {
    // Unaccented Vietnamese ("o nhiem") has no diacritics to detect, so try it as Vietnamese too.
    const { data: vi } = await db.rpc("dict_search_vi", { q: query, lim: 12 });
    return clean(vi);
  }
  return results;
}

/** Missing word: AI fallback (cached into dictionary_entries), then Free Dictionary API, never a hard dependency. */
export async function fallbackEntry(word: string, userId: string | null): Promise<DictEntry | null> {
  const w = word.trim().toLowerCase();
  if (!/^[a-z][a-z' -]{0,40}$/.test(w)) return null;
  try {
    const ai = await aiDictionaryEntry(w, userId);
    if (!ai.is_english_word || !ai.lemma) return null;
    const row = {
      lemma: ai.lemma.toLowerCase(), pos: ai.pos || "", ipa: ai.ipa, gloss_vi: ai.gloss_vi, definition_en: ai.definition_en,
      examples: ai.example ? [ai.example] : [], collocations: ai.collocations, word_family: {}, ai_generated: true, source_list: "ai",
    };
    const { data } = await createAdminClient().from("dictionary_entries").upsert(row, { onConflict: "lemma,pos" }).select(COLS).single();
    return data ? { ...(data as DictEntry), examples: row.examples, source: "ai" } : { id: null, ...row, source: "ai" };
  } catch (e) {
    if (!(e instanceof AiUnavailableError)) console.error("dict fallback", e);
  }
  return freeDictionary(w);
}

async function freeDictionary(word: string): Promise<DictEntry | null> {
  try {
    const res = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`, {
      signal: AbortSignal.timeout(1500),
    });
    if (!res.ok) return null;
    const json = (await res.json()) as {
      word: string;
      phonetic?: string;
      phonetics?: { text?: string }[];
      meanings?: { partOfSpeech: string; definitions: { definition: string; example?: string }[] }[];
    }[];
    const e = json[0];
    const m = e?.meanings?.[0];
    if (!e || !m) return null;
    return {
      id: null, lemma: e.word, pos: m.partOfSpeech, ipa: e.phonetic ?? e.phonetics?.find((p) => p.text)?.text ?? "",
      gloss_vi: [], definition_en: m.definitions[0]?.definition ?? "", examples: m.definitions[0]?.example ? [m.definitions[0].example] : [],
      collocations: [], word_family: {}, ai_generated: false, source: "freedict",
    };
  } catch {
    return null;
  }
}

/**
 * Wiktionary-imported rows often have a Vietnamese gloss but no English definition.
 * Fill the gap once — free Dictionary API first, AI second — and cache it in the table.
 * Never a hard dependency: on any failure the entry is returned unchanged.
 */
export async function enrichEntry(entry: DictEntry, userId: string | null = null): Promise<DictEntry> {
  if (entry.definition_en || !entry.id) return entry;
  let patch: { definition_en: string; examples?: string[]; ipa?: string; collocations?: string[] } | null = null;

  // 1) Free Dictionary API (Wiktionary-based, free) — often slow or down, so short timeout.
  const fd = await freeDictionary(entry.lemma);
  if (fd?.definition_en) {
    patch = {
      definition_en: fd.definition_en.slice(0, 200),
      ...(entry.examples?.length ? {} : { examples: fd.examples }),
      ...(entry.ipa ? {} : { ipa: fd.ipa }),
    };
  } else {
    // 2) AI learner definition (cheap, cached once per word). Keeps the Wiktionary gloss.
    try {
      const ai = await aiDictionaryEntry(entry.lemma, userId);
      if (ai.is_english_word && ai.definition_en) {
        patch = {
          definition_en: ai.definition_en,
          ...(entry.examples?.length ? {} : { examples: ai.example ? [ai.example] : [] }),
          ...(entry.ipa ? {} : { ipa: ai.ipa }),
          ...(entry.collocations?.length ? {} : { collocations: ai.collocations.slice(0, 3) }),
        };
      }
    } catch (e) {
      if (!(e instanceof AiUnavailableError)) console.error("dict enrich", e);
    }
  }
  if (!patch) return entry;
  await createAdminClient().from("dictionary_entries").update(patch).eq("id", entry.id);
  return { ...entry, ...patch };
}
