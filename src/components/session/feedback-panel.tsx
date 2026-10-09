"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowRight, Check, HelpCircle, Languages, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ERROR_LABELS, type AnyErrorCode } from "@/lib/curriculum";
import { cn } from "@/lib/utils";
import { post } from "./api";
import type { AnswerResponse } from "./types";

type Why = { explanation_en: string; explanation_vi: string; examples: { en: string; note: string }[] };

/** Feedback slides up from the bottom: strip, correct answer, one-line rule, Vietnamese toggle. */
export function FeedbackPanel({
  result,
  itemId,
  explainLang,
  onContinue,
  continueLabel = "Continue",
}: {
  result: AnswerResponse;
  itemId?: string;
  explainLang: "en" | "vi";
  onContinue: () => void;
  continueLabel?: string;
}) {
  const [showVi, setShowVi] = useState(explainLang === "vi");
  const [why, setWhy] = useState<Why | null>(null);
  const [whyState, setWhyState] = useState<"idle" | "loading" | "error">("idle");
  const [whyError, setWhyError] = useState("");
  const btnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    btnRef.current?.focus();
  }, []);

  // V toggles Vietnamese; Enter continues (handled by the focused button).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).closest("input, textarea")) return;
      if (e.key.toLowerCase() === "v" && !e.metaKey && !e.ctrlKey) setShowVi((v) => !v);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const ok = result.correct;
  const code = result.error_code as AnyErrorCode | undefined;
  const hasVi = Boolean(result.explanation_vi || result.feedback_vi || result.trap_note_vi || result.gloss_vi);

  async function askWhy() {
    if (!itemId) return;
    setWhyState("loading");
    const r = await post<Why>("/api/grammar/why", { item_id: itemId });
    if (r.ok) {
      setWhy(r.data);
      setWhyState("idle");
    } else {
      setWhyState("error");
      setWhyError(r.error);
    }
  }

  return (
    <section
      aria-live="assertive"
      aria-label={ok ? "Correct" : "Not quite"}
      className={cn("mt-6 overflow-hidden rounded-3xl border animate-slide-up", ok ? "border-success/40" : "border-error/40")}
    >
      <div className={cn("flex items-center gap-2 px-5 py-3 font-semibold", ok ? "bg-success-soft text-success" : "bg-error-soft text-error")}>
        {ok ? <Check className="size-5 animate-pop" aria-hidden /> : <X className="size-5" aria-hidden />}
        <span>{ok ? "Correct" : "Not quite"}</span>
        {result.xp_gained ? <span className="ml-auto text-sm font-medium text-streak">+{result.xp_gained} XP</span> : null}
      </div>
      <div className="space-y-2 bg-card px-5 py-4">
        {!ok && result.correct_answer && (
          <p className="text-base">
            <span className="text-muted-foreground">Answer: </span>
            <strong>{result.correct_answer}</strong>
          </p>
        )}
        {result.lemma && (
          <p className="text-base">
            <strong>{result.lemma}</strong>
            {result.definition_en && <> — {result.definition_en}</>}
          </p>
        )}
        {result.feedback_en && <p className="text-base">{result.feedback_en}</p>}
        {result.explanation_en && (
          <p className="text-base">
            {code && ERROR_LABELS[code] && <span className="mr-2 rounded bg-muted px-1.5 py-0.5 text-xs font-medium">{ERROR_LABELS[code].en}</span>}
            {result.explanation_en}
          </p>
        )}
        {hasVi && (
          <div>
            <button
              type="button"
              className="inline-flex min-h-11 items-center gap-1.5 text-sm font-medium text-brand underline-offset-4 hover:underline"
              aria-expanded={showVi}
              onClick={() => setShowVi((v) => !v)}
            >
              <Languages className="size-4" aria-hidden /> Tiếng Việt <kbd className="rounded border px-1 text-xs text-muted-foreground">V</kbd>
            </button>
            {showVi && (
              <div lang="vi" className="space-y-1 border-l-2 border-brand/40 pl-3 text-base">
                {result.gloss_vi && <p className="font-semibold">{result.gloss_vi}</p>}
                {result.feedback_vi && <p>{result.feedback_vi}</p>}
                {result.explanation_vi && <p>{result.explanation_vi}</p>}
                {result.trap_note_vi && (
                  <p className="text-muted-foreground">
                    <span className="font-medium text-foreground">Bẫy tiếng Việt: </span>
                    {result.trap_note_vi}
                  </p>
                )}
              </div>
            )}
          </div>
        )}
        {result.checked_by === "fallback" && <p className="text-sm text-muted-foreground">Checked against the answer list only (AI checking is unavailable right now).</p>}
        {why && (
          <div className="rounded-lg bg-muted p-3 text-base">
            <p>{showVi ? why.explanation_vi : why.explanation_en}</p>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              {why.examples.map((ex) => (
                <li key={ex.en}>
                  <em>{ex.en}</em> <span className="text-muted-foreground">— {ex.note}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
        {whyState === "error" && <p role="alert" className="text-sm text-error">{whyError}</p>}
        <div className="flex flex-wrap items-center gap-2 pt-2">
          <Button ref={btnRef} onClick={onContinue}>
            {continueLabel} <ArrowRight aria-hidden />
          </Button>
          {itemId && !why && (
            <Button variant="ghost" onClick={askWhy} disabled={whyState === "loading"} aria-busy={whyState === "loading"}>
              {whyState === "loading" ? <Loader2 className="animate-spin" aria-hidden /> : <HelpCircle aria-hidden />} Why?
            </Button>
          )}
          <span className="ml-auto hidden text-xs text-muted-foreground sm:inline">Enter to continue</span>
        </div>
      </div>
    </section>
  );
}
