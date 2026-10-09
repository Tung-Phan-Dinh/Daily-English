"use client";

import { LearnCard } from "@/components/session/answer-views";
import type { VocabItem } from "@/components/session/types";

export function WordDetail({ word, accent }: { word: VocabItem; accent: "en-GB" | "en-US" }) {
  const family = Object.entries(word.word_family ?? {}).filter(([, v]) => v);
  return (
    <article className="surface p-6">
      <LearnCard word={word} accent={accent} />
      {word.examples[1] && <p className="mt-3 border-l-2 border-brand/40 pl-3 text-lg italic">{word.examples[1]}</p>}
      {family.length > 0 && (
        <p className="mt-4 text-base text-muted-foreground">
          <span className="font-medium text-foreground">Word family: </span>
          {family.map(([k, v]) => `${v} (${k})`).join(" · ")}
        </p>
      )}
    </article>
  );
}
