"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowRight, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LearnCard, VocabExerciseView } from "../answer-views";
import { usePlayer } from "../player";
import type { AnswerResponse } from "../types";

/** 8 learn cards (meaning, VI gloss, IPA, audio, collocations, example), then 3 quick checks. */
export function NewWordsBlock() {
  const { payload, progress, action, answer, commit, settings } = usePlayer();
  const nw = payload.new_words!;
  const index = progress.blocks.new_words?.index ?? 0;
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState<AnswerResponse | null>(null);
  const shownAt = useRef(0);
  const nextBtn = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    shownAt.current = Date.now();
    nextBtn.current?.focus();
  }, [index]);

  if (index < nw.words.length) {
    const word = nw.words[index];
    return (
      <article className="surface p-6 sm:p-8" aria-label={`New word ${index + 1} of ${nw.words.length}`}>
        <div className="mb-5 flex items-center justify-between">
          <p className="text-sm font-medium text-brand">New word</p>
          <p className="text-sm text-muted-foreground tabular-nums">
            {index + 1} / {nw.words.length}
          </p>
        </div>
        <LearnCard word={word} accent={settings.accent} />
        <Button
          ref={nextBtn}
          className="mt-8"
          size="lg"
          disabled={busy}
          aria-busy={busy}
          onClick={async () => {
            setBusy(true);
            await action({ action: "advance", block: "new_words", ms: Date.now() - shownAt.current });
            setBusy(false);
          }}
        >
          {busy ? <Loader2 className="animate-spin" aria-hidden /> : null}
          {index === nw.words.length - 1 ? "Quick check" : "Next word"} <ArrowRight aria-hidden />
        </Button>
      </article>
    );
  }

  const ci = index - nw.words.length;
  const check = nw.checks[Math.min(ci, nw.checks.length - 1)];
  if (!check) return null;
  return (
    <div>
      <h1 className="mb-4 text-lg font-semibold">Quick check</h1>
      <VocabExerciseView
        key={check.vocab_id}
        exercise={check.exercise}
        settings={settings}
        position={`${ci + 1} / ${nw.checks.length}`}
        onSubmit={(response, meta) =>
          answer("new_words", check.vocab_id, response, meta).then((r) => {
            if (r) setPending(r);
            return r;
          })
        }
        onContinue={() => {
          if (pending) commit(pending.progress);
          setPending(null);
        }}
      />
    </div>
  );
}
