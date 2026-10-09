// Day boundaries. A learner "day" runs 04:00 → 04:00 in their stored time zone,
// always computed on the server (the device clock is never trusted).

export const DAY_BOUNDARY_HOUR = 4;

type Parts = { y: number; m: number; d: number; h: number; mi: number; s: number };

function wallParts(tz: string, at: Date): Parts {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });
  const p: Record<string, number> = {};
  for (const part of fmt.formatToParts(at)) {
    if (part.type !== "literal") p[part.type] = Number(part.value);
  }
  return { y: p.year, m: p.month, d: p.day, h: p.hour, mi: p.minute, s: p.second };
}

/** Offset of `tz` from UTC at instant `at`, in ms (positive east of UTC). */
function tzOffsetMs(tz: string, at: Date): number {
  const w = wallParts(tz, at);
  const asUtc = Date.UTC(w.y, w.m - 1, w.d, w.h, w.mi, w.s);
  return asUtc - Math.floor(at.getTime() / 1000) * 1000;
}

const iso = (ms: number) => new Date(ms).toISOString().slice(0, 10);

/** The learner's local date (YYYY-MM-DD) for instant `now`, with the 04:00 boundary. */
export function localDate(tz: string, now: Date = new Date()): string {
  const w = wallParts(tz, now);
  const wall = Date.UTC(w.y, w.m - 1, w.d, w.h, w.mi, w.s);
  return iso(wall - DAY_BOUNDARY_HOUR * 3600_000);
}

/** The UTC instant at which local date `date` begins (04:00 local). */
export function dayStart(tz: string, date: string): Date {
  const [y, m, d] = date.split("-").map(Number);
  const wallTarget = Date.UTC(y, m - 1, d, DAY_BOUNDARY_HOUR, 0, 0);
  // Two passes handle DST transitions.
  let guess = wallTarget - tzOffsetMs(tz, new Date(wallTarget));
  guess = wallTarget - tzOffsetMs(tz, new Date(guess));
  return new Date(guess);
}

/** The next 04:00 boundary after `now` (when tomorrow's session unlocks). */
export function nextBoundary(tz: string, now: Date = new Date()): Date {
  return dayStart(tz, addDays(localDate(tz, now), 1));
}

export function addDays(date: string, n: number): string {
  const [y, m, d] = date.split("-").map(Number);
  return iso(Date.UTC(y, m - 1, d + n));
}

/** 0 = Sunday … 6 = Saturday */
export function dayOfWeek(date: string): number {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

/** Monday of the week containing `date`. */
export function weekStart(date: string): string {
  const dow = dayOfWeek(date);
  return addDays(date, dow === 0 ? -6 : 1 - dow);
}

export function daysBetween(a: string, b: string): number {
  const [y1, m1, d1] = a.split("-").map(Number);
  const [y2, m2, d2] = b.split("-").map(Number);
  return Math.round((Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1)) / 86_400_000);
}

export type DayKind = "weekday" | "saturday" | "sunday";

export function dayKind(date: string): DayKind {
  const dow = dayOfWeek(date);
  return dow === 6 ? "saturday" : dow === 0 ? "sunday" : "weekday";
}
