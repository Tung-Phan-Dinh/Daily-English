import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { XP } from "@/lib/curriculum";
import { HttpError, type Viewer } from "@/lib/auth";
import { vocabState } from "@/lib/fsrs";
import { countWords, normalizeAnswer } from "@/lib/normalize";
import { createAdminClient } from "@/lib/supabase/admin";
import { localDate } from "@/lib/time";
import { loadOpenSession, saveProgress } from "./answer";
import { blockLength, completeBlock, nextBlock, SHORT_DAY_BLOCKS, streakOk, totalMinutes } from "./progress";
import type { Progress, SessionBlock, SessionRow } from "./types";

type DB = SupabaseClient;
type Locked = SessionRow & { updated_at: string };

// ---------------------------------------------------------------------------
// Reading: all four answers are submitted together.
// ---------------------------------------------------------------------------

export function checkReadingAnswer(q: { type: string; answer: string; accept: string[] }, response: string): boolean {
  const r = (response ?? "").trim();
  if (!r) return false;
  if (q.type === "completion") {
    // "NO MORE THAN TWO WORDS" from the passage: exact match after normalisation.
    if (countWords(r) > 2) return false;
    return [q.answer, ...(q.accept ?? [])].some((a) => normalizeAnswer(a) === normalizeAnswer(r));
  }
  if (q.type === "tfng") return r.toUpperCase() === q.answer.toUpperCase();
  return r === q.answer;
}

export async function submitReading(
  db: DB,
  viewer: Viewer,
  input: { session_id: string; answers: Record<string, string>; reading_ms: number; tapped_words?: string[] },
) {
  const s = (await loadOpenSession(db, viewer, input.session_id)) as Locked;
  if (s.progress.current !== "reading" || !s.plan.reading) throw new HttpError(409, "Reading is already submitted.", { code: "wrong_block" });
  const passageId = s.plan.reading.passage_id;
  const [{ data: passage }, { data: questions }] = await Promise.all([
    db.from("reading_passages").select("body").eq("id", passageId).single(),
    db.from("reading_questions").select("id, type, answer, accept").eq("passage_id", passageId).order("sort"),
  ]);
  const results: Record<string, { response: string; correct: boolean }> = {};
  for (const q of questions ?? []) {
    const response = String(input.answers?.[q.id] ?? "");
    results[q.id] = { response, correct: checkReadingAnswer(q as { type: string; answer: string; accept: string[] }, response) };
  }
  const readingMs = Math.max(10_000, Math.min(Number(input.reading_ms) || 0, 30 * 60_000));
  const words = countWords(passage?.body ?? "");
  const wpm = Math.round(words / (readingMs / 60_000));
  const correctCount = Object.values(results).filter((r) => r.correct).length;

  let progress: Progress = structuredClone(s.progress);
  const bp = progress.blocks.reading!;
  bp.answered = (questions ?? []).length;
  bp.correct = correctCount;
  bp.ms += readingMs;
  bp.data = { results, wpm, words, reading_ms: readingMs, tapped_words: (input.tapped_words ?? []).slice(0, 50) };
  progress.blocks.reading = bp;
  progress.xp += correctCount * XP.reading;
  progress = completeBlock(s.plan, progress, "reading", s.short_day);
  await saveProgress(db, s, progress);

  await db.from("attempts").insert(
    (questions ?? []).map((q) => ({
      user_id: viewer.id, session_id: s.id, item_kind: "reading", item_id: q.id, format: q.type,
      response: results[q.id].response.slice(0, 500), correct: results[q.id].correct,
      duration_ms: Math.round(readingMs / Math.max(1, (questions ?? []).length)), local_date: s.local_date,
    })),
  );
  return { results, wpm, correct: correctCount, total: (questions ?? []).length, progress };
}

// ---------------------------------------------------------------------------
// Other session actions
// ---------------------------------------------------------------------------

export type ActionInput =
  | { action: "advance"; session_id: string; block: SessionBlock; ms?: number }
  | { action: "skip"; session_id: string; block: SessionBlock }
  | { action: "short_day"; session_id: string }
  | { action: "continue_full"; session_id: string }
  | { action: "pause"; session_id: string; ms?: number; block?: SessionBlock }
  | { action: "finish"; session_id: string };

