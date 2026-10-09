// Pure progress transitions for a session.

import type { Plan, Progress, SessionBlock } from "./types";

export function grammarSequence(plan: Plan, progress: Progress): string[] {
  if (!plan.grammar) return [];
  const tail = progress.grammar_tail === "hard" ? plan.grammar.tail_hard : plan.grammar.tail_normal;
  return [...plan.grammar.head, ...tail].slice(0, 10);
}

export function blockLength(plan: Plan, progress: Progress, block: SessionBlock): number {
  switch (block) {
    case "review":
      return plan.review.entries.length;
    case "grammar":
      return grammarSequence(plan, progress).length;
    case "new_words":
      return (plan.new_words?.vocab_ids.length ?? 0) + (plan.new_words?.check_ids.length ?? 0);
    case "check":
      return plan.check?.item_ids.length ?? 0;
    default:
      return 1;
  }
}

/** Blocks that still count for a short day. */
export const SHORT_DAY_BLOCKS: SessionBlock[] = ["review", "grammar"];

export function nextBlock(plan: Plan, after: SessionBlock, shortDay: boolean): SessionBlock | "finished" {
  const order = plan.blocks;
  const i = order.indexOf(after);
  for (let j = i + 1; j < order.length; j++) {
    const b = order[j];
    if (shortDay && !SHORT_DAY_BLOCKS.includes(b) && b !== "wrapup") continue;
    return b;
  }
  return "finished";
}

/** Mark `block` done (or skipped) and activate the next one. Returns a new object. */
export function completeBlock(
  plan: Plan,
  progress: Progress,
  block: SessionBlock,
  shortDay: boolean,
  how: "done" | "skipped" = "done",
): Progress {
  const p: Progress = structuredClone(progress);
  const bp = p.blocks[block] ?? { status: "pending", index: 0, correct: 0, answered: 0, ms: 0 };
  bp.status = how;
  p.blocks[block] = bp;
  const next = nextBlock(plan, block, shortDay);
  p.current = next;
  if (next !== "finished") {
    const nb = p.blocks[next] ?? { status: "pending", index: 0, correct: 0, answered: 0, ms: 0 };
    if (nb.status === "pending") nb.status = "active";
    p.blocks[next] = nb;
  }
  return p;
}

/** A day keeps the streak once blocks 1 and 2 are done (Saturday: review; Sunday: check). */
export function streakOk(plan: Plan, progress: Progress): boolean {
  const done = (b: SessionBlock) => progress.blocks[b]?.status === "done";
  if (plan.kind === "sunday") return done("check");
  if (plan.kind === "saturday") return done("review") || plan.review.entries.length === 0;
  const reviewOk = done("review") || plan.review.entries.length === 0;
  const grammarOk = done("grammar") || !plan.grammar;
  return reviewOk && grammarOk;
}

export function totalMinutes(progress: Progress): number {
  const ms = Object.values(progress.blocks).reduce((s, b) => s + (b?.ms ?? 0), 0);
  return Math.round(ms / 60000);
}
