"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { BandEstimates, FeedbackView, type Feedback } from "@/components/writing/feedback-view";
import { t, type Lang } from "@/lib/i18n";
import { cn } from "@/lib/utils";

type Item = {
  id: string;
  local_date: string;
  text: string;
  word_count: number;
  feedback: unknown;
  hidden_from_viewers: boolean;
};

/** Last 5 graded paragraphs with highlighted corrections, read-only. */
export function RecentWriting({ items, lang, canHide }: { items: Item[]; lang: Lang; canHide: boolean }) {
  return (
    <section aria-labelledby="rw-h" className="space-y-3">
      <h2 id="rw-h" className="text-lg font-semibold">{t("recentWriting", lang)}</h2>
      {items.length === 0 && <p className="surface p-4 text-muted-foreground">{t("noWriting", lang)}</p>}
      {items.map((w) => (
        <WritingItem key={w.id} w={w} lang={lang} canHide={canHide} />
      ))}
    </section>
  );
}

function WritingItem({ w, lang, canHide }: { w: Item; lang: Lang; canHide: boolean }) {
  const [open, setOpen] = useState(false);
  const [hidden, setHidden] = useState(w.hidden_from_viewers);
  const fb = w.feedback as Feedback | null;
  return (
    <article className="surface">
      <button type="button" className="flex min-h-14 w-full items-center gap-3 px-4 py-3 text-left" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        <span className="flex-1">
          <span className="block font-medium">
            {new Date(w.local_date + "T00:00:00Z").toLocaleDateString(lang === "vi" ? "vi-VN" : "en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" })}
            <span className="ml-2 text-sm font-normal text-muted-foreground">{w.word_count} words</span>
          </span>
          <span className="line-clamp-1 text-sm text-muted-foreground">{w.text}</span>
        </span>
        {fb?.bands && <span className="shrink-0 text-sm tabular-nums">{fb.bands.gra?.toFixed(1)} / {fb.bands.lr?.toFixed(1)}</span>}
        <ChevronDown className={cn("size-5 shrink-0 transition-transform", open && "rotate-180")} aria-hidden />
      </button>
      {open && fb && (
        <div className="space-y-4 border-t p-4">
          <BandEstimates bands={fb.bands} compact />
          <FeedbackView text={w.text} feedback={fb} explainLang={lang} idPrefix={`rw-${w.id.slice(0, 6)}`} />
          {canHide && (
            <div className="flex items-center gap-2">
              <Switch
                id={`h-${w.id}`}
                checked={hidden}
                onCheckedChange={async (v) => {
                  const r = await fetch("/api/writing/hide", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ submission_id: w.id, hidden: v }) });
                  if (r.ok) setHidden(v);
                }}
              />
              <Label htmlFor={`h-${w.id}`} className="text-sm font-normal">Hide from family (still counts in stats)</Label>
            </div>
          )}
        </div>
      )}
    </article>
  );
}
