import type { Metadata } from "next";
import Link from "next/link";
import { requireViewer } from "@/lib/auth";
import { pointStatus, type AttemptLite } from "@/lib/progress-rules";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";
import { Check, Shapes } from "lucide-react";
import { ProgressRing } from "@/components/progress/progress-ring";

export const metadata: Metadata = { title: "Grammar map" };

const PHASES = ["Accuracy core", "Forms", "Complex sentences", "Sentence craft"];
const PHASE_BG = ["bg-periwinkle", "bg-orange", "bg-pink", "bg-lime"];

export default async function GrammarMapPage() {
  const viewer = await requireViewer(["learner"]);
  const db = await createClient();
  const [{ data: points }, { data: attempts }] = await Promise.all([
    db.from("grammar_points").select("id, slug, title, title_vi, phase, error_codes").order("sort"),
    db.from("attempts").select("grammar_point_id, correct, format, local_date").eq("user_id", viewer.id).eq("item_kind", "grammar").order("created_at", { ascending: false }).limit(4000),
  ]);
  const by = new Map<number, AttemptLite[]>();
  for (const a of attempts ?? []) {
    if (!a.grammar_point_id) continue;
    by.set(a.grammar_point_id, [...(by.get(a.grammar_point_id) ?? []), a as AttemptLite]);
  }
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Grammar map</h1>
        <p className="mt-1 text-muted-foreground">24 points in four phases, accuracy first. Mastered = 85% over your last 20 answers, two formats, two days.</p>
      </div>
      {[1, 2, 3, 4].map((ph) => (
        <section key={ph} aria-labelledby={`ph-${ph}`}>
          <h2 id={`ph-${ph}`} className="text-lg font-semibold">
            Phase {ph} · {PHASES[ph - 1]}
          </h2>
          <ul className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {(points ?? []).filter((p) => p.phase === ph).map((p) => {
              const list = by.get(p.id) ?? [];
              const status = pointStatus(list);
              const last = list.slice(0, 20);
              const acc = last.length ? Math.round((last.filter((a) => a.correct).length / last.length) * 100) : null;
              return (
                <li key={p.id}>
                  <Link
                    href={`/grammar/${p.slug}`}
                    className="surface flex h-full min-h-28 items-start gap-4 p-4 transition-shadow hover:ring-2 hover:ring-brand/50"
                  >
                    <ProgressRing
                      value={status === "mastered" ? 1 : acc !== null ? acc / 100 : 0}
                      size={52}
                      stroke={4}
                      label={status === "mastered" ? "Mastered" : acc !== null ? `${acc}% of the last ${last.length}` : "Not started"}
                      className="text-brand"
                      trackClassName="stroke-muted"
                    >
                      <span className={cn("grid size-10 place-items-center rounded-full text-on-accent", PHASE_BG[ph - 1])}>
                        {status === "mastered" ? <Check className="size-4" strokeWidth={3} /> : <Shapes className="size-4" />}
                      </span>
                    </ProgressRing>
                    <span className="min-w-0 flex-1">
                      <span className="block font-semibold">{p.title}</span>
                      <span lang="vi" className="block text-sm text-muted-foreground">{p.title_vi}</span>
                      <span className="mt-2 flex flex-wrap items-center gap-1.5 text-sm">
                        <span
                          className={cn(
                            "rounded-full px-2.5 py-0.5 font-medium",
                            status === "mastered" ? "bg-success-soft text-success" : status === "learning" ? "bg-brand-soft" : "bg-muted text-muted-foreground",
                          )}
                        >
                          {status === "mastered" ? "Mastered" : status === "learning" ? `Learning${acc !== null ? ` · ${acc}%` : ""}` : "Not started"}
                        </span>
                        <span className="text-muted-foreground">{(p.error_codes as string[]).join(" · ")}</span>
                      </span>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}
