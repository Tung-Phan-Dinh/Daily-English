"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowRight, Check, Circle, Loader2, Lock, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { TaskChart } from "@/components/charts/task-chart";
import { BandEstimates, FeedbackView, type Feedback } from "@/components/writing/feedback-view";
import { containsTarget } from "@/lib/inflect";
import { countWords } from "@/lib/normalize";
import { cn } from "@/lib/utils";
import { post } from "../api";
import { usePlayer } from "../player";
import type { Progress, SessionPayload } from "../types";

type Writing = NonNullable<SessionPayload["writing"]>;
type Submission = NonNullable<Writing["submission"]>;
type Stage = "saved" | "grammar" | "vocabulary" | "tips";

const TASK_LABELS: Record<string, string> = {
  opinion: "Opinion paragraph",
  chart: "Describe the chart",
  paraphrase: "Paraphrase + introduction",
  problem_solution: "Problem and solution",
  adv_disadv: "Advantages vs disadvantages",
  essay: "Task 2 essay (optional)",
};

export function WritingBlock() {
  const { payload } = usePlayer();
  const writing = payload.writing;
  const [submission, setSubmission] = useState<Submission | null>(writing?.submission ?? null);
  if (!writing) return <p role="alert">No writing task today. Use “Skip block”.</p>;
  return submission ? <WritingFeedback writing={writing} submission={submission} setSubmission={setSubmission} /> : <Compose writing={writing} onSubmitted={setSubmission} />;
}

// ---------------------------------------------------------------------------

