import { NextResponse } from "next/server";
import { apiViewer, handle, HttpError, readJson } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { addDays, dayStart, localDate } from "@/lib/time";

// "+ Save to my words": a new FSRS card that joins tomorrow's queue.
// Allowed after finishing the session too (it doesn't change today's scores).
export const POST = handle(async (req: Request) => {
  const viewer = await apiViewer(["learner"]);
  const { lemma, lookup_id } = await readJson<{ lemma: string; lookup_id?: number | null }>(req);
  const word = (lemma ?? "").trim();
  if (!word) throw new HttpError(400, "Nothing to save.");
  const db = await createClient();
  const admin = createAdminClient();

  // Reuse a shared vocab item when one exists; otherwise create a personal one from the dictionary.
  let { data: item } = await db.from("vocab_items").select("id").ilike("lemma", word).order("owner_id", { nullsFirst: true }).limit(1).maybeSingle();
  if (!item) {
    const { data: entry } = await db.from("dictionary_entries").select("*").ilike("lemma", word).limit(1).maybeSingle();
    if (!entry) throw new HttpError(404, "Look the word up first, then save it.");
    const { data: created, error } = await admin
      .from("vocab_items")
      .insert({
        entry_id: entry.id, lemma: entry.lemma, pos: entry.pos, ipa: entry.ipa,
        definition_en: entry.definition_en || "(no definition yet)", gloss_vi: (entry.gloss_vi as string[]).join(", "),
        word_family: entry.word_family, collocations: entry.collocations, examples: entry.examples as string[],
        source_list: "personal", owner_id: viewer.id,
      })
      .select("id")
      .single();
    if (error) throw new HttpError(500, "Could not save the word.");
    item = created;
  }
  const tomorrow = dayStart(viewer.timezone, addDays(localDate(viewer.timezone), 1)).toISOString();
  const { error } = await db.from("cards").upsert(
    { user_id: viewer.id, item_type: "vocab", item_id: item!.id, due: tomorrow, state: 0 },
    { onConflict: "user_id,item_type,item_id", ignoreDuplicates: true },
  );
  if (error) throw new HttpError(500, "Could not add the card.");
  if (lookup_id) await db.from("lookups").update({ saved: true }).eq("id", lookup_id).eq("user_id", viewer.id);
  return NextResponse.json({ saved: true, due: tomorrow });
});
