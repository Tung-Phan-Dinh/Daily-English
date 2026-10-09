import { describe, expect, it } from "vitest";
import { countWords, matchesAny, normalizeAnswer } from "@/lib/normalize";
import { checkGrammarExact, type GrammarItem } from "@/lib/session/check";

describe("answer normalisation", () => {
  it("ignores case, spacing and final punctuation", () => {
    expect(normalizeAnswer("  He  Goes to school.  ")).toBe("he goes to school");
  });
  it("treats curly apostrophes and contractions as equal", () => {
    expect(matchesAny("He doesn’t like playing football", ["He does not like playing football."])).toBe(true);
    expect(matchesAny("I can't swim", ["I cannot swim"])).toBe(true);
    expect(matchesAny("They're late", ["They are late"])).toBe(true);
  });
  it("does not accept a different answer", () => {
    expect(matchesAny("He don't like football", ["He doesn't like football"])).toBe(false);
  });
  it("empty answers never match", () => {
    expect(matchesAny("   ", [""])).toBe(false);
  });
  it("counts words like the editor", () => {
    expect(countWords("It's a well-known fact, isn't it?")).toBe(6);
    expect(countWords("")).toBe(0);
  });
});

const item = (over: Partial<GrammarItem>): GrammarItem => ({
  id: "x", grammar_point_id: 1, error_code: "ART", format: "typed_gap", difficulty: 1, prompt: "", options: null,
  answers: [], meta: {}, explanation_en: "", explanation_vi: "", trap_note_vi: "", ...over,
});

describe("grammar exact checks", () => {
  it("mcq is exact", () => {
    const it1 = item({ format: "mcq", options: ["a", "an"], answers: ["an"] });
    expect(checkGrammarExact(it1, "an").correct).toBe(true);
    expect(checkGrammarExact(it1, "An").correct).toBe(false);
  });
  it("typed gaps accept slash/comma variants for two gaps", () => {
    const it2 = item({ answers: ["an / The"] });
    expect(checkGrammarExact(it2, "an, the").correct).toBe(true);
    expect(checkGrammarExact(it2, "an the").correct).toBe(true);
  });
  it("spot the error uses the exact token index", () => {
    const it3 = item({ format: "spot_error", answers: ["2"] });
    expect(checkGrammarExact(it3, "2").correct).toBe(true);
    expect(checkGrammarExact(it3, "3").correct).toBe(false);
  });
  it("open formats fall through to the AI checker only when not in the list", () => {
    const it4 = item({ format: "correct_error", answers: ["He goes to school."] });
    expect(checkGrammarExact(it4, "he goes to school")).toEqual({ correct: true, needsAi: false });
    expect(checkGrammarExact(it4, "He walks to school")).toEqual({ correct: false, needsAi: true });
    const it5 = item({ format: "typed_gap", answers: ["in"] });
    expect(checkGrammarExact(it5, "on").needsAi).toBe(false);
  });
});
