"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Languages, Loader2, Search, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { EntryView } from "./entry-view";
import type { DictEntry } from "./types";

type PhraseOption = { english: string; register: string; note_vi: string };

export function SearchPalette({
  open,
  onOpenChange,
  accent,
  role,
  sessionId,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  accent: "en-GB" | "en-US";
  role: string;
  sessionId?: string;
}) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<DictEntry[]>([]);
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [selected, setSelected] = useState<{ entry: DictEntry; lookupId: number | null; inDeck: boolean } | null>(null);
  const [recent, setRecent] = useState<{ recent: string[]; saved: string[] }>({ recent: [], saved: [] });
  const listRef = useRef<HTMLUListElement>(null);

  // Phrase helper
  const [idea, setIdea] = useState("");
  const [phrases, setPhrases] = useState<PhraseOption[]>([]);
  const [phraseState, setPhraseState] = useState<"idle" | "loading" | "error">("idle");
  const [phraseMsg, setPhraseMsg] = useState("");

  useEffect(() => {
    if (!open) return;
    fetch("/api/dict/recent")
      .then((r) => (r.ok ? r.json() : { recent: [], saved: [] }))
      .then(setRecent)
      .catch(() => {});
  }, [open]);

  // Debounced search: English prefix, or accent-insensitive Vietnamese ("o nhiem" → pollution).
  useEffect(() => {
    const query = q.trim();
    if (!query) return;
    const ctrl = new AbortController();
    const t = setTimeout(() => {
      setStatus("loading");
      fetch(`/api/dict?q=${encodeURIComponent(query)}`, { signal: ctrl.signal })
        .then((r) => (r.ok ? r.json() : Promise.reject()))
        .then((d: { entries: DictEntry[] }) => {
          setResults(d.entries);
          setStatus("idle");
        })
        .catch((e) => {
          if (e?.name !== "AbortError") setStatus("error");
        });
    }, 160);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [q]);

  async function choose(word: string) {
    const res = await fetch(`/api/dict?${new URLSearchParams({ q: word, log: "1", ctx: JSON.stringify({ page: "palette", session_id: sessionId }) })}`);
    if (!res.ok) return;
    const d = (await res.json()) as { entries: DictEntry[]; lookup_id: number | null; in_deck: boolean };
    if (d.entries[0]) setSelected({ entry: d.entries[0], lookupId: d.lookup_id, inDeck: d.in_deck });
  }

  async function askPhrases(e: React.FormEvent) {
    e.preventDefault();
    setPhraseState("loading");
    setPhraseMsg("");
    const res = await fetch("/api/dict/phrase", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: idea, session_id: sessionId }),
    });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) {
      setPhraseState("error");
      setPhraseMsg(d.error ?? "The phrase helper isn't available right now.");
      return;
    }
    setPhrases(d.options);
    setPhraseMsg(`${d.remaining} use${d.remaining === 1 ? "" : "s"} left today.`);
    setPhraseState("idle");
  }

  const onListKey = (e: React.KeyboardEvent) => {
    if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
    e.preventDefault();
    const items = [...(listRef.current?.querySelectorAll<HTMLButtonElement>("button") ?? [])];
    const i = items.indexOf(document.activeElement as HTMLButtonElement);
    items[(i + (e.key === "ArrowDown" ? 1 : -1) + items.length) % items.length]?.focus();
  };

  const wordList = (words: string[]) =>
    words.map((w) => (
      <li key={w}>
        <button
          type="button"
          className="min-h-11 w-full rounded-lg px-3 text-left hover:bg-muted focus-visible:bg-muted"
          onClick={() => choose(w)}
        >
          {w}
        </button>
      </li>
    ));

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (o) setSelected(null);
        onOpenChange(o);
      }}
    >
      <DialogContent className="top-[10%] max-h-[80vh] translate-y-0 overflow-y-auto sm:max-w-lg" data-no-dict>
        <DialogTitle>Dictionary</DialogTitle>
        <DialogDescription>English ↔ Vietnamese. Type Vietnamese with or without accents.</DialogDescription>
        <Tabs defaultValue="search" className="mt-2">
          <TabsList className="w-full">
            <TabsTrigger value="search" className="min-h-10">
              <Search className="size-4" aria-hidden /> Search
            </TabsTrigger>
            {role === "learner" && (
              <TabsTrigger value="phrase" className="min-h-10">
                <Sparkles className="size-4" aria-hidden /> Phrase helper
              </TabsTrigger>
            )}
          </TabsList>

          <TabsContent value="search" className="mt-4">
            {selected ? (
              <div>
                <Button variant="ghost" size="sm" className="-ml-2 mb-2" onClick={() => setSelected(null)}>
                  <ArrowLeft aria-hidden /> Back to results
                </Button>
                <EntryView
                  key={selected.entry.lemma}
                  entry={selected.entry}
                  accent={accent}
                  canSave={role === "learner"}
                  inDeck={selected.inDeck}
                  onSave={async () =>
                    (
                      await fetch("/api/dict/save", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ lemma: selected.entry.lemma, lookup_id: selected.lookupId }),
                      })
                    ).ok
                  }
                />
              </div>
            ) : (
              <>
                <Label htmlFor="dict-q" className="sr-only">
                  Search the dictionary
                </Label>
                <div className="relative">
                  <Languages className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
                  <Input
                    id="dict-q"
                    autoFocus
                    className="pl-9"
                    placeholder="e.g. pollution, o nhiem, học phí"
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "ArrowDown") {
                        e.preventDefault();
                        listRef.current?.querySelector<HTMLButtonElement>("button")?.focus();
                      }
                      if (e.key === "Enter" && results[0]) choose(results[0].lemma);
                    }}
                    autoComplete="off"
                    spellCheck={false}
                  />
                </div>
                <div aria-live="polite" className="mt-3 min-h-6 text-sm text-muted-foreground">
                  {status === "loading" && (
                    <span className="flex items-center gap-2">
                      <Loader2 className="size-4 animate-spin" aria-hidden /> Searching…
                    </span>
                  )}
                  {status === "error" && <span className="text-error">Search failed. Check your connection.</span>}
                  {status === "idle" && q.trim() && results.length === 0 && <span>No matches. Try another spelling or the base form.</span>}
                </div>
                {q.trim() ? (
                  <ul ref={listRef} onKeyDown={onListKey} className="mt-1 space-y-0.5" aria-label="Results">
                    {results.map((r) => (
                      <li key={`${r.id}-${r.lemma}`}>
                        <button
                          type="button"
                          className="flex min-h-11 w-full items-baseline gap-3 rounded-lg px-3 py-2 text-left hover:bg-muted focus-visible:bg-muted"
                          onClick={() => choose(r.lemma)}
                        >
                          <span className="font-semibold">{r.lemma}</span>
                          <span className="text-sm text-muted-foreground italic">{r.pos}</span>
                          <span lang="vi" className="ml-auto truncate text-sm">
                            {r.gloss_vi.slice(0, 2).join("; ")}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="grid gap-4 sm:grid-cols-2" onKeyDown={onListKey}>
                    <section>
                      <h3 className="px-3 text-xs font-medium tracking-wide text-muted-foreground uppercase">Recent lookups</h3>
                      {recent.recent.length ? <ul ref={listRef}>{wordList(recent.recent)}</ul> : <p className="px-3 py-2 text-sm text-muted-foreground">Nothing yet.</p>}
                    </section>
                    <section>
                      <h3 className="px-3 text-xs font-medium tracking-wide text-muted-foreground uppercase">Saved words</h3>
                      {recent.saved.length ? <ul>{wordList(recent.saved)}</ul> : <p className="px-3 py-2 text-sm text-muted-foreground">Save words with “+ Save to my words”.</p>}
                    </section>
                  </div>
                )}
              </>
            )}
          </TabsContent>

          <TabsContent value="phrase" className="mt-4">
            <form onSubmit={askPhrases} className="space-y-3">
              <Label htmlFor="phrase-idea">Your idea in Vietnamese</Label>
              <Textarea
                id="phrase-idea"
                lang="vi"
                rows={3}
                value={idea}
                onChange={(e) => setIdea(e.target.value)}
                placeholder="Ví dụ: Chính phủ nên đầu tư nhiều hơn vào giáo dục"
              />
              <p className="text-sm text-muted-foreground">3 uses per writing task. Uses are noted in your writing feedback.</p>
              <Button type="submit" disabled={!idea.trim() || phraseState === "loading"} aria-busy={phraseState === "loading"}>
                {phraseState === "loading" ? (
                  <>
                    <Loader2 className="animate-spin" aria-hidden /> Finding phrasings…
                  </>
                ) : (
                  "Suggest English phrasings"
                )}
              </Button>
            </form>
            <div aria-live="polite" className="mt-3 text-sm">
              {phraseMsg && <p className={phraseState === "error" ? "text-error" : "text-muted-foreground"}>{phraseMsg}</p>}
            </div>
            {phrases.length > 0 && (
              <ul className="mt-3 space-y-2">
                {phrases.map((p) => (
                  <li key={p.english} className="rounded-lg border p-3">
                    <p className="font-medium">{p.english}</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      <span className="rounded bg-muted px-1.5 py-0.5 text-xs">{p.register}</span>{" "}
                      <span lang="vi">{p.note_vi}</span>
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
