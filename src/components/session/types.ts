import type { SessionPayload } from "@/lib/session/hydrate";

export type { SessionPayload };
export type Progress = SessionPayload["session"]["progress"];
export type PublicGrammar = NonNullable<NonNullable<SessionPayload["grammar"]>["items"][string]>;
export type ReviewEntry = SessionPayload["review"][number];
export type VocabItem = NonNullable<SessionPayload["new_words"]>["words"][number];
export type PublicExercise = NonNullable<NonNullable<SessionPayload["new_words"]>["checks"][number]["exercise"]>;

export type AnswerResponse = {
  correct: boolean;
  duplicate?: boolean;
  checked_by?: "exact" | "ai" | "fallback";
  correct_answer?: string;
  explanation_en?: string;
  explanation_vi?: string;
  trap_note_vi?: string;
  feedback_en?: string;
  feedback_vi?: string;
  error_code?: string;
  lemma?: string;
  gloss_vi?: string;
  definition_en?: string;
  example?: string;
  xp_gained?: number;
  progress: Progress;
  grammar_sequence?: string[];
};

export type Settings = { accent: "en-GB" | "en-US"; explain_lang: "en" | "vi"; spellcheck: boolean; sound: boolean };
