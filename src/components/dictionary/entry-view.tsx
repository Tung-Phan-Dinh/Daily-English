"use client";

import { useState } from "react";
import { Check, Loader2, Plus, Volume2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { speak } from "./speak";
import type { DictEntry } from "./types";

export function EntryView({
  entry,
  accent,
  canSave,
  inDeck,
  onSave,
  headingId,
}: {
  entry: DictEntry;
  accent: "en-GB" | "en-US";
  canSave: boolean;
  inDeck: boolean;
  onSave?: () => Promise<boolean>;
  headingId?: string;
}) {
  const [saving, setSaving] = useState<"idle" | "saving" | "saved" | "error">(inDeck ? "saved" : "idle");
  const family = Object.entries(entry.word_family ?? {}).filter(([, v]) => v);

  return (
    <div className="space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 id={headingId} tabIndex={-1} className="text-xl font-semibold leading-tight outline-none">
            {entry.lemma}
          </h2>
          <p className="text-sm text-muted-foreground">
            {entry.ipa && <span className="mr-2 font-mono">{entry.ipa}</span>}
            {entry.pos && <span className="italic">{entry.pos}</span>}
          </p>
        </div>
        <Button variant="outline" size="icon-sm" aria-label={`Play pronunciation of ${entry.lemma}`} onClick={() => speak(entry.lemma, accent)}>
          <Volume2 aria-hidden />
        </Button>
      </div>
      {entry.gloss_vi.length > 0 && (
        <p lang="vi" className="text-base font-semibold">
          {entry.gloss_vi.join("; ")}
        </p>
      )}
      {entry.definition_en && <p className="text-base">{entry.definition_en}</p>}
      {entry.examples?.[0] && <p className="border-l-2 border-brand/40 pl-3 text-base italic text-muted-foreground">{entry.examples[0]}</p>}
      {entry.collocations?.length > 0 && (
        <div>
          <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Collocations</p>
          <ul className="mt-1 flex flex-wrap gap-1.5">
            {entry.collocations.slice(0, 3).map((c) => (
              <li key={c} className="rounded-md bg-muted px-2 py-1 text-sm">
                {c}
              </li>
            ))}
          </ul>
        </div>
      )}
      {family.length > 0 && (
        <p className="text-sm text-muted-foreground">
          <span className="font-medium text-foreground">Word family: </span>
          {family.map(([k, v]) => `${v} (${k})`).join(" · ")}
        </p>
      )}
      {entry.ai_generated && <p className="text-xs text-muted-foreground">AI-generated entry — may contain mistakes.</p>}
      {canSave && onSave && (
        <Button
          className="w-full"
          variant={saving === "saved" ? "secondary" : "default"}
          disabled={saving === "saving" || saving === "saved"}
          aria-busy={saving === "saving"}
          onClick={async () => {
            setSaving("saving");
            setSaving((await onSave()) ? "saved" : "error");
          }}
        >
          {saving === "saving" ? (
            <>
              <Loader2 className="animate-spin" aria-hidden /> Saving…
            </>
          ) : saving === "saved" ? (
            <>
              <Check aria-hidden /> In my words · joins tomorrow&apos;s review
            </>
          ) : (
            <>
              <Plus aria-hidden /> Save to my words
            </>
          )}
        </Button>
      )}
      {saving === "error" && (
        <p role="alert" className="text-sm text-error">
          Couldn&apos;t save. Try again.
        </p>
      )}
    </div>
  );
}
