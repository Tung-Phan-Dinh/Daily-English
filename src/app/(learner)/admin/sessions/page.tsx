import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, ChevronRight, PenLine } from "lucide-react";
import { getLinkedLearner, requireViewer } from "@/lib/auth";
import type { Progress } from "@/lib/session/types";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Sessions" };

const STATUS: Record<string, { label: string; cls: string }> = {
  completed: { label: "Completed", cls: "bg-success-soft text-success" },
  in_progress: { label: "In progress", cls: "bg-brand-soft" },
  partial: { label: "Unfinished", cls: "bg-streak-soft text-streak" },
};

export default async function SessionsPage() {
  const viewer = await requireViewer(["admin"]);
  const db = await createClient();
  const learner = await getLinkedLearner(viewer);
  const { data: sessions } = learner
    ? await db.from("sessions").select("id, local_date, kind, status, minutes, xp, short_day, skipped_blocks, progress").eq("user_id", learner.id).order("local_date", { ascending: false }).limit(200)
    : { data: [] };
  const ids = (sessions ?? []).map((s) => s.id);
  const { data: writing } = ids.length
    ? await db.from("writing_submissions").select("session_id, status, band_gra, band_lr, teacher_bands, word_count").in("session_id", ids)
    : { data: [] };
  const bySession = new Map((writing ?? []).map((w) => [w.session_id, w]));

  return (
    <div className="space-y-6">
      <Link href="/admin" className="inline-flex min-h-11 items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" aria-hidden /> Admin
      </Link>
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Sessions</h1>
        <p className="mt-1 text-muted-foreground">
          {learner ? `Every day ${learner.display_name} practised. Open one to see each answer and grade the writing yourself.` : "No learner account yet."}
        </p>
      </div>
      {(sessions ?? []).length === 0 ? (
        <p className="surface p-6 text-muted-foreground">No sessions yet.</p>
      ) : (
        <ul className="space-y-2.5">
          {(sessions ?? []).map((s) => {
            const p = s.progress as Progress;
            const g = p.blocks?.grammar;
            const r = p.blocks?.reading;
            const w = bySession.get(s.id);
            const st = STATUS[s.status] ?? STATUS.partial;
            const teacher = w?.teacher_bands as { gra?: number; lr?: number } | null;
            return (
              <li key={s.id}>
                <Link href={`/admin/sessions/${s.id}`} className="surface flex min-h-18 flex-wrap items-center gap-x-4 gap-y-2 px-5 py-3 transition-shadow hover:ring-2 hover:ring-brand/50">
                  <span className="min-w-36">
                    <span className="block font-semibold">
                      {new Date(s.local_date + "T00:00:00Z").toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" })}
                    </span>
                    <span className="text-sm text-muted-foreground capitalize">{s.kind}{s.short_day ? " · short day" : ""}</span>
                  </span>
                  <span className={cn("rounded-full px-2.5 py-0.5 text-sm font-medium", st.cls)}>{st.label}</span>
                  <span className="text-sm text-muted-foreground tabular-nums">{s.minutes} min · {s.xp} XP</span>
                  {g?.answered ? <span className="text-sm tabular-nums">Grammar {g.correct}/{g.answered}</span> : null}
                  {r?.answered ? <span className="text-sm tabular-nums">Reading {r.correct}/{r.answered}</span> : null}
                  <span className="ml-auto flex items-center gap-2 text-sm">
                    {w ? (
                      teacher ? (
                        <span className="rounded-full bg-success-soft px-2.5 py-0.5 font-medium text-success">Graded by you · {teacher.gra}/{teacher.lr}</span>
                      ) : (
                        <span className="flex items-center gap-1 rounded-full bg-orange px-2.5 py-0.5 font-medium text-on-accent">
                          <PenLine className="size-3.5" aria-hidden />
                          {w.status === "graded" ? `AI ${Number(w.band_gra).toFixed(1)}/${Number(w.band_lr).toFixed(1)} · not graded by you` : "Writing waiting for a grade"}
                        </span>
                      )
                    ) : (
                      <span className="text-muted-foreground">No writing</span>
                    )}
                    <ChevronRight className="size-4 text-muted-foreground" aria-hidden />
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
