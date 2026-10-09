import { NextResponse } from "next/server";
import { apiViewer, handle, HttpError, readJson } from "@/lib/auth";
import { AiUnavailableError } from "@/lib/ai/client";
import { aiCheckRewrite } from "@/lib/ai/services";
import { XP } from "@/lib/curriculum";
import { loadOpenSession, saveProgress } from "@/lib/session/answer";
import { publicSubmission } from "@/lib/session/hydrate";
import { completeBlock } from "@/lib/session/progress";
import type { Progress, SessionRow } from "@/lib/session/types";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { ProcessedFeedback } from "@/lib/writing/grade";

export const maxDuration = 60;

/** Rewrite step: one hint after the first miss, then the block closes. */
export const POST = handle(async (req: Request) => {
  const viewer = await apiViewer(["learner"]);
  const { submission_id, text } = await readJson<{ submission_id: string; text: string }>(req);
  const admin = createAdminClient();
  const { data: sub } = await admin.from("writing_submissions").select("*").eq("id", submission_id).single();
  if (!sub || sub.user_id !== viewer.id) throw new HttpError(404, "Writing not found.");
  if (sub.status !== "graded") throw new HttpError(409, "Feedback isn't ready yet.");
  if (sub.rewrite_ok === true || sub.rewrite_attempts >= 2) throw new HttpError(409, "The rewrite is already done.");
  const rewrite = (text ?? "").trim();
  if (!rewrite) throw new HttpError(400, "Type your rewritten sentence first.");

  const db = await createClient();
  const s = (await loadOpenSession(db, viewer, sub.session_id)) as SessionRow & { updated_at: string };
  if (s.progress.current !== "writing") throw new HttpError(409, "The writing block is already finished.");

  const fb = sub.feedback as ProcessedFeedback;
  const original = sub.text.slice(fb.rewrite_sentence.start, fb.rewrite_sentence.end);
  const err = fb.rewrite_error;
  let fixed = false;
  let hint_en = "";
  let hint_vi = "";
  let checked = true;
  try {
    const r = await aiCheckRewrite({
      original,
      error: err ? `${err.code}: "${err.original}" → "${err.correction}". ${err.explain_en}` : "general accuracy",
      rewrite,
      userId: viewer.id,
    });
    fixed = r.fixed;
    hint_en = r.hint_en;
    hint_vi = r.hint_vi;
  } catch (e) {
    if (!(e instanceof AiUnavailableError)) throw e;
    // Without AI we can't judge; accept the attempt so he isn't blocked.
    checked = false;
    fixed = true;
  }

  const attempts = sub.rewrite_attempts + 1;
  const done = fixed || attempts >= 2;
  const { data: updated } = await admin
    .from("writing_submissions")
    .update({ rewrite_text: rewrite, rewrite_attempts: attempts, rewrite_ok: checked ? fixed : null })
    .eq("id", sub.id)
    .select("*")
    .single();

  let progress: Progress = s.progress;
  if (done) {
    progress = structuredClone(s.progress);
    if (fixed && checked) progress.xp += XP.rewrite;
    progress = completeBlock(s.plan, progress, "writing", s.short_day);
    await saveProgress(db, s, progress);
  }

  return NextResponse.json({
    fixed,
    checked,
    done,
    hint_en: done ? "" : hint_en,
    hint_vi: done ? "" : hint_vi,
    correction: done && !fixed ? correctedSentence(sub.text, fb) : null,
    submission: publicSubmission({ ...updated, rewrite_ok: checked ? fixed : true }),
    progress,
  });
});

/** The flagged sentence with its most serious error corrected (shown after the second miss). */
function correctedSentence(text: string, fb: ProcessedFeedback): string | null {
  const rs = fb.rewrite_sentence;
  const e = fb.errors.find((x) => x.start >= rs.start && x.end <= rs.end && x.original === fb.rewrite_error?.original);
  if (!e) return null;
  return (text.slice(rs.start, e.start) + e.correction + text.slice(e.end, rs.end)).trim();
}
