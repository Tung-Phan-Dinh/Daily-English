"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, LabelList, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { ERROR_LABELS, QUESTION_TYPE_LABELS, type AnyErrorCode } from "@/lib/curriculum";
import { t, type Lang } from "@/lib/i18n";
import { cn } from "@/lib/utils";

// Validated categorical order (see dataviz validator run): teal, orange, violet, yellow, magenta.
const SERIES = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)"];
const axisTick = { fill: "var(--muted-foreground)", fontSize: 12 };
const tooltipStyle = {
  contentStyle: { background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8, color: "var(--foreground)", fontSize: 14 },
  labelStyle: { color: "var(--muted-foreground)" },
};
const shortDate = (d: string) => new Date(d + "T00:00:00Z").toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });

/** A chart card: title + one-line "what good looks like" caption, tap to expand, table view. */
export function ChartCard({
  title, caption, children, table, lang, defaultOpen = false, empty,
}: {
  title: string;
  caption: string;
  children: React.ReactNode;
  table: { head: string[]; rows: (string | number)[][] };
  lang: Lang;
  defaultOpen?: boolean;
  empty?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const id = title.replace(/\W+/g, "-").toLowerCase();
  return (
    <section className="surface" aria-labelledby={`${id}-h`}>
      <button
        type="button"
        className="flex min-h-14 w-full items-center gap-3 px-4 py-3 text-left"
        aria-expanded={open}
        aria-controls={`${id}-body`}
        onClick={() => setOpen((o) => !o)}
      >
        <span className="flex-1">
          <span id={`${id}-h`} className="block font-semibold">{title}</span>
          <span className="block text-sm text-muted-foreground">{caption}</span>
        </span>
        <ChevronDown className={cn("size-5 shrink-0 transition-transform", open && "rotate-180")} aria-hidden />
      </button>
      {open && (
        <div id={`${id}-body`} className="border-t px-4 pt-3 pb-4">
          {empty ? <p className="py-6 text-center text-muted-foreground">{t("noData", lang)}</p> : children}
          {!empty && table.rows.length > 0 && (
            <details className="mt-2 text-sm">
              <summary className="min-h-11 cursor-pointer content-center text-muted-foreground">{t("showTable", lang)}</summary>
              <div className="overflow-x-auto">
                <table className="w-full text-left tabular-nums">
                  <thead>
                    <tr>{table.head.map((h) => <th key={h} className="py-1 pr-3 font-medium">{h}</th>)}</tr>
                  </thead>
                  <tbody>
                    {table.rows.map((r, i) => (
                      <tr key={i} className="border-t">{r.map((c, j) => <td key={j} className="py-1 pr-3">{c}</td>)}</tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </details>
          )}
        </div>
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------

export function CalendarHeatmap({ data, lang }: { data: { date: string; minutes: number; future: boolean }[]; lang: Lang }) {
  // 12 columns (weeks) × 7 rows; sequential teal ramp by minutes.
  const level = (m: number) => (m <= 0 ? 0 : m < 10 ? 1 : m < 20 ? 2 : m < 30 ? 3 : 4);
  const fills = ["var(--muted)", "color-mix(in oklch, var(--chart-1) 30%, var(--card))", "color-mix(in oklch, var(--chart-1) 55%, var(--card))", "color-mix(in oklch, var(--chart-1) 80%, var(--card))", "var(--chart-1)"];
  const weeks: (typeof data)[] = [];
  for (let i = 0; i < data.length; i += 7) weeks.push(data.slice(i, i + 7));
  return (
    <ChartCard
      lang={lang}
      title={t("calendar", lang)}
      caption={t("calendarCaption", lang)}
      defaultOpen
      table={{ head: ["Date", "Minutes"], rows: data.filter((d) => !d.future && d.minutes > 0).map((d) => [d.date, d.minutes]) }}
    >
      <div className="flex gap-1 overflow-x-auto pb-1" role="img" aria-label={`${t("calendar", lang)}: ${data.filter((d) => d.minutes > 0).length} active days in 12 weeks`}>
        {weeks.map((w, i) => (
          <div key={i} className="flex flex-col gap-1">
            {w.map((d) => (
              <span
                key={d.date}
                title={`${shortDate(d.date)}: ${d.minutes} min`}
                className={cn("size-5 rounded-[4px] sm:size-6", d.future && "opacity-30")}
                style={{ background: fills[level(d.minutes)] }}
              />
            ))}
          </div>
        ))}
      </div>
      <div className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground" aria-hidden>
        0 {fills.map((f, i) => <span key={i} className="size-3 rounded-[3px]" style={{ background: f }} />)} 30+ min
      </div>
    </ChartCard>
  );
}

export function MistakesChart({ rows, codes, lang }: { rows: Record<string, string | number>[]; codes: string[]; lang: Lang }) {
  const label = (c: string) => ERROR_LABELS[c as AnyErrorCode]?.[lang] ?? c;
  return (
    <ChartCard
      lang={lang}
      title={t("mistakes", lang)}
      caption={t("mistakesCaption", lang)}
      empty={rows.length === 0}
      table={{ head: ["Week", ...codes.map(label)], rows: rows.map((r) => [String(r.week), ...codes.map((c) => r[c] ?? 0)]) }}
    >
      <div className="h-64">
        <ResponsiveContainer>
          <LineChart data={rows} margin={{ top: 8, right: 16, left: -16, bottom: 0 }}>
            <CartesianGrid vertical={false} stroke="var(--border)" />
            <XAxis dataKey="week" tickFormatter={shortDate} tick={axisTick} tickLine={false} axisLine={false} />
            <YAxis tick={axisTick} tickLine={false} axisLine={false} width={40} />
            <Tooltip {...tooltipStyle} labelFormatter={(l) => `Week of ${shortDate(String(l))}`} />
            <Legend formatter={(v) => <span className="text-sm text-foreground">{label(String(v))}</span>} />
            {codes.map((c, i) => (
              <Line key={c} dataKey={c} name={c} stroke={SERIES[i]} strokeWidth={2} dot={{ r: 4, strokeWidth: 2, stroke: "var(--card)" }} isAnimationActive={false} />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </ChartCard>
  );
}

export function VocabGrowthChart({ data, lang }: { data: { local_date: string; learning: number; review: number; mastered: number }[]; lang: Lang }) {
  return (
    <ChartCard
      lang={lang}
      title={t("vocabGrowth", lang)}
      caption={t("vocabCaption", lang)}
      empty={data.length === 0}
      table={{ head: ["Date", t("learning", lang), t("review", lang), t("mastered", lang)], rows: data.map((d) => [d.local_date, d.learning, d.review, d.mastered]) }}
    >
      <div className="h-64">
        <ResponsiveContainer>
          <AreaChart data={data} margin={{ top: 8, right: 16, left: -16, bottom: 0 }}>
            <CartesianGrid vertical={false} stroke="var(--border)" />
            <XAxis dataKey="local_date" tickFormatter={shortDate} tick={axisTick} tickLine={false} axisLine={false} />
            <YAxis tick={axisTick} tickLine={false} axisLine={false} width={40} allowDecimals={false} />
            <Tooltip {...tooltipStyle} labelFormatter={(l) => shortDate(String(l))} />
            <Legend formatter={(v) => <span className="text-sm text-foreground">{v}</span>} />
            <Area dataKey="mastered" name={t("mastered", lang)} stackId="1" stroke="var(--chart-1)" fill="var(--chart-1)" fillOpacity={0.85} strokeWidth={2} isAnimationActive={false} />
            <Area dataKey="review" name={t("review", lang)} stackId="1" stroke="var(--chart-3)" fill="var(--chart-3)" fillOpacity={0.6} strokeWidth={2} isAnimationActive={false} />
            <Area dataKey="learning" name={t("learning", lang)} stackId="1" stroke="var(--chart-2)" fill="var(--chart-2)" fillOpacity={0.45} strokeWidth={2} isAnimationActive={false} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </ChartCard>
  );
}

export function RecallChart({ data, lang }: { data: { week: string; pct: number; total: number }[]; lang: Lang }) {
  return (
    <ChartCard
      lang={lang}
      title={t("recall", lang)}
      caption={t("recallCaption", lang)}
      empty={data.length === 0}
      table={{ head: ["Week", "%", "Cards"], rows: data.map((d) => [d.week, d.pct, d.total]) }}
    >
      <div className="h-56">
        <ResponsiveContainer>
          <LineChart data={data} margin={{ top: 16, right: 16, left: -16, bottom: 0 }}>
            <CartesianGrid vertical={false} stroke="var(--border)" />
            <XAxis dataKey="week" tickFormatter={shortDate} tick={axisTick} tickLine={false} axisLine={false} />
            <YAxis domain={[0, 100]} tick={axisTick} tickLine={false} axisLine={false} width={40} unit="%" />
            <Tooltip {...tooltipStyle} formatter={(v) => [`${v}%`, t("recall", lang)]} labelFormatter={(l) => `Week of ${shortDate(String(l))}`} />
            <Line dataKey="pct" stroke="var(--chart-1)" strokeWidth={2} dot={{ r: 4, strokeWidth: 2, stroke: "var(--card)" }} isAnimationActive={false}>
              <LabelList dataKey="pct" position="top" formatter={(v) => `${v}%`} style={{ fill: "var(--foreground)", fontSize: 12 }} />
            </Line>
          </LineChart>
        </ResponsiveContainer>
      </div>
    </ChartCard>
  );
}

export function ReadingCharts({ byType, speed, lang }: { byType: { type: string; pct: number; total: number }[]; speed: { date: string; wpm: number }[]; lang: Lang }) {
  const typed = byType.map((d) => ({ ...d, label: QUESTION_TYPE_LABELS[d.type] ?? d.type }));
  return (
    <>
      <ChartCard
        lang={lang}
        title={t("reading", lang)}
        caption={t("readingCaption", lang)}
        empty={typed.length === 0}
        table={{ head: ["Type", "%", "Questions"], rows: typed.map((d) => [d.label, d.pct, d.total]) }}
      >
        <div className="h-56">
          <ResponsiveContainer>
            <BarChart data={typed} layout="vertical" margin={{ top: 0, right: 40, left: 0, bottom: 0 }}>
              <CartesianGrid horizontal={false} stroke="var(--border)" />
              <XAxis type="number" domain={[0, 100]} tick={axisTick} tickLine={false} axisLine={false} unit="%" />
              <YAxis type="category" dataKey="label" tick={{ ...axisTick, fontSize: 13 }} width={150} tickLine={false} axisLine={false} />
              <Tooltip {...tooltipStyle} cursor={{ fill: "var(--muted)" }} formatter={(v) => [`${v}%`, "Accuracy"]} />
              <Bar dataKey="pct" fill="var(--chart-1)" radius={[0, 4, 4, 0]} maxBarSize={28} isAnimationActive={false}>
                <LabelList dataKey="pct" position="right" formatter={(v) => `${v}%`} style={{ fill: "var(--foreground)", fontSize: 12 }} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </ChartCard>
      <ChartCard
        lang={lang}
        title={t("readingSpeed", lang)}
        caption={t("readingSpeedCaption", lang)}
        empty={speed.length === 0}
        table={{ head: ["Date", "WPM"], rows: speed.map((d) => [d.date, d.wpm]) }}
      >
        <div className="h-48">
          <ResponsiveContainer>
            <LineChart data={speed} margin={{ top: 8, right: 16, left: -16, bottom: 0 }}>
              <CartesianGrid vertical={false} stroke="var(--border)" />
              <XAxis dataKey="date" tickFormatter={shortDate} tick={axisTick} tickLine={false} axisLine={false} />
              <YAxis tick={axisTick} tickLine={false} axisLine={false} width={40} />
              <Tooltip {...tooltipStyle} formatter={(v) => [`${v} wpm`, t("readingSpeed", lang)]} labelFormatter={(l) => shortDate(String(l))} />
              <Line dataKey="wpm" stroke="var(--chart-1)" strokeWidth={2} dot={{ r: 4, strokeWidth: 2, stroke: "var(--card)" }} isAnimationActive={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </ChartCard>
    </>
  );
}

export function WritingBandChart({ data, lang }: { data: { date: string; gra: number; lr: number }[]; lang: Lang }) {
  return (
    <ChartCard
      lang={lang}
      title={`${t("writingChart", lang)} · ${t("aiEstimate", lang)}`}
      caption={t("writingCaption", lang)}
      empty={data.length === 0}
      table={{ head: ["Date", "GRA", "LR"], rows: data.map((d) => [d.date, d.gra, d.lr]) }}
    >
      <div className="h-56">
        <ResponsiveContainer>
          <LineChart data={data} margin={{ top: 8, right: 16, left: -16, bottom: 0 }}>
            <CartesianGrid vertical={false} stroke="var(--border)" />
            <XAxis dataKey="date" tickFormatter={shortDate} tick={axisTick} tickLine={false} axisLine={false} />
            <YAxis domain={[4, 8]} ticks={[4, 5, 6, 7, 8]} tick={axisTick} tickLine={false} axisLine={false} width={40} />
            <Tooltip {...tooltipStyle} labelFormatter={(l) => shortDate(String(l))} />
            <Legend formatter={(v) => <span className="text-sm text-foreground">{v}</span>} />
            <Line dataKey="gra" name="Grammar (GRA)" stroke="var(--chart-1)" strokeWidth={2} dot={{ r: 4, strokeWidth: 2, stroke: "var(--card)" }} isAnimationActive={false} />
            <Line dataKey="lr" name="Vocabulary (LR)" stroke="var(--chart-2)" strokeWidth={2} dot={{ r: 4, strokeWidth: 2, stroke: "var(--card)" }} isAnimationActive={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </ChartCard>
  );
}