function Compose({ writing, onSubmitted }: { writing: Writing; onSubmitted: (s: Submission) => void }) {
  const { payload, settings, action } = usePlayer();
  const draftKey = `draft:${payload.session.id}`;
  const [text, setText] = useState(() => {
    try {
      return localStorage.getItem(draftKey) ?? "";
    } catch {
      return "";
    }
  });
  const [phase, setPhase] = useState<"compose" | "grading" | "queued" | "error">("compose");
  const [stages, setStages] = useState<Stage[]>([]);
  const [message, setMessage] = useState("");
  const queuedSub = useRef<Submission | null>(null);
  const { task, target_words } = writing;

  useEffect(() => {
    try {
      localStorage.setItem(draftKey, text);
    } catch {}
  }, [text, draftKey]);

  const words = countWords(text);
  const used = useMemo(() => target_words.map((w) => ({ w, ok: containsTarget(text, w) })), [text, target_words]);
  const usedCount = used.filter((u) => u.ok).length;
  const tooShort = words < Math.ceil(task.min_words * 0.75);
  const tooLong = words > Math.floor(task.max_words * 1.5);

  async function submit() {
    setPhase("grading");
    setStages([]);
    try {
      const res = await fetch("/api/writing/grade", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ session_id: payload.session.id, text }),
      });
      if (!res.ok || !res.body) {
        const d = await res.json().catch(() => ({}));
        setPhase("error");
        setMessage(d.error ?? "Couldn't submit. Your text is still here — try again.");
        return;
      }
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let buf = "";
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        let nl: number;
        while ((nl = buf.indexOf("\n")) >= 0) {
          const line = buf.slice(0, nl).trim();
          buf = buf.slice(nl + 1);
          if (!line) continue;
          const ev = JSON.parse(line);
          if (ev.type === "progress") setStages((s) => [...s, ev.stage]);
          if (ev.type === "feedback") {
            try { localStorage.removeItem(draftKey); } catch {}
            onSubmitted(ev.submission);
          }
          if (ev.type === "queued") {
            try { localStorage.removeItem(draftKey); } catch {}
            queuedSub.current = ev.submission;
            setMessage(ev.message);
            setPhase("queued");
          }
        }
      }
    } catch {
      setPhase("error");
      setMessage("The connection dropped. If your paragraph was saved, it will appear when you reload.");
    }
  }

  if (phase === "grading") {
    const steps: { key: Stage; label: string }[] = [
      { key: "saved", label: "Saved your paragraph" },
      { key: "grammar", label: "Checking grammar…" },
      { key: "vocabulary", label: "Checking vocabulary…" },
      { key: "tips", label: "Writing tips…" },
    ];
    return (
      <div className="mx-auto max-w-xl surface p-8" aria-live="polite">
        <h1 className="text-xl font-semibold">Preparing your feedback</h1>
        <p className="mt-1 text-muted-foreground">This usually takes about 10 seconds.</p>
        <ol className="mt-6 space-y-3">
          {steps.map((s, i) => {
            const done = stages.includes(s.key) && (i === steps.length - 1 ? false : stages.includes(steps[i + 1].key));
            const activeStep = stages.includes(s.key) && !done;
            return (
              <li key={s.key} className={cn("flex items-center gap-3 text-base", !stages.includes(s.key) && "text-muted-foreground")}>
                {done ? <Check className="size-5 text-success" aria-hidden /> : activeStep ? <Loader2 className="size-5 animate-spin text-brand" aria-hidden /> : <Circle className="size-5" aria-hidden />}
                {s.label}
              </li>
            );
          })}
        </ol>
      </div>
    );
  }

  if (phase === "queued") {
    return (
      <div className="mx-auto max-w-xl surface p-8" role="status">
        <h1 className="text-xl font-semibold">Your paragraph is saved</h1>
        <p className="mt-2 text-base">{message}</p>
        <p className="mt-1 text-muted-foreground">You&apos;ll find the feedback in My progress once it&apos;s ready.</p>
        <Button className="mt-6" autoFocus onClick={() => action({ action: "advance", block: "writing" })}>
          Continue <ArrowRight aria-hidden />
        </Button>
      </div>
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)]">
      <section aria-labelledby="task-h" className="space-y-4">
        <p className="text-sm font-medium text-brand">{TASK_LABELS[task.type] ?? "Writing"} · {task.min_words}–{task.max_words} words</p>
        <h1 id="task-h" className="text-xl leading-snug font-semibold">{task.prompt}</h1>
        {task.chart_data && <TaskChart data={task.chart_data} />}
        <div>
          <p className="text-sm text-muted-foreground">
            Use at least 2 of today&apos;s words ({usedCount} used){task.grammar_point && <> and today&apos;s grammar: <strong className="text-foreground">{task.grammar_point}</strong></>}.
          </p>
          <ul className="mt-2 flex flex-wrap gap-2" aria-label="Target words">
            {used.map(({ w, ok }) => (
              <li
                key={w}
                className={cn("flex min-h-9 items-center gap-1.5 rounded-full border px-3 text-sm", ok ? "border-success bg-success-soft text-success" : "bg-background")}
              >
                {ok ? <Check className="size-3.5" aria-hidden /> : <Circle className="size-3.5 text-muted-foreground" aria-hidden />}
                {w}
                <span className="sr-only">{ok ? "(used)" : "(not used yet)"}</span>
              </li>
            ))}
          </ul>
        </div>
        <p className="text-sm text-muted-foreground">Dictionary: press <kbd className="rounded border px-1">/</kbd> or <kbd className="rounded border px-1">Ctrl K</kbd>. No AI help until you submit.</p>
      </section>

      <section aria-label="Your writing">
        <Label htmlFor="essay">Your {task.type === "essay" ? "essay" : "paragraph"}</Label>
        <Textarea
          id="essay"
          className="prose-reading mt-2 min-h-72 max-w-none text-[1.0625rem]"
          value={text}
          onChange={(e) => setText(e.target.value)}
          spellCheck={settings.spellcheck}
          autoFocus
          aria-describedby="wc"
        />
        <div id="wc" className="mt-2" aria-live="polite">
          <div className="relative h-2 overflow-hidden rounded-full bg-muted" aria-hidden>
            <div className="absolute inset-y-0 bg-success/25" style={{ left: `${(task.min_words / (task.max_words * 1.25)) * 100}%`, width: `${((task.max_words - task.min_words) / (task.max_words * 1.25)) * 100}%` }} />
            <div className={cn("h-full rounded-full", words > task.max_words ? "bg-streak" : "bg-brand")} style={{ width: `${Math.min(100, (words / (task.max_words * 1.25)) * 100)}%` }} />
          </div>
          <p className="mt-1 text-sm text-muted-foreground tabular-nums">
            {words} words · target {task.min_words}–{task.max_words}
            {words > task.max_words && " · a little long"}
          </p>
        </div>
        {phase === "error" && <p role="alert" className="mt-3 text-error">{message}</p>}
        <div className="mt-4 flex flex-wrap gap-3">
          <Button size="lg" disabled={tooShort || tooLong} onClick={submit}>
            Submit for feedback
          </Button>
          {task.optional && (
            <Button size="lg" variant="ghost" onClick={() => action({ action: "advance", block: "writing" })}>
              Not today
            </Button>
          )}
        </div>
        {tooShort && <p className="mt-2 text-sm text-muted-foreground">Write at least {Math.ceil(task.min_words * 0.75)} words to submit.</p>}
      </section>
    </div>
  );
}

// ---------------------------------------------------------------------------

