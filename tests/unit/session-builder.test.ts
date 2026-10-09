import { describe, expect, it } from "vitest";
import { buildPlan, buildReviewQueue, chooseGrammarPoint, pickGrammarItems, seededRandom, type DueCard, type ItemInfo } from "@/lib/session/plan";
import { completeBlock, grammarSequence, nextBlock, streakOk } from "@/lib/session/progress";
import { emptyProgress } from "@/lib/session/types";
import { buildVocabExercise, publicExercise, type VocabItem } from "@/lib/session/vocab-exercise";

const topic = { id: 1, slug: "education", name_en: "Education", name_vi: "Giáo dục" };

function due(n: number, type: "vocab" | "grammar" = "vocab", stability = 3): DueCard[] {
  return Array.from({ length: n }, (_, i) => ({
    id: `${type}-card-${i}`, item_type: type, item_id: `${type}-item-${i}`,
    due: new Date(Date.UTC(2026, 9, 1, 0, i)).toISOString(), stability, difficulty: 5, elapsed_days: 0,
    scheduled_days: 1, learning_steps: 0, reps: 2, lapses: 0, state: 2, last_review: null,
  }));
}

function items(point: number, n: number, formats = ["mcq", "typed_gap", "spot_error", "correct_error", "transform", "combine", "word_form", "translate"]): ItemInfo[] {
  return Array.from({ length: n }, (_, i) => ({
    id: `p${point}-i${i}`, format: formats[i % formats.length], difficulty: (i % 3) + 1, grammar_point_id: point,
  }));
}

const grammar = { pointId: 3, current: items(3, 12), earlier: [...items(1, 8), ...items(2, 8)], seen: new Set<string>() };

describe("review queue", () => {
  it("caps at 20 cards and interleaves vocab and grammar", () => {
    const q = buildReviewQueue([...due(30, "vocab"), ...due(10, "grammar")]);
    expect(q).toHaveLength(20);
    // never more than two vocab cards in a row while grammar cards remain
    const types = q.map((e) => e.item_type).join(",");
    expect(types.startsWith("vocab,vocab,grammar")).toBe(true);
  });
  it("uses the ladder to pick vocab exercises", () => {
    const q = buildReviewQueue(due(3, "vocab", 1));
    expect(q.every((e) => e.exercise === "meaning_mcq")).toBe(true);
    const q3 = buildReviewQueue(due(3, "vocab", 4));
    expect(q3.every((e) => e.exercise === "type_word")).toBe(true);
  });
  it("allows at most 2 own-sentence exercises per day", () => {
    const q = buildReviewQueue(due(20, "vocab", 40));
    expect(q.filter((e) => e.exercise === "own_sentence").length).toBeLessThanOrEqual(2);
  });
});

describe("plan building", () => {
  const base = {
    localDate: "2026-10-12", kind: "weekday" as const, topic, weekIndex: 0, newPerDay: 8,
    newVocabIds: Array.from({ length: 10 }, (_, i) => `v${i}`), passageId: "p1", taskId: "t1", rand: seededRandom("x"),
  };
  it("weekday plan has all six blocks", () => {
    const plan = buildPlan({ ...base, due: due(5), grammar });
    expect(plan.blocks).toEqual(["review", "grammar", "new_words", "reading", "writing", "wrapup"]);
    expect(plan.new_words!.vocab_ids).toHaveLength(8);
    expect(plan.new_words!.check_ids).toHaveLength(3);
  });
  it("skips new words when more than 40 reviews are due, and says why", () => {
    const plan = buildPlan({ ...base, due: due(41), grammar });
    expect(plan.blocks).not.toContain("new_words");
    expect(plan.new_words_skipped_reason).toMatch(/41 reviews/);
    expect(plan.review.entries).toHaveLength(20);
  });
  it("Saturday is review + optional essay", () => {
    const plan = buildPlan({ ...base, kind: "saturday", due: due(2) });
    expect(plan.blocks).toEqual(["review", "writing", "wrapup"]);
    expect(plan.writing?.optional).toBe(true);
  });
  it("Sunday is a 10-question weekly check", () => {
    const plan = buildPlan({ ...base, kind: "sunday", due: [], checkItemIds: Array.from({ length: 15 }, (_, i) => `c${i}`) });
    expect(plan.blocks).toEqual(["check", "wrapup"]);
    expect(plan.check!.item_ids).toHaveLength(10);
  });
  it("is deterministic for the same seed", () => {
    const a = buildPlan({ ...base, due: due(5), grammar, rand: seededRandom("s") });
    const b = buildPlan({ ...base, due: due(5), grammar, rand: seededRandom("s") });
    expect(a).toEqual(b);
  });
});

