import Link from "next/link";
import { AlertTriangle, CheckCircle2, Flame, Info } from "lucide-react";
import { StatTile } from "@/components/progress/stat-tile";
import { ProgressRing } from "@/components/progress/progress-ring";
import { WeekDots } from "@/components/progress/week-dots";
import type { DashboardData } from "@/lib/dashboard/stats";
import { t, type Lang } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { CalendarHeatmap, MistakesChart, ReadingCharts, RecallChart, VocabGrowthChart, WritingBandChart } from "./charts";
import { RecentWriting } from "./recent-writing";

export function Dashboard({ data, lang, mode }: { data: DashboardData; lang: Lang; mode: "learner" | "family" }) {
  const h = data.headline;
  // Weekly target: Mon–Fri full sessions + Saturday (Sunday is rest).
  const weekTarget = 6;
  const daysDone = Math.min(weekTarget, data.week.filter((d) => d.status === "done" || d.status === "short").length);
  const other: Lang = lang === "en" ? "vi" : "en";
  return (
    <div className="space-y-6">
      {/* 1. Status strip — periwinkle hero with the week's completion ring */}
      <section className="hero-card p-5 sm:p-6" aria-labelledby="status-h">
        <div className="flex items-center gap-4">
          <div className="min-w-0 flex-1">
            <h2 id="status-h" className="text-sm font-semibold tracking-wide uppercase">{t("thisWeek", lang)}</h2>
            <p className="mt-1 text-4xl font-bold tracking-tight tabular-nums">
              {daysDone}<span className="text-xl font-semibold">/{weekTarget}</span>
            </p>
            <p className="text-base font-medium">{lang === "vi" ? "buổi học hoàn thành" : "sessions done"}</p>
            <p className="mt-3 flex flex-wrap items-center gap-2 text-sm font-semibold">
              <span className="flex items-center gap-1 rounded-full bg-white px-3 py-1.5 text-[#14161c]">
                <Flame className="size-4 text-[#a04a08]" aria-hidden /> {data.streak} {t("streak", lang)}
              </span>
              <span className="rounded-full bg-white/60 px-3 py-1.5 tabular-nums">{data.weekMinutes} {t("minutes", lang)}</span>
            </p>
          </div>
          <ProgressRing
            value={daysDone / weekTarget}
            size={112}
            stroke={10}
            label={`${daysDone} of ${weekTarget}`}
            trackClassName="stroke-white/50"
            barClassName="stroke-[#14161c]"
          >
            <span className="text-2xl font-bold tabular-nums">{Math.round((daysDone / weekTarget) * 100)}%</span>
          </ProgressRing>
        </div>
        <div className="mt-5 rounded-[28px] bg-card px-3 py-3 text-foreground">
          <WeekDots days={data.week} lang={lang} />
        </div>
      </section>

      {data.summary && (
        <section className="surface p-5" aria-labelledby="sum-h">
          <h2 id="sum-h" className="font-semibold">{t("weeklySummary", lang)}</h2>
          <p className="mt-2 text-base leading-relaxed" lang={lang}>{lang === "vi" ? data.summary.body_vi : data.summary.body_en}</p>
          <details className="mt-2 text-sm text-muted-foreground">
            <summary className="min-h-11 cursor-pointer content-center">{other === "vi" ? "Tiếng Việt" : "English"}</summary>
            <p lang={other}>{other === "vi" ? data.summary.body_vi : data.summary.body_en}</p>
          </details>
        </section>
      )}

      {/* 2. Insight cards (max 3) */}
      {data.insights.length > 0 && (
        <section aria-labelledby="ins-h">
          <h2 id="ins-h" className="sr-only">{t("insights", lang)}</h2>
          <ul className="grid gap-3 md:grid-cols-3">
            {data.insights.map((i) => {
              const Icon = i.tone === "good" ? CheckCircle2 : i.tone === "warn" ? AlertTriangle : Info;
              return (
                <li
                  key={i.en}
                  className={cn(
                    "flex gap-3 rounded-3xl border p-4",
                    i.tone === "good" && "border-success/40 bg-success-soft",
                    i.tone === "warn" && "border-streak/40 bg-streak-soft",
                    i.tone === "info" && "bg-card",
                  )}
                >
                  <Icon className={cn("mt-0.5 size-5 shrink-0", i.tone === "good" ? "text-success" : i.tone === "warn" ? "text-streak" : "text-slate")} aria-hidden />
                  <div>
                    <p className="text-base" lang={lang}>{i[lang]}</p>
                    <p className="text-sm text-muted-foreground" lang={other}>{i[other]}</p>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {/* 3. Four headline numbers */}
      <section aria-label="Headline numbers" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile
          label={t("wordsMastered", lang)}
          value={h.wordsMastered}
          sub={`${h.wordsMasteredDelta >= 0 ? "+" : ""}${h.wordsMasteredDelta} ${t("thisWeekChange", lang)}`}
        />
        <StatTile label={t("grammarMastered", lang)} value={`${h.pointsMastered}/${h.pointsTotal}`} />
        <StatTile label={t("readingAccuracy", lang)} value={h.readingAccuracy === null ? "—" : `${h.readingAccuracy}%`} />
        <StatTile
          label={t("writingBand", lang)}
          value={h.writingBand ? `${h.writingBand.gra.toFixed(1)} / ${h.writingBand.lr.toFixed(1)}` : "—"}
          sub={h.writingBand ? `GRA / LR · ${t("aiEstimate", lang)}` : t("noData", lang)}
        />
      </section>

      {/* 4. Charts */}
      <section aria-labelledby="charts-h" className="space-y-3">
        <h2 id="charts-h" className="text-lg font-semibold">{t("charts", lang)}</h2>
        <CalendarHeatmap data={data.charts.calendar} lang={lang} />
        <MistakesChart rows={data.charts.mistakes.rows} codes={data.charts.mistakes.codes} lang={lang} />
        <GrammarMapCard map={data.charts.grammarMap} lang={lang} linkable={mode === "learner"} />
        <VocabGrowthChart data={data.charts.vocabGrowth} lang={lang} />
        <RecallChart data={data.charts.recall} lang={lang} />
        <ReadingCharts byType={data.charts.readingByType} speed={data.charts.readingSpeed} lang={lang} />
        <WritingBandChart data={data.charts.writingBands} lang={lang} />
      </section>

      {mode === "learner" && data.lookups.top.length > 0 && (
        <section className="surface p-4 sm:p-5" aria-labelledby="lk-h">
          <h2 id="lk-h" className="font-semibold">{t("topLookups", lang)}</h2>
          <ul className="mt-3 flex flex-wrap gap-2">
            {data.lookups.top.map((l) => (
              <li key={l.lemma} className="rounded-lg bg-muted px-3 py-1.5 text-base">
                {l.lemma} <span className="text-muted-foreground tabular-nums">×{l.n}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* 5. Recent writing */}
      <RecentWriting items={data.recentWriting} lang={lang} canHide={mode === "learner"} />
    </div>
  );
}

function GrammarMapCard({
  map, lang, linkable,
}: {
  map: DashboardData["charts"]["grammarMap"];
  lang: Lang;
  linkable: boolean;
}) {
  const phases = [1, 2, 3, 4];
  return (
    <section className="surface px-4 py-3" aria-labelledby="gm-h">
      <h3 id="gm-h" className="font-semibold">{t("grammarMap", lang)}</h3>
      <p className="text-sm text-muted-foreground">{t("grammarMapCaption", lang)}</p>
      <div className="mt-3 space-y-3">
        {phases.map((ph) => (
          <div key={ph}>
            <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{t("phase", lang)} {ph}</p>
            <ul className="mt-1 grid grid-cols-2 gap-1.5 sm:grid-cols-3 lg:grid-cols-6">
              {map.filter((g) => g.phase === ph).map((g) => {
                const inner = (
                  <>
                    <span className="line-clamp-2 text-sm leading-snug">{lang === "vi" ? g.title_vi || g.title : g.title}</span>
                    <span className="mt-1 text-xs text-muted-foreground">
                      {g.status === "mastered" ? `✓ ${t("mastered", lang)}` : g.status === "learning" ? `◐ ${t("learning", lang)}${g.accuracy !== null ? ` · ${g.accuracy}%` : ""}` : `○ ${t("notStarted", lang)}`}
                    </span>
                  </>
                );
                const cls = cn(
                  "flex min-h-16 flex-col justify-between rounded-lg border p-2",
                  g.status === "mastered" && "border-success/50 bg-success-soft",
                  g.status === "learning" && "border-brand/40 bg-brand-soft",
                );
                return (
                  <li key={g.id}>
                    {linkable ? <Link href={`/grammar/${g.slug}`} className={cn(cls, "hover:border-brand")}>{inner}</Link> : <div className={cls}>{inner}</div>}
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}
