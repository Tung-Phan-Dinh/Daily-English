"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2, Pause, Search, SkipForward, Timer, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useDictionary } from "@/components/dictionary/dictionary-provider";
import { BLOCK_META } from "@/lib/curriculum";
import type { SessionBlock } from "@/lib/session/types";
import { cn } from "@/lib/utils";
import { post } from "./api";
import { CheckBlock, GrammarBlock, ReviewBlock } from "./blocks/practice-blocks";
import { NewWordsBlock } from "./blocks/new-words-block";
import { ReadingBlock } from "./blocks/reading-block";
import { WrapUpBlock } from "./blocks/wrapup-block";
import { WritingBlock } from "./blocks/writing-block";
import type { AnswerResponse, Progress, SessionPayload, Settings } from "./types";

type Ctx = {
  payload: SessionPayload;
  progress: Progress;
  settings: Settings;
  /** Submit an answer; returns null on error (and reloads/redirects when needed). */
  answer: (block: SessionBlock, ref: string, response: string, meta: { usedHint: boolean; durationMs: number }) => Promise<AnswerResponse | null>;
  action: (body: Record<string, unknown>) => Promise<boolean>;
  commit: (p: Progress, patch?: Partial<SessionPayload>) => void;
  reload: () => Promise<void>;
};

const PlayerContext = createContext<Ctx | null>(null);
export const usePlayer = () => {
  const c = useContext(PlayerContext);
  if (!c) throw new Error("usePlayer outside player");
  return c;
};

type LoadState = { status: "loading" } | { status: "error"; message: string } | { status: "ready"; payload: SessionPayload };

