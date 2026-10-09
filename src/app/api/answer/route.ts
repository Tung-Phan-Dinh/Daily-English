import { NextResponse } from "next/server";
import { apiViewer, handle, HttpError, readJson } from "@/lib/auth";
import { submitAnswer, type AnswerInput } from "@/lib/session/answer";
import { createClient } from "@/lib/supabase/server";

// Accepted only with today's in-progress session_id (checked in submitAnswer
// and again by RLS on attempts/review_logs).
export const POST = handle(async (req: Request) => {
  const viewer = await apiViewer(["learner"]);
  const input = await readJson<AnswerInput>(req);
  if (!input.session_id || !input.block || !input.ref || typeof input.response !== "string") {
    throw new HttpError(400, "Missing answer fields.");
  }
  const db = await createClient();
  return NextResponse.json(await submitAnswer(db, viewer, input));
});
