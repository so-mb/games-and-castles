import { cn } from "../../lib/cn";
import type {
  BadgeTone,
  ContentIcon as ContentIconName,
} from "../../types/content";
import { ContentIcon } from "./ContentIcon";

interface StatusBadgeProps {
  children: string;
  tone?: BadgeTone;
  icon?: ContentIconName;
  className?: string;
}

const toneClasses: Record<BadgeTone, string> = {
  neutral: "border-current/15 bg-current/5 text-inherit",
  live: "border-[var(--color-electric-cyan-400)]/35 bg-[var(--color-electric-cyan-400)]/10 text-[var(--color-electric-cyan-400)]",
  gold: "border-[var(--color-antique-gold-400)]/40 bg-[var(--color-antique-gold-400)]/10 text-[var(--color-antique-gold-400)]",
  success:
    "border-[var(--color-success-500)]/35 bg-[var(--color-success-500)]/10 text-[var(--color-success-500)]",
  warning:
    "border-[var(--color-warning-500)]/40 bg-[var(--color-warning-500)]/10 text-[#7a4a00] dark:text-[var(--color-warning-500)]",
  red: "border-[var(--color-prague-red-600)]/35 bg-[var(--color-prague-red-600)]/10 text-[var(--color-prague-red-700)] dark:text-[#ff9ca1]",
};

export function StatusBadge({
  children,
  tone = "neutral",
  icon,
  className,
}: StatusBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex min-h-7 items-center gap-1.5 rounded-full border px-2.5 py-1 text-[0.72rem] leading-none font-bold tracking-[0.08em] uppercase",
        toneClasses[tone],
        className,
      )}
    >
      {icon ? <ContentIcon name={icon} size={14} strokeWidth={2} /> : null}
      {children}
    </span>
  );
}
