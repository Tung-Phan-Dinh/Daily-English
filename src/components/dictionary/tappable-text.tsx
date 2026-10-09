"use client";

import { Fragment, useEffect, useMemo } from "react";
import { useDictionary } from "./dictionary-provider";
import type { LookupContext } from "./types";

/**
 * Renders text with every word tappable for the dictionary. Optional
 * `marks` wrap character ranges (evidence highlights, paraphrase underlines).
 */
export function TappableText({
  text,
  context,
  marks = [],
  onTap,
  className,
  prefetch = true,
}: {
  text: string;
  context?: LookupContext;
  marks?: { start: number; end: number; className: string; id?: string }[];
  onTap?: (word: string) => void;
  className?: string;
  prefetch?: boolean;
}) {
  const { lookup, prefetch: doPrefetch } = useDictionary();

  const tokens = useMemo(() => {
    const out: { text: string; start: number; word: boolean }[] = [];
    const re = /[A-Za-zÀ-ỹ]+(?:['’-][A-Za-zÀ-ỹ]+)*/g;
    let last = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(text))) {
      if (m.index > last) out.push({ text: text.slice(last, m.index), start: last, word: false });
      out.push({ text: m[0], start: m.index, word: true });
      last = m.index + m[0].length;
    }
    if (last < text.length) out.push({ text: text.slice(last), start: last, word: false });
    return out;
  }, [text]);

  useEffect(() => {
    if (prefetch) doPrefetch(tokens.filter((t) => t.word).map((t) => t.text));
  }, [tokens, prefetch, doPrefetch]);

  // Split tokens at mark boundaries so marks can wrap partial spans.
  const segments = useMemo(() => {
    const cuts = new Set<number>([0, text.length]);
    for (const mk of marks) {
      cuts.add(mk.start);
      cuts.add(mk.end);
    }
    const out: { text: string; start: number; word: boolean; wordText: string }[] = [];
    for (const t of tokens) {
      const inner = [...cuts].filter((c) => c > t.start && c < t.start + t.text.length).sort((a, b) => a - b);
      let s = t.start;
      for (const c of [...inner, t.start + t.text.length]) {
        out.push({ text: text.slice(s, c), start: s, word: t.word, wordText: t.text });
        s = c;
      }
    }
    return out;
  }, [tokens, marks, text]);

  return (
    <span className={className} data-dict-zone>
      {segments.map((seg, i) => {
        const active = marks.filter((mk) => seg.start >= mk.start && seg.start < mk.end);
        let node: React.ReactNode = seg.word ? (
          <span
            role="button"
            tabIndex={-1}
            className="tappable-word"
            onClick={(e) => {
              if (window.getSelection()?.toString().trim().includes(" ")) return; // phrase selection handles itself
              lookup(seg.wordText, e.currentTarget, context);
              onTap?.(seg.wordText);
            }}
          >
            {seg.text}
          </span>
        ) : (
          seg.text
        );
        for (const mk of active) node = <span className={mk.className} data-mark-id={mk.id}>{node}</span>;
        return <Fragment key={i}>{node}</Fragment>;
      })}
    </span>
  );
}
