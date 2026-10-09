import { NextResponse } from "next/server";
import { apiViewer, handle, readJson } from "@/lib/auth";
import { getOrStartSession } from "@/lib/session/builder";
import { hydrateSession } from "@/lib/session/hydrate";
import { createClient } from "@/lib/supabase/server";

// Returns today's session (resume), builds it if none exists, or reports
// done_for_today. The day is computed on the server from the stored time zone.
export const POST = handle(async (req: Request) => {
  const viewer = await apiViewer(["learner"]);
  const body = await readJson<{ short_day?: boolean }>(req).catch(() => ({}) as { short_day?: boolean });
  const db = await createClient();
  const result = await getOrStartSession(db, viewer, { shortDay: body.short_day });
  if (result.status === "done_for_today") {
    return NextResponse.json({
      status: "done_for_today",
      next_start: result.next_start,
      tomorrow_topic: result.tomorrow_topic,
      session: { id: result.session.id, status: result.session.status, xp: result.session.xp, short_day: result.session.short_day },
    });
  }
  return NextResponse.json({ status: result.status, payload: await hydrateSession(db, result.session) });
});
