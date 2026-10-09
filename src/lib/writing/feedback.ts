// Pure post-processing of the writing grader's output (unit-tested).
import type { WritingFeedback } from "@/lib/ai/prompts/writing-grader";
import { sentenceAround, validateErrorOffsets, type OffsetError } from "@/lib/offsets";

const SEVERITY_ORDER = { blocks_meaning: 0, noticeable: 1, minor: 2 } as const;

const toHalfBand = (x: number | null) =>
  x === null || !Number.isFinite(x) ? null : Math.min(9, Math.max(0, Math.round(x * 2) / 2));

/** Validate and clean the model's output against the original text. Pure. */
export function postProcessFeedback(text: string, raw: WritingFeedback, weakCodes: string[], fullCriteria: boolean) {
  const errors = validateErrorOffsets(text, raw.errors as OffsetError[]);
  // At most 3 focus codes, all present in the error list; prefer blocks_meaning then weak codes.
  const present = new Set(errors.filter((e) => e.severity !== "minor").map((e) => e.code));
  let focus: string[] = raw.focus_codes.filter((c) => present.has(c));
  if (focus.length === 0) {
    focus = [...present].sort((a, b) => {
      const sa = Math.min(...errors.filter((e) => e.code === a).map((e) => SEVERITY_ORDER[e.severity]));
      const sb = Math.min(...errors.filter((e) => e.code === b).map((e) => SEVERITY_ORDER[e.severity]));
      return sa - sb || Number(weakCodes.includes(b)) - Number(weakCodes.includes(a));
    });
  }
  focus = [...new Set(focus)].slice(0, 3);

  let rewrite = raw.rewrite_sentence;
  const validRewrite = rewrite && rewrite.start >= 0 && rewrite.end > rewrite.start && rewrite.end <= text.length;
  const worst = errors.slice().sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity])[0];
  if (worst && (!validRewrite || !(worst.start >= rewrite.start && worst.end <= rewrite.end))) {
    rewrite = sentenceAround(text, worst.start, worst.end);
  } else if (!validRewrite) {
    rewrite = { start: 0, end: 0 };
  }

  return {
    ...raw,
    errors: errors.map((e) => ({ ...e, is_focus: focus.includes(e.code) && e.severity !== "minor" })),
    focus_codes: focus,
    bands: {
      gra: toHalfBand(raw.bands.gra),
      lr: toHalfBand(raw.bands.lr),
      tr: fullCriteria ? toHalfBand(raw.bands.tr) : null,
      cc: fullCriteria ? toHalfBand(raw.bands.cc) : null,
    },
    strengths: raw.strengths.filter((s) => s.quote && text.includes(s.quote)).slice(0, 2),
    upgrades: raw.upgrades.filter((u) => u.original && text.toLowerCase().includes(u.original.toLowerCase())).slice(0, 3),
    rewrite_sentence: rewrite,
    rewrite_error: worst ? { code: worst.code, original: worst.original, correction: worst.correction, explain_en: worst.explain_en, explain_vi: worst.explain_vi } : null,
  };
}

export type ProcessedFeedback = ReturnType<typeof postProcessFeedback>;

