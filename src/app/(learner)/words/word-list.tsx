"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export type WordRow = {
  id: string; lemma: string; pos: string; gloss_vi: string; definition_en: string;
  topic: string | null; source: string; state: "new" | "learning" | "review" | "mastered"; due: string;
};

const STATE_STYLE: Record<WordRow["state"], string> = {
  new: "bg-muted text-muted-foreground",
  learning: "bg-streak-soft text-streak",
  review: "bg-brand-soft text-brand",
  mastered: "bg-success-soft text-success",
};
const SOURCES: Record<string, string> = { topic: "Topic set", nawl: "NAWL", ngsl: "NGSL", personal: "Saved by me" };

export function WordList({ rows, topics }: { rows: WordRow[]; topics: string[] }) {
  const [q, setQ] = useState("");
  const [state, setState] = useState("all");
  const [topic, setTopic] = useState("all");
  const [source, setSource] = useState("all");
  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    return rows.filter(
      (r) =>
        (!s || r.lemma.toLowerCase().includes(s) || r.gloss_vi.toLowerCase().includes(s)) &&
        (state === "all" || r.state === state) &&
        (topic === "all" || r.topic === topic) &&
        (source === "all" || r.source === source),
    );
  }, [rows, q, state, topic, source]);

  const select = "h-11 rounded-lg border border-input bg-background px-3 text-base";
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-[minmax(0,2fr)_repeat(3,minmax(0,1fr))]">
        <div>
          <Label htmlFor="w-q">Search</Label>
          <div className="relative mt-1">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <Input id="w-q" className="pl-9" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Word or Vietnamese" />
          </div>
        </div>
        <div>
          <Label htmlFor="w-state">State</Label>
          <select id="w-state" className={cn(select, "mt-1 w-full")} value={state} onChange={(e) => setState(e.target.value)}>
            <option value="all">All</option>
            <option value="new">New</option>
            <option value="learning">Learning</option>
            <option value="review">Review</option>
            <option value="mastered">Mastered</option>
          </select>
        </div>
        <div>
          <Label htmlFor="w-topic">Topic</Label>
          <select id="w-topic" className={cn(select, "mt-1 w-full")} value={topic} onChange={(e) => setTopic(e.target.value)}>
            <option value="all">All topics</option>
            {topics.map((t) => <option key={t}>{t}</option>)}
          </select>
        </div>
        <div>
          <Label htmlFor="w-src">Source</Label>
          <select id="w-src" className={cn(select, "mt-1 w-full")} value={source} onChange={(e) => setSource(e.target.value)}>
            <option value="all">All sources</option>
            {Object.entries(SOURCES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>
      </div>
      <p className="text-sm text-muted-foreground" aria-live="polite">{filtered.length} shown</p>
      {rows.length === 0 ? (
        <div className="surface p-8 text-center">
          <p className="font-medium">No words yet</p>
          <p className="mt-1 text-muted-foreground">New words arrive in each session. You can also save any word from the dictionary.</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="surface p-8 text-center">
          <p className="font-medium">No words match these filters</p>
          <button type="button" className="mt-2 min-h-11 text-brand underline-offset-4 hover:underline" onClick={() => { setQ(""); setState("all"); setTopic("all"); setSource("all"); }}>
            Clear filters
          </button>
        </div>
      ) : (
        <ul className="divide-y surface">
          {filtered.map((r) => (
            <li key={r.id}>
              <Link href={`/words/${r.id}`} className="flex min-h-14 items-center gap-3 px-4 py-2 hover:bg-muted">
                <span className="min-w-0 flex-1">
                  <span className="font-semibold">{r.lemma}</span> <span className="text-sm text-muted-foreground italic">{r.pos}</span>
                  <span lang="vi" className="block truncate text-sm text-muted-foreground">{r.gloss_vi}</span>
                </span>
                <span className={cn("shrink-0 rounded-full px-2.5 py-1 text-xs font-medium capitalize", STATE_STYLE[r.state])}>{r.state}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
