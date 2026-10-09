import { ERROR_LABELS, type AnyErrorCode } from "@/lib/curriculum";
import type { DashboardData } from "./stats";

/** The week's numbers only — no writing text leaves the database. */
export function summaryStats(d: DashboardData) {
  const doneDays = d.week.filter((x) => x.status === "done" || x.status === "short").length;
  const codes = d.charts.mistakes.codes;
  const rows = d.charts.mistakes.rows;
  const last = rows.at(-1);
  const prev = rows.at(-2);
  const changes = codes.map((c) => ({
    code: c,
    label: ERROR_LABELS[c as AnyErrorCode]?.en ?? c,
    now: last ? Number(last[c] ?? 0) : null,
    before: prev ? Number(prev[c] ?? 0) : null,
  }));
  return {
    sessions_this_week: doneDays,
    minutes_this_week: d.weekMinutes,
    streak_days: d.streak,
    words_mastered: d.headline.wordsMastered,
    words_mastered_change_7d: d.headline.wordsMasteredDelta,
    grammar_points_mastered: `${d.headline.pointsMastered}/${d.headline.pointsTotal}`,
    reading_accuracy_7d_pct: d.headline.readingAccuracy,
    writing_band_7d_avg: d.headline.writingBand,
    error_density_per_100_words: changes,
    reviews_due: d.dueCount,
    skipped_blocks: d.weekSkips.length,
  };
}

export function fallbackSummary(s: ReturnType<typeof summaryStats>): { en: string; vi: string } {
  const top = s.error_density_per_100_words[0];
  const best = s.error_density_per_100_words
    .filter((c) => c.now !== null && c.before !== null && c.now < c.before)
    .sort((a, b) => (b.before! - b.now!) - (a.before! - a.now!))[0];
  const topVi = top ? ERROR_LABELS[top.code as AnyErrorCode]?.vi ?? top.code : "";
  const bestVi = best ? ERROR_LABELS[best.code as AnyErrorCode]?.vi ?? best.code : "";
  return {
    en: [
      `He practised on ${s.sessions_this_week} days this week (${s.minutes_this_week} minutes).`,
      best ? `His biggest improvement was ${best.label.toLowerCase()}: ${best.before} → ${best.now} errors per 100 words.` : "There is not enough writing yet to show a clear improvement.",
      top ? `His main remaining weakness is ${top.label.toLowerCase()} (${top.now ?? "–"} per 100 words).` : "No clear weakness stands out yet.",
      `He has now mastered ${s.words_mastered} words (${s.words_mastered_change_7d >= 0 ? "+" : ""}${s.words_mastered_change_7d} this week).`,
      s.sessions_this_week < 5 ? "A short reminder at the same time each day would help him keep the routine." : "Ask him to show you one paragraph he wrote this week.",
    ].join(" "),
    vi: [
      `Tuần này em đã học ${s.sessions_this_week} ngày (${s.minutes_this_week} phút).`,
      best ? `Tiến bộ lớn nhất là ${bestVi.toLowerCase()}: từ ${best.before} còn ${best.now} lỗi/100 từ.` : "Chưa đủ bài viết để thấy rõ tiến bộ.",
      top ? `Điểm yếu chính còn lại là ${topVi.toLowerCase()} (${top.now ?? "–"} lỗi/100 từ).` : "Chưa có điểm yếu nổi bật.",
      `Em đã thuộc ${s.words_mastered} từ (${s.words_mastered_change_7d >= 0 ? "+" : ""}${s.words_mastered_change_7d} trong tuần).`,
      s.sessions_this_week < 5 ? "Gia đình có thể nhắc em học vào cùng một giờ mỗi ngày." : "Hãy nhờ em cho xem một đoạn văn em đã viết tuần này.",
    ].join(" "),
  };
}
