import { NextResponse } from "next/server";
import { apiViewer, handle, HttpError, readJson } from "@/lib/auth";
import { AiUnavailableError } from "@/lib/ai/client";
import { aiWhy } from "@/lib/ai/services";
import type { GrammarItem } from "@/lib/session/check";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

// "Why?": a longer explanation with two more examples, cached per item.
export const POST = handle(async (req: Request) => {
  const viewer = await apiViewer();
  const { item_id } = await readJson<{ item_id: string }>(req);
  const db = await createClient();
  const { data: item } = await db.from("grammar_items").select("*").eq("id", item_id).maybeSingle();
  if (!item) throw new HttpError(404, "Item not found.");
  if (item.why_cache) return NextResponse.json({ ...item.why_cache, cached: true });
  try {
    const why = await aiWhy(item as GrammarItem, viewer.id);
    await createAdminClient().from("grammar_items").update({ why_cache: why }).eq("id", item_id);
    return NextResponse.json({ ...why, cached: false });
  } catch (e) {
    if (e instanceof AiUnavailableError) throw new HttpError(503, e.message);
    throw e;
  }
});
