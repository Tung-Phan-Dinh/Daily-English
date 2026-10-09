"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

// Common zones for this family; the current value is kept even if it isn't listed.
const TIME_ZONES = [
  { id: "Asia/Ho_Chi_Minh", label: "Vietnam" },
  { id: "Australia/Melbourne", label: "Melbourne" },
  { id: "Australia/Sydney", label: "Sydney" },
  { id: "Australia/Brisbane", label: "Brisbane" },
  { id: "Australia/Perth", label: "Perth" },
  { id: "Asia/Singapore", label: "Singapore" },
  { id: "Asia/Bangkok", label: "Bangkok" },
  { id: "Asia/Seoul", label: "Seoul" },
  { id: "Asia/Tokyo", label: "Tokyo" },
  { id: "Europe/London", label: "London" },
  { id: "America/Los_Angeles", label: "Los Angeles" },
  { id: "America/New_York", label: "New York" },
];

async function postJson(url: string, body: unknown) {
  const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, data };
}

const goesLive = (created: string) => {
  const ms = Date.parse(created) + 86_400_000 - Date.now();
  return ms <= 0 ? "live now (auto)" : `goes live in ${Math.ceil(ms / 3_600_000)} h`;
};

type VocabDraft = { id: string; lemma: string; pos: string; gloss_vi: string; definition_en: string; created_at: string; topic: string };

