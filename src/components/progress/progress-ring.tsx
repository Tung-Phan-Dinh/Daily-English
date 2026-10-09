import { cn } from "@/lib/utils";

/** Circular progress (like the 2/3 and 42% rings in the design). Value is 0–1. */
export function ProgressRing({
  value,
  size = 64,
  stroke = 6,
  label,
  children,
  className,
  trackClassName = "stroke-[color-mix(in_oklch,currentColor_18%,transparent)]",
  barClassName = "stroke-current",
}: {
  value: number;
  size?: number;
  stroke?: number;
  label: string;
  children?: React.ReactNode;
  className?: string;
  trackClassName?: string;
  barClassName?: string;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const v = Math.max(0, Math.min(1, value));
  return (
    <div className={cn("relative inline-grid shrink-0 place-items-center", className)} style={{ width: size, height: size }} role="img" aria-label={label}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90" aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} className={trackClassName} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - v)}
          className={cn("transition-[stroke-dashoffset] duration-500", barClassName)}
        />
      </svg>
      {children && <div className="absolute inset-0 grid place-items-center" aria-hidden>{children}</div>}
    </div>
  );
}