describe("grammar items", () => {
  it("10 items: 5 head, then a normal or hard tail of 5, with earlier points mixed in", () => {
    const g = pickGrammarItems(grammar.current, grammar.earlier, new Set(), seededRandom("g"));
    expect(g.head).toHaveLength(5);
    expect(g.tail_normal).toHaveLength(5);
    expect(g.tail_hard.length).toBeGreaterThanOrEqual(3);
    const all = [...g.head, ...g.tail_normal];
    expect(new Set(all).size).toBe(10);
    expect(all.some((id) => !id.startsWith("p3-"))).toBe(true); // interleaving
  });
  it("the hard tail prefers sentence combining / transformation", () => {
    const g = pickGrammarItems(grammar.current, grammar.earlier, new Set(), seededRandom("h"));
    const hardCurrent = g.tail_hard.filter((id) => id.startsWith("p3-"));
    const formats = hardCurrent.map((id) => grammar.current.find((i) => i.id === id)!);
    expect(formats.some((i) => ["combine", "transform", "translate"].includes(i.format) || i.difficulty === 3)).toBe(true);
  });
  it("the first five right switches the tail to hard", () => {
    const plan = buildPlan({
      localDate: "2026-10-12", kind: "weekday", topic, weekIndex: 0, newPerDay: 8, newVocabIds: [], due: [], grammar, rand: seededRandom("t"),
    });
    const p = emptyProgress(plan.blocks);
    expect(grammarSequence(plan, { ...p, grammar_tail: "hard" }).slice(5)).toEqual(plan.grammar!.tail_hard.slice(0, 5));
    expect(grammarSequence(plan, { ...p, grammar_tail: "normal" }).slice(5)).toEqual(plan.grammar!.tail_normal);
  });
});

describe("grammar point choice", () => {
  const points = Array.from({ length: 24 }, (_, i) => ({ id: i + 1, sort: i + 1, error_codes: [i % 2 ? "ART" : "TNS"] }));
  it("stays on a point for 3 sessions, then moves on", () => {
    const ctx = { sessionsPerPoint: new Map([[1, 2]]), mastered: new Set<number>(), compressed: new Set<number>(), weakestCodes: [] };
    expect(chooseGrammarPoint(points, ctx).pointId).toBe(1);
    ctx.sessionsPerPoint.set(1, 3);
    expect(chooseGrammarPoint(points, ctx).pointId).toBe(2);
  });
  it("placement-mastered points get a single review day", () => {
    const ctx = { sessionsPerPoint: new Map([[1, 1]]), mastered: new Set<number>(), compressed: new Set([1]), weakestCodes: [] };
    expect(chooseGrammarPoint(points, ctx).pointId).toBe(2);
  });
  it("after all 24 points, cycles the weakest codes", () => {
    const ctx = {
      sessionsPerPoint: new Map(points.map((p) => [p.id, 3])), mastered: new Set<number>(), compressed: new Set<number>(), weakestCodes: ["ART"],
    };
    const c = chooseGrammarPoint(points, ctx);
    expect(c.mode).toBe("cycle");
    expect(points.find((p) => p.id === c.pointId)!.error_codes).toContain("ART");
  });
});

describe("block transitions", () => {
  const plan = buildPlan({
    localDate: "2026-10-12", kind: "weekday", topic, weekIndex: 0, newPerDay: 8, newVocabIds: ["a", "b", "c"],
    due: due(2), grammar, passageId: "p", taskId: "t", rand: seededRandom("b"),
  });
  it("short day goes from grammar straight to wrap-up", () => {
    expect(nextBlock(plan, "grammar", true)).toBe("wrapup");
    expect(nextBlock(plan, "grammar", false)).toBe("new_words");
  });
  it("streak is kept once review and grammar are done", () => {
    let p = emptyProgress(plan.blocks);
    p = completeBlock(plan, p, "review", false);
    expect(streakOk(plan, p)).toBe(false);
    p = completeBlock(plan, p, "grammar", false);
    expect(streakOk(plan, p)).toBe(true);
    expect(p.current).toBe("new_words");
  });
});

describe("vocab exercises", () => {
  const v = (id: string, lemma: string, over: Partial<VocabItem> = {}): VocabItem => ({
    id, lemma, pos: "verb", ipa: "", definition_en: `meaning of ${lemma}`, gloss_vi: "vi", word_family: { noun: `${lemma}ment` },
    collocations: [`${lemma} a problem`], examples: [`We must ${lemma} it now.`, `They ${lemma}d the issue quickly.`], register: "neutral",
    common_mistake_vi: null, ...over,
  });
  const pool = [v("1", "tackle"), v("2", "allocate"), v("3", "assess"), v("4", "attend"), v("5", "invest")];
  it("meaning MCQ has 4 options including the answer", () => {
    const ex = buildVocabExercise("meaning_mcq", pool[0], pool, "seed");
    expect(ex.options).toHaveLength(4);
    expect(ex.options).toContain(ex.answer);
  });
  it("is deterministic for a seed, so the server can re-check without storing the answer", () => {
    expect(buildVocabExercise("collocation", pool[0], pool, "s1")).toEqual(buildVocabExercise("collocation", pool[0], pool, "s1"));
  });
  it("cloze blanks the inflected form", () => {
    const ex = buildVocabExercise("cloze", pool[0], pool, "s");
    expect(ex.sentence).toContain("_____");
    expect(ex.answer).toBe("tackled");
  });
  it("public exercise never contains the answer", () => {
    const pub = publicExercise(buildVocabExercise("type_word", pool[0], pool, "s"));
    expect(JSON.stringify(pub)).not.toContain('"answer"');
    expect(pub.firstLetter).toBe("t");
  });
});

describe("grammar items with a small bank and no earlier points", () => {
  it("never repeats an item between the head and either tail", () => {
    for (const seed of ["a", "b", "c", "d", "e"]) {
      const g = pickGrammarItems(items(1, 8), [], new Set(), seededRandom(seed));
      expect(new Set([...g.head, ...g.tail_normal]).size).toBe(g.head.length + g.tail_normal.length);
      expect(new Set([...g.head, ...g.tail_hard]).size).toBe(g.head.length + g.tail_hard.length);
      expect(g.head).toHaveLength(5);
    }
  });
});
