import { NextResponse } from "next/server";
import { handle } from "@/lib/auth";
import { verifyCron } from "@/lib/cron";
import { snapshotVocab } from "@/lib/session/actions";
import { createAdminClient } from "@/lib/supabase/admin";
import { localDate } from "@/lib/time";
import { gradeSubmission } from "@/lib/writing/grade";

export const maxDuration = 300;

// Daily: keeps the free Supabase project awake, expires unfinished sessions,
// grades writing that was queued while OpenAI was unavailable, snapshots vocab.
export const GET = handle(async (req: Request) => {
  verifyCron(req);
  const admin = createAdminClient();
  const { data: learners } = await admin.from("profiles").select("id, timezone").eq("role", "learner");
  const out: Record<string, unknown> = { learners: learners?.length ?? 0 };

  for (const l of learners ?? []) {
    const today = localDate(l.timezone);
    await admin.from("sessions").update({ status: "partial" }).eq("user_id", l.id).eq("status", "in_progress").lt("local_date", today);
    await snapshotVocab(l.id, today);
  }

  const { data: queued } = await admin
    .from("writing_submissions")
    .select("id")
    .eq("status", "pending")
    .lt("created_at", new Date(Date.now() - 5 * 60_000).toISOString())
    .limit(5);
  const graded: string[] = [];
  for (const q of queued ?? []) {
    try {
      await gradeSubmission(q.id);
      graded.push(q.id);
    } catch (e) {
      console.error("queued grading failed", q.id, e);
    }
  }
  out.graded = graded.length;
  return NextResponse.json(out);
});
