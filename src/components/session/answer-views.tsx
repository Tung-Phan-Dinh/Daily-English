"use client";

import { useEffect, useRef, useState } from "react";
import { Lightbulb, Loader2, Undo2, Volume2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { FORMAT_LABELS } from "@/lib/curriculum";
import { cn } from "@/lib/utils";
import { speak } from "@/components/dictionary/speak";
import { TappableText } from "@/components/dictionary/tappable-text";
import { chime } from "./api";
import { FeedbackPanel } from "./feedback-panel";
import type { AnswerResponse, PublicExercise, PublicGrammar, Settings, VocabItem } from "./types";

type Submit = (response: string, meta: { usedHint: boolean; durationMs: number }) => Promise<AnswerResponse | null>;

/** Shared answer lifecycle: answering → checking → feedback, with shake on wrong and optional chime. */
function useAnswerFlow(onSubmit: Submit, settings: Settings) {
  const [phase, setPhase] = useState<"answering" | "checking" | "feedback">("answering");
  const [result, setResult] = useState<AnswerResponse | null>(null);
  const [shake, setShake] = useState(false);
  const [usedHint, setUsedHint] = useState(false);
  const started = useRef(0);
  useEffect(() => {
    started.current = Date.now();
  }, []);

  async function submit(response: string) {
    if (phase !== "answering" || !response.trim()) return;
    setPhase("checking");
    const r = await onSubmit(response, { usedHint, durationMs: Date.now() - started.current });
    if (!r) {
      setPhase("answering");
      return;
    }
    setResult(r);
    setPhase("feedback");
    if (!r.correct) {
      setShake(true);
      setTimeout(() => setShake(false), 200);
    } else if (settings.sound) chime();
  }
  return { phase, result, shake, usedHint, setUsedHint, submit };
}

function Card({ children, shake, label }: { children: React.ReactNode; shake?: boolean; label: string }) {
  return (
    <article aria-label={label} className={cn("surface p-6 sm:p-8", shake && "animate-shake")}>
      {children}
    </article>
  );
}

function Checking() {
  return (
    <p className="mt-4 flex items-center gap-2 text-muted-foreground" aria-live="polite">
      <Loader2 className="size-4 animate-spin" aria-hidden /> Checking…
    </p>
  );
}

function useHotkeys(handler: (e: KeyboardEvent) => void, active: boolean) {
  const ref = useRef(handler);
  useEffect(() => {
    ref.current = handler;
  });
  useEffect(() => {
    if (!active) return;
    const on = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if ((e.target as HTMLElement).closest("[role=dialog]")) return;
      ref.current(e);
    };
    window.addEventListener("keydown", on);
    return () => window.removeEventListener("keydown", on);
  }, [active]);
}

// ---------------------------------------------------------------------------
// Option list (1–4 keys)
// ---------------------------------------------------------------------------

function OptionList({
  options,
  disabled,
  onChoose,
  chosen,
  name,
}: {
  options: string[];
  disabled: boolean;
  onChoose: (o: string) => void;
  chosen?: string | null;
  name: string;
}) {
  useHotkeys((e) => {
    const typing = (e.target as HTMLElement).closest("input, textarea");
    if (typing) return;
    const n = Number(e.key);
    if (n >= 1 && n <= options.length) {
      e.preventDefault();
      onChoose(options[n - 1]);
    }
  }, !disabled);
  return (
    <div role="group" aria-label={name} className="mt-6 grid gap-2">
      {options.map((o, i) => (
        <button
          key={o}
          type="button"
          disabled={disabled}
          onClick={() => onChoose(o)}
          className={cn(
            "flex min-h-14 items-center gap-3 rounded-full border-2 border-transparent bg-muted py-2 pr-5 pl-2 text-left text-base transition-colors hover:border-brand/50 hover:bg-brand-soft disabled:cursor-not-allowed",
            chosen === o && "border-brand bg-brand-soft",
          )}
        >
          <kbd className="grid size-10 shrink-0 place-items-center rounded-full bg-card font-mono text-sm font-semibold shadow-soft">{i + 1}</kbd>
          <span>{o}</span>
        </button>
      ))}
    </div>
  );
}

