"use client";

import { useMemo, useRef, useState } from "react";
import { ChevronDown, Languages } from "lucide-react";
import { ERROR_LABELS, type AnyErrorCode } from "@/lib/curriculum";
import { cn } from "@/lib/utils";

export type FeedbackError = {
  start: number;
  end: number;
  original: string;
  correction: string;
  code: string;
  severity: "blocks_meaning" | "noticeable" | "minor";
  explain_en: string;
  explain_vi: string;
  is_focus?: boolean;
};

export type Feedback = {
  bands: { gra: number | null; lr: number | null; tr: number | null; cc: number | null };
  errors: FeedbackError[];
  focus_codes: string[];
  strengths: { quote: string; why: string }[];
  upgrades: { original: string; better: string; note_vi: string }[];
  target_check: { words_used: string[]; grammar_used_correctly: boolean; comment: string };
  rewrite_sentence: { start: number; end: number };
  model_version: string | null;
};

const SEVERITY_TEXT = { blocks_meaning: "Blocks meaning", noticeable: "Noticeable", minor: "Minor" } as const;

export function BandEstimates({ bands, compact }: { bands: Feedback["bands"]; compact?: boolean }) {
  const rows = [
    ["Grammar (GRA)", bands.gra],
    ["Vocabulary (LR)", bands.lr],
    ["Task response", bands.tr],
    ["Coherence", bands.cc],
  ].filter(([, v]) => v !== null) as [string, number][];
  return (
    <div>
      <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Band estimate · AI, single piece</p>
      <dl className={cn("mt-2 grid gap-2", compact ? "grid-cols-2" : "grid-cols-2 sm:grid-cols-4")}>
        {rows.map(([label, v]) => (
          <div key={label} className="rounded-lg border bg-background px-3 py-2">
            <dt className="text-sm text-muted-foreground">{label}</dt>
            <dd className="text-2xl font-semibold tabular-nums">{v.toFixed(1)}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

/** His text with inline highlights (left) and focus errors (right); clicking either side scrolls to the other. */
export function FeedbackView({ text, feedback, explainLang = "en", idPrefix = "fb" }: { text: string; feedback: Feedback; explainLang?: "en" | "vi"; idPrefix?: string }) {
  const [showOthers, setShowOthers] = useState(false);
  const [active, setActive] = useState<number | null>(null);
  const [vi, setVi] = useState(explainLang === "vi");
  const listRef = useRef<HTMLOListElement>(null);
  const textRef = useRef<HTMLDivElement>(null);

  const indexed = feedback.errors.map((e, i) => ({ ...e, i }));
  const focus = indexed.filter((e) => e.is_focus);
  const others = indexed.filter((e) => !e.is_focus);
  const visible = showOthers ? indexed : focus;

  const segments = useMemo(() => {
    const out: { text: string; err?: (typeof indexed)[number] }[] = [];
    let pos = 0;
    for (const e of [...visible].sort((a, b) => a.start - b.start)) {
      if (e.start < pos) continue;
      if (e.start > pos) out.push({ text: text.slice(pos, e.start) });
      out.push({ text: text.slice(e.start, e.end), err: e });
      pos = e.end;
    }
    if (pos < text.length) out.push({ text: text.slice(pos) });
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text, showOthers, feedback]);

  const goList = (i: number) => {
    setActive(i);
    const el = document.getElementById(`${idPrefix}-err-${i}`);
    el?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    el?.focus({ preventScroll: true });
  };
  const goText = (i: number) => {
    setActive(i);
    const el = document.getElementById(`${idPrefix}-mark-${i}`);
    el?.scrollIntoView({ behavior: "smooth", block: "center" });
    el?.focus({ preventScroll: true });
  };

  const grouped = feedback.focus_codes.map((code) => ({ code, errors: focus.filter((e) => e.code === code) })).filter((g) => g.errors.length);

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
      <div ref={textRef}>
        <h3 className="text-sm font-medium tracking-wide text-muted-foreground uppercase">Your paragraph</h3>
        <p className="prose-reading mt-2 rounded-3xl border bg-background p-4 whitespace-pre-wrap">
          {segments.map((s, k) =>
            s.err ? (
              <mark
                key={k}
                id={`${idPrefix}-mark-${s.err.i}`}
                tabIndex={0}
                role="button"
                aria-label={`${SEVERITY_TEXT[s.err.severity]} error: “${s.err.original}”, suggest “${s.err.correction}”`}
                onClick={() => goList(s.err!.i)}
                onKeyDown={(e) => e.key === "Enter" && goList(s.err!.i)}
                className={cn("cursor-pointer rounded-sm bg-transparent text-inherit", `mark-${s.err.severity}`, active === s.err.i && "ring-2 ring-brand")}
              >
                {s.text}
              </mark>
            ) : (
              <span key={k}>{s.text}</span>
            ),
          )}
        </p>
        <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground" aria-label="Highlight key">
          <li><span className="mark-blocks_meaning px-1">wavy</span> blocks meaning</li>
          <li><span className="mark-noticeable px-1">solid</span> noticeable</li>
          <li><span className="mark-minor px-1">dotted</span> minor</li>
        </ul>
      </div>

      <div>
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium tracking-wide text-muted-foreground uppercase">Focus errors</h3>
          <button type="button" className="inline-flex min-h-11 items-center gap-1 text-sm font-medium text-brand" aria-pressed={vi} onClick={() => setVi((v) => !v)}>
            <Languages className="size-4" aria-hidden /> {vi ? "English" : "Tiếng Việt"}
          </button>
        </div>
        {grouped.length === 0 && <p className="mt-2 text-base text-muted-foreground">No serious errors — well done.</p>}
        <ol ref={listRef} className="mt-2 space-y-4">
          {grouped.map((g) => (
            <li key={g.code}>
              <p className="font-semibold">{ERROR_LABELS[g.code as AnyErrorCode]?.[vi ? "vi" : "en"] ?? g.code}</p>
              <ul className="mt-1 space-y-2">
                {g.errors.map((e) => (
                  <ErrorItem key={e.i} e={e} vi={vi} active={active === e.i} id={`${idPrefix}-err-${e.i}`} onClick={() => goText(e.i)} />
                ))}
              </ul>
            </li>
          ))}
        </ol>
        {others.length > 0 && (
          <div className="mt-4">
            <button
              type="button"
              className="inline-flex min-h-11 items-center gap-1 text-base font-medium text-brand"
              aria-expanded={showOthers}
              onClick={() => setShowOthers((v) => !v)}
            >
              <ChevronDown className={cn("size-4 transition-transform", showOthers && "rotate-180")} aria-hidden />
              Other notes ({others.length})
            </button>
            {showOthers && (
              <ul className="mt-2 space-y-2">
                {others.map((e) => (
                  <ErrorItem key={e.i} e={e} vi={vi} active={active === e.i} id={`${idPrefix}-err-${e.i}`} onClick={() => goText(e.i)} />
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function ErrorItem({ e, vi, active, id, onClick }: { e: FeedbackError; vi: boolean; active: boolean; id: string; onClick: () => void }) {
  return (
    <li>
      <button
        type="button"
        id={id}
        onClick={onClick}
        className={cn("w-full rounded-lg border bg-card p-3 text-left transition-colors hover:border-brand/50", active && "border-brand bg-brand-soft")}
      >
        <span className="flex flex-wrap items-baseline gap-2 text-base">
          <s className="decoration-error/70">{e.original}</s>
          <span aria-hidden>→</span>
          <strong>{e.correction}</strong>
          <span className="ml-auto rounded bg-muted px-1.5 py-0.5 text-xs">{SEVERITY_TEXT[e.severity]}</span>
        </span>
        <span className="mt-1 block text-base" lang={vi ? "vi" : "en"}>{vi ? e.explain_vi : e.explain_en}</span>
      </button>
    </li>
  );
}
