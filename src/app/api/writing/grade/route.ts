import { NextResponse } from "next/server";
import { apiViewer, handle, HttpError, readJson } from "@/lib/auth";
import { AiUnavailableError } from "@/lib/ai/client";
import { XP } from "@/lib/curriculum";
import { countWords } from "@/lib/normalize";
import { weakestCodes } from "@/lib/progress-rules";
import { loadOpenSession, saveProgress } from "@/lib/session/answer";
import { loadWriting, publicSubmission } from "@/lib/session/hydrate";
import type { Progress, SessionRow } from "@/lib/session/types";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { gradeSubmission, type WritingContext } from "@/lib/writing/grade";

export const maxDuration = 120;

/**
 * One writing submission per day (writing_submissions.session_id is unique).
 * Streams NDJSON: progress stages while the grader works, then the feedback.
 * If OpenAI is unavailable the text is saved and graded later by the daily cron.
 */
export const POST = handle(async (req: Request) => {
  const viewer = await apiViewer(["learner"]);
  const { session_id, text } = await readJson<{ session_id: string; text: string }>(req);
  const db = await createClient();
  const s = (await loadOpenSession(db, viewer, session_id)) as SessionRow & { updated_at: string };
  if (s.progress.current !== "writing") throw new HttpError(409, "The writing block isn't open.", { code: "wrong_block" });

  const writing = await loadWriting(db, s);
  if (!writing) throw new HttpError(404, "No writing task today.");
  if (writing.submission) throw new HttpError(409, "You've already submitted today's writing.", { code: "already_submitted" });

  const clean = (text ?? "").replace(/\r\n/g, "\n").trim();
  const words = countWords(clean);
  if (words < Math.min(20, writing.task.min_words)) throw new HttpError(400, `Write at least ${Math.min(20, writing.task.min_words)} words first.`);
  if (words > writing.task.max_words * 1.6) throw new HttpError(400, `That's too long — keep it under ${writing.task.max_words} words.`);

  const admin = createAdminClient();
  const [{ data: weak }, { data: phrases }] = await Promise.all([
    admin.from("weakness").select("error_code, score").eq("user_id", viewer.id),
    admin.from("lookups").select("query, context").eq("user_id", viewer.id).eq("local_date", s.local_date).eq("context->>kind", "phrase"),
  ]);
  const context: WritingContext = {
    task_prompt: writing.task.prompt,
    task_type: writing.task.type,
    target_words: writing.target_words,
    grammar_point: writing.task.grammar_point,
    weak_codes: weakestCodes((weak ?? []) as { error_code: string; score: number }[], 5),
  };
  const { data: sub, error } = await admin
    .from("writing_submissions")
    .insert({
      user_id: viewer.id, session_id: s.id, task_id: writing.task.id, text: clean, word_count: words, status: "pending",
      context, local_date: s.local_date, assisted_phrases: (phrases ?? []).map((p) => p.query),
    })
    .select("*")
    .single();
  if (error || !sub) {
    if (error?.code === "23505") throw new HttpError(409, "You've already submitted today's writing.", { code: "already_submitted" });
    throw new HttpError(500, "Could not save your writing.");
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      // If the browser disconnects, keep grading: the result is stored and shown on resume.
      let open = true;
      const send = (obj: unknown) => {
        if (!open) return;
        try {
          controller.enqueue(encoder.encode(JSON.stringify(obj) + "\n"));
        } catch {
          open = false;
        }
      };
      send({ type: "progress", stage: "saved" });
      const seen = new Set<string>();
      const stageFor = (t: string) => {
        if (!seen.has("grammar") && t.includes('"errors"')) return "grammar";
        if (!seen.has("vocabulary") && t.includes('"upgrades"')) return "vocabulary";
        if (!seen.has("tips") && t.includes('"model_version"')) return "tips";
        return null;
      };
      let stage: "feedback" | "queued" = "queued";
      try {
        const graded = await gradeSubmission(sub.id, (t) => {
          const st = stageFor(t);
          if (st) {
            seen.add(st);
            send({ type: "progress", stage: st });
          }
        });
        stage = "feedback";
        send({ type: "feedback", submission: publicSubmission(graded) });
      } catch (err) {
        const message =
          err instanceof AiUnavailableError
            ? `${err.message} Your paragraph is saved and will be checked automatically later.`
            : "Feedback isn't available right now. Your paragraph is saved and will be checked automatically later.";
        send({ type: "queued", message, submission: publicSubmission(sub) });
      }
      // Record the outcome in the session (reload to get the latest lock version).
      try {
        const { data: fresh } = await db.from("sessions").select("*").eq("id", s.id).single();
        if (fresh) {
          const progress: Progress = structuredClone((fresh as SessionRow).progress);
          const bp = progress.blocks.writing!;
          bp.data = { ...(bp.data ?? {}), submission_id: sub.id, stage };
          bp.answered = 1;
          if (stage === "feedback") progress.xp += XP.writing;
          await saveProgress(db, fresh as SessionRow & { updated_at: string }, progress);
        }
      } catch (e) {
        console.error("writing progress save", e);
      }
      try {
        controller.close();
      } catch {}
    },
  });

  return new NextResponse(stream, {
    headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-store" },
  });
});
