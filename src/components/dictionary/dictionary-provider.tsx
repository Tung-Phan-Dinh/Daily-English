"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EntryView } from "./entry-view";
import { SearchPalette } from "./search-palette";
import type { DictEntry, LookupContext } from "./types";

type PopoverState = {
  word: string;
  rect: { top: number; left: number; bottom: number; width: number };
  status: "loading" | "ready" | "missing" | "error";
  entry?: DictEntry;
  lookupId?: number | null;
  inDeck?: boolean;
  returnFocus?: HTMLElement | null;
};

type Ctx = {
  lookup: (word: string, anchor: Element | DOMRect, ctx?: LookupContext) => void;
  prefetch: (words: string[]) => void;
  openPalette: () => void;
  setContext: (ctx: LookupContext) => void;
  accent: "en-GB" | "en-US";
  role: "learner" | "viewer" | "admin";
  sessionId?: string;
  setSessionId: (id?: string) => void;
};

const DictionaryContext = createContext<Ctx | null>(null);

export function useDictionary() {
  const ctx = useContext(DictionaryContext);
  if (!ctx) throw new Error("useDictionary must be used inside <DictionaryProvider>");
  return ctx;
}

// Small LRU so prefetched words open instantly (<300 ms target).
class Lru<V> {
  private map = new Map<string, V>();
  constructor(private max = 600) {}
  get(k: string) {
    const v = this.map.get(k);
    if (v !== undefined) {
      this.map.delete(k);
      this.map.set(k, v);
    }
    return v;
  }
  set(k: string, v: V) {
    this.map.delete(k);
    this.map.set(k, v);
    if (this.map.size > this.max) this.map.delete(this.map.keys().next().value!);
  }
  has(k: string) {
    return this.map.has(k);
  }
}

const cache = new Lru<DictEntry | null>();
const norm = (w: string) => w.toLowerCase().replace(/[’]/g, "'").replace(/^[^a-z]+|[^a-z]+$/g, "");

