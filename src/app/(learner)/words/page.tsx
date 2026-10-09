import type { Metadata } from "next";
import { requireViewer } from "@/lib/auth";
import { vocabState } from "@/lib/fsrs";
import { createClient } from "@/lib/supabase/server";
import { WordList, type WordRow } from "./word-list";

export const metadata: Metadata = { title: "My words" };

export default async function WordsPage() {
  const viewer = await requireViewer(["learner"]);
  const db = await createClient();
  const { data: cards } = await db
    .from("cards")
    .select("id, item_id, state, stability, due, reps")
    .eq("user_id", viewer.id)
    .eq("item_type", "vocab")
    .limit(5000);
  const ids = (cards ?? []).map((c) => c.item_id);
  const [{ data: items }, { data: topics }] = await Promise.all([
    ids.length
      ? db.from("vocab_items").select("id, lemma, pos, gloss_vi, definition_en, topic_id, source_list").in("id", ids)
      : Promise.resolve({ data: [] as never[] }),
    db.from("topics").select("id, name_en").order("week_order"),
  ]);
  const byId = new Map((items ?? []).map((i) => [i.id, i]));
  const rows: WordRow[] = (cards ?? [])
    .map((c) => {
      const it = byId.get(c.item_id);
      if (!it) return null;
      return {
        id: it.id, lemma: it.lemma, pos: it.pos, gloss_vi: it.gloss_vi, definition_en: it.definition_en,
        topic: topics?.find((t) => t.id === it.topic_id)?.name_en ?? null, source: it.source_list,
        state: c.state === 0 ? "new" : vocabState(c), due: c.due,
      } as WordRow;
    })
    .filter(Boolean) as WordRow[];
  rows.sort((a, b) => a.lemma.localeCompare(b.lemma));
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">My words</h1>
        <p className="mt-1 text-muted-foreground">{rows.length} words in your deck. Each one comes back on its own schedule.</p>
      </div>
      <WordList rows={rows} topics={(topics ?? []).map((t) => t.name_en)} />
    </div>
  );
}
