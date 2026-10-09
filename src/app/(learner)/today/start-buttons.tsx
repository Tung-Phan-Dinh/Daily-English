"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Loader2, Timer } from "lucide-react";
import { Button } from "@/components/ui/button";

// On the periwinkle hero the CTA stays a black pill in both themes (as in the design).
const HERO_CTA = "bg-[#14161c] text-white hover:bg-[#14161c]/85";
const HERO_SECONDARY = "border-transparent bg-white text-[#14161c] hover:bg-white/85";

export function StartButtons({
  mode,
  kind = "weekday",
  sessionId,
}: {
  mode: "start" | "resume" | "continue_full";
  kind?: "weekday" | "saturday" | "sunday";
  sessionId?: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<null | "full" | "short">(null);
  const [error, setError] = useState("");

  if (mode === "continue_full") {
    return (
      <div>
        <Button
          className={HERO_CTA}
          disabled={busy !== null}
          aria-busy={busy !== null}
          onClick={async () => {
            setBusy("full");
            const res = await fetch("/api/session/action", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ action: "continue_full", session_id: sessionId }),
            });
            if (res.ok) router.push("/session");
            else {
              setBusy(null);
              setError((await res.json().catch(() => ({}))).error ?? "Couldn't continue.");
            }
          }}
        >
          {busy ? <Loader2 className="animate-spin" aria-hidden /> : <ArrowRight aria-hidden />} Continue to full session
        </Button>
        {error && <p role="alert" className="mt-2 text-sm font-medium">{error}</p>}
      </div>
    );
  }

  const go = (short: boolean) => {
    setBusy(short ? "short" : "full");
    router.push(short ? "/session?short=1" : "/session");
  };

  const label =
    mode === "resume"
      ? "Resume today's session"
      : kind === "sunday"
        ? "Start the weekly check · 8 min"
        : kind === "saturday"
          ? "Start Saturday's session · 20 min"
          : "Start today's session · 25 min";

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
      <Button size="xl" className={HERO_CTA} onClick={() => go(false)} disabled={busy !== null} aria-busy={busy === "full"}>
        {busy === "full" ? <Loader2 className="animate-spin" aria-hidden /> : null}
        {label}
        {busy !== "full" && <ArrowRight aria-hidden />}
      </Button>
      {mode === "start" && kind === "weekday" && (
        <Button size="xl" variant="outline" className={HERO_SECONDARY} onClick={() => go(true)} disabled={busy !== null} aria-busy={busy === "short"}>
          <Timer aria-hidden /> Short day · 10 min
        </Button>
      )}
    </div>
  );
}
