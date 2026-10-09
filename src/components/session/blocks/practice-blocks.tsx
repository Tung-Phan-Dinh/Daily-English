"use client";

import { useState } from "react";
import { ArrowRight, Languages, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { GrammarItemView, VocabExerciseView } from "../answer-views";
import { usePlayer } from "../player";
import type { AnswerResponse } from "../types";

function EmptyBlock({ title, body, block }: { title: string; body: string; block: string }) {
  const { action } = usePlayer();
  const [busy, setBusy] = useState(false);
  return (
    <div className="surface p-8 text-center">
      <h1 className="text-xl font-semibold">{title}</h1>
      <p className="mt-2 text-muted-foreground">{body}</p>
      <Button className="mt-6" autoFocus disabled={busy} aria-busy={busy} onClick={async () => { setBusy(true); await action({ action: "advance", block }); setBusy(false); }}>
        {busy ? <Loader2 className="animate-spin" aria-hidden /> : <ArrowRight aria-hidden />} Continue
      </Button>
    </div>
  );
}

/** Applies the server's progress once he presses Continue (so feedback stays on screen). */
function useContinue() {
  const { commit } = usePlayer();
  const [pending, setPending] = useState<AnswerResponse | null>(null);
  return {
    track: (r: AnswerResponse | null) => {
      if (r) setPending(r);
      return r;
    },
    next: (patch?: Parameters<typeof commit>[1]) => {
      if (pending) commit(pending.progress, patch);
      setPending(null);
    },
    pending,
  };
}

export function ReviewBlock() {
  const { payload, progress, answer, settings } = usePlayer();
  const cont = useContinue();
  const index = progress.blocks.review?.index ?? 0;
  const entries = payload.review;
  if (entries.length === 0) {
    return <EmptyBlock block="review" title="Nothing to review today" body="No cards are due. Nice — on to grammar." />;
  }
  const entry = entries[Math.min(index, entries.length - 1)];
  const position = `${Math.min(index + 1, entries.length)} / ${entries.length}`;
  const submit = (response: string, meta: { usedHint: boolean; durationMs: number }) =>
    answer("review", entry.card_id, response, meta).then(cont.track);

  return (
    <div>
      <h1 className="sr-only">Review</h1>
      {entry.item_type === "grammar" && entry.grammar ? (
        <GrammarItemView key={entry.card_id} item={entry.grammar} onSubmit={submit} onContinue={() => cont.next()} settings={settings} position={position} context={{ block: "review" }} />
      ) : entry.exercise ? (
        <VocabExerciseView
          key={entry.card_id}
          exercise={entry.exercise}
          word={entry.vocab}
          showLearn={entry.stage === 1}
          onSubmit={submit}
          onContinue={() => cont.next()}
          settings={settings}
          position={position}
        />
      ) : (
        <p role="alert">This card&apos;s content is missing. Use “Skip block” to continue.</p>
      )}
    </div>
  );
}

function RuleCard({ onStart }: { onStart: () => void }) {
  const { payload, settings } = usePlayer();
  const [vi, setVi] = useState(settings.explain_lang === "vi");
  const point = payload.grammar!.point as {
    title: string; title_vi: string; rule_en: string; rule_vi: string;
    examples: { en: string; vi: string }[]; trap: { wrong: string; right: string; note_vi: string };
  } | null;
  if (!point) return null;
  return (
    <article className="surface p-6 sm:p-8" aria-labelledby="rule-title">
      <p className="text-sm font-medium text-brand">Today&apos;s grammar · 60-second rule</p>
      <h1 id="rule-title" className="mt-1 text-2xl font-semibold tracking-tight">{point.title}</h1>
      <p lang="vi" className="text-muted-foreground">{point.title_vi}</p>
      <p className="mt-4 text-lg leading-relaxed" lang={vi ? "vi" : "en"}>{vi ? point.rule_vi : point.rule_en}</p>
      <button
        type="button"
        className="mt-2 inline-flex min-h-11 items-center gap-1.5 text-sm font-medium text-brand hover:underline"
        aria-pressed={vi}
        onClick={() => setVi((v) => !v)}
      >
        <Languages className="size-4" aria-hidden /> {vi ? "English" : "Tiếng Việt"}
      </button>
      <h2 className="mt-4 text-sm font-medium tracking-wide text-muted-foreground uppercase">Examples</h2>
      <ul className="mt-2 space-y-2">
        {point.examples.slice(0, 2).map((ex) => (
          <li key={ex.en} className="border-l-2 border-brand/40 pl-3">
            <p className="text-lg">{ex.en}</p>
            <p lang="vi" className="text-muted-foreground">{ex.vi}</p>
          </li>
        ))}
      </ul>
      <h2 className="mt-5 text-sm font-medium tracking-wide text-muted-foreground uppercase">Vietnamese trap</h2>
      <div className="mt-2 grid gap-2 sm:grid-cols-2">
        <p className="rounded-lg bg-error-soft px-3 py-2 text-base">
          <span className="block text-xs font-semibold text-error">✗ Wrong</span>
          <s className="decoration-error/60">{point.trap.wrong}</s>
        </p>
        <p className="rounded-lg bg-success-soft px-3 py-2 text-base">
          <span className="block text-xs font-semibold text-success">✓ Right</span>
          {point.trap.right}
        </p>
      </div>
      <p lang="vi" className="mt-2 text-base text-muted-foreground">{point.trap.note_vi}</p>
      <Button className="mt-6" size="lg" autoFocus onClick={onStart}>
        Start 10 questions <ArrowRight aria-hidden />
      </Button>
    </article>
  );
}

export function GrammarBlock() {
  const { payload, progress, answer, settings } = usePlayer();
  const cont = useContinue();
  const index = progress.blocks.grammar?.index ?? 0;
  const [started, setStarted] = useState(index > 0);
  const [sequence, setSequence] = useState(payload.grammar?.sequence ?? []);
  if (!payload.grammar || sequence.length === 0) {
    return <EmptyBlock block="grammar" title="No grammar items available" body="The item bank for this point is empty right now. Continue to the next block." />;
  }
  if (!started) return <RuleCard onStart={() => setStarted(true)} />;
  const id = sequence[Math.min(index, sequence.length - 1)];
  const item = payload.grammar.items[id];
  return (
    <div>
      <h1 className="sr-only">Grammar practice</h1>
      {index === 5 && progress.grammar_tail === "hard" && (
        <p className="mb-4 rounded-lg bg-brand-soft px-4 py-2 text-base" role="status">
          5 out of 5! The last five are harder: sentence combining and transformations.
        </p>
      )}
      {item ? (
        <GrammarItemView
          key={id}
          item={item}
          settings={settings}
          position={`${index + 1} / ${sequence.length}`}
          context={{ block: "grammar" }}
          onSubmit={(response, meta) =>
            answer("grammar", id, response, meta).then((r) => {
              if (r?.grammar_sequence) setSequence(r.grammar_sequence);
              return cont.track(r);
            })
          }
          onContinue={() => cont.next()}
        />
      ) : (
        <p role="alert">Item missing.</p>
      )}
    </div>
  );
}

export function CheckBlock() {
  const { payload, progress, answer, settings } = usePlayer();
  const cont = useContinue();
  const index = progress.blocks.check?.index ?? 0;
  const seq = payload.check?.sequence ?? [];
  if (!seq.length) return <EmptyBlock block="check" title="No weekly check this week" body="There was no practice this week to check. Enjoy the rest day." />;
  const id = seq[Math.min(index, seq.length - 1)];
  const item = payload.check!.items[id];
  return (
    <div>
      <h1 className="mb-4 text-xl font-semibold">Weekly check</h1>
      {item && (
        <GrammarItemView
          key={id}
          item={item}
          settings={settings}
          position={`${index + 1} / ${seq.length}`}
          context={{ block: "check" }}
          onSubmit={(response, meta) => answer("check", id, response, meta).then(cont.track)}
          onContinue={() => cont.next()}
        />
      )}
    </div>
  );
}
