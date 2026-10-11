import { NextResponse } from "next/server";
import { apiViewer, handle, HttpError, readJson } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

// Active-time heartbeat: the session page reports seconds the learner was
// actually active (tab visible + recent input). Capped per call in the database.
export const POST = handle(async (req: Request) => {
  await apiViewer(["learner"]);
  const { session_id, ms } = await readJson<{ session_id: string; ms: number }>(req);
  if (!session_id || !Number.isFinite(ms)) throw new HttpError(400, "Missing session_id or ms.");
  const db = await createClient();
  const { data, error } = await db.rpc("add_session_time", { sid: session_id, ms: Math.round(ms) });
  if (error) throw new HttpError(500, "Could not save time.");
  return NextResponse.json({ active_ms: data });
});
