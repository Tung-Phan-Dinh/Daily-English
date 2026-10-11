import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Check, Minus, X } from "lucide-react";
import { BandEstimates, FeedbackView, type Feedback } from "@/components/writing/feedback-view";
import { requireViewer } from "@/lib/auth";
import { BLOCK_META, FORMAT_LABELS, QUESTION_TYPE_LABELS } from "@/lib/curriculum";
import { displayAnswer, type GrammarItem } from "@/lib/session/check";
import type { Plan, Progress, SessionBlock } from "@/lib/session/types";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";
import { GradeForm } from "./grade-form";

export const metadata: Metadata = { title: "Session detail" };

type Row = { prompt: string; sub?: string; response: string | null; correct: boolean | null; answer?: string; ms?: number };

function ResultList({ rows, empty }: { rows: Row[]; empty: string }) {
  if (!rows.length) return <p className="text-muted-foreground">{empty}</p>;
  return (
    <ol className="divide-y">
      {rows.map((r, i) => (
        <li key={i} className="flex gap-3 py-3">
          <span
            className={cn(
              "mt-0.5 grid size-7 shrink-0 place-items-center rounded-full",
              r.correct === true ? "bg-success-soft text-success" : r.correct === false ? "bg-error-soft text-error" : "bg-muted text-muted-foreground",
            )}
          >
            {r.correct === true ? <Check className="size-4" aria-hidden /> : r.correct === false ? <X className="size-4" aria-hidden /> : <Minus className="size-4" aria-hidden />}
            <span className="sr-only">{r.correct === true ? "Correct" : r.correct === false ? "Wrong" : "Not marked"}</span>
          </span>
          <div className="min-w-0 flex-1 text-base">
            <p>{r.prompt}</p>
            {r.sub && <p className="text-sm text-muted-foreground">{r.sub}</p>}
            <p className="mt-1">
              <span className="text-muted-foreground">His answer: </span>
              <strong className={r.correct === false ? "text-error" : ""}>{r.response?.trim() ? r.response : "(blank)"}</strong>
            </p>
            {r.correct === false && r.answer && (
              <p>
                <span className="text-muted-foreground">Correct: </span>
                {r.answer}
              </p>
            )}
          </div>
          {r.ms ? <span className="shrink-0 text-sm text-muted-foreground tabular-nums">{Math.round(r.ms / 1000)}s</span> : null}
        </li>
      ))}
    </ol>
  );
}

function Section({ title, children, aside }: { title: string; children: React.ReactNode; aside?: React.ReactNode }) {
  return (
    <section className="surface p-5">
      <div className="mb-2 flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">{title}</h2>
        {aside}
      </div>
      {children}
    </section>
  );
}

