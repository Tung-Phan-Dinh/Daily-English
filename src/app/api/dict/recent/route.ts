import { NextResponse } from "next/server";
import { apiViewer, handle } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

// Recent lookups and recently saved words for the search palette.
export const GET = handle(async () => {
  const viewer = await apiViewer();
  const db = await createClient();
  const [{ data: recent }, { data: saved }] = await Promise.all([
    db.from("lookups").select("query, lemma, created_at, context").eq("user_id", viewer.id).not("lemma", "is", null).order("created_at", { ascending: false }).limit(30),
    db.from("lookups").select("lemma, created_at").eq("user_id", viewer.id).eq("saved", true).order("created_at", { ascending: false }).limit(8),
  ]);
  const seen = new Set<string>();
  const recentLemmas = (recent ?? []).filter((r) => r.lemma && !seen.has(r.lemma) && seen.add(r.lemma)).slice(0, 8).map((r) => r.lemma as string);
  return NextResponse.json({ recent: recentLemmas, saved: [...new Set((saved ?? []).map((s) => s.lemma as string))] });
});
