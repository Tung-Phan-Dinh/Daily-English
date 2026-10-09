"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { GrammarItemView } from "@/components/session/answer-views";
import { post } from "@/components/session/api";
import type { AnswerResponse, PublicGrammar } from "@/components/session/types";

/** 10-item self-check. Results stay on this page; nothing is recorded. */
export function Practice({ items, explainLang }: { items: PublicGrammar[]; explainLang: "en" | "vi" }) {
  const [started, setStarted] = useState(false);
  const [i, setI] = useState(0);
  const [score, setScore] = useState(0);
  if (!started) {
    return (
      <section className="surface p-5">
        <h2 className="font-semibold">Practice set</h2>
        <p className="mt-1 text-muted-foreground">{items.length} questions on this point. Just for you — it doesn&apos;t change your schedule or scores.</p>
        <Button className="mt-4" onClick={() => setStarted(true)}>Start practice</Button>
      </section>
    );
  }
  if (i >= items.length) {
    return (
      <section className="surface p-5" role="status">
        <h2 className="font-semibold">{score} / {items.length} correct</h2>
        <Button className="mt-4" variant="outline" onClick={() => { setI(0); setScore(0); }}>Try again</Button>
      </section>
    );
  }
  const item = items[i];
  return (
    <GrammarItemView
      key={item.id + i}
      item={item}
      position={`${i + 1} / ${items.length}`}
      settings={{ accent: "en-GB", explain_lang: explainLang, spellcheck: false, sound: false }}
      onSubmit={async (response) => {
        const r = await post<AnswerResponse>("/api/grammar/practice", { item_id: item.id, response });
        if (!r.ok) return null;
        if (r.data.correct) setScore((s) => s + 1);
        return r.data;
      }}
      onContinue={() => setI((n) => n + 1)}
    />
  );
}