function WritingFeedback({ writing, submission, setSubmission }: { writing: Writing; submission: Submission; setSubmission: (s: Submission) => void }) {
  const { payload, settings, commit, action } = usePlayer();
  const [polling, setPolling] = useState(submission.status === "pending");
  const [doneProgress, setDoneProgress] = useState<Progress | null>(null);
  const fb = submission.feedback as Feedback | null;

  // Reloaded while grading: poll for a minute, then fall back to "graded later".
  useEffect(() => {
    if (submission.status !== "pending") return;
    let n = 0;
    const t = setInterval(async () => {
      n++;
      const r = await fetch(`/api/writing/submission?session_id=${payload.session.id}`).then((x) => x.json()).catch(() => null);
      if (r?.submission?.status === "graded") {
        setSubmission(r.submission);
        clearInterval(t);
      }
      if (n > 15) {
        setPolling(false);
        clearInterval(t);
      }
    }, 4000);
    return () => clearInterval(t);
  }, [submission.status, payload.session.id, setSubmission]);

  if (submission.status !== "graded" || !fb) {
    return (
      <div className="mx-auto max-w-xl surface p-8" aria-live="polite">
        <h1 className="text-xl font-semibold">{polling ? "Feedback is on its way…" : "Your paragraph is saved"}</h1>
        <p className="mt-2 text-muted-foreground">
          {polling ? "Hang on a few seconds." : "Feedback will be ready later today — you'll find it in My progress."}
        </p>
        {polling ? <Loader2 className="mt-4 size-6 animate-spin text-brand" aria-hidden /> : (
          <Button className="mt-6" onClick={() => action({ action: "advance", block: "writing" })}>Continue <ArrowRight aria-hidden /></Button>
        )}
      </div>
    );
  }

  const hasRewrite = fb.rewrite_sentence.end > fb.rewrite_sentence.start;
  const finished = submission.rewrite_done || !hasRewrite;

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-brand">Feedback</p>
          <h1 className="text-2xl font-semibold">{writing.task.type === "essay" ? "Your essay" : "Your paragraph"}</h1>
        </div>
        <HideToggle submission={submission} />
      </div>
      <BandEstimates bands={fb.bands} />
      <FeedbackView text={submission.text} feedback={fb} explainLang={settings.explain_lang} />

      <div className="grid gap-6 md:grid-cols-2">
        <section className="surface p-5" aria-labelledby="str-h">
          <h2 id="str-h" className="font-semibold">Two strengths</h2>
          <ul className="mt-2 space-y-2">
            {fb.strengths.map((s) => (
              <li key={s.quote} className="text-base">
                <q className="font-medium">{s.quote}</q> — {s.why}
              </li>
            ))}
            {fb.strengths.length === 0 && <li className="text-muted-foreground">—</li>}
          </ul>
        </section>
        <section className="surface p-5" aria-labelledby="up-h">
          <h2 id="up-h" className="font-semibold">Word upgrades</h2>
          <ul className="mt-2 space-y-2">
            {fb.upgrades.map((u) => (
              <li key={u.original} className="text-base">
                <s className="decoration-error/60">{u.original}</s> → <strong>{u.better}</strong>
                <span lang="vi" className="block text-muted-foreground">{u.note_vi}</span>
              </li>
            ))}
            {fb.upgrades.length === 0 && <li className="text-muted-foreground">Your word choice was precise.</li>}
          </ul>
        </section>
      </div>

      <section className="surface p-5" aria-labelledby="tc-h">
        <h2 id="tc-h" className="font-semibold">Target check</h2>
        <p className="mt-1 text-base">
          Words used: {fb.target_check.words_used.length ? fb.target_check.words_used.join(", ") : "none"} · Grammar point{" "}
          {fb.target_check.grammar_used_correctly ? "used correctly ✓" : "not yet used correctly"}
        </p>
        {fb.target_check.comment && <p className="text-muted-foreground">{fb.target_check.comment}</p>}
      </section>

      {hasRewrite && <RewriteStep submission={submission} feedback={fb} onDone={(s, p) => { setSubmission(s); if (p) setDoneProgress(p); }} />}

      <section className="surface p-5" aria-labelledby="model-h">
        <h2 id="model-h" className="flex items-center gap-2 font-semibold">
          {finished && fb.model_version ? <Sparkles className="size-4 text-brand" aria-hidden /> : <Lock className="size-4" aria-hidden />}
          Band 6.5 model version
        </h2>
        {finished && fb.model_version ? (
          <p className="prose-reading mt-2 max-w-none whitespace-pre-wrap">{fb.model_version}</p>
        ) : (
          <p className="mt-1 text-muted-foreground">Unlocks after the rewrite step.</p>
        )}
      </section>

      {finished && (
        <Button
          size="lg"
          autoFocus
          onClick={async () => {
            // The rewrite route already closed the block; otherwise close it now.
            if (doneProgress) commit(doneProgress);
            else await action({ action: "advance", block: "writing" });
          }}
        >
          Continue to wrap-up <ArrowRight aria-hidden />
        </Button>
      )}
    </div>
  );
}

