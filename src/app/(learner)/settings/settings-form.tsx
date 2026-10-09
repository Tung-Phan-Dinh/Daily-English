"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import type { Settings } from "@/lib/auth";

type Form = Settings & { ui_lang: "en" | "vi"; display_name: string };

function Radio<T extends string>({ name, value, options, onChange, legend }: { name: string; value: T; options: { v: T; label: string }[]; onChange: (v: T) => void; legend: string }) {
  return (
    <fieldset>
      <legend className="text-sm font-medium">{legend}</legend>
      <div className="mt-2 flex flex-wrap gap-2">
        {options.map((o) => (
          <label key={o.v} className="flex min-h-11 cursor-pointer items-center gap-2 rounded-lg border px-3 has-[:checked]:border-brand has-[:checked]:bg-brand-soft has-[:focus-visible]:ring-3 has-[:focus-visible]:ring-ring">
            <input type="radio" name={name} value={o.v} checked={value === o.v} onChange={() => onChange(o.v)} className="size-4 accent-[var(--brand)]" />
            {o.label}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

export function SettingsForm({ initial, isLearner }: { initial: Form; isLearner: boolean }) {
  const router = useRouter();
  const [f, setF] = useState<Form>(initial);
  const [state, setState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [error, setError] = useState("");
  const set = <K extends keyof Form>(k: K, v: Form[K]) => {
    setF((p) => ({ ...p, [k]: v }));
    setState("idle");
  };

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setState("saving");
    const res = await fetch("/api/settings", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(f) });
    if (!res.ok) {
      setState("error");
      setError((await res.json().catch(() => ({}))).error ?? "Couldn't save.");
      return;
    }
    setState("saved");
    router.refresh();
  }

  return (
    <form onSubmit={save} className="space-y-6 surface p-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="s-name">Display name</Label>
          <Input id="s-name" className="mt-1" value={f.display_name} onChange={(e) => set("display_name", e.target.value)} maxLength={40} />
        </div>
        {isLearner && (
          <div>
            <Label htmlFor="s-band">Target band</Label>
            <select id="s-band" className="mt-1 h-11 w-full rounded-lg border border-input bg-background px-3 text-base" value={f.target_band} onChange={(e) => set("target_band", Number(e.target.value))}>
              {[5.5, 6, 6.5, 7, 7.5, 8].map((b) => <option key={b} value={b}>{b.toFixed(1)}</option>)}
            </select>
          </div>
        )}
        {isLearner && (
          <div>
            <Label htmlFor="s-new">New words per day: <span className="tabular-nums">{f.new_words_per_day}</span></Label>
            <input id="s-new" type="range" min={5} max={15} step={1} value={f.new_words_per_day} onChange={(e) => set("new_words_per_day", Number(e.target.value))} className="mt-3 h-6 w-full accent-[var(--brand)]" />
          </div>
        )}
        {isLearner && (
          <div>
            <Label htmlFor="s-xp">Weekly XP goal</Label>
            <Input id="s-xp" type="number" inputMode="numeric" min={50} max={5000} step={10} className="mt-1" value={f.weekly_xp_goal} onChange={(e) => set("weekly_xp_goal", Number(e.target.value))} />
          </div>
        )}
      </div>

      {isLearner && (
        <Radio legend="Pronunciation accent" name="accent" value={f.accent} onChange={(v) => set("accent", v)} options={[{ v: "en-GB", label: "UK English" }, { v: "en-US", label: "US English" }]} />
      )}
      {isLearner && (
        <Radio legend="Default explanation language" name="explain" value={f.explain_lang} onChange={(v) => set("explain_lang", v)} options={[{ v: "en", label: "English" }, { v: "vi", label: "Tiếng Việt" }]} />
      )}
      <Radio legend="Dashboard language" name="ui" value={f.ui_lang} onChange={(v) => set("ui_lang", v)} options={[{ v: "en", label: "English" }, { v: "vi", label: "Tiếng Việt" }]} />
      <Radio legend="Theme" name="theme" value={f.theme} onChange={(v) => set("theme", v)} options={[{ v: "system", label: "Follow system" }, { v: "light", label: "Light" }, { v: "dark", label: "Dark" }]} />

      <div>
        <Label htmlFor="s-size">Text size: <span className="tabular-nums">{f.text_size}%</span></Label>
        <input id="s-size" type="range" min={100} max={130} step={5} value={f.text_size} onChange={(e) => set("text_size", Number(e.target.value))} className="mt-3 h-6 w-full accent-[var(--brand)]" />
      </div>

      {isLearner && (
        <div className="space-y-3">
          <div className="flex items-start gap-3">
            <Switch id="s-spell" checked={f.spellcheck} onCheckedChange={(v) => set("spellcheck", v)} />
            <Label htmlFor="s-spell" className="flex-col items-start font-normal">
              <span className="font-medium">Browser spellcheck in writing</span>
              <span className="text-sm text-muted-foreground">Off by default so feedback measures your real accuracy.</span>
            </Label>
          </div>
          <div className="flex items-start gap-3">
            <Switch id="s-sound" checked={f.sound} onCheckedChange={(v) => set("sound", v)} />
            <Label htmlFor="s-sound" className="font-medium">Soft sound on correct answers</Label>
          </div>
        </div>
      )}

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={state === "saving"} aria-busy={state === "saving"}>
          {state === "saving" ? <Loader2 className="animate-spin" aria-hidden /> : null} Save settings
        </Button>
        <p aria-live="polite" className="text-sm">
          {state === "saved" && <span className="flex items-center gap-1 text-success"><Check className="size-4" aria-hidden /> Saved</span>}
          {state === "error" && <span className="text-error">{error}</span>}
        </p>
      </div>
    </form>
  );
}
