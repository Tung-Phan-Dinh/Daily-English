"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Flame, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BLOCK_META } from "@/lib/curriculum";
import type { SessionBlock } from "@/lib/session/types";
import { usePlayer } from "../player";

/** One line in Vietnamese saying what went well today (rule-based, no AI). */
function improvementLine(blocks: Record<string, { status: string; correct: number; answered: number } | undefined>, pointTitle?: string, words?: number) {
  const g = blocks.grammar;
  const r = blocks.reading;
  const rv = blocks.review;
  if (g?.answered && g.correct / g.answered >= 0.8) return `Hôm nay em làm đúng ${g.correct}/${g.answered} câu ngữ pháp${pointTitle ? ` về “${pointTitle}”` : ""} — rất tốt!`;
  if (rv?.answered && rv.correct / rv.answered >= 0.8) return `Em nhớ ${rv.correct}/${rv.answered} thẻ ôn tập — trí nhớ đang vững hơn.`;
  if (r?.answered && r.correct >= 3) return `Phần đọc hiểu đúng ${r.correct}/${r.answered} câu — em đang đọc nhanh và chính xác hơn.`;
  if (words) return `Hôm nay em học thêm ${words} từ mới — mai các từ này sẽ quay lại để ôn.`;
  return "Em đã hoàn thành buổi học hôm nay — đều đặn mỗi ngày là cách tiến bộ nhanh nhất.";
}

export function WrapUpBlock({ name }: { name: string }) {
  const { payload, progress, action } = usePlayer();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const finished = progress.current === "finished";
  const blocks = payload.session.blocks as SessionBlock[];
  const pointTitle = (payload.grammar?.point as { title?: string } | null)?.title;
  const line = improvementLine(progress.blocks as never, pointTitle, progress.words_learned);

  return (
    <div className="mx-auto max-w-xl text-center">
      <div className="mx-auto grid size-16 place-items-center rounded-full bg-success text-primary-foreground animate-pop" aria-hidden>
        <Check className="size-8" strokeWidth={3} />
      </div>
      <h1 className="mt-4 text-3xl font-semibold tracking-tight">Nice work, {name}.</h1>
      <p lang="vi" className="mt-3 text-lg">{line}</p>

      <dl className="mt-8 grid grid-cols-2 gap-3 text-left sm:grid-cols-3">
        {blocks
          .filter((b) => b !== "wrapup")
          .map((b) => {
            const bp = progress.blocks[b];
            const val =
              bp?.status === "skipped" ? "Skipped"
                : b === "writing" ? (bp?.status === "done" ? "Done" : "—")
                  : b === "new_words" ? `${progress.words_learned || 0} words`
                    : bp?.answered ? `${bp.correct}/${bp.answered}` : bp?.status === "done" ? "Done" : "—";
            return (
              <div key={b} className="surface px-4 py-3">
                <dt className="text-sm text-muted-foreground">{BLOCK_META[b].title}</dt>
                <dd className="mt-0.5 text-xl font-semibold tabular-nums">{val}</dd>
              </div>
            );
          })}
        <div className="rounded-3xl border border-streak/40 bg-streak-soft px-4 py-3">
          <dt className="text-sm text-muted-foreground">XP today</dt>
          <dd className="mt-0.5 flex items-center gap-1.5 text-xl font-semibold tabular-nums">
            <Flame className="size-5 text-streak" aria-hidden /> {progress.xp}
          </dd>
        </div>
      </dl>

      <Button
        size="xl"
        className="mt-8"
        autoFocus
        disabled={busy}
        aria-busy={busy}
        onClick={async () => {
          setBusy(true);
          if (!finished) await action({ action: "finish" });
          router.push("/today");
        }}
      >
        {busy ? <Loader2 className="animate-spin" aria-hidden /> : null} Done
      </Button>
      <p className="mt-3 text-sm text-muted-foreground">Your streak updates when you tap Done.</p>
    </div>
  );
}