export default async function SessionDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requireViewer(["admin"]);
  const { id } = await params;
  const db = await createClient();
  const { data: s } = await db.from("sessions").select("*").eq("id", id).maybeSingle();
  if (!s) notFound();
  const plan = s.plan as Plan;
  const progress = s.progress as Progress;

  const [{ data: attempts }, { data: logs }, { data: writing }] = await Promise.all([
    db.from("attempts").select("item_kind, item_id, format, response, correct, duration_ms, created_at").eq("session_id", id).order("created_at"),
    db.from("review_logs").select("card_id, exercise_type, correct, rating, duration_ms, created_at, response").eq("session_id", id).order("created_at"),
    db.from("writing_submissions").select("*, writing_tasks(prompt, type, min_words, max_words)").eq("session_id", id).maybeSingle(),
  ]);

  // Look up everything the attempts and review logs point at.
  const grammarIds = (attempts ?? []).filter((a) => a.item_kind === "grammar").map((a) => a.item_id);
  const vocabCheckIds = (attempts ?? []).filter((a) => a.item_kind === "vocab_check").map((a) => a.item_id);
  const questionIds = (attempts ?? []).filter((a) => a.item_kind === "reading").map((a) => a.item_id);
  const { data: cards } = (logs ?? []).length
    ? await db.from("cards").select("id, item_type, item_id").in("id", (logs ?? []).map((l) => l.card_id))
    : { data: [] };
  const reviewGrammarIds = (cards ?? []).filter((c) => c.item_type === "grammar").map((c) => c.item_id);
  const reviewVocabIds = (cards ?? []).filter((c) => c.item_type === "vocab").map((c) => c.item_id);
  const [{ data: gItems }, { data: vItems }, { data: questions }, { data: passage }] = await Promise.all([
    grammarIds.length + reviewGrammarIds.length
      ? db.from("grammar_items").select("*").in("id", [...new Set([...grammarIds, ...reviewGrammarIds])])
      : Promise.resolve({ data: [] }),
    vocabCheckIds.length + reviewVocabIds.length + (plan.new_words?.vocab_ids.length ?? 0)
      ? db.from("vocab_items").select("id, lemma, definition_en, gloss_vi").in("id", [...new Set([...vocabCheckIds, ...reviewVocabIds, ...(plan.new_words?.vocab_ids ?? [])])])
      : Promise.resolve({ data: [] }),
    questionIds.length ? db.from("reading_questions").select("id, prompt, type, answer, sort").in("id", questionIds) : Promise.resolve({ data: [] }),
    plan.reading ? db.from("reading_passages").select("title").eq("id", plan.reading.passage_id).maybeSingle() : Promise.resolve({ data: null }),
  ]);
  const g = new Map(((gItems ?? []) as GrammarItem[]).map((x) => [x.id, x]));
  const v = new Map((vItems ?? []).map((x) => [x.id, x]));
  const q = new Map((questions ?? []).map((x) => [x.id, x]));
  const cardMap = new Map((cards ?? []).map((c) => [c.id, c]));

  const reviewRows: Row[] = (logs ?? []).map((l) => {
    const c = cardMap.get(l.card_id);
    if (c?.item_type === "grammar") {
      const it = g.get(c.item_id);
      return { prompt: it?.prompt ?? "(item removed)", sub: `Grammar review · ${FORMAT_LABELS[it?.format ?? ""] ?? ""}`, response: null, correct: l.correct, answer: it ? displayAnswer(it) : undefined, ms: l.duration_ms };
    }
    const word = c ? v.get(c.item_id) : undefined;
    return { prompt: word?.lemma ?? "(word removed)", sub: `Word review · ${l.exercise_type.replace("_", " ")}${word ? ` · ${word.definition_en}` : ""}`, response: l.response ?? null, correct: l.correct, answer: word?.lemma, ms: l.duration_ms };
  });
  // Grammar answers are logged in attempts too (with his actual response) — use those for review grammar items.
  const grammarRows = (kindIds: Set<string>) =>
    (attempts ?? [])
      .filter((a) => a.item_kind === "grammar" && kindIds.has(a.item_id))
      .map((a): Row => {
        const it = g.get(a.item_id);
        const tokens = it?.format === "spot_error" ? it.prompt.split(" ") : null;
        const response = tokens && /^\d+$/.test(a.response ?? "") ? `“${tokens[Number(a.response)]}”` : a.response;
        return { prompt: it?.prompt ?? "(item removed)", sub: `${FORMAT_LABELS[a.format ?? ""] ?? a.format} · ${it?.error_code ?? ""}`, response, correct: a.correct, answer: it ? displayAnswer(it) : undefined, ms: a.duration_ms };
      });
  const grammarPlanIds = new Set([...(plan.grammar ? [...plan.grammar.head, ...plan.grammar.tail_normal, ...plan.grammar.tail_hard] : []), ...(plan.check?.item_ids ?? [])]);
  const reviewGrammarSet = new Set(reviewGrammarIds);
  const reviewGrammarAnswers = grammarRows(reviewGrammarSet);
  const sessionGrammarRows = grammarRows(new Set([...grammarPlanIds].filter((x) => !reviewGrammarSet.has(x))));
  const checkRows: Row[] = (attempts ?? [])
    .filter((a) => a.item_kind === "vocab_check")
    .map((a) => {
      const w = v.get(a.item_id);
      return { prompt: w?.lemma ?? "(word removed)", sub: "Pick the meaning", response: a.response, correct: a.correct, answer: w?.definition_en };
    });
  const readingRows: Row[] = (attempts ?? [])
    .filter((a) => a.item_kind === "reading")
    .map((a) => ({ a, qq: q.get(a.item_id) }))
    .sort((x, y) => (x.qq?.sort ?? 0) - (y.qq?.sort ?? 0))
    .map(({ a, qq }) => ({ prompt: qq?.prompt ?? "(question removed)", sub: QUESTION_TYPE_LABELS[qq?.type ?? ""] ?? "", response: a.response, correct: a.correct, answer: qq?.answer }));

  const readingData = progress.blocks?.reading?.data as { wpm?: number } | undefined;
  const fb = (writing?.feedback ?? null) as Feedback | null;
  const task = writing?.writing_tasks as { prompt?: string; type?: string; min_words?: number; max_words?: number } | null;
  const blocks = plan.blocks as SessionBlock[];

  return (
    <div className="space-y-6">
      <Link href="/admin/sessions" className="inline-flex min-h-11 items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" aria-hidden /> All sessions
      </Link>
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">
          {new Date(s.local_date + "T00:00:00Z").toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" })}
        </h1>
        <p className="mt-1 text-muted-foreground">
          {plan.topic?.name_en} · {s.status === "completed" ? "completed" : s.status === "partial" ? "unfinished" : "in progress"}
          {s.short_day ? " · short day" : ""} · {s.minutes} min active · {s.xp} XP
          {s.skipped_blocks?.length ? ` · skipped: ${s.skipped_blocks.map((b: SessionBlock) => BLOCK_META[b]?.title ?? b).join(", ")}` : ""}
        </p>
        <ul className="mt-3 flex flex-wrap gap-2">
          {blocks.map((b) => {
            const st = progress.blocks?.[b]?.status ?? "pending";
            return (
              <li key={b} className={cn("rounded-full px-3 py-1 text-sm", st === "done" ? "bg-success-soft text-success" : st === "skipped" ? "bg-muted text-muted-foreground" : "bg-streak-soft text-streak")}>
                {BLOCK_META[b].title}: {st === "done" ? "done" : st === "skipped" ? "skipped" : "not finished"}
              </li>
            );
          })}
        </ul>
      </div>

      {/* Writing first — that's what you're most likely here to grade. */}
      {writing ? (
        <Section title="Writing" aside={<span className="text-sm text-muted-foreground tabular-nums">{writing.word_count} words</span>}>
          {task?.prompt && <p className="mb-3 rounded-2xl bg-muted px-4 py-3 text-base"><span className="font-medium">Task: </span>{task.prompt}</p>}
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
            <div className="space-y-4">
              {fb ? (
                <>
                  <BandEstimates bands={fb.bands} />
                  <FeedbackView text={writing.text} feedback={fb} idPrefix="adm" />
                </>
              ) : (
                <>
                  <p className="text-sm text-muted-foreground">No AI feedback yet ({writing.status}).</p>
                  <p className="prose-reading max-w-none rounded-2xl border bg-background p-4 whitespace-pre-wrap">{writing.text}</p>
                </>
              )}
              {writing.rewrite_text && (
                <p className="rounded-2xl bg-muted px-4 py-3 text-base">
                  <span className="font-medium">His rewrite{writing.rewrite_ok === true ? " (fixed)" : writing.rewrite_ok === false ? " (not fixed)" : ""}: </span>
                  {writing.rewrite_text}
                </p>
              )}
              {writing.hidden_from_viewers && <p className="text-sm text-muted-foreground">He hid this piece from the family view.</p>}
            </div>
            <GradeForm
              submissionId={writing.id}
              essay={task?.type === "essay"}
              initial={{
                bands: (writing.teacher_bands as { gra?: number; lr?: number; tr?: number | null; cc?: number | null } | null) ?? null,
                comment: writing.teacher_comment ?? "",
                gradedAt: writing.teacher_graded_at ?? null,
              }}
              aiBands={fb?.bands ?? null}
            />
          </div>
        </Section>
      ) : plan.writing ? (
        <Section title="Writing"><p className="text-muted-foreground">No writing was submitted.</p></Section>
      ) : null}

      {plan.blocks.includes("review") && (
        <Section title="Review" aside={<span className="text-sm text-muted-foreground">{reviewRows.filter((r) => r.correct).length}/{reviewRows.length} recalled</span>}>
          <ResultList rows={[...reviewRows.filter((r) => !r.sub?.startsWith("Grammar review")), ...reviewGrammarAnswers]} empty="Nothing was due for review." />
        </Section>
      )}
      {plan.grammar && (
        <Section title="Grammar" aside={<span className="text-sm text-muted-foreground">{sessionGrammarRows.filter((r) => r.correct).length}/{sessionGrammarRows.length} correct</span>}>
          <ResultList rows={sessionGrammarRows} empty="No grammar answers." />
        </Section>
      )}
      {plan.check && (
        <Section title="Weekly check"><ResultList rows={sessionGrammarRows} empty="No answers." /></Section>
      )}
      {plan.new_words && (
        <Section title="New words">
          <p className="mb-2 text-base">
            {plan.new_words.vocab_ids.map((wid) => v.get(wid)?.lemma).filter(Boolean).join(" · ")}
          </p>
          <ResultList rows={checkRows} empty="Quick check not reached." />
        </Section>
      )}
      {plan.reading && (
        <Section
          title={`Reading${passage?.title ? ` · ${passage.title}` : ""}`}
          aside={readingData?.wpm ? <span className="text-sm text-muted-foreground">{readingData.wpm} wpm</span> : undefined}
        >
          <ResultList rows={readingRows} empty="Reading not submitted." />
        </Section>
      )}
    </div>
  );
}