export function SessionPlayer({ short, settings, name }: { short: boolean; settings: Settings; name: string }) {
  const router = useRouter();
  const dict = useDictionary();
  const [state, setState] = useState<LoadState>({ status: "loading" });
  const [progress, setProgress] = useState<Progress | null>(null);
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const blockStarted = useRef(0);

  const load = useCallback(async () => {
    const r = await post<{ status: string; payload?: SessionPayload }>("/api/session/start", { short_day: short });
    if (!r.ok) {
      setState({ status: "error", message: r.error });
      return;
    }
    if (r.data.status === "done_for_today" || !r.data.payload) {
      router.replace("/today");
      return;
    }
    setState({ status: "ready", payload: r.data.payload });
    setProgress(r.data.payload.session.progress);
    dict.setSessionId(r.data.payload.session.id);
  }, [short, router, dict]);

  useEffect(() => {
    // Initial fetch: state is only set after the request resolves.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
    // Load once on mount; `load` is stable for the life of this page.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleError = useCallback(
    async (err: { status: number; error: string; code?: string }) => {
      if (err.code === "done_for_today" || err.code === "stale_session") {
        router.replace("/today");
        return;
      }
      if (err.status === 409) {
        setNotice(err.error);
        await load();
        return;
      }
      setNotice(err.error);
    },
    [load, router],
  );

  const current = progress?.current;
  useEffect(() => {
    blockStarted.current = Date.now();
  }, [current]);

  const sessionId = state.status === "ready" ? state.payload.session.id : "";

  const answer: Ctx["answer"] = useCallback(
    async (block, ref, response, meta) => {
      setNotice("");
      const r = await post<AnswerResponse>("/api/answer", {
        session_id: sessionId, block, ref, response, duration_ms: meta.durationMs, used_hint: meta.usedHint,
      });
      if (!r.ok) {
        await handleError(r);
        return null;
      }
      if (r.data.duplicate) {
        setProgress(r.data.progress);
        return null;
      }
      return r.data;
    },
    [sessionId, handleError],
  );

  const action: Ctx["action"] = useCallback(
    async (body) => {
      setNotice("");
      const r = await post<{ progress: Progress; short_day?: boolean; status?: string }>("/api/session/action", { session_id: sessionId, ...body });
      if (!r.ok) {
        await handleError(r);
        return false;
      }
      setProgress(r.data.progress);
      if (state.status === "ready" && r.data.short_day !== undefined) {
        setState({ status: "ready", payload: { ...state.payload, session: { ...state.payload.session, short_day: Boolean(r.data.short_day) } } });
      }
      return true;
    },
    [sessionId, handleError, state],
  );

  const commit: Ctx["commit"] = useCallback((p, patch) => {
    setProgress(p);
    if (patch) setState((s) => (s.status === "ready" ? { status: "ready", payload: { ...s.payload, ...patch } } : s));
  }, []);

  const pause = useCallback(async () => {
    if (!current || current === "finished") return router.push("/today");
    setBusy("pause");
    await post("/api/session/action", { session_id: sessionId, action: "pause", block: current, ms: Date.now() - blockStarted.current });
    router.push("/today");
  }, [current, router, sessionId]);

  // Esc: pause and save (unless a dialog or the dictionary popover is open).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (document.querySelector("[role=dialog]")) return;
      e.preventDefault();
      pause();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [pause]);

  if (state.status === "loading" || !progress) {
    return (
      <div className="grid min-h-[60vh] place-items-center" aria-live="polite">
        <p className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="size-5 animate-spin" aria-hidden /> Getting today&apos;s session ready…
        </p>
      </div>
    );
  }
  if (state.status === "error") {
    return (
      <div className="mx-auto max-w-md py-24 text-center" role="alert">
        <h1 className="text-xl font-semibold">We couldn&apos;t open your session</h1>
        <p className="mt-2 text-muted-foreground">{state.message}</p>
        <div className="mt-6 flex justify-center gap-3">
          <Button onClick={() => { setState({ status: "loading" }); load(); }}>Try again</Button>
          <Button variant="outline" asChild>
            <Link href="/today">Back to Today</Link>
          </Button>
        </div>
      </div>
    );
  }

  const payload = state.payload;
  const s = payload.session;
  const blocks = s.blocks as SessionBlock[];
  const canSkip = current !== "finished" && current !== "wrapup" && !s.skipped_blocks.includes(current!);
  const canShort = s.kind === "weekday" && !s.short_day && (current === "review" || current === "grammar");
  const ctx: Ctx = { payload, progress, settings, answer, action, commit, reload: load };

  return (
    <PlayerContext.Provider value={ctx}>
      <div className="min-h-dvh">
        <header className="sticky top-0 z-30 bg-background/90 backdrop-blur">
          <div className="mx-auto flex max-w-5xl items-center gap-2 px-4 pt-3 sm:gap-3">
            <Button
              variant="outline"
              size="icon"
              className="shrink-0 border-transparent shadow-soft"
              onClick={pause}
              disabled={busy === "pause"}
              aria-busy={busy === "pause"}
              aria-label="Pause and save (Esc)"
              title="Pause and save (Esc)"
            >
              {busy === "pause" ? <Loader2 className="animate-spin" aria-hidden /> : <Pause aria-hidden />}
            </Button>
            <p className="min-w-0 flex-1 truncate text-center">
              <span className="block truncate text-base font-bold">{current && current !== "finished" ? BLOCK_META[current].title : "Finished"}</span>
              <span className="block truncate text-sm text-muted-foreground">
                {s.topic.name_en}
                {s.short_day && " · short day"}
              </span>
            </p>
            {canShort && (
              <Button variant="outline" size="icon" className="shrink-0 border-transparent shadow-soft sm:w-auto sm:px-4" disabled={busy !== null} onClick={async () => { setBusy("short"); await action({ action: "short_day" }); setBusy(null); }} aria-label="Short day" title="Short day: finish after grammar">
                <Timer aria-hidden /> <span className="hidden sm:inline">Short day</span>
              </Button>
            )}
            {canSkip && (
              <Button
                variant="outline"
                size="icon"
                className="shrink-0 border-transparent shadow-soft sm:w-auto sm:px-4"
                disabled={busy !== null}
                aria-label="Skip this block"
                title="Skip this block (once a day)"
                onClick={async () => {
                  if (!window.confirm(`Skip “${BLOCK_META[current!].title}” for today? Each block can be skipped once a day and skips show on the dashboard.`)) return;
                  setBusy("skip");
                  await action({ action: "skip", block: current });
                  setBusy(null);
                }}
              >
                <SkipForward aria-hidden /> <span className="hidden sm:inline">Skip</span>
              </Button>
            )}
            <Button size="icon" className="shrink-0" onClick={dict.openPalette} aria-label="Dictionary (/ or Ctrl+K)" title="Dictionary (/ or Ctrl+K)">
              <Search aria-hidden />
            </Button>
          </div>
          <SegmentBar blocks={blocks} progress={progress} payload={payload} />
          <SoftTimer key={current} block={current} />
        </header>

        {notice && (
          <div role="alert" className="mx-auto mt-4 flex max-w-3xl items-start gap-3 rounded-3xl bg-streak-soft px-5 py-3">
            <p className="flex-1">{notice}</p>
            <Button variant="ghost" size="icon-sm" aria-label="Dismiss" onClick={() => setNotice("")}>
              <X aria-hidden />
            </Button>
          </div>
        )}

        <main id="main" className={cn("mx-auto px-4 py-8", current === "reading" || current === "writing" ? "max-w-6xl" : "max-w-2xl")}>
          {current === "review" && <ReviewBlock />}
          {current === "grammar" && <GrammarBlock />}
          {current === "new_words" && <NewWordsBlock />}
          {current === "reading" && <ReadingBlock />}
          {current === "writing" && <WritingBlock />}
          {current === "check" && <CheckBlock />}
          {(current === "wrapup" || current === "finished") && <WrapUpBlock name={name} />}
        </main>
      </div>
    </PlayerContext.Provider>
  );
}

