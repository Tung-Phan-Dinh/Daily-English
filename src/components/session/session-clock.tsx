"use client";

import { useEffect, useRef, useState } from "react";
import { Timer } from "lucide-react";
import { cn } from "@/lib/utils";

const IDLE_AFTER_MS = 90_000; // no input for 90 s → stop counting
const FLUSH_EVERY_MS = 20_000;
export const HARD_CAP_MINUTES = 30;

/**
 * Counts active time: the tab is visible and there was input in the last 90 s.
 * Starts from the server's total (so reloads and pauses resume correctly) and
 * reports new time to the server every 20 s and when the tab is hidden or closed.
 */
export function useActiveTime(sessionId: string, initialMs: number, enabled: boolean) {
  const [activeMs, setActiveMs] = useState(initialMs);
  const pending = useRef(0);
  const lastInput = useRef(0);

  useEffect(() => {
    if (!enabled || !sessionId) return;
    lastInput.current = Date.now();
    const onInput = () => (lastInput.current = Date.now());
    const events = ["keydown", "pointerdown", "pointermove", "scroll", "input", "wheel", "touchstart"] as const;
    events.forEach((e) => window.addEventListener(e, onInput, { passive: true }));

    const flush = (keepalive = false) => {
      const ms = pending.current;
      if (ms < 1000) return;
      pending.current = 0;
      fetch("/api/session/time", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ session_id: sessionId, ms }),
        keepalive,
      }).catch(() => (pending.current += ms)); // retry with the next flush
    };

    const tick = setInterval(() => {
      const visible = document.visibilityState === "visible";
      const recent = Date.now() - lastInput.current < IDLE_AFTER_MS;
      if (visible && recent) {
        pending.current += 1000;
        setActiveMs((m) => m + 1000);
      }
    }, 1000);
    const flusher = setInterval(() => flush(), FLUSH_EVERY_MS);
    const onHide = () => {
      if (document.visibilityState === "hidden") flush(true);
    };
    const onUnload = () => flush(true);
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("pagehide", onUnload);

    return () => {
      clearInterval(tick);
      clearInterval(flusher);
      events.forEach((e) => window.removeEventListener(e, onInput));
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("pagehide", onUnload);
      flush(true);
    };
  }, [sessionId, enabled]);

  return activeMs;
}

const fmt = (ms: number) => {
  const s = Math.floor(Math.abs(ms) / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};

/** Countdown to the session's target time; after zero it counts overtime in orange. */
export function SessionClock({ activeMs, targetMinutes }: { activeMs: number; targetMinutes: number }) {
  const remaining = targetMinutes * 60_000 - activeMs;
  const over = remaining <= 0;
  const minutesLeft = Math.ceil(remaining / 60_000);
  return (
    <div
      role="timer"
      aria-label={over ? `Over time by ${Math.floor(-remaining / 60_000)} minutes` : `${minutesLeft} minutes left of ${targetMinutes}`}
      className={cn(
        "flex h-11 shrink-0 items-center gap-1.5 rounded-full px-3.5 font-mono text-base font-semibold tabular-nums shadow-soft",
        over ? "bg-streak-soft text-streak" : remaining < 3 * 60_000 ? "bg-orange text-on-accent" : "bg-card",
      )}
      title={over ? "Over the target time — finish this block and wrap up" : "Time left (counts only while you're active)"}
    >
      <Timer className="size-4" aria-hidden />
      <span aria-hidden>{over ? `+${fmt(remaining)}` : fmt(remaining)}</span>
    </div>
  );
}

export function targetMinutesFor(kind: string, shortDay: boolean): number {
  if (kind === "sunday") return 8;
  if (kind === "saturday") return 20;
  return shortDay ? 10 : 25;
}

/** Clock + one gentle message at the hard cap. Mounted once the session has loaded. */
export function SessionClockSlot({
  sessionId, initialMs, kind, shortDay, running,
}: {
  sessionId: string;
  initialMs: number;
  kind: string;
  shortDay: boolean;
  running: boolean;
}) {
  const activeMs = useActiveTime(sessionId, initialMs, running);
  const [dismissed, setDismissed] = useState(false);
  const capped = activeMs >= HARD_CAP_MINUTES * 60_000;
  return (
    <>
      <SessionClock activeMs={activeMs} targetMinutes={targetMinutesFor(kind, shortDay)} />
      {capped && running && !dismissed && (
        <div role="status" className="fixed inset-x-4 top-20 z-40 mx-auto flex max-w-xl items-start gap-3 rounded-3xl bg-streak-soft px-5 py-3 text-foreground shadow-float">
          <Timer className="mt-0.5 size-5 shrink-0 text-streak" aria-hidden />
          <p className="flex-1 text-base">
            <strong>{HARD_CAP_MINUTES} minutes — great effort.</strong> Finish this block, then wrap up. The rest can wait for tomorrow.
            <span lang="vi" className="block text-sm text-muted-foreground">30 phút rồi — làm xong phần này rồi nghỉ nhé.</span>
          </p>
          <button type="button" onClick={() => setDismissed(true)} className="min-h-11 rounded-full px-3 text-sm font-semibold hover:bg-muted">
            OK
          </button>
        </div>
      )}
    </>
  );
}
