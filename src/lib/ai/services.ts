import "server-only";
import { AiUnavailableError, callStructured } from "./client";
import { ANSWER_CHECKER_SYSTEM, ANSWER_CHECKER_VERSION, AnswerCheckSchema, answerCheckerUser, type AnswerCheck } from "./prompts/answer-checker";
import { REWRITE_CHECKER_SYSTEM, REWRITE_CHECKER_VERSION, RewriteCheckSchema } from "./prompts/rewrite-checker";
import { WHY_SYSTEM, WHY_VERSION, WhySchema } from "./prompts/why";
import {
  DICT_FALLBACK_SYSTEM, DICT_FALLBACK_VERSION, DictFallbackSchema,
  PHRASE_HELPER_SYSTEM, PHRASE_HELPER_VERSION, PhraseHelperSchema,
} from "./prompts/dictionary";
import { WEEKLY_SUMMARY_SYSTEM, WEEKLY_SUMMARY_VERSION, WeeklySummarySchema } from "./prompts/weekly-summary";
import type { GrammarItem } from "@/lib/session/check";
import { instructionFor } from "@/lib/session/check";

export { AiUnavailableError };

/** Open-answer check. Returns null when AI is unavailable (caller falls back to the answer list). */
export async function aiCheckAnswer(item: GrammarItem, response: string, userId: string): Promise<AnswerCheck | null> {
  try {
    return await callStructured({
      route: "/api/answer",
      userId,
      tier: "fast",
      system: ANSWER_CHECKER_SYSTEM,
      user: answerCheckerUser({
        format: item.format,
        prompt: item.prompt,
        instruction: instructionFor(item),
        references: item.answers,
        response,
      }),
      schema: AnswerCheckSchema,
      schemaName: "answer_check",
      promptVersion: ANSWER_CHECKER_VERSION,
      maxOutputTokens: 800,
    });
  } catch (e) {
    if (e instanceof AiUnavailableError) return null;
    throw e;
  }
}

export async function aiCheckOwnSentence(lemma: string, definition: string, sentence: string, userId: string) {
  try {
    return await callStructured({
      route: "/api/answer",
      userId,
      tier: "fast",
      system: ANSWER_CHECKER_SYSTEM,
      user: JSON.stringify({
        exercise_format: "own_sentence",
        instruction: `Write an original, grammatical sentence that uses "${lemma}" (meaning: ${definition}) correctly and naturally. Minor errors elsewhere are acceptable if the target word is used correctly.`,
        learner_answer: sentence,
      }),
      schema: AnswerCheckSchema,
      schemaName: "answer_check",
      promptVersion: ANSWER_CHECKER_VERSION,
      maxOutputTokens: 800,
    });
  } catch (e) {
    if (e instanceof AiUnavailableError) return null;
    throw e;
  }
}

export async function aiCheckRewrite(p: { original: string; error: string; rewrite: string; userId: string }) {
  return callStructured({
    route: "/api/writing/rewrite",
    userId: p.userId,
    tier: "grader",
    system: REWRITE_CHECKER_SYSTEM,
    user: JSON.stringify({ original_sentence: p.original, flagged_error: p.error, learner_rewrite: p.rewrite }),
    schema: RewriteCheckSchema,
    schemaName: "rewrite_check",
    promptVersion: REWRITE_CHECKER_VERSION,
    maxOutputTokens: 1000,
  });
}

export async function aiWhy(item: GrammarItem, userId: string) {
  return callStructured({
    route: "/api/grammar/why",
    userId,
    tier: "fast",
    system: WHY_SYSTEM,
    user: JSON.stringify({
      instruction: instructionFor(item),
      prompt: item.prompt,
      correct_answer: item.answers[0],
      short_rule: item.explanation_en,
      error_type: item.error_code,
    }),
    schema: WhySchema,
    schemaName: "why",
    promptVersion: WHY_VERSION,
    maxOutputTokens: 1200,
  });
}

export async function aiDictionaryEntry(word: string, userId: string | null) {
  return callStructured({
    route: "/api/dict",
    userId,
    tier: "fast",
    system: DICT_FALLBACK_SYSTEM,
    user: word,
    schema: DictFallbackSchema,
    schemaName: "dictionary_entry",
    promptVersion: DICT_FALLBACK_VERSION,
    maxOutputTokens: 700,
  });
}

export async function aiPhrases(text: string, userId: string) {
  return callStructured({
    route: "/api/dict/phrase",
    userId,
    tier: "fast",
    system: PHRASE_HELPER_SYSTEM,
    user: text,
    schema: PhraseHelperSchema,
    schemaName: "phrase_helper",
    promptVersion: PHRASE_HELPER_VERSION,
    maxOutputTokens: 800,
  });
}

export async function aiWeeklySummary(stats: unknown) {
  return callStructured({
    route: "/api/cron/weekly-summary",
    userId: null,
    tier: "grader",
    system: WEEKLY_SUMMARY_SYSTEM,
    user: JSON.stringify(stats),
    schema: WeeklySummarySchema,
    schemaName: "weekly_summary",
    promptVersion: WEEKLY_SUMMARY_VERSION,
    maxOutputTokens: 1500,
  });
}
