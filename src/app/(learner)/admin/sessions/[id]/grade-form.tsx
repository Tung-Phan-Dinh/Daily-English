"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type Bands = { gra?: number; lr?: number; tr?: number | null; cc?: number | null };
const OPTIONS = Array.from({ length: 13 }, (_, i) => 3 + i * 0.5); // 3.0 … 9.0

/** Your own grade for this piece. It replaces the AI estimate for him, the family and the charts. */
export function GradeForm({
  submissionId, essay, initial, aiBands,
}: {
  submissionId: string;
  essay: boolean;
  initial: { bands: Bands | null; comment: string; gradedAt: string | null };
  aiBands: { gra: number | null; lr: number | null; tr: number | null; cc: number | null } | null;
}) {
  const router = useRouter();
  const start = initial.bands ?? { gra: aiBands?.gra ?? undefined, lr: aiBands?.lr ?? undefined, tr: aiBands?.tr ?? null, cc: aiBands?.cc ?? null };
  const [bands, setBands] = useState<Bands>(start);
  const [comment, setComment] = useState(initial.comment);
  const [state, setState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [error, setError] = useState("");
  const [gradedAt, setGradedAt] = useState(initial.gradedAt);

  async function send(body: Record<string, unknown>) {
    setState("saving");
    const res = await fetch("/api/admin/grade", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ submission_id: submissionId, ...body }) });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) {
      setState("error");
      setError(d.error ?? "Couldn't save.");
      return;
    }
    setGradedAt(d.teacher_graded_at ?? null);
    setState("saved");
    router.refresh();
  }

  const fields: { key: keyof Bands; label: string; required: boolean }[] = [
    { key: "gra", label: "Grammar (GRA)", required: true },
    { key: "lr", label: "Vocabulary (LR)", required: true },
    ...(essay
      ? [
          { key: "tr" as const, label: "Task response (TR)", required: false },
          { key: "cc" as const, label: "Coherence (CC)", required: false },
        ]
      : []),
  ];

  return (
    <form
      className="space-y-4 rounded-3xl bg-brand-soft p-5"
      onSubmit={(e) => {
        e.preventDefault();
        send({ bands, comment });
      }}
    >
      <div>
        <h3 className="font-semibold">Your grade</h3>
        <p className="text-sm text-muted-foreground">
          {gradedAt
            ? `Saved ${new Date(gradedAt).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}. He and the family see your grade instead of the AI estimate.`
            : "Starts from the AI estimate. Saving shows your grade to him and the family instead."}
        </p>
      </div>
      <div className="grid grid-cols-2 gap-3">
        {fields.map((f) => (
          <div key={f.key}>
            <Label htmlFor={`band-${f.key}`}>{f.label}</Label>
            <select
              id={`band-${f.key}`}
              required={f.required}
              className="mt-1 h-12 w-full rounded-2xl border border-input bg-card px-3 text-base"
              value={bands[f.key] ?? ""}
              onChange={(e) => {
                setBands((b) => ({ ...b, [f.key]: e.target.value === "" ? null : Number(e.target.value) }));
                setState("idle");
              }}
            >
              <option value="">{f.required ? "Choose…" : "—"}</option>
              {OPTIONS.map((o) => (
                <option key={o} value={o}>{o.toFixed(1)}</option>
              ))}
            </select>
          </div>
        ))}
      </div>
      <div>
        <Label htmlFor="teacher-comment">Comment for him (optional)</Label>
        <Textarea
          id="teacher-comment"
          rows={5}
          className="mt-1"
          value={comment}
          onChange={(e) => {
            setComment(e.target.value);
            setState("idle");
          }}
          placeholder="What he did well, one thing to fix next time… (English or Vietnamese)"
        />
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button type="submit" disabled={state === "saving" || bands.gra == null || bands.lr == null} aria-busy={state === "saving"}>
          {state === "saving" ? <Loader2 className="animate-spin" aria-hidden /> : null} Save grade
        </Button>
        {gradedAt && (
          <Button type="button" variant="ghost" disabled={state === "saving"} onClick={() => send({ clear: true })}>
            Remove my grade
          </Button>
        )}
        <p aria-live="polite" className="text-sm">
          {state === "saved" && <span className="flex items-center gap-1 text-success"><Check className="size-4" aria-hidden /> Saved</span>}
          {state === "error" && <span className="text-error">{error}</span>}
        </p>
      </div>
    </form>
  );
}
