"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowRight, Check, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ERROR_LABELS, FORMAT_LABELS, type AnyErrorCode } from "@/lib/curriculum";
import { countWords } from "@/lib/normalize";
import { cn } from "@/lib/utils";
import type { PublicGrammar } from "@/components/session/types";

type Data = { items: (PublicGrammar & { instruction: string })[]; words: string[]; writing_prompt: string; completed_at: string | null };
type Result = { per_code: Record<string, { wrong: number; total: number }>; compressed_points: number; vocab_bands: { band: string; adjusted: number; known: boolean }[]; writing_graded: boolean };

export function PlacementFlow() {
  const [data, setData] = useState<Data | null>(null);
  const [loadError, setLoadError] = useState("");
  const [step, setStep] = useState<"intro" | "grammar" | "vocab" | "writing" | "submitting" | "done">("intro");
  const [gi, setGi] = useState(0);
  const [grammar, setGrammar] = useState<Record<string, string>>({});
  const [vi, setVi] = useState(0);
  const [vocab, setVocab] = useState<Record<string, boolean>>({});
  const [writing, setWriting] = useState("");
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/placement").then(async (r) => (r.ok ? setData(await r.json()) : setLoadError("Couldn't load the placement. Reload to try again."))).catch(() => setLoadError("You seem to be offline."));
  }, []);

  if (loadError) return <p role="alert" className="text-error">{loadError}</p>;
  if (!data) return <p className="flex items-center gap-2 text-muted-foreground" aria-live="polite"><Loader2 className="size-4 animate-spin" aria-hidden /> Loading…</p>;

  const total = data.items.length + data.words.length + 1;
  const done = step === "intro" ? 0 : step === "grammar" ? gi : step === "vocab" ? data.items.length + vi : total - 1;

  async function submit() {
    setStep("submitting");
    const res = await fetch("/api/placement", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ grammar, vocab, writing }) });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(d.error ?? "Couldn't save the results.");
      setStep("writing");
      return;
    }
    setResult(d);
    setStep("done");
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Placement</h1>
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted" role="progressbar" aria-label="Placement progress" aria-valuemin={0} aria-valuemax={total} aria-valuenow={done}>
          <div className="h-full bg-brand transition-[width]" style={{ width: `${(done / total) * 100}%` }} />
        </div>
      </div>

      {step === "intro" && (
        <section className="surface p-6">
          {data.completed_at && <p className="mb-3 rounded-lg bg-muted px-3 py-2 text-sm">You took the placement on {new Date(data.completed_at).toLocaleDateString("en-GB")}. Taking it again resets your starting weak points.</p>}
          <h2 className="text-xl font-semibold">About 15 minutes, three parts</h2>
          <ol className="mt-3 list-decimal space-y-1 pl-5 text-base">
            <li>{data.items.length} short grammar questions (no feedback until the end — just do your best)</li>
            <li>A quick word check: say yes if you know a word. Some words are made up, so don&apos;t guess!</li>
            <li>One short paragraph (80–100 words)</li>
          </ol>
          <Button size="lg" className="mt-6" autoFocus onClick={() => setStep("grammar")}>Start <ArrowRight aria-hidden /></Button>
        </section>
      )}

      {step === "grammar" && (
        <PlacementItem
          key={data.items[gi].id}
          item={data.items[gi]}
          position={`${gi + 1} / ${data.items.length}`}
          onAnswer={(resp) => {
            setGrammar((g) => ({ ...g, [data.items[gi].id]: resp }));
            if (gi + 1 >= data.items.length) setStep("vocab");
            else setGi(gi + 1);
          }}
        />
      )}

      {step === "vocab" && (
        <VocabCheck
          word={data.words[vi]}
          position={`${vi + 1} / ${data.words.length}`}
          onAnswer={(yes) => {
            setVocab((v) => ({ ...v, [data.words[vi]]: yes }));
            if (vi + 1 >= data.words.length) setStep("writing");
            else setVi(vi + 1);
          }}
        />
      )}

      {(step === "writing" || step === "submitting") && (
        <section className="surface p-6">
          <h2 className="text-xl font-semibold">Last part: a short paragraph</h2>
          <p className="mt-1 text-base">{data.writing_prompt}</p>
          <Label htmlFor="pl-w" className="mt-4 block">Your paragraph</Label>
          <Textarea id="pl-w" className="prose-reading mt-2 min-h-48 max-w-none" value={writing} onChange={(e) => setWriting(e.target.value)} spellCheck={false} autoFocus />
          <p className="mt-1 text-sm text-muted-foreground tabular-nums" aria-live="polite">{countWords(writing)} words</p>
          {error && <p role="alert" className="mt-2 text-error">{error}</p>}
          <div className="mt-4 flex gap-3">
            <Button size="lg" onClick={submit} disabled={step === "submitting" || countWords(writing) < 30} aria-busy={step === "submitting"}>
              {step === "submitting" ? <><Loader2 className="animate-spin" aria-hidden /> Scoring…</> : "Finish placement"}
            </Button>
            <Button size="lg" variant="ghost" onClick={submit} disabled={step === "submitting"}>Skip the paragraph</Button>
          </div>
        </section>
      )}

      {step === "done" && result && (
        <section className="space-y-4 surface p-6" aria-live="polite">
          <h2 className="text-xl font-semibold">Done — here&apos;s your starting point</h2>
          <ul className="grid gap-2 sm:grid-cols-2">
            {Object.entries(result.per_code)
              .sort((a, b) => b[1].wrong / b[1].total - a[1].wrong / a[1].total)
              .map(([code, r]) => (
                <li key={code} className="flex items-center gap-2 rounded-lg border px-3 py-2 text-base">
                  {r.wrong === 0 ? <Check className="size-4 text-success" aria-hidden /> : <X className="size-4 text-error" aria-hidden />}
                  <span className="flex-1">{ERROR_LABELS[code as AnyErrorCode]?.en ?? code}</span>
                  <span className="tabular-nums text-muted-foreground">{r.total - r.wrong}/{r.total}</span>
                </li>
              ))}
          </ul>
          <p className="text-base">
            {result.compressed_points > 0 ? `${result.compressed_points} early grammar points will be a quick 1-day review. ` : ""}
            Known word bands: {result.vocab_bands.filter((b) => b.known).map((b) => b.band).join(", ") || "none yet — we'll start from the basics"}.
            {!result.writing_graded && " (The paragraph wasn't graded — AI is unavailable or it was skipped.)"}
          </p>
          <Button asChild size="lg"><Link href="/today">Go to Today</Link></Button>
        </section>
      )}
    </div>
  );
}

