import { z } from "zod";

export const CONTENT_GENERATOR_VERSION = "content-generator@1";

const FORMATS = ["mcq", "typed_gap", "spot_error", "correct_error", "transform", "combine", "word_form", "translate", "word_order"] as const;
const QTYPES = ["tfng", "mcq", "completion", "headings", "summary"] as const;

export const DayContentSchema = z.object({
  passage: z.object({ title: z.string(), body: z.string(), target_words_used: z.array(z.string()) }),
  questions: z.array(
    z.object({
      type: z.enum(QTYPES),
      prompt: z.string(),
      options: z.array(z.string()).nullable(),
      answer: z.string(),
      evidence_quote: z.string(),
      paraphrase_pairs: z.array(z.array(z.string())),
      explain_en: z.string(),
      explain_vi: z.string(),
    }),
  ),
  grammar_items: z.array(
    z.object({
      format: z.enum(FORMATS),
      prompt: z.string(),
      options: z.array(z.string()).nullable(),
      answers: z.array(z.string()),
      error_code: z.string(),
      difficulty: z.number().int(),
      explain_en: z.string(),
      explain_vi: z.string(),
      trap_note_vi: z.string(),
    }),
  ),
  writing_task: z.object({
    type: z.enum(["opinion", "chart", "paraphrase", "problem_solution", "adv_disadv", "essay"]),
    prompt: z.string(),
    chart_data: z
      .object({ title: z.string(), unit: z.string(), points: z.array(z.object({ label: z.string(), value: z.number() })) })
      .nullable(),
  }),
});
export type DayContent = z.infer<typeof DayContentSchema>;

export const CONTENT_GENERATOR_SYSTEM = `You create one day of IELTS-style practice for a Vietnamese learner at band 5–5.5.
Passage: 150–250 words, 2–3 paragraphs separated by a blank line, neutral academic register like a short IELTS
Academic extract. Use at least 4 of the target words and at least one example of the grammar point. Use mainly
words from the allowed vocabulary. No real named people, brands or recent news events.
Questions: exactly 4. Usually 2 TRUE/FALSE/NOT GIVEN (answer is exactly "TRUE", "FALSE" or "NOT GIVEN"), 1 multiple
choice (4 options, answer is the exact option text), 1 sentence completion (answer: NO MORE THAN TWO WORDS copied
from the passage). evidence_quote must be copied exactly from the passage (for NOT GIVEN: the closest related
sentence). paraphrase_pairs: [question phrase, passage phrase] pairs. Explanations: English under 40 words, Vietnamese natural.
Grammar items: 6 items on the grammar point, mixed formats, each tagged with one error code from
TNS ART PLU SVA VFM WFM PRP PSV CLS WOR CNJ BE. Use "___" for gaps. spot_error: the answer is the 0-based index of the
wrong word when the prompt is split on spaces. word_order: options are the shuffled tiles, answers the correct sentence(s).
Explanations under 40 words; trap_note_vi: one Vietnamese sentence on why Vietnamese speakers make this error.
Writing task: follow the requested type; for "chart" include 3–5 data points.`;
