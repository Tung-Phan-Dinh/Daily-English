import { NextResponse } from "next/server";
import { apiViewer, handle } from "@/lib/auth";
import { enrichEntry, fallbackEntry, searchDictionary } from "@/lib/dict/service";
import { createClient } from "@/lib/supabase/server";
import { localDate } from "@/lib/time";

// GET /api/dict?q=word[&mode=auto|en|vi][&log=1&ctx={"block":"reading","item":"..."}]
// Lemma or Vietnamese lookup; AI fallback only for single missing English words.
export const GET = handle(async (req: Request) => {
  const viewer = await apiViewer();
  const url = new URL(req.url);
  const q = (url.searchParams.get("q") ?? "").trim();
  const mode = (url.searchParams.get("mode") ?? "auto") as "auto" | "en" | "vi";
  const log = url.searchParams.get("log") === "1";
  if (!q) return NextResponse.json({ entries: [] });
  const db = await createClient();

  let entries = await searchDictionary(db, q, mode);
  if (entries.length === 0 && log && mode !== "vi") {
    const fb = await fallbackEntry(q, viewer.id);
    if (fb) entries = [fb];
  } else if (log && entries[0] && !entries[0].definition_en) {
    // Opened in the popover: add a missing English definition (free, cached).
    entries = [await enrichEntry(entries[0], viewer.id), ...entries.slice(1)];
  }

  let lookup_id: number | null = null;
  let in_deck = false;
  if (entries[0]) {
    const lemma = entries[0].lemma;
    const { data: items } = await db.from("vocab_items").select("id").ilike("lemma", lemma).limit(5);
    if (items?.length) {
      const { count } = await db
        .from("cards")
        .select("id", { count: "exact", head: true })
        .eq("user_id", viewer.id)
        .in("item_id", items.map((i) => i.id));
      in_deck = (count ?? 0) > 0;
    }
  }
  if (log && viewer.role === "learner") {
    let ctx: Record<string, unknown> = {};
    try {
      ctx = JSON.parse(url.searchParams.get("ctx") ?? "{}");
    } catch {}
    const { data } = await db
      .from("lookups")
      .insert({ user_id: viewer.id, query: q.slice(0, 80), lemma: entries[0]?.lemma ?? null, context: ctx, local_date: localDate(viewer.timezone) })
      .select("id")
      .single();
    lookup_id = data?.id ?? null;
  }
  return NextResponse.json({ entries, lookup_id, in_deck });
});
