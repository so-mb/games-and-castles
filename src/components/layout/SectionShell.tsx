import type { ReactNode } from "react";
import { cn } from "../../lib/cn";
import type { SurfaceTone } from "../../types/content";
import { Container } from "./Container";

interface SectionShellProps {
  id: string;
  children: ReactNode;
  tone?: SurfaceTone;
  className?: string;
  containerClassName?: string;
  labelledBy?: string;
}

const toneClasses: Record<SurfaceTone, string> = {
  light: "bg-[var(--color-cream-50)] text-[var(--color-ink-900)]",
  cream: "bg-[var(--color-cream-100)] text-[var(--color-ink-900)]",
  dark: "bg-[var(--color-night-900)] text-[var(--color-paper-50)]",
  locked: "bg-[var(--color-night-950)] text-[var(--color-paper-50)]",
};

export function SectionShell({
  id,
  children,
  tone = "light",
  className,
  containerClassName,
  labelledBy,
}: SectionShellProps) {
  return (
    <section
      aria-labelledby={labelledBy}
      className={cn(
        "section-shell relative overflow-hidden py-16 sm:py-20 lg:py-24",
        toneClasses[tone],
        className,
      )}
      id={id}
    >
      <Container className={containerClassName}>{children}</Container>
    </section>
  );
}
