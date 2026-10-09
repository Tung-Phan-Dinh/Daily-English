import { NextResponse } from "next/server";
import { apiViewer, handle, HttpError, readJson } from "@/lib/auth";
import { checkGrammarExact, displayAnswer, type GrammarItem } from "@/lib/session/check";
import { createClient } from "@/lib/supabase/server";

// Grammar-map practice: self-check only. Nothing is written, so it never
// changes scheduling or scores (and it can't create a second session).
export const POST = handle(async (req: Request) => {
  await apiViewer(["learner"]);
  const { item_id, response } = await readJson<{ item_id: string; response: string }>(req);
  const db = await createClient();
  const { data: item } = await db.from("grammar_items").select("*").eq("id", item_id).maybeSingle();
  if (!item) throw new HttpError(404, "Item not found.");
  const g = item as GrammarItem;
  const { correct } = checkGrammarExact(g, response ?? "");
  return NextResponse.json({
    correct,
    correct_answer: displayAnswer(g),
    explanation_en: g.explanation_en,
    explanation_vi: g.explanation_vi,
    trap_note_vi: g.trap_note_vi,
    error_code: g.error_code,
    checked_by: "exact",
    progress: null,
  });
});
