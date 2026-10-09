import type { Metadata } from "next";
import { requireViewer } from "@/lib/auth";
import { env } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import { localDate } from "@/lib/time";
import { ApprovalQueue, LearnerControls } from "./admin-client";

export const metadata: Metadata = { title: "Admin" };

function timeWindows() {
  const monthStart = new Date();
  monthStart.setUTCDate(1);
  monthStart.setUTCHours(0, 0, 0, 0);
  const now = new Date();
  const daysInMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0)).getUTCDate();
  return { monthStart, dayAgo: new Date(Date.now() - 86_400_000).toISOString(), dayOfMonth: now.getUTCDate(), daysInMonth };
}

export default async function AdminPage() {
  await requireViewer(["admin"]);
  const db = await createClient();
  const { monthStart, dayAgo, dayOfMonth, daysInMonth } = timeWindows();

  const [{ data: people }, { data: calls }, { count: calls24 }, { data: items }, { data: passages }, { data: tasks }, { data: batches }, { data: resets }, { count: sessionsThisMonth }, { data: vocabDrafts }] = await Promise.all([
    db.from("profiles").select("id, display_name, role, timezone, ui_lang").order("role"),
    db.from("ai_calls").select("route, model, input_tokens, output_tokens, cost_usd, ok").gte("created_at", monthStart.toISOString()).limit(20000),
    db.from("ai_calls").select("id", { count: "exact", head: true }).gte("created_at", dayAgo),
    db.from("grammar_items").select("id, prompt, format, error_code, answers, explanation_en, created_at, grammar_points(title)").eq("status", "draft").eq("source", "generated").order("created_at").limit(200),
    db.from("reading_passages").select("id, title, body, scheduled_for, created_at, reading_questions(prompt, type, answer)").eq("status", "draft").order("scheduled_for").limit(30),
    db.from("writing_tasks").select("id, type, prompt, scheduled_for, created_at").eq("status", "draft").order("scheduled_for").limit(30),
    db.from("content_batches").select("week_start, status, summary, created_at").order("created_at", { ascending: false }).limit(5),
    db.from("session_resets").select("local_date, reason, created_at").order("created_at", { ascending: false }).limit(5),
    db.from("sessions").select("id", { count: "exact", head: true }).gte("local_date", monthStart.toISOString().slice(0, 10)),
    db.from("vocab_items").select("id, lemma, pos, gloss_vi, definition_en, created_at, topics(name_en, week_order)").eq("status", "draft").is("owner_id", null).order("frequency_rank").limit(1000),
  ]);

  const learners = (people ?? []).filter((p) => p.role === "learner");
  const spend = (calls ?? []).reduce((s, c) => s + Number(c.cost_usd), 0);
  const byRoute = new Map<string, { calls: number; cost: number; tokens: number }>();
  for (const c of calls ?? []) {
    const r = byRoute.get(c.route) ?? { calls: 0, cost: 0, tokens: 0 };
    r.calls++;
    r.cost += Number(c.cost_usd);
    r.tokens += c.input_tokens + c.output_tokens;
    byRoute.set(c.route, r);
  }
  const budget = env.aiMonthlyBudgetUsd();
  const perSession = sessionsThisMonth ? spend / sessionsThisMonth : null;
  const projected = (spend / Math.max(1, dayOfMonth)) * daysInMonth;

  const queue = (
    <ApprovalQueue
      items={(items ?? []).map((i) => ({ ...i, point: (i.grammar_points as { title?: string } | null)?.title ?? "" }))}
      passages={passages ?? []}
      tasks={tasks ?? []}
      batches={batches ?? []}
      vocab={(vocabDrafts ?? []).map((v) => ({ ...v, topic: (v.topics as { name_en?: string } | null)?.name_en ?? "Other" }))}
    />
  );

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Admin</h1>
        <p className="mt-1 text-muted-foreground">Content approval, the learner&apos;s day and AI spend.</p>
      </div>

      {/* Most-used first: the approval queue */}
      {queue}

      <LearnerControls learners={learners} today={learners[0] ? localDate(learners[0].timezone) : ""} resets={resets ?? []} />

      <section className="surface p-5" aria-labelledby="spend-h">
        <h2 id="spend-h" className="text-lg font-semibold">AI spend this month</h2>
        <p className="mt-1 text-3xl font-semibold tabular-nums">${spend.toFixed(3)} <span className="text-base font-normal text-muted-foreground">of ${budget.toFixed(2)} budget</span></p>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted" role="progressbar" aria-label="Monthly AI budget used" aria-valuemin={0} aria-valuemax={budget} aria-valuenow={Number(spend.toFixed(3))}>
          <div className={projected > budget ? "h-full rounded-full bg-streak" : "h-full rounded-full bg-brand"} style={{ width: `${Math.min(100, (spend / budget) * 100)}%` }} />
        </div>
        <dl className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="rounded-2xl bg-muted px-4 py-3">
            <dt className="text-sm text-muted-foreground">Per session</dt>
            <dd className="text-2xl font-semibold tabular-nums">{perSession === null ? "—" : `$${perSession.toFixed(3)}`}</dd>
            <dd className="text-sm text-muted-foreground">{sessionsThisMonth ?? 0} session{sessionsThisMonth === 1 ? "" : "s"} this month</dd>
          </div>
          <div className="rounded-2xl bg-muted px-4 py-3">
            <dt className="text-sm text-muted-foreground">Projected for the month</dt>
            <dd className="text-2xl font-semibold tabular-nums">${projected.toFixed(2)}</dd>
            <dd className={projected > budget ? "text-sm font-medium text-streak" : "text-sm text-muted-foreground"}>
              {projected > budget ? "Above budget at this pace" : "Within budget at this pace"}
            </dd>
          </div>
          <div className="rounded-2xl bg-muted px-4 py-3">
            <dt className="text-sm text-muted-foreground">Calls in the last 24 h</dt>
            <dd className="text-2xl font-semibold tabular-nums">{calls24 ?? 0}</dd>
            <dd className="text-sm text-muted-foreground">limit {env.aiDailyCallLimit()}</dd>
          </div>
        </dl>
        <p className="mt-3 text-sm text-muted-foreground">
          Models: fast <code>{env.modelFast()}</code>, grader <code>{env.modelGrader()}</code>. Estimates use list prices; compare with the OpenAI usage page.
        </p>
        {byRoute.size > 0 && (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-left text-sm tabular-nums">
              <thead>
                <tr><th className="py-1 font-medium">Route</th><th className="py-1 font-medium">Calls</th><th className="py-1 font-medium">Cost</th><th className="py-1 font-medium">Per call</th></tr>
              </thead>
              <tbody>
                {[...byRoute.entries()].sort((a, b) => b[1].cost - a[1].cost).map(([route, r]) => (
                  <tr key={route} className="border-t">
                    <td className="py-1">{route}</td>
                    <td>{r.calls}</td>
                    <td>${r.cost.toFixed(4)}</td>
                    <td>${(r.cost / r.calls).toFixed(4)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="surface p-5" aria-labelledby="acc-h">
        <h2 id="acc-h" className="text-lg font-semibold">Accounts</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          The app has exactly three accounts, managed with <code>npm run accounts</code> (sign-ups are disabled).
        </p>
        <ul className="mt-2 divide-y">
          {(people ?? []).map((p) => (
            <li key={p.id} className="flex items-center gap-3 py-2 text-base">
              <span className="flex-1">{p.display_name}</span>
              <span className="rounded-full bg-muted px-2.5 py-0.5 text-sm">{p.role}</span>
              <span className="text-sm text-muted-foreground">{p.timezone}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