function SegmentBar({ blocks, progress, payload }: { blocks: SessionBlock[]; progress: Progress; payload: SessionPayload }) {
  const fraction = (b: SessionBlock) => {
    const bp = progress.blocks[b];
    if (!bp) return 0;
    if (bp.status === "done" || bp.status === "skipped") return 1;
    const len =
      b === "review" ? payload.review.length
        : b === "grammar" ? payload.grammar?.sequence.length ?? 0
          : b === "new_words" ? (payload.new_words?.words.length ?? 0) + (payload.new_words?.checks.length ?? 0)
            : b === "check" ? payload.check?.sequence.length ?? 0
              : 0;
    return len ? Math.min(1, bp.index / len) : 0;
  };
  return (
    <ol className="mx-auto flex max-w-5xl gap-1.5 px-4 pt-4 pb-2" aria-label="Session progress">
      {blocks.map((b) => {
        const f = fraction(b);
        const st = progress.blocks[b]?.status ?? "pending";
        return (
          <li key={b} className="flex-1">
            <div className="h-2 overflow-hidden rounded-full bg-[color-mix(in_oklch,var(--muted),var(--foreground)_6%)]">
              <div className={cn("h-full rounded-full transition-[width] duration-200", st === "skipped" ? "bg-slate/50" : "bg-brand")} style={{ width: `${f * 100}%` }} />
            </div>
            <span className="sr-only">
              {BLOCK_META[b].title}: {st === "done" ? "done" : st === "skipped" ? "skipped" : progress.current === b ? "in progress" : "not started"}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

/** Soft timer: a thin bar toward the block's target time — never cuts him off. */
function SoftTimer({ block }: { block: string | undefined }) {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    const start = Date.now();
    const t = setInterval(() => setElapsed(Date.now() - start), 5000);
    return () => clearInterval(t);
  }, []);
  if (!block || block === "finished" || block === "wrapup") return null;
  const target = BLOCK_META[block as SessionBlock].minutes * 60_000;
  const f = Math.min(1, elapsed / target);
  return (
    <div className="mx-auto max-w-5xl px-4 pb-2" aria-hidden>
      <div className="h-0.5 overflow-hidden rounded-full bg-muted">
        <div className="h-full bg-streak/70 transition-[width] duration-1000" style={{ width: `${f * 100}%` }} />
      </div>
    </div>
  );
}
