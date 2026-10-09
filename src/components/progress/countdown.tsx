"use client";

import { useEffect, useState } from "react";

/** Counts down to the next 04:00 boundary (computed on the server). */
export function Countdown({ to, lang = "en" }: { to: string; lang?: "en" | "vi" }) {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    const first = setTimeout(() => setNow(Date.now()), 0);
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => {
      clearTimeout(first);
      clearInterval(t);
    };
  }, []);
  if (now === null) return <span className="tabular-nums">…</span>;
  const ms = Math.max(0, Date.parse(to) - now);
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  if (ms === 0) return <span>{lang === "vi" ? "Đã sẵn sàng — tải lại trang" : "Ready — reload the page"}</span>;
  return (
    <time dateTime={to} className="tabular-nums">
      {h > 0 ? `${h}h ${m}m` : `${m}m`}
    </time>
  );
}
