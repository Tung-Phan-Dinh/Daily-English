import "server-only";
// wink-lemmatizer has no types; it exposes noun/verb/adjective lemmatisers.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const lemmatize = require("wink-lemmatizer") as { noun(w: string): string; verb(w: string): string; adjective(w: string): string };

/** Candidate lemmas for a word: itself, then noun/verb/adjective base forms ("increased" → "increase"). */
export function lemmaCandidates(raw: string): string[] {
  const w = raw.toLowerCase().trim().replace(/[’]/g, "'").replace(/^[^a-z]+|[^a-z]+$/g, "");
  if (!w) return [];
  if (w.includes(" ")) {
    // Phrases ("gave up"): lemmatise the first word as a verb.
    const [head, ...rest] = w.split(/\s+/);
    return [...new Set([w, [lemmatize.verb(head), ...rest].join(" ")])];
  }
  return [...new Set([w, lemmatize.verb(w), lemmatize.noun(w), lemmatize.adjective(w)])].filter(Boolean);
}
