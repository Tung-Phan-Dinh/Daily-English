"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowRight, Check, Eye, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TappableText } from "@/components/dictionary/tappable-text";
import { QUESTION_TYPE_LABELS } from "@/lib/curriculum";
import { cn } from "@/lib/utils";
import { post } from "../api";
import { usePlayer } from "../player";
import type { Progress, SessionPayload } from "../types";

type Reading = NonNullable<SessionPayload["reading"]>;
type Question = Reading["questions"][number];
type Results = Record<string, { response: string; correct: boolean }>;

export function ReadingBlock() {
  const { payload, commit, action } = usePlayer();
  const [reading, setReading] = useState<Reading | null>(payload.reading);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [results, setResults] = useState<{ results: Results; wpm: number; correct: number; total: number; progress: Progress } | null>(null);
  const [state, setState] = useState<"reading" | "submitting" | "error">("reading");
  const [error, setError] = useState("");
  const [focusQ, setFocusQ] = useState<string | null>(null);
  const [tab, setTab] = useState("passage");
  const started = useRef(0);
  useEffect(() => {
    started.current = Date.now();
  }, []);
  const tapped = useRef<string[]>([]);
  const passageRef = useRef<HTMLDivElement>(null);

  const marks = useMemo(() => {
    if (!results || !reading) return [];
    const out: { start: number; end: number; className: string; id?: string }[] = [];
    for (const q of reading.questions) {
      if (q.evidence_start == null || q.evidence_end == null) continue;
      out.push({ start: q.evidence_start, end: q.evidence_end, className: cn("evidence", focusQ === q.id && "ring-2 ring-brand"), id: q.id });
      // Underline the passage side of each paraphrase pair inside the evidence.
      for (const [, passagePhrase] of q.paraphrase_pairs ?? []) {
        const span = reading.passage.body.slice(q.evidence_start, q.evidence_end);
        const at = span.toLowerCase().indexOf(passagePhrase.toLowerCase());
        if (at >= 0 && passagePhrase.trim()) out.push({ start: q.evidence_start + at, end: q.evidence_start + at + passagePhrase.length, className: "paraphrase" });
      }
    }
    return out;
  }, [results, reading, focusQ]);

  if (!reading) {
    return (
      <div className="surface p-8 text-center">
        <h1 className="text-xl font-semibold">No reading today</h1>
        <p className="mt-2 text-muted-foreground">There&apos;s no passage available. Use “Skip block” to continue.</p>
        <Button className="mt-4" onClick={() => action({ action: "skip", block: "reading" })}>Skip reading</Button>
      </div>
    );
  }

  const done = Boolean(results);
  const unanswered = reading.questions.filter((q) => !answers[q.id]?.trim()).length;

  async function submit() {
    setState("submitting");
    const r = await post<{ results: Results; wpm: number; correct: number; total: number; progress: Progress; reading: Reading }>("/api/reading/submit", {
      session_id: payload.session.id,
      answers,
      reading_ms: Date.now() - started.current,
      tapped_words: tapped.current,
    });
    if (!r.ok) {
      setState("error");
      setError(r.error);
      return;
    }
    setReading(r.data.reading);
    setResults(r.data);
    setState("reading");
    setTab("questions");
  }

  function showEvidence(q: Question) {
    setFocusQ(q.id);
    setTab("passage");
    requestAnimationFrame(() => {
      passageRef.current?.querySelector(`[data-mark-id="${q.id}"]`)?.scrollIntoView({ behavior: "smooth", block: "center" });
    });
  }

  const passage = (
    <div ref={passageRef} className="lg:h-[calc(100dvh-10rem)] lg:overflow-y-auto lg:pr-4">
      <h1 className="font-serif text-2xl font-semibold">{reading.passage.title}</h1>
      <p className="mt-1 text-sm text-muted-foreground">Tap any word for the dictionary · select 2–4 words for a phrase</p>
      <div className="prose-reading mt-4 whitespace-pre-line">
        <TappableText
          text={reading.passage.body}
          context={{ block: "reading", item: reading.passage.id }}
          marks={marks}
          onTap={(w) => tapped.current.push(w)}
        />
      </div>
      {done && (
        <p className="mt-4 text-sm text-muted-foreground">
          <span className="evidence px-1">Highlighted</span> = evidence ·{" "}
          <span className="paraphrase">underlined</span> = paraphrase of the question wording
        </p>
      )}
    </div>
  );

  const questions = (
    <div className="lg:h-[calc(100dvh-10rem)] lg:overflow-y-auto lg:pl-1">
      {results && (
        <div role="status" className="mb-4 rounded-3xl border border-success/40 bg-success-soft px-4 py-3">
          <p className="font-semibold">
            {results.correct} / {results.total} correct
          </p>
          <p className="text-sm text-muted-foreground">Reading speed about {results.wpm} words per minute.</p>
        </div>
      )}
      <ol className="space-y-4">
        {reading.questions.map((q, i) => (
          <QuestionCard
            key={q.id}
            n={i + 1}
            q={q}
            value={answers[q.id] ?? ""}
            onChange={(v) => setAnswers((a) => ({ ...a, [q.id]: v }))}
            result={results?.results[q.id]}
            onEvidence={() => showEvidence(q)}
          />
        ))}
      </ol>
      <div className="sticky bottom-0 mt-6 bg-background/95 py-3">
        {!done ? (
          <>
            {state === "error" && <p role="alert" className="mb-2 text-sm text-error">{error}</p>}
            <Button
              size="lg"
              className="w-full"
              disabled={state === "submitting"}
              aria-busy={state === "submitting"}
              onClick={() => {
                if (unanswered && !window.confirm(`${unanswered} question${unanswered > 1 ? "s are" : " is"} unanswered. Submit anyway?`)) return;
                submit();
              }}
            >
              {state === "submitting" ? <Loader2 className="animate-spin" aria-hidden /> : null} Submit answers
            </Button>
          </>
        ) : (
          <Button size="lg" className="w-full" autoFocus onClick={() => commit(results!.progress)}>
            Continue <ArrowRight aria-hidden />
          </Button>
        )}
      </div>
    </div>
  );

  return (
    <div>
      <div className="hidden gap-8 lg:grid lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
        <section aria-label="Passage">{passage}</section>
        <section aria-label="Questions">{questions}</section>
      </div>
      <Tabs value={tab} onValueChange={setTab} className="lg:hidden">
        <TabsList className="w-full">
          <TabsTrigger value="passage" className="min-h-10">Passage</TabsTrigger>
          <TabsTrigger value="questions" className="min-h-10">
            Questions {!done && unanswered < reading.questions.length ? `(${reading.questions.length - unanswered}/${reading.questions.length})` : ""}
          </TabsTrigger>
        </TabsList>
        <TabsContent value="passage" className="mt-4">{passage}</TabsContent>
        <TabsContent value="questions" className="mt-4">{questions}</TabsContent>
      </Tabs>
    </div>
  );
}

