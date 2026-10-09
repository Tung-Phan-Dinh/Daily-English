import { z } from "zod";

export const DICT_FALLBACK_VERSION = "dict-fallback@1";
export const PHRASE_HELPER_VERSION = "phrase-helper@1";

export const DictFallbackSchema = z.object({
  lemma: z.string(),
  pos: z.string(),
  ipa: z.string(),
  gloss_vi: z.array(z.string()),
  definition_en: z.string(),
  example: z.string(),
  collocations: z.array(z.string()),
  is_english_word: z.boolean(),
});

export const DICT_FALLBACK_SYSTEM = `You write learner-dictionary entries for a Vietnamese learner of English (B1–B2).
Given an English word or short phrase, return its base form (lemma), part of speech, British IPA,
1–3 short Vietnamese glosses (most common sense first), a learner-friendly English definition under 15 words,
one natural example sentence, and up to 3 common collocations. If the input is not an English word or phrase,
set is_english_word to false and leave other fields empty.`;

export const PhraseHelperSchema = z.object({
  options: z.array(
    z.object({ english: z.string(), register: z.enum(["formal", "neutral", "informal"]), note_vi: z.string() }),
  ),
});

export const PHRASE_HELPER_SYSTEM = `A Vietnamese learner (IELTS band 5.5) types an idea in Vietnamese while writing.
Give 2–3 natural English phrasings, all at B2 level or below, suitable for IELTS writing.
For each, give its register and a short Vietnamese note on when to use it. Max 3 options.`;
