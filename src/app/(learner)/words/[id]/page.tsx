import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requireViewer } from "@/lib/auth";
import { stageFor, vocabState } from "@/lib/fsrs";
import { createClient } from "@/lib/supabase/server";
import { WordDetail } from "./word-detail";

export const metadata: Metadata = { title: "Word" };

const EXERCISE_NAMES: Record<string, string> = {
  meaning_mcq: "Pick the meaning", type_word: "Type the word", collocation: "Collocation", word_form: "Word form",
  cloze: "Complete the sentence", own_sentence: "Own sentence", grammar: "Grammar",
};
const RATING = ["", "Again", "Hard", "Good", "Easy"];

export default async function WordPage({ params }: { params: Promise<{ id: string }> }) {
  const viewer = await requireViewer(["learner"]);
  const { id } = await params;
  const db = await createClient();
  const [{ data: item }, { data: card }] = await Promise.all([
    db.from("vocab_items").select("*").eq("id", id).maybeSingle(),
    db.from("cards").select("*").eq("user_id", viewer.id).eq("item_type", "vocab").eq("item_id", id).maybeSingle(),
  ]);
  if (!item) notFound();
  const { data: logs } = card
    ? await db.from("review_logs").select("created_at, exercise_type, correct, rating, duration_ms").eq("card_id", card.id).order("created_at", { ascending: false })
    : { data: [] };
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <Link href="/words" className="inline-flex min-h-11 items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" aria-hidden /> My words
      </Link>
      <WordDetail word={item} accent={viewer.settings.accent} />
      {card && (
        <section className="surface p-5" aria-labelledby="sched-h">
          <h2 id="sched-h" className="font-semibold">Schedule</h2>
          <dl className="mt-2 grid grid-cols-2 gap-3 text-base sm:grid-cols-4">
            <div><dt className="text-sm text-muted-foreground">State</dt><dd className="capitalize">{card.state === 0 ? "new" : vocabState(card)}</dd></div>
            <div><dt className="text-sm text-muted-foreground">Exercise stage</dt><dd>{stageFor(card)} of 5</dd></div>
            <div><dt className="text-sm text-muted-foreground">Memory strength</dt><dd>{card.stability.toFixed(1)} days</dd></div>
            <div><dt className="text-sm text-muted-foreground">Next review</dt><dd>{new Date(card.due).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}</dd></div>
          </dl>
        </section>
      )}
      <section className="surface p-5" aria-labelledby="hist-h">
        <h2 id="hist-h" className="font-semibold">Exercises you&apos;ve done</h2>
        {logs?.length ? (
          <ul className="mt-2 divide-y">
            {logs.map((l, i) => (
              <li key={i} className="flex flex-wrap items-center gap-x-3 py-2 text-base">
                <span className="w-24 text-sm text-muted-foreground">{new Date(l.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}</span>
                <span className="flex-1">{EXERCISE_NAMES[l.exercise_type] ?? l.exercise_type}</span>
                <span className={l.correct ? "text-success" : "text-error"}>{l.correct ? "✓ Right" : "✗ Missed"}</span>
                <span className="w-14 text-right text-sm text-muted-foreground">{RATING[l.rating]}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-muted-foreground">No reviews yet — this word will come back soon.</p>
        )}
      </section>
    </div>
  );
}
