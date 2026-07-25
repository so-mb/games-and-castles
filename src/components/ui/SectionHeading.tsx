import { cn } from "../../lib/cn";

interface SectionHeadingProps {
  id: string;
  eyebrow: string;
  title: string;
  description?: string;
  align?: "left" | "center";
  tone?: "light" | "dark";
  className?: string;
}

export function SectionHeading({
  id,
  eyebrow,
  title,
  description,
  align = "left",
  tone = "light",
  className,
}: SectionHeadingProps) {
  return (
    <header
      className={cn(
        "max-w-3xl",
        align === "center" && "mx-auto text-center",
        className,
      )}
    >
      <p
        className={cn(
          "mb-3 text-xs font-bold tracking-[0.22em] uppercase",
          tone === "dark"
            ? "text-[var(--color-electric-cyan-400)]"
            : "text-[var(--color-prague-red-600)]",
        )}
      >
        {eyebrow}
      </p>
      <h2
        className="font-display text-4xl leading-[1.05] font-semibold text-balance sm:text-5xl"
        id={id}
      >
        {title}
      </h2>
      {description ? (
        <p
          className={cn(
            "mt-5 max-w-2xl text-base leading-7 text-pretty sm:text-lg",
            align === "center" && "mx-auto",
            tone === "dark"
              ? "text-[var(--color-paper-300)]"
              : "text-[var(--color-ink-600)]",
          )}
        >
          {description}
        </p>
      ) : null}
    </header>
  );
}
