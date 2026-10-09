import { describe, expect, it } from "vitest";
import { containsTarget, findTargetSpan } from "@/lib/inflect";
import { computeStreak, isPointMastered, weakestCodes, weaknessFromAttempt } from "@/lib/progress-rules";
import { scoreVocabCheck } from "@content/placement";

const att = (n: number, correct: number, formats: string[], days: string[]) =>
  Array.from({ length: n }, (_, i) => ({ correct: i < correct, format: formats[i % formats.length], local_date: days[i % days.length] }));

describe("mastery rule", () => {
  it("needs 20 attempts", () => {
    expect(isPointMastered(att(19, 19, ["mcq", "typed_gap"], ["2026-10-01", "2026-10-02"]))).toBe(false);
  });
  it("≥85% over the last 20, two formats incl. production, two days", () => {
    expect(isPointMastered(att(20, 17, ["mcq", "typed_gap"], ["2026-10-01", "2026-10-02"]))).toBe(true);
  });
  it("fails below 85%", () => {
    expect(isPointMastered(att(20, 16, ["mcq", "typed_gap"], ["2026-10-01", "2026-10-02"]))).toBe(false);
  });
  it("fails with recognition formats only", () => {
    expect(isPointMastered(att(20, 20, ["mcq", "spot_error"], ["2026-10-01", "2026-10-02"]))).toBe(false);
  });
  it("fails on a single day", () => {
    expect(isPointMastered(att(20, 20, ["mcq", "typed_gap"], ["2026-10-01"]))).toBe(false);
  });
});

describe("weakness", () => {
  it("wrong answers raise the score, right answers lower it", () => {
    expect(weaknessFromAttempt(0.5, false)).toBeGreaterThan(0.5);
    expect(weaknessFromAttempt(0.5, true)).toBeLessThan(0.5);
  });
  it("weakest codes sorted by score", () => {
    expect(weakestCodes([{ error_code: "ART", score: 0.2 }, { error_code: "TNS", score: 0.9 }], 1)).toEqual(["TNS"]);
  });
});

describe("streak", () => {
  it("counts consecutive practised days, Sundays don't break it", () => {
    // 2026-10-09 is a Friday; 2026-10-04 a Sunday
    const days = ["2026-10-02", "2026-10-03", "2026-10-05", "2026-10-06", "2026-10-07", "2026-10-08", "2026-10-09"].map((d) => ({ local_date: d, streak_ok: true }));
    expect(computeStreak(days, "2026-10-09").current).toBe(7);
  });
  it("today not done yet doesn't break the streak", () => {
    const days = ["2026-10-07", "2026-10-08"].map((d) => ({ local_date: d, streak_ok: true }));
    expect(computeStreak(days, "2026-10-09").current).toBe(2);
  });
  it("two free freezes per month bridge missed days; a third breaks it", () => {
    const days = ["2026-10-01", "2026-10-05", "2026-10-09"].map((d) => ({ local_date: d, streak_ok: true }));
    // missed 6,7,8 (three weekdays) → only two freezes → streak = 1 (just the 9th)
    expect(computeStreak(days, "2026-10-09").current).toBe(1);
    const days2 = ["2026-10-06", "2026-10-09"].map((d) => ({ local_date: d, streak_ok: true }));
    // missed 7, 8 → two freezes → streak continues to the 6th
    const s = computeStreak(days2, "2026-10-09");
    expect(s.current).toBe(2);
    expect(s.frozen).toEqual(["2026-10-08", "2026-10-07"]);
  });
});

describe("target word detection (any inflection)", () => {
  it("matches inflected forms", () => {
    expect(containsTarget("Fees have increased sharply.", "increase")).toBe(true);
    expect(containsTarget("She studies hard.", "study")).toBe(true);
    expect(containsTarget("He stopped smoking.", "stop")).toBe(true);
    expect(containsTarget("They taught us well.", "teach")).toBe(true);
    expect(containsTarget("Tuition fees are rising.", "tuition fee")).toBe(true);
  });
  it("does not match other words", () => {
    expect(containsTarget("The interest rate fell.", "invest")).toBe(false);
  });
  it("finds the span", () => {
    const t = "They allocated more funds.";
    const s = findTargetSpan(t, "allocate")!;
    expect(t.slice(s.start, s.end)).toBe("allocated");
  });
});

describe("placement vocabulary check", () => {
  it("yes to fake words discounts the score", () => {
    const honest = scoreVocabCheck({ decide: true, happen: true, likely: true, region: true, increase: true, prepare: true, raise: true, simple: true, support: true, describe: true });
    expect(honest.bands[0].known).toBe(true);
    const guesser = scoreVocabCheck({
      decide: true, happen: true, likely: true, region: true, increase: true, prepare: true, raise: true, simple: true, support: true, describe: true,
      prenticate: true, dabbersome: true, glomerize: true,
    });
    expect(guesser.bands[0].known).toBe(false);
  });
});
