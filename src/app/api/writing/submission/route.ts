import { NextResponse } from "next/server";
import { apiViewer, handle, HttpError } from "@/lib/auth";
import { publicSubmission } from "@/lib/session/hydrate";
import { createClient } from "@/lib/supabase/server";

// Poll a submission (used when the page was reloaded while feedback was being prepared).
export const GET = handle(async (req: Request) => {
  await apiViewer(["learner"]);
  const sessionId = new URL(req.url).searchParams.get("session_id");
  if (!sessionId) throw new HttpError(400, "Missing session_id.");
  const db = await createClient();
  const { data } = await db.from("writing_submissions").select("*").eq("session_id", sessionId).maybeSingle();
  return NextResponse.json({ submission: data ? publicSubmission(data) : null });
});