function QuestionCard({
  n, q, value, onChange, result, onEvidence,
}: {
  n: number;
  q: Question;
  value: string;
  onChange: (v: string) => void;
  result?: { response: string; correct: boolean };
  onEvidence: () => void;
}) {
  const options = q.type === "tfng" ? ["TRUE", "FALSE", "NOT GIVEN"] : q.options ?? [];
  const locked = Boolean(result);
  const name = `q-${q.id}`;
  return (
    <li className={cn("surface p-4", result && (result.correct ? "border-success/50" : "border-error/50"))}>
      <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
        {n}. {QUESTION_TYPE_LABELS[q.type]}
      </p>
      {q.type === "completion" ? (
        <>
          <Label htmlFor={name} className="mt-2 block text-base font-normal">{q.prompt}</Label>
          <Input id={name} className="mt-2" value={value} disabled={locked} onChange={(e) => onChange(e.target.value)} autoComplete="off" spellCheck={false} />
        </>
      ) : (
        <fieldset className="mt-2">
          <legend className="text-base">{q.prompt}</legend>
          <div className="mt-2 grid gap-1.5">
            {options.map((o) => (
              <label
                key={o}
                className={cn(
                  "flex min-h-11 cursor-pointer items-center gap-3 rounded-lg border px-3 py-2 text-base has-[:checked]:border-brand has-[:checked]:bg-brand-soft has-[:focus-visible]:ring-3 has-[:focus-visible]:ring-ring",
                  locked && "cursor-default",
                )}
              >
                <input type="radio" name={name} value={o} checked={value === o} disabled={locked} onChange={() => onChange(o)} className="size-4 accent-[var(--brand)]" />
                {o}
              </label>
            ))}
          </div>
        </fieldset>
      )}
      {result && (
        <div className="mt-3 space-y-1 text-base" aria-live="polite">
          <p className={cn("flex items-center gap-1.5 font-semibold", result.correct ? "text-success" : "text-error")}>
            {result.correct ? <Check className="size-4" aria-hidden /> : <X className="size-4" aria-hidden />}
            {result.correct ? "Correct" : `Answer: ${q.answer}`}
          </p>
          {!result.correct && <p className="text-muted-foreground">Your answer: {result.response || "(blank)"}</p>}
          <p>{q.explain_en}</p>
          <p lang="vi" className="text-muted-foreground">{q.explain_vi}</p>
          {q.evidence_start != null && (
            <Button variant="ghost" size="sm" className="-ml-2" onClick={onEvidence}>
              <Eye aria-hidden /> Show evidence in the passage
            </Button>
          )}
        </div>
      )}
    </li>
  );
}
