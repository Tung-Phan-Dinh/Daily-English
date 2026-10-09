"use client";

import { Bar, BarChart, CartesianGrid, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

/** The mini chart for Tuesday's describe-a-chart task. Single series, direct labels, table fallback. */
export function TaskChart({ data }: { data: { title: string; unit: string; points: { label: string; value: number }[] } }) {
  return (
    <figure className="rounded-3xl border bg-background p-4">
      <figcaption className="text-base font-medium">{data.title}</figcaption>
      <div className="mt-2 h-52" role="img" aria-label={`${data.title}: ${data.points.map((p) => `${p.label} ${p.value}${data.unit}`).join(", ")}`}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data.points} margin={{ top: 24, right: 8, left: -16, bottom: 0 }}>
            <CartesianGrid vertical={false} stroke="var(--border)" />
            <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fill: "var(--muted-foreground)", fontSize: 14 }} />
            <YAxis tickLine={false} axisLine={false} tick={{ fill: "var(--muted-foreground)", fontSize: 12 }} width={44} />
            <Tooltip
              cursor={{ fill: "var(--muted)" }}
              contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8, color: "var(--foreground)" }}
              formatter={(v) => [`${v}${data.unit}`, data.title]}
            />
            <Bar dataKey="value" fill="var(--chart-1)" radius={[4, 4, 0, 0]} maxBarSize={48} isAnimationActive={false}>
              <LabelList dataKey="value" position="top" formatter={(v) => `${v}${data.unit}`} style={{ fill: "var(--foreground)", fontSize: 13 }} />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <details className="mt-2 text-sm">
        <summary className="min-h-11 cursor-pointer content-center text-muted-foreground">Show as a table</summary>
        <table className="mt-1 w-full text-left">
          <thead>
            <tr><th className="py-1 font-medium">Year</th><th className="py-1 font-medium">Value</th></tr>
          </thead>
          <tbody>
            {data.points.map((p) => (
              <tr key={p.label} className="border-t"><td className="py-1">{p.label}</td><td className="py-1 tabular-nums">{p.value}{data.unit}</td></tr>
            ))}
          </tbody>
        </table>
      </details>
    </figure>
  );
}
