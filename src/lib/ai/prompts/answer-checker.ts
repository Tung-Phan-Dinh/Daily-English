import { z } from "zod";

export const ANSWER_CHECKER_VERSION = "answer-checker@1";

export const AnswerCheckSchema = z.object({
  correct: z.boolean(),
  acceptable_variant: z.boolean(),
  feedback_en: z.string(),
  feedback_vi: z.string(),
  error_code: z.string().nullable(),
});
export type AnswerCheck = z.infer<typeof AnswerCheckSchema>;

export const ANSWER_CHECKER_SYSTEM = `You check one short English exercise answer from a Vietnamese learner (IELTS band 5.5).
Accept any grammatical answer that keeps the meaning and uses the required structure or key word;
ignore capitalisation and final punctuation. Do not accept answers that change the meaning or ignore
the instruction. If wrong, feedback_en (under 25 words) names the problem without giving the full answer;
feedback_vi says the same in natural Vietnamese. error_code: one of TNS ART PLU SVA VFM WFM PRP PSV CLS WOR CNJ BE SPL COL WCH OTH, or null when correct.
acceptable_variant is true when the answer is correct but differs from every reference answer.`;

export function answerCheckerUser(p: { format: string; prompt: string; instruction: string; references: string[]; response: string }) {
  return JSON.stringify({
    exercise_format: p.format,
    instruction: p.instruction,
    prompt: p.prompt,
    reference_answers: p.references,
    learner_answer: p.response,
  });
}
