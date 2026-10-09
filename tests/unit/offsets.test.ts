import { describe, expect, it } from "vitest";
import { errorDensity, quoteToOffsets, sentenceAround, validateErrorOffsets, type OffsetError } from "@/lib/offsets";
import { postProcessFeedback } from "@/lib/writing/feedback";

const e = (over: Partial<OffsetError>): OffsetError => ({
  start: 0, end: 0, original: "", correction: "", code: "ART", severity: "noticeable", explain_en: "", explain_vi: "", ...over,
});

const text = "Government should invest in education system. I go to school yesterday.";

describe("offset validation", () => {
  it("keeps errors whose offsets match exactly", () => {
    const out = validateErrorOffsets(text, [e({ start: 0, end: 10, original: "Government" })]);
    expect(out).toHaveLength(1);
    expect(text.slice(out[0].start, out[0].end)).toBe("Government");
  });
  it("relocates an error whose offsets are wrong by string search", () => {
    const out = validateErrorOffsets(text, [e({ start: 3, end: 5, original: "go", code: "TNS" })]);
    expect(out).toHaveLength(1);
    expect(text.slice(out[0].start, out[0].end)).toBe("go");
  });
  it("drops errors whose original text isn't in the paragraph", () => {
    expect(validateErrorOffsets(text, [e({ start: 0, end: 4, original: "banana" })])).toHaveLength(0);
  });
  it("every surviving error satisfies text.slice(start,end) === original", () => {
    const out = validateErrorOffsets(text, [
      e({ start: 99, end: 120, original: "education system" }),
      e({ start: 0, end: 10, original: "Government" }),
      e({ start: 50, end: 52, original: "go", code: "TNS" }),
    ]);
    for (const x of out) expect(text.slice(x.start, x.end)).toBe(x.original);
  });
  it("overlaps keep the more severe error", () => {
    const out = validateErrorOffsets(text, [
      e({ start: 28, end: 37, original: "education", severity: "minor" }),
      e({ start: 28, end: 44, original: "education system", severity: "blocks_meaning" }),
    ]);
    expect(out).toHaveLength(1);
    expect(out[0].severity).toBe("blocks_meaning");
  });
});

describe("error density", () => {
  it("is errors per 100 words per code", () => {
    expect(errorDensity([{ code: "ART" }, { code: "ART" }, { code: "TNS" }], 50)).toEqual({ ART: 4, TNS: 2 });
  });
  it("is empty for zero words", () => {
    expect(errorDensity([{ code: "ART" }], 0)).toEqual({});
  });
});

describe("evidence quotes", () => {
  const body = "Access to good schools has improved.\n\nGovernments have tried  several ways.";
  it("finds exact quotes", () => {
    const o = quoteToOffsets(body, "has improved")!;
    expect(body.slice(o.start, o.end)).toBe("has improved");
  });
  it("tolerates whitespace differences", () => {
    const o = quoteToOffsets(body, "tried several ways")!;
    expect(body.slice(o.start, o.end)).toBe("tried  several ways");
  });
  it("returns null when missing", () => {
    expect(quoteToOffsets(body, "not there")).toBeNull();
  });
  it("sentenceAround finds the containing sentence", () => {
    const s = sentenceAround(text, 50, 52);
    expect(text.slice(s.start, s.end)).toBe("I go to school yesterday.");
  });
});

describe("writing feedback post-processing", () => {
  const raw = {
    bands: { gra: 5.3, lr: 6.1, tr: 6, cc: 6 },
    errors: [
      e({ start: 0, end: 10, original: "Government", code: "ART", severity: "noticeable" }),
      e({ start: 0, end: 2, original: "go", code: "TNS", severity: "blocks_meaning" }),
      e({ start: 0, end: 1, original: "zzz", code: "PLU" }),
    ],
    focus_codes: ["ART", "TNS", "PLU", "SVA"] as never,
    strengths: [{ quote: "invest in", why: "good collocation" }, { quote: "made up words", why: "x" }],
    upgrades: [],
    target_check: { words_used: [], grammar_used_correctly: true, comment: "" },
    rewrite_sentence: { start: 0, end: 5 },
    model_version: "…",
  };
  const fb = postProcessFeedback(text, raw as never, ["ART"], false);
  it("drops invalid errors and caps focus codes at 3, only codes present", () => {
    expect(fb.errors.map((x) => x.code).sort()).toEqual(["ART", "TNS"]);
    expect(fb.focus_codes.length).toBeLessThanOrEqual(3);
    expect(fb.focus_codes).not.toContain("PLU");
  });
  it("rounds bands to half-bands and nulls TR/CC on weekdays", () => {
    expect(fb.bands).toEqual({ gra: 5.5, lr: 6, tr: null, cc: null });
  });
  it("keeps only strengths that quote his exact words", () => {
    expect(fb.strengths.map((s) => s.quote)).toEqual(["invest in"]);
  });
  it("rewrite sentence contains the most serious error", () => {
    const s = text.slice(fb.rewrite_sentence.start, fb.rewrite_sentence.end);
    expect(s).toContain("go to school yesterday");
  });
});
