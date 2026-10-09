import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requireViewer } from "@/lib/auth";
import { instructionFor, publicGrammarItem, type GrammarItem } from "@/lib/session/check";
import { seededRandom, shuffle } from "@/lib/session/plan";
import { todaysSession } from "@/lib/session/builder";
import { createClient } from "@/lib/supabase/server";
import { localDate } from "@/lib/time";
import { Practice } from "./practice";

export const metadata: Metadata = { title: "Grammar point" };

export default async function GrammarPointPage({ params }: { params: Promise<{ slug: string }> }) {
  const viewer = await requireViewer(["learner"]);
  const { slug } = await params;
  const db = await createClient();
  const { data: point } = await db.from("grammar_points").select("*").eq("slug", slug).maybeSingle();
  if (!point) notFound();
  const today = localDate(viewer.timezone);
  const [{ data: items }, session] = await Promise.all([
    db.from("grammar_items").select("*").eq("grammar_point_id", point.id).is("owner_id", null).neq("status", "retired"),
    todaysSession(db, viewer.id, today),
  ]);
  const doneToday = Boolean(session && session.status !== "in_progress");
  const practice = shuffle((items ?? []) as GrammarItem[], seededRandom(`${slug}:${today}`))
    .slice(0, 10)
    .map((i) => ({ ...publicGrammarItem(i), instruction: instructionFor(i) }));
  const examples = point.examples as { en: string; vi: string }[];
  const trap = point.trap as { wrong: string; right: string; note_vi: string };

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <Link href="/grammar" className="inline-flex min-h-11 items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" aria-hidden /> Grammar map
      </Link>
      <article className="surface p-6" aria-labelledby="gp-h">
        <p className="text-sm font-medium text-brand">Phase {point.phase} · {(point.error_codes as string[]).join(", ")}</p>
        <h1 id="gp-h" className="mt-1 text-2xl font-semibold">{point.title}</h1>
        <p lang="vi" className="text-muted-foreground">{point.title_vi}</p>
        <p className="mt-4 text-lg leading-relaxed">{point.rule_en}</p>
        <details className="mt-2">
          <summary className="min-h-11 cursor-pointer content-center text-sm font-medium text-brand">Tiếng Việt</summary>
          <p lang="vi" className="text-lg leading-relaxed">{point.rule_vi}</p>
        </details>
        <h2 className="mt-4 text-sm font-medium tracking-wide text-muted-foreground uppercase">Examples</h2>
        <ul className="mt-2 space-y-2">
          {examples.map((e) => (
            <li key={e.en} className="border-l-2 border-brand/40 pl-3">
              <p className="text-lg">{e.en}</p>
              <p lang="vi" className="text-muted-foreground">{e.vi}</p>
            </li>
          ))}
        </ul>
        <h2 className="mt-4 text-sm font-medium tracking-wide text-muted-foreground uppercase">Vietnamese trap</h2>
        <p className="mt-2 text-base"><span className="font-semibold text-error">✗</span> <s>{trap.wrong}</s> → <span className="font-semibold text-success">✓</span> {trap.right}</p>
        <p lang="vi" className="text-muted-foreground">{trap.note_vi}</p>
      </article>
      {doneToday ? (
        <p className="surface p-4 text-muted-foreground">You&apos;re done for today — practice opens again with tomorrow&apos;s session. The rule card stays available.</p>
      ) : practice.length ? (
        <Practice items={practice} explainLang={viewer.settings.explain_lang} />
      ) : (
        <p className="surface p-4 text-muted-foreground">No practice items for this point yet.</p>
      )}
    </div>
  );
}
