// Exact checks for grammar items. Open-answer formats that miss the stored
// answer list fall through to the AI checker (server only).

import { AI_CHECKED_FORMATS } from "@/lib/curriculum";
import { matchesAny, normalizeAnswer } from "@/lib/normalize";

export type GrammarItem = {
  id: string;
  grammar_point_id: number | null;
  error_code: string;
  format: string;
  difficulty: number;
  prompt: string;
  options: string[] | null;
  answers: string[];
  meta: Record<string, unknown>;
  explanation_en: string;
  explanation_vi: string;
  trap_note_vi: string;
  source?: string;
};

const gapNorm = (s: string) => normalizeAnswer(s.replace(/[/,]/g, " ").replace(/[—–]/g, "-"));

export function checkGrammarExact(item: GrammarItem, response: string): { correct: boolean; needsAi: boolean } {
  const r = (response ?? "").trim();
  if (!r) return { correct: false, needsAi: false };
  switch (item.format) {
    case "mcq":
      return { correct: item.answers.includes(r), needsAi: false };
    case "spot_error":
      return { correct: item.answers.includes(r), needsAi: false };
    case "typed_gap":
    case "word_form": {
      const ok = item.answers.some((a) => gapNorm(a) === gapNorm(r));
      return { correct: ok, needsAi: false };
    }
    case "word_order":
      return { correct: matchesAny(r, item.answers), needsAi: false };
    default: {
      if (matchesAny(r, item.answers)) return { correct: true, needsAi: false };
      return { correct: false, needsAi: AI_CHECKED_FORMATS.has(item.format) };
    }
  }
}

/** The answer to show after a wrong attempt. */
export function displayAnswer(item: GrammarItem): string {
  if (item.format === "spot_error") {
    const idx = Number(item.answers[0]);
    const word = item.prompt.split(" ")[idx] ?? "";
    const corr = item.meta?.correction ? ` → ${item.meta.correction}` : "";
    return `“${word}” is wrong${corr}`;
  }
  return item.answers[0] ?? "";
}

export function publicGrammarItem(item: GrammarItem) {
  return {
    id: item.id,
    format: item.format,
    error_code: item.error_code,
    difficulty: item.difficulty,
    prompt: item.prompt,
    options: item.options,
    tokens: item.format === "spot_error" ? item.prompt.split(" ") : undefined,
    meta: {
      hint: item.meta?.hint ?? null,
      keyword: item.meta?.keyword ?? null,
      instruction: item.meta?.instruction ?? null,
    },
    grammar_point_id: item.grammar_point_id,
  };
}

export function instructionFor(item: GrammarItem): string {
  const base: Record<string, string> = {
    mcq: "Choose the correct option.",
    typed_gap: "Type the missing word(s).",
    spot_error: "Tap the wrong word.",
    correct_error: "Rewrite the sentence correctly.",
    transform: `Rewrite the sentence using the key word${item.meta?.keyword ? ` ${item.meta.keyword}` : ""}.`,
    combine: `Join the sentences${item.meta?.instruction ? ` (${item.meta.instruction})` : ""}.`,
    word_form: "Write the correct form of the word in capitals.",
    translate: "Translate into natural English.",
    word_order: "Put the words in order.",
    upgrade: "Replace the vague word with a more precise one.",
  };
  return base[item.format] ?? "Answer the question.";
}
