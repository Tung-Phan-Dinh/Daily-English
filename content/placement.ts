// Day-0 placement material.

/** Yes/no vocabulary check: 60 real words in six frequency bands + 12 pseudo-words. */
export const VOCAB_CHECK_BANDS: { band: string; list: "ngsl" | "nawl"; words: string[] }[] = [
  { band: "NGSL 1–1000", list: "ngsl", words: ["decide", "happen", "likely", "region", "increase", "prepare", "raise", "simple", "support", "describe"] },
  { band: "NGSL 1001–2000", list: "ngsl", words: ["aware", "budget", "essential", "emphasis", "generate", "impact", "permit", "remove", "retire", "shelter"] },
  { band: "NGSL 2001–2800", list: "ngsl", words: ["accurate", "anxiety", "consume", "debt", "efficient", "encounter", "fragile", "neglect", "rural", "sufficient"] },
  { band: "NAWL 1–300", list: "nawl", words: ["hypothesis", "empirical", "correlate", "criteria", "framework", "parameter", "cognitive", "discourse", "finite", "implication"] },
  { band: "NAWL 301–650", list: "nawl", words: ["cumulative", "deviation", "simulate", "aggregate", "intrinsic", "notion", "spatial", "synthesis", "explicit", "inherent"] },
  { band: "NAWL 651–960", list: "nawl", words: ["heterogeneous", "paradigm", "salient", "replicate", "discrete", "quantitative", "invoke", "proxy", "robust", "intervene"] },
];

export const PSEUDO_WORDS = [
  "prenticate", "dabbersome", "glomerize", "fendle", "obsquent", "marfle",
  "trubious", "vornish", "skelpation", "quindle", "perdantic", "ostrapulate",
];

export const PLACEMENT_WRITING_PROMPT =
  "Describe your school and say one thing you would like to change about it. Write 80–100 words.";

/**
 * Score: hit rate per band minus the false-alarm rate on pseudo-words.
 * A band is "known" when the adjusted score is at least 0.9.
 */
export function scoreVocabCheck(answers: Record<string, boolean>) {
  const fakeYes = PSEUDO_WORDS.filter((w) => answers[w]).length / PSEUDO_WORDS.length;
  const bands = VOCAB_CHECK_BANDS.map((b) => {
    const hits = b.words.filter((w) => answers[w]).length / b.words.length;
    const adjusted = Math.max(0, hits - fakeYes);
    return { band: b.band, list: b.list, hits, adjusted, known: adjusted >= 0.9 };
  });
  const knownLemmas = VOCAB_CHECK_BANDS.flatMap((b, i) => (bands[i].known ? b.words.filter((w) => answers[w]) : []));
  return { fakeYesRate: fakeYes, bands, knownLemmas };
}
