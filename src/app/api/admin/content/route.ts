import { NextResponse } from "next/server";
import { apiViewer, handle, HttpError, readJson } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

const TABLES = {
  grammar_item: "grammar_items",
  reading_passage: "reading_passages",
  writing_task: "writing_tasks",
  vocab_item: "vocab_items",
} as const;

// Approval queue: approve or retire generated content (admin RLS policy enforces this too).
export const POST = handle(async (req: Request) => {
  await apiViewer(["admin"]);
  const { kind, ids, status } = await readJson<{ kind: keyof typeof TABLES; ids: string[]; status: "approved" | "retired" }>(req);
  if (!TABLES[kind] || !["approved", "retired"].includes(status) || !ids?.length) throw new HttpError(400, "Invalid request.");
  const db = await createClient();
  const { data, error } = await db.from(TABLES[kind]).update({ status }).in("id", ids.slice(0, 200)).select("id");
  if (error) throw new HttpError(500, error.message);
  return NextResponse.json({ updated: data?.length ?? 0 });
});
