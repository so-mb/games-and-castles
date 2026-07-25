import { ArrowRight } from "lucide-react";
import { cn } from "../../lib/cn";
import type { WeekendDay } from "../../types/content";
import { ContentIcon } from "./ContentIcon";
import { StatusBadge } from "./StatusBadge";
import { Tag } from "./Tag";

interface DayCardProps {
  day: WeekendDay;
  className?: string;
}

const toneClasses: Record<WeekendDay["tone"], string> = {
  game: "day-card-game border-[var(--color-antique-gold-400)]/30 bg-[var(--color-night-900)] text-[var(--color-paper-50)]",
  quest:
    "day-card-quest border-[var(--color-prague-red-600)]/25 bg-[var(--color-cream-50)] text-[var(--color-ink-900)]",
  departure:
    "day-card-departure border-[var(--color-cream-200)] bg-[#efe4ce] text-[var(--color-ink-900)]",
};

export function DayCard({ day, className }: DayCardProps) {
  const isDark = day.tone === "game";

  return (
    <article
      className={cn(
        "group relative flex h-full flex-col overflow-hidden rounded-[var(--radius-xl)] border p-5 shadow-[var(--shadow-resting)] sm:p-6",
        toneClasses[day.tone],
        className,
      )}
    >
      <div aria-hidden="true" className="day-card-orbit" />
      <div className="relative flex items-start justify-between gap-4">
        <div>
          <p
            className={cn(
              "text-xs font-bold tracking-[0.16em] uppercase",
              isDark
                ? "text-[var(--color-antique-gold-400)]"
                : "text-[var(--color-prague-red-600)]",
            )}
          >
            {day.eyebrow}
          </p>
          <p
            className={cn(
              "mt-1 text-sm",
              isDark ? "text-white/60" : "text-[var(--color-ink-600)]",
            )}
          >
            {day.date}
          </p>
        </div>
        <span
          className={cn(
            "flex size-12 shrink-0 items-center justify-center rounded-2xl border",
            isDark
              ? "border-white/10 bg-white/5 text-[var(--color-electric-cyan-400)]"
              : "border-[var(--color-prague-red-600)]/15 bg-[var(--color-prague-red-600)]/5 text-[var(--color-prague-red-600)]",
          )}
        >
          <ContentIcon name={day.icon} size={24} />
        </span>
      </div>

      <div className="relative mt-8">
        <StatusBadge tone={isDark ? "gold" : "red"}>{day.status}</StatusBadge>
        <h3 className="font-display mt-4 text-3xl leading-none font-semibold">
          {day.title}
        </h3>
        <p
          className={cn(
            "mt-4 text-base leading-6",
            isDark ? "text-white/78" : "text-[var(--color-ink-600)]",
          )}
        >
          {day.summary}
        </p>
        <p
          className={cn(
            "mt-3 text-sm leading-6",
            isDark ? "text-white/55" : "text-[var(--color-ink-600)]",
          )}
        >
          {day.detail}
        </p>
      </div>

      <div className="relative mt-6 flex flex-wrap gap-2">
        {day.items.map((item) => (
          <Tag key={item}>{item}</Tag>
        ))}
      </div>

      {day.actionTarget ? (
        <a
          className={cn(
            "relative mt-auto flex min-h-11 items-center gap-2 pt-7 text-sm font-bold focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-[var(--focus-ring)]",
            isDark
              ? "text-[var(--color-electric-cyan-400)]"
              : "text-[var(--color-prague-red-700)]",
          )}
          href={`#${day.actionTarget}`}
        >
          Explore this day
          <ArrowRight
            aria-hidden="true"
            className="transition-transform group-hover:translate-x-1"
            size={17}
          />
        </a>
      ) : null}
    </article>
  );
}
