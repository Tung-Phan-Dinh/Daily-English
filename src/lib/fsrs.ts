import { createEmptyCard, fsrs, generatorParameters, Rating, State, type Card, type Grade } from "ts-fsrs";

// FSRS-6, desired retention 0.90, fuzz on. Sessions are once a day, so
// short-term (minute-level) learning steps are disabled.
export const scheduler = fsrs(
  generatorParameters({
    request_retention: 0.9,
    enable_fuzz: true,
    enable_short_term: false,
    learning_steps: [],
    relearning_steps: [],
  }),
);

export { Rating, State };

export type CardRow = {
  id?: string;
  user_id?: string;
  item_type?: "vocab" | "grammar";
  item_id?: string;
  due: string;
  stability: number;
  difficulty: number;
  elapsed_days: number;
  scheduled_days: number;
  learning_steps: number;
  reps: number;
  lapses: number;
  state: number;
  last_review: string | null;
};

/**
 * Ratings are derived, never self-reported:
 *   wrong → Again; right with a hint or after >10 s → Hard;
 *   right on a production card in <4 s → Easy; otherwise Good.
 */
export function deriveRating(input: {
  correct: boolean;
  usedHint?: boolean;
  durationMs: number;
  production?: boolean;
}): Grade {
  if (!input.correct) return Rating.Again;
  if (input.usedHint || input.durationMs > 10_000) return Rating.Hard;
  if (input.production && input.durationMs < 4_000) return Rating.Easy;
  return Rating.Good;
}

export function rowToCard(row: CardRow | null | undefined): Card {
  if (!row) return createEmptyCard(new Date());
  return {
    due: new Date(row.due),
    stability: row.stability,
    difficulty: row.difficulty,
    elapsed_days: row.elapsed_days,
    scheduled_days: row.scheduled_days,
    learning_steps: row.learning_steps,
    reps: row.reps,
    lapses: row.lapses,
    state: row.state as State,
    last_review: row.last_review ? new Date(row.last_review) : undefined,
  };
}

export function cardToRow(card: Card): CardRow {
  return {
    due: card.due.toISOString(),
    stability: card.stability,
    difficulty: card.difficulty,
    elapsed_days: card.elapsed_days,
    scheduled_days: card.scheduled_days,
    learning_steps: card.learning_steps,
    reps: card.reps,
    lapses: card.lapses,
    state: card.state,
    last_review: card.last_review ? card.last_review.toISOString() : null,
  };
}

export function review(row: CardRow | null, grade: Grade, now: Date = new Date()): CardRow {
  const next = scheduler.next(rowToCard(row), now, grade);
  return cardToRow(next.card);
}

/** Exercise ladder stage from FSRS stability (spec "Exercise ladder"). */
export function stageFor(row: Pick<CardRow, "state" | "stability"> | null | undefined): 1 | 2 | 3 | 4 | 5 {
  if (!row || row.state === State.New) return 1;
  if (row.stability < 2) return 2;
  if (row.stability < 7) return 3;
  if (row.stability < 21) return 4;
  return 5;
}

export type VocabState = "learning" | "review" | "mastered";

export function vocabState(row: Pick<CardRow, "state" | "stability">): VocabState {
  if (row.state === State.Review && row.stability >= 21) return "mastered";
  if (row.state === State.Review && row.stability >= 2) return "review";
  return "learning";
}
