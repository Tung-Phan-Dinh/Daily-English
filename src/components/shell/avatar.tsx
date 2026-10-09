import { ProgressRing } from "@/components/progress/progress-ring";
import { cn } from "@/lib/utils";

const initials = (name: string) =>
  name.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]!.toUpperCase()).join("") || "?";

/** Initials avatar, optionally wrapped in a weekly-XP progress ring (orange, like the design). */
export function Avatar({ name, size = 44, progress, className }: { name: string; size?: number; progress?: number; className?: string }) {
  const face = (
    <span
      className="grid place-items-center rounded-full bg-periwinkle font-bold text-on-accent"
      style={{ width: size - (progress !== undefined ? 10 : 0), height: size - (progress !== undefined ? 10 : 0), fontSize: size * 0.32 }}
      aria-hidden
    >
      {initials(name)}
    </span>
  );
  if (progress === undefined) return <span className={cn("inline-grid", className)}>{face}</span>;
  return (
    <ProgressRing value={progress} size={size} stroke={3} label={`Weekly XP goal ${Math.round(progress * 100)}%`} className={cn("text-orange", className)} barClassName="stroke-[var(--streak)]" trackClassName="stroke-border">
      {face}
    </ProgressRing>
  );
}
