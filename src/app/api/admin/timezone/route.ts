import { NextResponse } from "next/server";
import { apiViewer, handle, HttpError, readJson } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

// Only the admin can change a learner's time zone (it moves the day boundary).
export const POST = handle(async (req: Request) => {
  await apiViewer(["admin"]);
  const { user_id, timezone } = await readJson<{ user_id: string; timezone: string }>(req);
  try {
    new Intl.DateTimeFormat("en", { timeZone: timezone });
  } catch {
    throw new HttpError(400, "Unknown time zone.");
  }
  const { error } = await createAdminClient().from("profiles").update({ timezone }).eq("id", user_id);
  if (error) throw new HttpError(500, error.message);
  return NextResponse.json({ ok: true });
});
