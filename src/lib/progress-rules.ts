// Mastery, weakness and streak rules (pure).

import { PRODUCTION_FORMATS, STREAK_FREEZES_PER_MONTH } from "@/lib/curriculum";
import { addDays, dayOfWeek } from "@/lib/time";

// ---------------------------------------------------------------------------
// Mastery: rolling accuracy ≥85% over the last 20 attempts, ≥2 formats
// including a production format, on ≥2 different days.
// ---------------------------------------------------------------------------

export type AttemptLite = { correct: boolean; format: string | null; local_date: string };

export function isPointMastered(attemptsNewestFirst: AttemptLite[]): boolean {
  const last = attemptsNewestFirst.slice(0, 20);
  if (last.length < 20) return false;
  const accuracy = last.filter((a) => a.correct).length / last.length;
  const formats = new Set(last.map((a) => a.format ?? ""));
  const hasProduction = [...formats].some((f) => PRODUCTION_FORMATS.has(f));
  const days = new Set(last.map((a) => a.local_date));
  return accuracy >= 0.85 && formats.size >= 2 && hasProduction && days.size >= 2;
}

export function pointStatus(attemptsNewestFirst: AttemptLite[]): "not_started" | "learning" | "mastered" {
  if (attemptsNewestFirst.length === 0) return "not_started";
  return isPointMastered(attemptsNewestFirst) ? "mastered" : "learning";
}

// ---------------------------------------------------------------------------
// Weakness (0 = solid, 1 = weak). One model fed by drills and writing.
// ---------------------------------------------------------------------------

export function weaknessFromAttempt(prev: number, correct: boolean): number {
  return clamp01(prev * 0.85 + (correct ? 0 : 1) * 0.15);
}

/** Writing density (errors per 100 words) pulls the score toward density/4, capped at 1. */
export function weaknessFromDensity(prev: number, per100: number): number {
  return clamp01(prev * 0.7 + Math.min(1, per100 / 4) * 0.3);
}

export function weaknessFromPlacement(wrong: number, total: number, writingPer100 = 0): number {
  const drill = total > 0 ? wrong / total : 0.5;
  return clamp01(writingPer100 > 0 ? drill * 0.7 + Math.min(1, writingPer100 / 4) * 0.3 : drill);
}

export function weakestCodes(rows: { error_code: string; score: number }[], n = 5): string[] {
  return rows
    .slice()
    .sort((a, b) => b.score - a.score)
    .slice(0, n)
    .map((r) => r.error_code);
}

function clamp01(x: number) {
  return Math.max(0, Math.min(1, x));
}

// ---------------------------------------------------------------------------
// Streak: a day counts when blocks 1 and 2 were done (streak_ok). Sundays are
// rest days and never break it. Two automatic freezes per calendar month.
// ---------------------------------------------------------------------------

export type DayRecord = { local_date: string; streak_ok: boolean };

export function computeStreak(days: DayRecord[], today: string): { current: number; frozen: string[] } {
  const ok = new Set(days.filter((d) => d.streak_ok).map((d) => d.local_date));
  const first = days.map((d) => d.local_date).sort()[0];
  if (!first) return { current: 0, frozen: [] };
  const freezesUsed = new Map<string, number>();
  const frozen: string[] = [];
  let current = 0;
  // Today doesn't break the streak until it's over.
  let d = ok.has(today) ? today : addDays(today, -1);
  while (d >= first) {
    if (ok.has(d)) {
      current++;
    } else if (dayOfWeek(d) === 0) {
      // Sunday rest
    } else {
      const month = d.slice(0, 7);
      const used = freezesUsed.get(month) ?? 0;
      if (used >= STREAK_FREEZES_PER_MONTH) break;
      freezesUsed.set(month, used + 1);
      frozen.push(d);
    }
    d = addDays(d, -1);
  }
  // Freezes only count if they bridge to an earlier practised day.
  while (frozen.length && frozen[frozen.length - 1] < [...ok].filter((x) => x <= today).sort()[0]) frozen.pop();
  return { current, frozen };
}
