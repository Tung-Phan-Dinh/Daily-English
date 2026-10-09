import { NextResponse } from "next/server";
import { apiViewer, handle, readJson } from "@/lib/auth";
import { submitReading } from "@/lib/session/actions";
import { hydrateSession } from "@/lib/session/hydrate";
import { createClient } from "@/lib/supabase/server";
import type { SessionRow } from "@/lib/session/types";

export const POST = handle(async (req: Request) => {
  const viewer = await apiViewer(["learner"]);
  const input = await readJson<{ session_id: string; answers: Record<string, string>; reading_ms: number; tapped_words?: string[] }>(req);
  const db = await createClient();
  const result = await submitReading(db, viewer, input);
  const { data } = await db.from("sessions").select("*").eq("id", input.session_id).single();
  const payload = await hydrateSession(db, data as SessionRow);
  return NextResponse.json({ ...result, reading: payload.reading });
});