export function ApprovalQueue({
  items, passages, tasks, batches, vocab,
}: {
  vocab: VocabDraft[];
  items: { id: string; prompt: string; format: string; error_code: string; answers: string[]; explanation_en: string; created_at: string; point: string }[];
  passages: { id: string; title: string; body: string; scheduled_for: string | null; created_at: string; reading_questions: { prompt: string; type: string; answer: string }[] }[];
  tasks: { id: string; type: string; prompt: string; scheduled_for: string | null; created_at: string }[];
  batches: { week_start: string; status: string; summary: Record<string, number>; created_at: string }[];
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState("");

  async function act(kind: string, ids: string[], status: "approved" | "retired") {
    setBusy(kind + status);
    const r = await postJson("/api/admin/content", { kind, ids, status });
    setBusy(null);
    setMsg(r.ok ? `${r.data.updated} ${status}.` : r.data.error ?? "Failed.");
    setSelected(new Set());
    router.refresh();
  }
  // 10% human spot-check suggestion.
  const sample = items.filter((_, i) => i % 10 === 0).map((i) => i.id);

  return (
    <section className="space-y-4 surface p-5" aria-labelledby="queue-h">
      <div>
        <h2 id="queue-h" className="text-lg font-semibold">Content approval queue</h2>
        <p className="text-sm text-muted-foreground">Generated content waits here; anything not reviewed goes live after 24 hours so practice is never blocked.</p>
        <p aria-live="polite" className="mt-1 text-sm text-success">{msg}</p>
      </div>

      {batches.length > 0 && (
        <ul className="text-sm text-muted-foreground">
          {batches.map((b) => (
            <li key={b.created_at}>Week of {b.week_start}: {b.status}{b.summary?.passages !== undefined && ` · ${b.summary.passages} passages, ${b.summary.items} items, ${b.summary.tasks} tasks, ${b.summary.questions_dropped} questions dropped`}</li>
          ))}
        </ul>
      )}

      <div>
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="font-semibold">Grammar items ({items.length})</h3>
          {items.length > 0 && (
            <>
              <Button size="sm" variant="outline" onClick={() => setSelected(new Set(sample))}>Select 10% sample</Button>
              <Button size="sm" disabled={!selected.size || busy !== null} onClick={() => act("grammar_item", [...selected], "approved")}>Approve selected</Button>
              <Button size="sm" variant="destructive" disabled={!selected.size || busy !== null} onClick={() => act("grammar_item", [...selected], "retired")}>Retire selected</Button>
              <Button size="sm" variant="ghost" disabled={busy !== null} onClick={() => act("grammar_item", items.map((i) => i.id), "approved")}>Approve all</Button>
            </>
          )}
        </div>
        {items.length === 0 ? (
          <p className="mt-2 text-muted-foreground">Nothing waiting.</p>
        ) : (
          <ul className="mt-2 max-h-96 divide-y overflow-y-auto rounded-lg border">
            {items.map((i) => (
              <li key={i.id} className="flex gap-3 p-3">
                <input
                  type="checkbox"
                  aria-label={`Select item: ${i.prompt}`}
                  className="mt-1 size-5 accent-[var(--brand)]"
                  checked={selected.has(i.id)}
                  onChange={(e) => setSelected((s) => { const n = new Set(s); if (e.target.checked) n.add(i.id); else n.delete(i.id); return n; })}
                />
                <div className="min-w-0 text-base">
                  <p>{i.prompt}</p>
                  <p className="text-sm text-muted-foreground">{i.point} · {i.format} · {i.error_code} · answer: <strong className="text-foreground">{i.answers.join(" | ")}</strong> · {goesLive(i.created_at)}</p>
                  <p className="text-sm text-muted-foreground">{i.explanation_en}</p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <VocabQueue vocab={vocab} busy={busy} act={act} />

      <div>
        <h3 className="font-semibold">Reading passages ({passages.length})</h3>
        {passages.length === 0 && <p className="mt-1 text-muted-foreground">Nothing waiting.</p>}
        <ul className="mt-2 space-y-2">
          {passages.map((p) => (
            <li key={p.id} className="rounded-lg border p-3">
              <details>
                <summary className="min-h-11 cursor-pointer content-center font-medium">{p.title} · {p.scheduled_for ?? "unscheduled"} · {goesLive(p.created_at)}</summary>
                <p className="mt-2 whitespace-pre-line font-serif text-base">{p.body}</p>
                <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm">
                  {p.reading_questions.map((q, k) => <li key={k}>{q.prompt} — <strong>{q.answer}</strong> ({q.type})</li>)}
                </ol>
              </details>
              <div className="mt-2 flex gap-2">
                <Button size="sm" disabled={busy !== null} onClick={() => act("reading_passage", [p.id], "approved")}>Approve</Button>
                <Button size="sm" variant="destructive" disabled={busy !== null} onClick={() => act("reading_passage", [p.id], "retired")}>Retire</Button>
              </div>
            </li>
          ))}
        </ul>
      </div>

      <div>
        <h3 className="font-semibold">Writing tasks ({tasks.length})</h3>
        {tasks.length === 0 && <p className="mt-1 text-muted-foreground">Nothing waiting.</p>}
        <ul className="mt-2 space-y-2">
          {tasks.map((t) => (
            <li key={t.id} className="flex flex-wrap items-center gap-3 rounded-lg border p-3 text-base">
              <span className="min-w-0 flex-1">{t.prompt} <span className="text-sm text-muted-foreground">({t.type}, {t.scheduled_for ?? "unscheduled"}, {goesLive(t.created_at)})</span></span>
              <Button size="sm" disabled={busy !== null} onClick={() => act("writing_task", [t.id], "approved")}>Approve</Button>
              <Button size="sm" variant="destructive" disabled={busy !== null} onClick={() => act("writing_task", [t.id], "retired")}>Retire</Button>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

/** Generated topic words, grouped by topic: approve a whole topic, or select words to retire. */
function VocabQueue({
  vocab, busy, act,
}: {
  vocab: VocabDraft[];
  busy: string | null;
  act: (kind: string, ids: string[], status: "approved" | "retired") => Promise<void>;
}) {
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const topics = [...new Set(vocab.map((v) => v.topic))];
  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="font-semibold">Topic words ({vocab.length})</h3>
        {picked.size > 0 && (
          <Button size="sm" variant="destructive" disabled={busy !== null} onClick={async () => { await act("vocab_item", [...picked], "retired"); setPicked(new Set()); }}>
            Retire {picked.size} selected
          </Button>
        )}
      </div>
      {vocab.length === 0 && <p className="mt-1 text-muted-foreground">Nothing waiting.</p>}
      <ul className="mt-2 space-y-2">
        {topics.map((t) => {
          const words = vocab.filter((v) => v.topic === t);
          return (
            <li key={t} className="rounded-3xl border p-3">
              <details>
                <summary className="flex min-h-11 cursor-pointer items-center gap-2 font-medium">
                  <span className="flex-1">{t} · {words.length} words · {goesLive(words[0].created_at)}</span>
                </summary>
                <ul className="mt-2 max-h-96 divide-y overflow-y-auto">
                  {words.map((w) => (
                    <li key={w.id} className="flex items-start gap-3 py-2">
                      <input
                        type="checkbox"
                        aria-label={`Select ${w.lemma}`}
                        className="mt-1 size-5 accent-[var(--brand)]"
                        checked={picked.has(w.id)}
                        onChange={(e) => setPicked((s) => { const n = new Set(s); if (e.target.checked) n.add(w.id); else n.delete(w.id); return n; })}
                      />
                      <div className="min-w-0 text-base">
                        <p><strong>{w.lemma}</strong> <span className="text-sm text-muted-foreground italic">{w.pos}</span> · <span lang="vi">{w.gloss_vi}</span></p>
                        <p className="text-sm text-muted-foreground">{w.definition_en}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              </details>
              <div className="mt-2 flex gap-2">
                <Button size="sm" disabled={busy !== null} onClick={() => act("vocab_item", words.filter((w) => !picked.has(w.id)).map((w) => w.id), "approved")}>
                  Approve {words.filter((w) => !picked.has(w.id)).length} words
                </Button>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export function LearnerControls({
  learners, today, resets,
}: {
  learners: { id: string; display_name: string; timezone: string }[];
  today: string;
  resets: { local_date: string; reason: string; created_at: string }[];
}) {
  const router = useRouter();
  const learner = learners[0];
  const [tz, setTz] = useState(learner?.timezone ?? "Asia/Ho_Chi_Minh");
  const [reason, setReason] = useState("");
  const [state, setState] = useState<{ busy?: string; msg?: string; error?: string }>({});
  if (!learner) {
    return <section className="surface p-5"><h2 className="text-lg font-semibold">Learner</h2><p className="mt-1 text-muted-foreground">No learner account yet. Create it with <code>npm run accounts</code>.</p></section>;
  }
  return (
    <section className="grid gap-6 surface p-5 lg:grid-cols-2" aria-labelledby="learner-h">
      <div>
        <h2 id="learner-h" className="text-lg font-semibold">{learner.display_name}</h2>
        <form
          className="mt-3 space-y-2"
          onSubmit={async (e) => {
            e.preventDefault();
            setState({ busy: "tz" });
            const r = await postJson("/api/admin/timezone", { user_id: learner.id, timezone: tz });
            setState(r.ok ? { msg: "Time zone saved." } : { error: r.data.error });
            router.refresh();
          }}
        >
          <Label htmlFor="tz">Learner time zone (day ends 04:00 here)</Label>
          <div className="flex gap-2">
            <select
              id="tz"
              value={tz}
              onChange={(e) => setTz(e.target.value)}
              className="h-12 min-w-0 flex-1 rounded-2xl border border-input bg-card px-4 text-base"
            >
              {(TIME_ZONES.some((z) => z.id === tz) ? TIME_ZONES : [{ id: tz, label: tz }, ...TIME_ZONES]).map((z) => (
                <option key={z.id} value={z.id}>
                  {z.label} — {z.id}
                </option>
              ))}
            </select>
            <Button type="submit" disabled={state.busy === "tz" || tz === learner.timezone} aria-busy={state.busy === "tz"}>
              Save
            </Button>
          </div>
        </form>
      </div>
      <div>
        <h3 className="font-semibold">Reset today&apos;s session ({today})</h3>
        <p className="text-sm text-muted-foreground">For bugs only. Deletes today&apos;s session so it can be rebuilt; logged with your reason.</p>
        <form
          className="mt-2 space-y-2"
          onSubmit={async (e) => {
            e.preventDefault();
            if (!window.confirm("Reset today's session? This can't be undone.")) return;
            setState({ busy: "reset" });
            const r = await postJson("/api/admin/reset", { learner_id: learner.id, reason });
            setState(r.ok ? { msg: "Today's session was reset." } : { error: r.data.error });
            setReason("");
            router.refresh();
          }}
        >
          <Label htmlFor="reason">Reason</Label>
          <Textarea id="reason" rows={2} value={reason} onChange={(e) => setReason(e.target.value)} />
          <Button type="submit" variant="destructive" disabled={reason.trim().length < 5 || state.busy === "reset"} aria-busy={state.busy === "reset"}>
            {state.busy === "reset" ? <Loader2 className="animate-spin" aria-hidden /> : null} Reset today
          </Button>
        </form>
        {resets.length > 0 && (
          <ul className="mt-3 text-sm text-muted-foreground">
            {resets.map((r) => <li key={r.created_at}>{r.local_date}: {r.reason}</li>)}
          </ul>
        )}
      </div>
      <p aria-live="polite" className="text-sm lg:col-span-2">
        {state.msg && <span className="text-success">{state.msg}</span>}
        {state.error && <span className="text-error">{state.error}</span>}
      </p>
    </section>
  );
}
