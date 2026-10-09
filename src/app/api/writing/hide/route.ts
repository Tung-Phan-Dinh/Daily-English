import { NextResponse } from "next/server";
import { apiViewer, handle, HttpError, readJson } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

// The learner can hide a piece from viewers; it still counts in metrics.
export const POST = handle(async (req: Request) => {
  const viewer = await apiViewer(["learner"]);
  const { submission_id, hidden } = await readJson<{ submission_id: string; hidden: boolean }>(req);
  const db = await createClient();
  const { data, error } = await db
    .from("writing_submissions")
    .update({ hidden_from_viewers: Boolean(hidden) })
    .eq("id", submission_id)
    .eq("user_id", viewer.id)
    .select("id, hidden_from_viewers");
  if (error || !data?.length) throw new HttpError(404, "Writing not found.");
  return NextResponse.json(data[0]);
});
