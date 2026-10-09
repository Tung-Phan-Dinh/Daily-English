import { NextResponse } from "next/server";
import { apiViewer, handle, HttpError, readJson } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { localDate } from "@/lib/time";

// Admin override (bugs only): deletes today's session so it can be rebuilt. Every reset is logged.
export const POST = handle(async (req: Request) => {
  const me = await apiViewer(["admin"]);
  const { learner_id, reason } = await readJson<{ learner_id: string; reason: string }>(req);
  if (!reason || reason.trim().length < 5) throw new HttpError(400, "Give a short reason (it is logged).");
  const admin = createAdminClient();
  const { data: learner } = await admin.from("profiles").select("id, timezone, role").eq("id", learner_id).single();
  if (!learner || learner.role !== "learner") throw new HttpError(404, "Learner not found.");
  const today = localDate(learner.timezone);
  const { data: session } = await admin.from("sessions").select("*").eq("user_id", learner_id).eq("local_date", today).maybeSingle();
  if (!session) throw new HttpError(404, "There is no session today to reset.");
  await admin.from("session_resets").insert({
    learner_id, local_date: today, reset_by: me.id, reason: reason.trim().slice(0, 500), snapshot: session,
  });
  await admin.from("writing_submissions").delete().eq("session_id", session.id);
  await admin.from("sessions").delete().eq("id", session.id);
  return NextResponse.json({ ok: true, local_date: today });
});