function RewriteStep({ submission, feedback, onDone }: { submission: Submission; feedback: Feedback; onDone: (s: Submission, p?: Progress) => void }) {
  const original = submission.text.slice(feedback.rewrite_sentence.start, feedback.rewrite_sentence.end).trim();
  const [text, setText] = useState(submission.rewrite_text ?? original);
  const [state, setState] = useState<"idle" | "checking">("idle");
  const [hint, setHint] = useState<{ en: string; vi: string } | null>(null);
  const [result, setResult] = useState<{ fixed: boolean; checked: boolean; correction: string | null } | null>(
    submission.rewrite_done ? { fixed: Boolean(submission.rewrite_ok), checked: submission.rewrite_ok !== null, correction: null } : null,
  );
  const [error, setError] = useState("");

  async function check(e: React.FormEvent) {
    e.preventDefault();
    setState("checking");
    setError("");
    const r = await post<{ fixed: boolean; checked: boolean; done: boolean; hint_en: string; hint_vi: string; correction: string | null; submission: Submission; progress: Progress }>(
      "/api/writing/rewrite",
      { submission_id: submission.id, text },
    );
    setState("idle");
    if (!r.ok) {
      setError(r.error);
      return;
    }
    if (r.data.done) {
      setResult({ fixed: r.data.fixed, checked: r.data.checked, correction: r.data.correction });
      onDone(r.data.submission, r.data.progress);
    } else {
      setHint({ en: r.data.hint_en, vi: r.data.hint_vi });
    }
  }

  return (
    <section className="surface ring-2 ring-brand/40 p-5" aria-labelledby="rw-h">
      <h2 id="rw-h" className="font-semibold">Rewrite one sentence</h2>
      <p className="mt-1 text-muted-foreground">This sentence has your most serious error. Rewrite it correctly.</p>
      <blockquote className="prose-reading mt-3 max-w-none border-l-2 border-error/60 pl-3">{original}</blockquote>
      {result ? (
        <div className="mt-4 text-base" role="status">
          <p className={cn("font-semibold", result.fixed ? "text-success" : "text-error")}>
            {result.fixed ? (result.checked ? "Fixed — well done." : "Saved. (AI check unavailable, so it wasn't marked.)") : "Not quite yet."}
          </p>
          {!result.fixed && result.correction && (
            <p className="mt-1">
              One correct version: <strong>{result.correction}</strong>
            </p>
          )}
        </div>
      ) : (
        <form onSubmit={check} className="mt-4">
          <Label htmlFor="rewrite">Your rewritten sentence</Label>
          <Input id="rewrite" className="mt-2 text-lg" value={text} onChange={(e) => setText(e.target.value)} spellCheck={false} autoComplete="off" />
          {hint && (
            <p className="mt-2 rounded-lg bg-streak-soft px-3 py-2 text-base" role="status">
              Hint: {hint.en} <span lang="vi" className="block text-muted-foreground">{hint.vi}</span>
            </p>
          )}
          {error && <p role="alert" className="mt-2 text-error">{error}</p>}
          <Button type="submit" className="mt-3" disabled={state === "checking" || !text.trim()} aria-busy={state === "checking"}>
            {state === "checking" ? <Loader2 className="animate-spin" aria-hidden /> : null}
            {hint ? "Try again" : "Check my rewrite"}
          </Button>
        </form>
      )}
    </section>
  );
}

function HideToggle({ submission }: { submission: Submission }) {
  const [hidden, setHidden] = useState(submission.hidden_from_viewers);
  const [busy, setBusy] = useState(false);
  return (
    <div className="flex items-center gap-2">
      <Switch
        id={`hide-${submission.id}`}
        checked={hidden}
        disabled={busy}
        onCheckedChange={async (v) => {
          setBusy(true);
          const r = await post("/api/writing/hide", { submission_id: submission.id, hidden: v });
          if (r.ok) setHidden(v);
          setBusy(false);
        }}
      />
      <Label htmlFor={`hide-${submission.id}`} className="text-sm font-normal">
        Hide from family (still counts in stats)
      </Label>
    </div>
  );
}
