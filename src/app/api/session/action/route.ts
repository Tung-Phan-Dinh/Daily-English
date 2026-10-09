import { NextResponse } from "next/server";
import { apiViewer, handle, readJson } from "@/lib/auth";
import { sessionAction, type ActionInput } from "@/lib/session/actions";
import { createClient } from "@/lib/supabase/server";

export const POST = handle(async (req: Request) => {
  const viewer = await apiViewer(["learner"]);
  const input = await readJson<ActionInput>(req);
  const db = await createClient();
  return NextResponse.json(await sessionAction(db, viewer, input));
});
