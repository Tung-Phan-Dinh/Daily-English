// Character-offset validation for AI output. The model's offsets are never
// trusted: every error must satisfy text.slice(start, end) === original.

export type Severity = "blocks_meaning" | "noticeable" | "minor";

export type OffsetError = {
  start: number;
  end: number;
  original: string;
  correction: string;
  code: string;
  severity: Severity;
  explain_en: string;
  explain_vi: string;
};

function allIndexes(hay: string, needle: string): number[] {
  const out: number[] = [];
  if (!needle) return out;
  let i = hay.indexOf(needle);
  while (i !== -1) {
    out.push(i);
    i = hay.indexOf(needle, i + 1);
  }
  return out;
}

const SEVERITY_RANK: Record<Severity, number> = { blocks_meaning: 0, noticeable: 1, minor: 2 };

/**
 * Keep errors whose offsets match the text exactly; otherwise relocate the
 * `original` string (nearest occurrence to the claimed start); otherwise drop.
 * Overlapping spans keep the more severe error.
 */
export function validateErrorOffsets<T extends OffsetError>(text: string, errors: T[]): T[] {
  const fixed: T[] = [];
  for (const e of errors) {
    const original = (e.original ?? "").trim() ? e.original : "";
    if (!original) continue;
    if (Number.isInteger(e.start) && Number.isInteger(e.end) && text.slice(e.start, e.end) === original) {
      fixed.push(e);
      continue;
    }
    let hits = allIndexes(text, original);
    let len = original.length;
    if (hits.length === 0) {
      const lower = text.toLowerCase();
      hits = allIndexes(lower, original.toLowerCase());
      len = original.length;
    }
    if (hits.length === 0) continue;
    const target = Number.isFinite(e.start) ? e.start : 0;
    const best = hits.reduce((a, b) => (Math.abs(b - target) < Math.abs(a - target) ? b : a));
    fixed.push({ ...e, start: best, end: best + len, original: text.slice(best, best + len) });
  }
  fixed.sort((a, b) => a.start - b.start || SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity]);
  const out: T[] = [];
  for (const e of fixed) {
    const prev = out[out.length - 1];
    if (prev && e.start < prev.end) {
      if (SEVERITY_RANK[e.severity] < SEVERITY_RANK[prev.severity]) out[out.length - 1] = e;
      continue;
    }
    out.push(e);
  }
  return out;
}

/** Errors per 100 words, per code. */
export function errorDensity(errors: { code: string }[], wordCount: number): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const e of errors) counts[e.code] = (counts[e.code] ?? 0) + 1;
  const out: Record<string, number> = {};
  if (wordCount <= 0) return out;
  for (const [code, n] of Object.entries(counts)) out[code] = Math.round((n * 10000) / wordCount) / 100;
  return out;
}

/** Locate an evidence quote in a passage → character offsets (whitespace-tolerant). */
export function quoteToOffsets(body: string, quote: string): { start: number; end: number } | null {
  const q = (quote ?? "").trim();
  if (!q) return null;
  const exact = body.indexOf(q);
  if (exact !== -1) return { start: exact, end: exact + q.length };
  // Whitespace- and case-tolerant search via a regex built from the words.
  const words = q.split(/\s+/).map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  const re = new RegExp(words.join("\\s+"), "i");
  const m = re.exec(body);
  if (m) return { start: m.index, end: m.index + m[0].length };
  return null;
}

/** Sentence that contains offset `pos` (for rewrite step and personal drills). */
export function sentenceAround(text: string, start: number, end: number = start): { start: number; end: number } {
  let s = start;
  while (s > 0 && !/[.!?]/.test(text[s - 1])) s--;
  while (s < text.length && /\s/.test(text[s])) s++;
  let e = Math.max(end, start);
  while (e < text.length && !/[.!?]/.test(text[e])) e++;
  if (e < text.length) e++;
  return { start: s, end: e };
}
