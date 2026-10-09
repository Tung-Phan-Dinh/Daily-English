// Answer normalisation for typed answers. Ignores capitalisation, spacing,
// curly quotes and final punctuation, and treats contractions as equal to
// their full forms ("doesn't" = "does not").

const CONTRACTIONS: [RegExp, string][] = [
  [/\bcan't\b/g, "cannot"],
  [/\bcan not\b/g, "cannot"],
  [/\bwon't\b/g, "will not"],
  [/\bshan't\b/g, "shall not"],
  [/\b(\w+)n't\b/g, "$1 not"],
  [/\b(i|you|we|they)'re\b/g, "$1 are"],
  [/\bi'm\b/g, "i am"],
  [/\b(i|you|we|they|could|should|would|might|must)'ve\b/g, "$1 have"],
  [/\b(i|you|he|she|it|we|they|there|that)'ll\b/g, "$1 will"],
  [/\b(he|she|it|that|there|what|who)'s (been|got)\b/g, "$1 has $2"],
];

export function normalizeAnswer(raw: string): string {
  let s = (raw ?? "")
    .normalize("NFC")
    .toLowerCase()
    .replace(/[‘’ʼ`´]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/\s+/g, " ")
    .trim();
  s = s.replace(/^["'(\[]+|["')\]]+$/g, "");
  s = s.replace(/[.!?;:,\s]+$/g, "");
  for (const [re, rep] of CONTRACTIONS) s = s.replace(re, rep);
  s = s.replace(/\s*,\s*/g, ", ").replace(/\s+/g, " ").trim();
  return s;
}

export function matchesAny(response: string, answers: readonly string[]): boolean {
  const r = normalizeAnswer(response);
  if (!r) return false;
  return answers.some((a) => normalizeAnswer(a) === r);
}

/** Order-insensitive token comparison used for word-order tiles. */
export function tilesToSentence(tiles: string[]): string {
  return tiles.join(" ").replace(/\s+([,.!?;:])/g, "$1");
}

/** Count words the way the editor and the server both do. */
export function countWords(text: string): number {
  const m = (text ?? "").trim().match(/[A-Za-zÀ-ỹ0-9]+(?:['’-][A-Za-zÀ-ỹ0-9]+)*/g);
  return m ? m.length : 0;
}

/** Exact-match check for sentence completion ("NO MORE THAN TWO WORDS"). */
export function withinWordLimit(response: string, limit: number): boolean {
  return countWords(response) <= limit;
}