function HintButton({ onHint, hint, shown }: { onHint: () => void; hint: string | null; shown: boolean }) {
  useHotkeys((e) => {
    if ((e.target as HTMLElement).closest("input, textarea")) return;
    if (e.key.toLowerCase() === "h" && hint) {
      e.preventDefault();
      onHint();
    }
  }, Boolean(hint));
  if (!hint) return null;
  return shown ? (
    <p className="mt-3 rounded-lg bg-highlight/60 px-3 py-2 text-base" role="note">
      <Lightbulb className="mr-1.5 inline size-4" aria-hidden /> {hint}
    </p>
  ) : (
    <Button type="button" variant="ghost" size="sm" className="mt-2 -ml-2" onClick={onHint}>
      <Lightbulb aria-hidden /> Hint <kbd className="rounded-full border px-1.5 text-xs">H</kbd>
    </Button>
  );
}

// ---------------------------------------------------------------------------
// Grammar item (all formats)
// ---------------------------------------------------------------------------

export function GrammarItemView({
  item,
  onSubmit,
  onContinue,
  settings,
  position,
  context,
}: {
  item: PublicGrammar;
  onSubmit: Submit;
  onContinue: () => void;
  settings: Settings;
  position?: string;
  context?: { block: string };
}) {
  const flow = useAnswerFlow(onSubmit, settings);
  const [text, setText] = useState("");
  const [chosen, setChosen] = useState<string | null>(null);
  const [placed, setPlaced] = useState<number[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const answering = flow.phase === "answering";
  const hint = (item.meta.hint as string | null) ?? (item.meta.keyword ? `Use the key word ${item.meta.keyword}` : null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const tiles = item.options ?? [];
  const body = (() => {
    switch (item.format) {
      case "mcq":
        return (
          <>
            <p className="prose-reading mt-4 text-xl">
              <TappableText text={item.prompt} context={context} />
            </p>
            <OptionList
              name="Options"
              options={item.options ?? []}
              disabled={!answering}
              chosen={chosen}
              onChoose={(o) => {
                setChosen(o);
                flow.submit(o);
              }}
            />
          </>
        );
      case "spot_error":
        return (
          <div className="mt-6 flex flex-wrap gap-2" role="group" aria-label="Words in the sentence — choose the wrong one">
            {(item.tokens ?? []).map((t, i) => (
              <button
                key={i}
                type="button"
                disabled={!answering}
                onClick={() => {
                  setChosen(String(i));
                  flow.submit(String(i));
                }}
                className={cn(
                  "min-h-11 rounded-full border-2 border-transparent bg-muted px-4 text-lg transition-colors hover:border-brand/50 hover:bg-brand-soft disabled:cursor-not-allowed",
                  chosen === String(i) && "border-brand bg-brand-soft",
                )}
              >
                {t}
              </button>
            ))}
          </div>
        );
      case "word_order": {
        const sentence = placed.map((i) => tiles[i]).join(" ");
        return (
          <>
            <div className="mt-6 min-h-14 rounded-3xl border border-dashed p-3" aria-live="polite" aria-label="Your sentence">
              {placed.length === 0 ? (
                <span className="text-muted-foreground">Tap the words in order…</span>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {placed.map((ti, pi) => (
                    <button
                      key={pi}
                      type="button"
                      disabled={!answering}
                      className="min-h-11 rounded-full bg-periwinkle px-4 text-lg text-on-accent"
                      onClick={() => setPlaced((p) => p.filter((_, k) => k !== pi))}
                      aria-label={`Remove “${tiles[ti]}”`}
                    >
                      {tiles[ti]}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label="Word tiles">
              {tiles.map((t, i) =>
                placed.includes(i) ? null : (
                  <button
                    key={i}
                    type="button"
                    disabled={!answering}
                    className="min-h-11 rounded-full border-2 border-transparent bg-muted px-4 text-lg hover:border-brand/50 hover:bg-brand-soft"
                    onClick={() => setPlaced((p) => [...p, i])}
                  >
                    {t}
                  </button>
                ),
              )}
            </div>
            {answering && (
              <div className="mt-4 flex gap-2">
                <Button onClick={() => flow.submit(sentence)} disabled={placed.length !== tiles.length}>
                  Check
                </Button>
                <Button variant="ghost" onClick={() => setPlaced((p) => p.slice(0, -1))} disabled={!placed.length}>
                  <Undo2 aria-hidden /> Undo
                </Button>
              </div>
            )}
          </>
        );
      }
      default: {
        const long = ["correct_error", "transform", "combine", "translate", "upgrade"].includes(item.format);
        return (
          <form
            className="mt-6"
            onSubmit={(e) => {
              e.preventDefault();
              flow.submit(text);
            }}
          >
            <p className={cn("text-xl", item.format === "translate" ? "font-medium" : "prose-reading")} lang={item.format === "translate" ? "vi" : undefined}>
              {item.format === "translate" ? item.prompt : <TappableText text={item.prompt} context={context} />}
            </p>
            <Label htmlFor={`ans-${item.id}`} className="mt-5 block">
              {long ? "Your sentence" : "Your answer"}
            </Label>
            <Input
              ref={inputRef}
              id={`ans-${item.id}`}
              className="mt-2 text-lg"
              value={text}
              onChange={(e) => setText(e.target.value)}
              disabled={!answering}
              autoComplete="off"
              autoCapitalize="off"
              spellCheck={settings.spellcheck}
            />
            {answering && (
              <Button type="submit" className="mt-3" disabled={!text.trim()}>
                Check <kbd className="rounded border border-primary-foreground/40 px-1 text-xs">Enter</kbd>
              </Button>
            )}
          </form>
        );
      }
    }
  })();

  return (
    <div>
      <Card shake={flow.shake} label={FORMAT_LABELS[item.format] ?? "Question"}>
        <div className="flex items-center justify-between gap-3">
          <p className="w-fit rounded-full bg-brand-soft px-3 py-1 text-sm font-semibold">{FORMAT_LABELS[item.format] ?? "Question"}</p>
          {position && <p className="text-sm text-muted-foreground tabular-nums">{position}</p>}
        </div>
        <p className="mt-1 text-base text-muted-foreground">{(item as { instruction?: string }).instruction}</p>
        {body}
        {answering && <HintButton hint={hint} shown={flow.usedHint} onHint={() => flow.setUsedHint(true)} />}
        {flow.phase === "checking" && <Checking />}
      </Card>
      {flow.phase === "feedback" && flow.result && (
        <FeedbackPanel result={flow.result} itemId={item.id} explainLang={settings.explain_lang} onContinue={onContinue} />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Vocabulary
// ---------------------------------------------------------------------------

export function LearnCard({ word, accent, compact }: { word: VocabItem; accent: Settings["accent"]; compact?: boolean }) {
  return (
    <div>
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className={cn("font-semibold tracking-tight", compact ? "text-2xl" : "text-4xl")}>{word.lemma}</h2>
          <p className="mt-1 text-muted-foreground">
            <span className="font-mono">{word.ipa}</span> · <span className="italic">{word.pos}</span>
            {word.register !== "neutral" && <span className="ml-2 rounded bg-muted px-1.5 py-0.5 text-xs">{word.register}</span>}
          </p>
        </div>
        <Button variant="outline" size="icon" aria-label={`Play “${word.lemma}”`} onClick={() => speak(word.lemma, accent)}>
          <Volume2 aria-hidden />
        </Button>
      </div>
      <p lang="vi" className="mt-4 text-xl font-semibold">{word.gloss_vi}</p>
      <p className="mt-1 text-lg">{word.definition_en}</p>
      {word.collocations.length > 0 && (
        <ul className="mt-4 flex flex-wrap gap-2" aria-label="Collocations">
          {word.collocations.slice(0, 2).map((c) => (
            <li key={c} className="rounded-full bg-lavender px-3.5 py-1.5 text-base font-medium text-on-accent">{c}</li>
          ))}
        </ul>
      )}
      {word.examples[0] && (
        <p className="mt-4 flex items-start gap-2 border-l-2 border-brand/40 pl-3 text-lg italic">
          {word.examples[0]}
          <button type="button" className="mt-1 text-muted-foreground hover:text-foreground" aria-label="Play example" onClick={() => speak(word.examples[0], accent)}>
            <Volume2 className="size-4" aria-hidden />
          </button>
        </p>
      )}
      {word.common_mistake_vi && (
        <p lang="vi" className="mt-4 rounded-lg bg-streak-soft px-3 py-2 text-base">
          <span className="font-medium">Lỗi hay gặp: </span>
          {word.common_mistake_vi}
        </p>
      )}
    </div>
  );
}

const VOCAB_LABELS: Record<string, string> = {
  meaning_mcq: "Pick the meaning",
  type_word: "Type the word",
  collocation: "Collocation",
  word_form: "Word form",
  cloze: "Complete the sentence",
  own_sentence: "Write your own sentence",
};

export function VocabExerciseView({
  exercise,
  word,
  showLearn,
  onSubmit,
  onContinue,
  settings,
  position,
}: {
  exercise: PublicExercise;
  word?: VocabItem | null;
  showLearn?: boolean;
  onSubmit: Submit;
  onContinue: () => void;
  settings: Settings;
  position?: string;
}) {
  const flow = useAnswerFlow(onSubmit, settings);
  const [learning, setLearning] = useState(Boolean(showLearn && word));
  const [text, setText] = useState("");
  const [chosen, setChosen] = useState<string | null>(null);
  const answering = flow.phase === "answering";
  const hint = exercise.firstLetter ? `Starts with “${exercise.firstLetter}”` : exercise.hint ?? null;

  if (learning && word) {
    return (
      <Card label="New word">
        <p className="mb-4 text-sm font-medium text-brand">Saved word — learn it first</p>
        <LearnCard word={word} accent={settings.accent} />
        <Button className="mt-6" autoFocus onClick={() => setLearning(false)}>
          Got it — test me
        </Button>
      </Card>
    );
  }

  return (
    <div>
      <Card shake={flow.shake} label={VOCAB_LABELS[exercise.kind]}>
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium text-brand">{VOCAB_LABELS[exercise.kind]}</p>
          {position && <p className="text-sm text-muted-foreground tabular-nums">{position}</p>}
        </div>
        {exercise.kind === "meaning_mcq" ? (
          <p className="mt-4 flex items-center gap-3 text-3xl font-semibold">
            {exercise.prompt}
            <Button variant="ghost" size="icon-sm" aria-label="Play word" onClick={() => speak(exercise.prompt, settings.accent)}>
              <Volume2 aria-hidden />
            </Button>
          </p>
        ) : (
          <p className="mt-3 text-lg">{exercise.prompt}</p>
        )}
        {exercise.sentence && <p className="prose-reading mt-3 text-xl">{exercise.sentence}</p>}
        {exercise.options ? (
          <OptionList
            name="Options"
            options={exercise.options}
            disabled={!answering}
            chosen={chosen}
            onChoose={(o) => {
              setChosen(o);
              flow.submit(o);
            }}
          />
        ) : (
          <form
            className="mt-5"
            onSubmit={(e) => {
              e.preventDefault();
              flow.submit(text);
            }}
          >
            <Label htmlFor={`v-${exercise.kind}`}>{exercise.kind === "own_sentence" ? "Your sentence" : "Your answer"}</Label>
            {exercise.kind === "own_sentence" ? (
              <Textarea
                id={`v-${exercise.kind}`}
                className="mt-2 text-lg"
                rows={2}
                value={text}
                onChange={(e) => setText(e.target.value)}
                disabled={!answering}
                autoFocus
                spellCheck={settings.spellcheck}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    flow.submit(text);
                  }
                }}
              />
            ) : (
              <Input
                id={`v-${exercise.kind}`}
                className="mt-2 text-lg"
                value={text}
                onChange={(e) => setText(e.target.value)}
                disabled={!answering}
                autoFocus
                autoComplete="off"
                autoCapitalize="off"
                spellCheck={false}
              />
            )}
            {answering && (
              <Button type="submit" className="mt-3" disabled={!text.trim()}>
                Check
              </Button>
            )}
          </form>
        )}
        {answering && <HintButton hint={hint} shown={flow.usedHint} onHint={() => flow.setUsedHint(true)} />}
        {flow.phase === "checking" && <Checking />}
      </Card>
      {flow.phase === "feedback" && flow.result && (
        <FeedbackPanel result={flow.result} explainLang={settings.explain_lang} onContinue={onContinue} />
      )}
    </div>
  );
}
