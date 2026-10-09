import { Check, Minus, Moon, X } from "lucide-react";
import type { DayDot } from "@/lib/dashboard/stats";
import { cn } from "@/lib/utils";

const LABELS = { en: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"], vi: ["T2", "T3", "T4", "T5", "T6", "T7", "CN"] };
const STATUS_TEXT: Record<DayDot["status"], { en: string; vi: string }> = {
  done: { en: "done", vi: "đã học" },
  short: { en: "short day", vi: "buổi ngắn" },
  partial: { en: "unfinished", vi: "chưa xong" },
  missed: { en: "missed", vi: "bỏ lỡ" },
  rest: { en: "rest day", vi: "nghỉ" },
  today: { en: "today", vi: "hôm nay" },
  future: { en: "upcoming", vi: "sắp tới" },
  none: { en: "before start", vi: "chưa bắt đầu" },
};

/** Seven day-dots (labels on top, like the design). Status = icon + text, never colour alone. */
export function WeekDots({ days, lang = "en", size = "md", labelsOnTop = true }: { days: DayDot[]; lang?: "en" | "vi"; size?: "md" | "lg"; labelsOnTop?: boolean }) {
  return (
    <ol className="grid grid-cols-7 gap-1" aria-label={lang === "vi" ? "Tuần này" : "This week"}>
      {days.map((d, i) => {
        const Icon = d.status === "done" ? Check : d.status === "short" || d.status === "partial" ? Minus : d.status === "missed" ? X : d.status === "rest" ? Moon : null;
        const isToday = d.status === "today";
        const label = (
          <span aria-hidden className={cn("text-sm", isToday ? "font-bold text-foreground" : "text-muted-foreground")}>
            {LABELS[lang][i]}
          </span>
        );
        return (
          <li key={d.date} className="flex flex-col items-center gap-1.5">
            {labelsOnTop && label}
            <span
              className={cn(
                "grid place-items-center rounded-full",
                size === "lg" ? "size-11" : "size-10",
                d.status === "done" && "bg-primary text-primary-foreground",
                d.status === "short" && "bg-periwinkle text-on-accent",
                d.status === "partial" && "bg-streak-soft text-streak",
                d.status === "missed" && "bg-error-soft text-error",
                d.status === "rest" && "bg-muted text-muted-foreground",
                isToday && "bg-orange text-on-accent ring-4 ring-orange/30",
                (d.status === "future" || d.status === "none") && "border-2 border-dashed border-border",
              )}
            >
              {Icon && <Icon className="size-4" strokeWidth={2.75} aria-hidden />}
              <span className="sr-only">
                {d.date}: {STATUS_TEXT[d.status][lang]}
              </span>
            </span>
            {!labelsOnTop && label}
          </li>
        );
      })}
    </ol>
  );
}
