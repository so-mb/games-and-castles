import type { ElementType, ReactNode } from "react";
import { cn } from "../../lib/cn";

type SurfaceVariant =
  "editorial" | "championship" | "live" | "celebration" | "locked";

interface SurfaceProps {
  children: ReactNode;
  as?: ElementType;
  variant?: SurfaceVariant;
  className?: string;
}

const variantClasses: Record<SurfaceVariant, string> = {
  editorial:
    "border-[var(--color-cream-200)] bg-[var(--color-cream-50)] text-[var(--color-ink-900)] shadow-[var(--shadow-resting)]",
  championship:
    "border-white/10 bg-[var(--color-night-800)] text-[var(--color-paper-50)] shadow-[var(--shadow-dark)]",
  live: "border-[var(--color-electric-cyan-400)]/65 bg-[var(--color-night-800)] text-[var(--color-paper-50)] shadow-[var(--shadow-live)]",
  celebration:
    "border-[var(--color-antique-gold-400)]/35 bg-[var(--color-night-800)] text-[var(--color-paper-50)] shadow-[var(--shadow-gold)]",
  locked:
    "border-white/10 bg-[linear-gradient(145deg,rgba(24,35,56,0.96),rgba(9,14,24,0.98))] text-[var(--color-paper-50)] shadow-[var(--shadow-dark)]",
};

export function Surface({
  children,
  as: Component = "div",
  variant = "editorial",
  className,
}: SurfaceProps) {
  return (
    <Component
      className={cn(
        "rounded-[var(--radius-lg)] border",
        variantClasses[variant],
        className,
      )}
    >
      {children}
    </Component>
  );
}
