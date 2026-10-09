import { describe, expect, it } from "vitest";
import { deriveRating, Rating, review, stageFor, State, vocabState } from "@/lib/fsrs";

describe("FSRS rating mapping (derived, never self-reported)", () => {
  it("wrong → Again", () => {
    expect(deriveRating({ correct: false, durationMs: 1000 })).toBe(Rating.Again);
  });
  it("right with a hint → Hard", () => {
    expect(deriveRating({ correct: true, usedHint: true, durationMs: 2000 })).toBe(Rating.Hard);
  });
  it("right after more than 10 s → Hard", () => {
    expect(deriveRating({ correct: true, durationMs: 10_001 })).toBe(Rating.Hard);
  });
  it("right on a production card in under 4 s → Easy", () => {
    expect(deriveRating({ correct: true, production: true, durationMs: 3_999 })).toBe(Rating.Easy);
  });
  it("right on a recognition card quickly → Good (not Easy)", () => {
    expect(deriveRating({ correct: true, production: false, durationMs: 2_000 })).toBe(Rating.Good);
  });
  it("right in normal time → Good", () => {
    expect(deriveRating({ correct: true, production: true, durationMs: 6_000 })).toBe(Rating.Good);
  });
});

describe("scheduler", () => {
  const now = new Date("2026-10-09T03:00:00Z");
  it("a new card rated Good is due in days, not minutes (no short-term steps)", () => {
    const row = review(null, Rating.Good, now);
    expect(new Date(row.due).getTime() - now.getTime()).toBeGreaterThan(20 * 3600_000);
    expect(row.state).toBe(State.Review);
  });
  it("Again schedules sooner than Good", () => {
    const again = review(null, Rating.Again, now);
    const good = review(null, Rating.Good, now);
    expect(new Date(again.due).getTime()).toBeLessThan(new Date(good.due).getTime());
  });
});

describe("exercise ladder", () => {
  it("maps stability to stages", () => {
    expect(stageFor(null)).toBe(1);
    expect(stageFor({ state: State.New, stability: 0 })).toBe(1);
    expect(stageFor({ state: State.Review, stability: 1.5 })).toBe(2);
    expect(stageFor({ state: State.Review, stability: 5 })).toBe(3);
    expect(stageFor({ state: State.Review, stability: 10 })).toBe(4);
    expect(stageFor({ state: State.Review, stability: 30 })).toBe(5);
  });
  it("vocab state buckets", () => {
    expect(vocabState({ state: State.Learning, stability: 30 })).toBe("learning");
    expect(vocabState({ state: State.Review, stability: 5 })).toBe("review");
    expect(vocabState({ state: State.Review, stability: 25 })).toBe("mastered");
  });
});
