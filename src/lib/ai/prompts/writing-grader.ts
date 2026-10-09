import { z } from "zod";

export const WRITING_GRADER_VERSION = "writing-grader@1";

// Paraphrased from the public IELTS Writing band descriptors (May 2023 update).
export const DESCRIPTOR_EXCERPT = `
GRA band 5: limited, repetitive structures; complex sentences attempted but often faulty; frequent errors may slow the reader.
GRA band 6: a mix of simple and complex forms; complex forms less accurate than simple ones; errors rarely block meaning.
GRA band 7: a variety of complex structures used with some flexibility; error-free sentences are frequent; a few errors persist.
LR band 5: range barely adequate; frequent simplification and repetition; noticeable spelling and word-form errors.
LR band 6: range adequate; meaning clear despite some imprecision; risk-takers use wider vocabulary with more errors; spelling and word-form errors do not impede.
LR band 7: sufficient range for flexibility and precision; some less common items and awareness of collocation.
TR band 6: main parts addressed; position relevant; some ideas need more development.
CC band 6: linkers used with some effect but can be mechanical; reference may be repetitive.
Reward attempts at new vocabulary; penalise only errors that hurt meaning or would clearly be noticed by an examiner.`.trim();

const CODES = ["TNS", "ART", "PLU", "SVA", "VFM", "WFM", "PRP", "PSV", "CLS", "WOR", "CNJ", "BE", "SPL", "COL", "WCH", "OTH"] as const;

const band = z.number(); // range-checked server-side (strict mode keeps schemas simple)

export const WritingFeedbackSchema = z.object({
  bands: z.object({ gra: band, lr: band, tr: band.nullable(), cc: band.nullable() }),
  errors: z.array(
    z.object({
      start: z.number().int(),
      end: z.number().int(),
      original: z.string(),
      correction: z.string(),
      code: z.enum(CODES),
      severity: z.enum(["blocks_meaning", "noticeable", "minor"]),
      explain_en: z.string(),
      explain_vi: z.string(),
    }),
  ),
  focus_codes: z.array(z.enum(CODES)),
  strengths: z.array(z.object({ quote: z.string(), why: z.string() })),
  upgrades: z.array(z.object({ original: z.string(), better: z.string(), note_vi: z.string() })),
  target_check: z.object({
    words_used: z.array(z.string()),
    grammar_used_correctly: z.boolean(),
    comment: z.string(),
  }),
  rewrite_sentence: z.object({ start: z.number().int(), end: z.number().int() }),
  model_version: z.string(),
});
export type WritingFeedback = z.infer<typeof WritingFeedbackSchema>;

export function writingGraderSystem(p: {
  weakCodes: string[];
  taskPrompt: string;
  targetWords: string[];
  grammarPoint: string;
  fullCriteria: boolean;
}) {
  return `You are an experienced IELTS Writing examiner and English teacher for a Vietnamese
learner at about band 5.5. Grade the text against the public IELTS Writing band
descriptors (included below). Be accurate and encouraging, never harsh.
Rules:
- Find every grammar, vocabulary, spelling and punctuation error. Give character
  offsets into the ORIGINAL text (0-based, end exclusive), the minimal correction, and one error code from:
  TNS ART PLU SVA VFM WFM PRP PSV CLS WOR CNJ BE SPL COL(collocation) WCH(word choice) OTH.
- "original" must be copied exactly from the text, character for character.
- Severity: blocks_meaning | noticeable | minor.
- Choose at most 3 focus codes: prefer blocks_meaning, then codes in {${p.weakCodes.join(", ")}}.
- Explanations: English under 25 words; Vietnamese under 35 words, natural Vietnamese.
- Band estimates in 0.5 steps. Do not inflate. A band 6 paragraph can still contain errors.
- ${p.fullCriteria ? "Also estimate Task Response (tr) and Coherence and Cohesion (cc)." : "Set tr and cc to null."}
- Strengths: exactly two, and they must quote his exact words.
- Upgrades: at most 3 vague words or weak collocations, with a better choice inside his own sentence.
- rewrite_sentence: offsets of the full sentence containing the most serious error.
- Model version: rewrite at band 6.5, keep his ideas and structure, same length +-20%.
Descriptors: ${DESCRIPTOR_EXCERPT}
Task: ${p.taskPrompt}  Target words: ${p.targetWords.join(", ")}  Target grammar: ${p.grammarPoint}`;
}