function PlacementItem({ item, position, onAnswer }: { item: PublicGrammar & { instruction: string }; position: string; onAnswer: (r: string) => void }) {
  const [text, setText] = useState("");
  const [placed, setPlaced] = useState<number[]>([]);
  const tiles = item.options ?? [];
  return (
    <article className="surface p-6" aria-label={FORMAT_LABELS[item.format]}>
      <div className="flex justify-between text-sm"><span className="font-medium text-brand">{FORMAT_LABELS[item.format]}</span><span className="text-muted-foreground tabular-nums">{position}</span></div>
      <p className="mt-1 text-muted-foreground">{item.instruction}</p>
      {item.format === "mcq" && (
        <>
          <p className="prose-reading mt-4 text-xl">{item.prompt}</p>
          <div className="mt-4 grid gap-2">
            {tiles.map((o) => <button key={o} type="button" className="min-h-12 rounded-3xl border px-4 text-left text-base hover:border-brand hover:bg-brand-soft" onClick={() => onAnswer(o)}>{o}</button>)}
          </div>
        </>
      )}
      {item.format === "spot_error" && (
        <div className="mt-4 flex flex-wrap gap-2">
          {(item.tokens ?? []).map((t, i) => <button key={i} type="button" className="min-h-11 rounded-lg border px-3 text-lg hover:border-brand hover:bg-brand-soft" onClick={() => onAnswer(String(i))}>{t}</button>)}
        </div>
      )}
      {item.format === "word_order" && (
        <>
          <p className="mt-4 min-h-12 rounded-3xl border border-dashed p-3 text-lg">{placed.map((i) => tiles[i]).join(" ") || <span className="text-muted-foreground">Tap the words in order…</span>}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {tiles.map((t, i) => placed.includes(i) ? null : <button key={i} type="button" className="min-h-11 rounded-lg border px-3 text-lg" onClick={() => setPlaced((p) => [...p, i])}>{t}</button>)}
          </div>
          <div className="mt-3 flex gap-2">
            <Button disabled={placed.length !== tiles.length} onClick={() => onAnswer(placed.map((i) => tiles[i]).join(" "))}>Next</Button>
            <Button variant="ghost" onClick={() => setPlaced([])}>Clear</Button>
          </div>
        </>
      )}
      {!["mcq", "spot_error", "word_order"].includes(item.format) && (
        <form className="mt-4" onSubmit={(e) => { e.preventDefault(); onAnswer(text); }}>
          <p className={cn("text-xl", item.format === "translate" ? "" : "prose-reading")} lang={item.format === "translate" ? "vi" : undefined}>{item.prompt}</p>
          <Label htmlFor="pl-a" className="mt-4 block">Your answer</Label>
          <Input id="pl-a" className="mt-2 text-lg" value={text} onChange={(e) => setText(e.target.value)} autoFocus autoComplete="off" spellCheck={false} />
          <div className="mt-3 flex gap-2">
            <Button type="submit" disabled={!text.trim()}>Next</Button>
            <Button type="button" variant="ghost" onClick={() => onAnswer("")}>I don&apos;t know</Button>
          </div>
        </form>
      )}
    </article>
  );
}

function VocabCheck({ word, position, onAnswer }: { word: string; position: string; onAnswer: (yes: boolean) => void }) {
  const ref = useRef(onAnswer);
  useEffect(() => {
    ref.current = onAnswer;
  });
  useEffect(() => {
    const on = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === "y") ref.current(true);
      if (e.key.toLowerCase() === "n") ref.current(false);
    };
    window.addEventListener("keydown", on);
    return () => window.removeEventListener("keydown", on);
  }, []);
  return (
    <section className="surface p-6 text-center" aria-live="polite">
      <p className="text-sm text-muted-foreground">Do you know this word? <span className="tabular-nums">{position}</span></p>
      <p className="mt-6 text-4xl font-semibold">{word}</p>
      <div className="mt-8 flex justify-center gap-3">
        <Button size="lg" variant="outline" onClick={() => onAnswer(false)}>No <kbd className="rounded border px-1 text-xs">N</kbd></Button>
        <Button size="lg" onClick={() => onAnswer(true)}>Yes, I know it <kbd className="rounded border border-primary-foreground/40 px-1 text-xs">Y</kbd></Button>
      </div>
    </section>
  );
}
