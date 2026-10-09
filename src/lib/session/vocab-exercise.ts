// Builds the exercise for a vocabulary card from its ladder stage. Pure and
// deterministic (seeded), so the server can rebuild the same exercise when
// checking an answer without ever sending the answer to the browser.

import { findTargetSpan } from "@/lib/inflect";
import { seededRandom, shuffle } from "./plan";
import type { VocabExercise } from "./types";

export type VocabItem = {
  id: string;
  lemma: string;
  pos: string;
  ipa: string;
  definition_en: string;
  gloss_vi: string;
  word_family: Record<string, string>;
  collocations: string[];
  examples: string[];
  register: string;
  common_mistake_vi: string | null;
};

export type BuiltExercise = {
  kind: VocabExercise;
  prompt: string;
  sentence?: string;
  options?: string[];
  answer: string;
  hint?: string;
  production: boolean;
};

function blank(sentence: string, span: { start: number; end: number }) {
  return sentence.slice(0, span.start) + "_____" + sentence.slice(span.end);
}

export function buildVocabExercise(
  kind: VocabExercise,
  item: VocabItem,
  pool: VocabItem[],
  seed: string,
): BuiltExercise {
  const rand = seededRandom(seed);
  const others = shuffle(pool.filter((p) => p.id !== item.id && p.lemma !== item.lemma), rand);

  const typeWord = (): BuiltExercise => ({
    kind: "type_word",
    prompt: item.definition_en,
    hint: item.gloss_vi,
    answer: item.lemma,
    production: true,
  });

  switch (kind) {
    case "meaning_mcq": {
      const distractors = others.slice(0, 3).map((o) => o.definition_en);
      return {
        kind,
        prompt: item.lemma,
        options: shuffle([item.definition_en, ...distractors], rand),
        answer: item.definition_en,
        production: false,
      };
    }
    case "type_word":
      return typeWord();
    case "collocation": {
      for (const c of shuffle(item.collocations, rand)) {
        const span = findTargetSpan(c, item.lemma);
        if (!span || c.trim().length === span.end - span.start) continue;
        const shown = c.slice(span.start, span.end);
        const distractors = others.filter((o) => o.pos === item.pos).slice(0, 3).map((o) => o.lemma);
        const fill = others.filter((o) => !distractors.includes(o.lemma)).map((o) => o.lemma);
        const opts = [...distractors, ...fill].slice(0, 3);
        return {
          kind,
          prompt: "Which word completes the collocation?",
          sentence: blank(c, span),
          options: shuffle([shown, ...opts], rand),
          answer: shown,
          production: false,
        };
      }
      return buildVocabExercise("cloze", item, pool, seed);
    }
    case "word_form": {
      const familyForms = Object.values(item.word_family ?? {}).filter((f) => f && f.toLowerCase() !== item.lemma.toLowerCase());
      for (const ex of item.examples) {
        const span = findTargetSpan(ex, item.lemma);
        if (!span || familyForms.length === 0) continue;
        const base = familyForms[Math.floor(rand() * familyForms.length)];
        return {
          kind,
          prompt: "Write the correct form of the word in capitals.",
          sentence: `(${base.toUpperCase()}) ${blank(ex, span)}`,
          answer: ex.slice(span.start, span.end),
          production: true,
        };
      }
      return buildVocabExercise("cloze", item, pool, seed);
    }
    case "cloze": {
      const ex = item.examples[1] ?? item.examples[0];
      const span = ex ? findTargetSpan(ex, item.lemma) : null;
      if (!ex || !span) return typeWord();
      return {
        kind,
        prompt: "Complete the sentence with the word you learned.",
        sentence: blank(ex, span),
        hint: item.gloss_vi,
        answer: ex.slice(span.start, span.end),
        production: true,
      };
    }
    case "own_sentence":
      return {
        kind,
        prompt: `Write your own sentence using “${item.lemma}”.`,
        hint: item.collocations[0] ? `Try: ${item.collocations[0]}` : undefined,
        answer: "",
        production: true,
      };
  }
}

/** Remove the answer before the exercise goes to the browser. */
export function publicExercise(ex: BuiltExercise) {
  const { answer, ...rest } = ex;
  void answer;
  return { ...rest, firstLetter: ex.kind === "type_word" ? ex.answer.slice(0, 1) : undefined };
}
