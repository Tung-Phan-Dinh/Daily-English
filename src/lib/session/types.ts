import type { DayKind } from "@/lib/time";

export type SessionBlock = "review" | "grammar" | "new_words" | "reading" | "writing" | "check" | "wrapup";

export type VocabExercise = "meaning_mcq" | "type_word" | "collocation" | "word_form" | "cloze" | "own_sentence";

export type ReviewEntry = {
  card_id: string;
  item_type: "vocab" | "grammar";
  item_id: string;
  stage: 1 | 2 | 3 | 4 | 5;
  exercise: VocabExercise | "grammar";
};

export type Plan = {
  v: 1;
  kind: DayKind;
  local_date: string;
  topic: { id: number; slug: string; name_en: string; name_vi: string };
  week_index: number;
  blocks: SessionBlock[];
  review: { entries: ReviewEntry[]; due_total: number };
  grammar?: { point_id: number; head: string[]; tail_normal: string[]; tail_hard: string[] };
  new_words?: { vocab_ids: string[]; check_ids: string[] };
  new_words_skipped_reason?: string;
  reading?: { passage_id: string };
  writing?: { task_id: string; optional?: boolean };
  check?: { item_ids: string[] };
};

export type BlockStatus = "pending" | "active" | "done" | "skipped" | "expired";

export type BlockProgress = {
  status: BlockStatus;
  index: number; // next item index within the block
  correct: number;
  answered: number;
  ms: number;
  data?: Record<string, unknown>;
};

export type Progress = {
  current: SessionBlock | "finished";
  blocks: Partial<Record<SessionBlock, BlockProgress>>;
  xp: number;
  grammar_tail?: "normal" | "hard";
  own_sentence_count: number;
  words_learned: number;
  paused_at?: string;
};

export type SessionRow = {
  id: string;
  user_id: string;
  local_date: string;
  kind: DayKind;
  status: "in_progress" | "completed" | "partial";
  plan: Plan;
  progress: Progress;
  minutes: number;
  short_day: boolean;
  skipped_blocks: string[];
  streak_ok: boolean;
  xp: number;
  started_at: string;
  completed_at: string | null;
};

export function emptyProgress(blocks: SessionBlock[]): Progress {
  const p: Progress = { current: blocks[0], blocks: {}, xp: 0, own_sentence_count: 0, words_learned: 0 };
  blocks.forEach((b, i) => {
    p.blocks[b] = { status: i === 0 ? "active" : "pending", index: 0, correct: 0, answered: 0, ms: 0 };
  });
  return p;
}