export async function sessionAction(db: DB, viewer: Viewer, input: ActionInput) {
  if (input.action === "continue_full") return continueFull(viewer, input.session_id);

  const s = (await loadOpenSession(db, viewer, input.session_id)) as Locked;
  let progress: Progress = structuredClone(s.progress);
  const extra: Record<string, unknown> = {};
  const addMs = (block: SessionBlock | undefined, ms: number | undefined) => {
    if (!block || !progress.blocks[block]) return;
    progress.blocks[block]!.ms += Math.max(0, Math.min(Number(ms) || 0, 10 * 60_000));
  };

  switch (input.action) {
    case "advance": {
      // Learn-card steps in the new-words block and the reading/writing intro screens.
      if (progress.current !== input.block) throw new HttpError(409, "That block is already finished.", { code: "wrong_block" });
      const bp = progress.blocks[input.block]!;
      addMs(input.block, input.ms);
      if (input.block === "new_words") {
        const n = s.plan.new_words?.vocab_ids.length ?? 0;
        if (bp.index < n) bp.index += 1;
      } else if (input.block === "writing") {
        // Writing normally closes after the rewrite step. "advance" closes it only when
        // grading was queued, there was nothing to rewrite, or the task is optional (Saturday).
        const { data: sub } = await db.from("writing_submissions").select("status, feedback, rewrite_ok, rewrite_attempts").eq("session_id", s.id).maybeSingle();
        const rs = (sub?.feedback as { rewrite_sentence?: { start: number; end: number } } | null)?.rewrite_sentence;
        const nothingToRewrite = sub?.status === "graded" && (!rs || rs.end <= rs.start);
        const allowed = s.plan.writing?.optional || (sub && (sub.status !== "graded" || nothingToRewrite || sub.rewrite_ok || sub.rewrite_attempts >= 2));
        if (!allowed) throw new HttpError(409, "Submit your writing first (or use Skip).");
        progress = completeBlock(s.plan, progress, "writing", s.short_day);
      } else if (blockLength(s.plan, progress, input.block) === 0) {
        // Nothing due / no items available: close the empty block.
        progress = completeBlock(s.plan, progress, input.block, s.short_day);
      } else {
        throw new HttpError(400, "Nothing to advance here.");
      }
      break;
    }
    case "skip": {
      const b = input.block;
      if (b === "wrapup") throw new HttpError(400, "The wrap-up can't be skipped.");
      if (s.skipped_blocks.includes(b)) throw new HttpError(409, "You've already skipped this block today.");
      if (progress.current !== b) throw new HttpError(409, "You can only skip the block you're on.");
      progress = completeBlock(s.plan, progress, b, s.short_day, "skipped");
      extra.skipped_blocks = [...s.skipped_blocks, b];
      break;
    }
    case "short_day": {
      if (s.plan.kind !== "weekday") throw new HttpError(400, "Short day is for weekday sessions.");
      extra.short_day = true;
      if (progress.current !== "finished" && progress.current !== "wrapup" && !SHORT_DAY_BLOCKS.includes(progress.current)) {
        const cur = progress.current;
        progress.blocks[cur]!.status = "pending";
        progress.current = "wrapup";
        progress.blocks.wrapup = { ...(progress.blocks.wrapup ?? { index: 0, correct: 0, answered: 0, ms: 0 }), status: "active" };
      }
      break;
    }
    case "pause": {
      addMs(input.block, input.ms);
      progress.paused_at = new Date().toISOString();
      break;
    }
    case "finish": {
      if (progress.current !== "wrapup") throw new HttpError(409, "Finish the remaining blocks first.");
      progress = completeBlock(s.plan, progress, "wrapup", s.short_day);
      progress.current = "finished";
      extra.status = "completed";
      extra.completed_at = new Date().toISOString();
      break;
    }
  }

  const saved = await saveProgress(db, s, progress, extra);
  if (input.action === "finish") await snapshotVocab(viewer.id, s.local_date);
  return { progress, short_day: extra.short_day ?? s.short_day, status: extra.status ?? s.status, updated_at: saved.updated_at };
}

/** "Continue to full session" after a short day: extends the same session (never a new one). */
async function continueFull(viewer: Viewer, sessionId: string) {
  const admin = createAdminClient();
  const { data } = await admin.from("sessions").select("*").eq("id", sessionId).single();
  const s = data as SessionRow | null;
  if (!s || s.user_id !== viewer.id) throw new HttpError(404, "Session not found.");
  if (s.local_date !== localDate(viewer.timezone)) throw new HttpError(409, "That session has ended.", { code: "stale_session" });
  if (!s.short_day) throw new HttpError(409, "This session is already a full session.");

  const progress: Progress = structuredClone(s.progress);
  // Reopen the first block that was left out by the short day.
  const remaining = s.plan.blocks.filter(
    (b) => b !== "wrapup" && !SHORT_DAY_BLOCKS.includes(b) && !["done", "skipped"].includes(progress.blocks[b]?.status ?? ""),
  );
  const first = remaining[0] ?? "wrapup";
  if (progress.blocks.wrapup) progress.blocks.wrapup.status = first === "wrapup" ? "active" : "pending";
  progress.current = first;
  progress.blocks[first] = { ...(progress.blocks[first] ?? { index: 0, correct: 0, answered: 0, ms: 0 }), status: "active" };
  const { error } = await admin
    .from("sessions")
    .update({ short_day: false, status: "in_progress", completed_at: null, progress })
    .eq("id", s.id);
  if (error) throw new HttpError(500, "Could not reopen the session.");
  return { progress, short_day: false, status: "in_progress" };
}

/** Daily vocabulary state snapshot for the growth chart. */
export async function snapshotVocab(userId: string, date: string) {
  const admin = createAdminClient();
  const { data } = await admin.from("cards").select("state, stability").eq("user_id", userId).eq("item_type", "vocab");
  const counts = { learning: 0, review: 0, mastered: 0 };
  for (const c of data ?? []) counts[vocabState(c as { state: number; stability: number })]++;
  await admin.from("vocab_snapshots").upsert({ user_id: userId, local_date: date, ...counts });
}

export { nextBlock, streakOk, totalMinutes };