export function DictionaryProvider({
  children,
  accent,
  role,
}: {
  children: React.ReactNode;
  accent: "en-GB" | "en-US";
  role: "learner" | "viewer" | "admin";
}) {
  const [pop, setPop] = useState<PopoverState | null>(null);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [sessionId, setSessionId] = useState<string | undefined>();
  const ctxRef = useRef<LookupContext>({});
  const popRef = useRef<HTMLDivElement>(null);

  const prefetch = useCallback((words: string[]) => {
    const missing = [...new Set(words.map(norm).filter((w) => w.length > 1 && !cache.has(w)))].slice(0, 300);
    if (!missing.length) return;
    fetch(`/api/dict/batch?w=${encodeURIComponent(missing.join(","))}`)
      .then((r) => (r.ok ? r.json() : { entries: {} }))
      .then(({ entries }: { entries: Record<string, DictEntry> }) => {
        for (const w of missing) if (entries[w]) cache.set(w, entries[w]);
      })
      .catch(() => {});
  }, []);

  const lookup = useCallback((word: string, anchor: Element | DOMRect, ctx?: LookupContext) => {
    const q = word.trim().replace(/\s+/g, " ").slice(0, 60);
    if (!q) return;
    const r = anchor instanceof Element ? anchor.getBoundingClientRect() : anchor;
    const key = norm(q);
    const cached = cache.get(key);
    setPop({
      word: q,
      rect: { top: r.top, left: r.left, bottom: r.bottom, width: r.width },
      status: cached ? "ready" : "loading",
      entry: cached ?? undefined,
      returnFocus: (document.activeElement as HTMLElement) ?? null,
    });
    const params = new URLSearchParams({ q, log: "1", ctx: JSON.stringify({ ...ctxRef.current, ...ctx, session_id: sessionId }) });
    fetch(`/api/dict?${params}`)
      .then(async (res) => {
        if (!res.ok) throw new Error();
        const data = (await res.json()) as { entries: DictEntry[]; lookup_id: number | null; in_deck: boolean };
        const entry = data.entries[0];
        if (entry) cache.set(key, entry);
        setPop((p) =>
          p && p.word === q
            ? { ...p, status: entry ? "ready" : "missing", entry: entry ?? p.entry, lookupId: data.lookup_id, inDeck: data.in_deck }
            : p,
        );
      })
      .catch(() => setPop((p) => (p && p.word === q ? { ...p, status: p.entry ? "ready" : "error" } : p)));
  }, [sessionId]);

  const close = useCallback(() => {
    setPop((p) => {
      p?.returnFocus?.focus?.();
      return null;
    });
  }, []);

  // Global shortcuts: Cmd/Ctrl+K or "/" opens the palette; double-click looks up a word;
  // selecting 2–4 words inside a [data-dict-zone] looks up the phrase.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      const typing = t.closest("input, textarea, [contenteditable=true], select");
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen(true);
      } else if (e.key === "/" && !typing && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        setPaletteOpen(true);
      }
    };
    const onDbl = (e: MouseEvent) => {
      const t = e.target as HTMLElement;
      if (t.closest("input, textarea, button, [data-no-dict]")) return;
      const sel = window.getSelection();
      const text = sel?.toString().trim() ?? "";
      if (!text || text.split(/\s+/).length > 4 || !/[a-z]/i.test(text)) return;
      const range = sel!.rangeCount ? sel!.getRangeAt(0) : null;
      if (range) lookup(text, range.getBoundingClientRect(), { page: window.location.pathname });
    };
    const onUp = (e: MouseEvent) => {
      const t = e.target as HTMLElement;
      if (!t.closest("[data-dict-zone]") || e.detail > 1) return;
      const sel = window.getSelection();
      const text = sel?.toString().trim() ?? "";
      const n = text ? text.split(/\s+/).length : 0;
      if (n >= 2 && n <= 4 && sel!.rangeCount) lookup(text, sel!.getRangeAt(0).getBoundingClientRect(), { page: window.location.pathname });
    };
    window.addEventListener("keydown", onKey);
    document.addEventListener("dblclick", onDbl);
    document.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.removeEventListener("dblclick", onDbl);
      document.removeEventListener("mouseup", onUp);
    };
  }, [lookup]);

  // Popover: Esc closes, outside click closes, focus moves into it.
  useEffect(() => {
    if (!pop) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        close();
      }
    };
    const onDown = (e: MouseEvent) => {
      if (popRef.current && !popRef.current.contains(e.target as Node)) close();
    };
    window.addEventListener("keydown", onKey, true);
    document.addEventListener("mousedown", onDown);
    return () => {
      window.removeEventListener("keydown", onKey, true);
      document.removeEventListener("mousedown", onDown);
    };
  }, [pop, close]);

  useEffect(() => {
    if (pop?.status === "ready") popRef.current?.querySelector<HTMLElement>("#dict-pop-title")?.focus();
  }, [pop?.status, pop?.word]);

  const save = useCallback(async () => {
    if (!pop?.entry) return false;
    const res = await fetch("/api/dict/save", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lemma: pop.entry.lemma, lookup_id: pop.lookupId }),
    });
    return res.ok;
  }, [pop]);

  const value = useMemo<Ctx>(
    () => ({
      lookup,
      prefetch,
      openPalette: () => setPaletteOpen(true),
      setContext: (c) => (ctxRef.current = c),
      accent,
      role,
      sessionId,
      setSessionId,
    }),
    [lookup, prefetch, accent, role, sessionId],
  );

  // Position: below the word if there is room, otherwise above; clamped to the viewport.
  const style = (() => {
    if (!pop || typeof window === "undefined") return {};
    const width = Math.min(360, window.innerWidth - 32);
    const left = Math.min(Math.max(16, pop.rect.left + pop.rect.width / 2 - width / 2), window.innerWidth - width - 16);
    const below = window.innerHeight - pop.rect.bottom > 320;
    return below
      ? { top: pop.rect.bottom + 8, left, width }
      : { bottom: window.innerHeight - pop.rect.top + 8, left, width };
  })();

  return (
    <DictionaryContext.Provider value={value}>
      {children}
      {pop && (
        <div
          ref={popRef}
          role="dialog"
          aria-labelledby="dict-pop-title"
          aria-modal="false"
          className="fixed z-50 max-h-[70vh] overflow-y-auto rounded-3xl border bg-popover p-4 text-popover-foreground shadow-lg animate-slide-up"
          style={style}
          data-no-dict
        >
          <Button variant="ghost" size="icon-sm" className="absolute top-2 right-2" aria-label="Close dictionary" onClick={close}>
            <X aria-hidden />
          </Button>
          <div aria-live="polite" className="pr-10">
            {pop.status === "loading" && (
              <p className="flex items-center gap-2 text-muted-foreground">
                <Loader2 className="size-4 animate-spin" aria-hidden /> Looking up “{pop.word}”…
              </p>
            )}
            {pop.status === "missing" && (
              <p id="dict-pop-title" tabIndex={-1}>
                No entry for “{pop.word}”. Try the search palette (Ctrl/⌘ K).
              </p>
            )}
            {pop.status === "error" && (
              <p id="dict-pop-title" tabIndex={-1} role="alert" className="text-error">
                Couldn&apos;t load the dictionary. Check your connection.
              </p>
            )}
          </div>
          {pop.status === "ready" && pop.entry && (
            <EntryView
              key={`${pop.entry.lemma}-${pop.inDeck}`}
              entry={pop.entry}
              accent={accent}
              canSave={role === "learner"}
              inDeck={Boolean(pop.inDeck)}
              onSave={save}
              headingId="dict-pop-title"
            />
          )}
        </div>
      )}
      <SearchPalette open={paletteOpen} onOpenChange={setPaletteOpen} accent={accent} role={role} sessionId={sessionId} />
    </DictionaryContext.Provider>
  );
}
