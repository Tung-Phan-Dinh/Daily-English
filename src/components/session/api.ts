"use client";

export type ApiResult<T> = { ok: true; data: T } | { ok: false; status: number; error: string; code?: string };

export async function post<T>(url: string, body: unknown): Promise<ApiResult<T>> {
  try {
    const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return { ok: false, status: res.status, error: data.error ?? "Something went wrong.", code: data.code };
    return { ok: true, data: data as T };
  } catch {
    return { ok: false, status: 0, error: "You seem to be offline. Your progress up to the last answer is saved." };
  }
}

/** Optional soft "correct" sound (setting), generated — no audio files. */
export function chime() {
  try {
    const ctx = new AudioContext();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.frequency.value = 880;
    g.gain.setValueAtTime(0.0001, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.06, ctx.currentTime + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.25);
    o.connect(g).connect(ctx.destination);
    o.start();
    o.stop(ctx.currentTime + 0.3);
  } catch {}
}
