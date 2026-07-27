import { Crown } from "lucide-react";
import { cn } from "../../lib/cn";
import type { LeaderboardEntry } from "../../types/content";
import { ParticipantAvatar } from "./ParticipantAvatar";

interface PodiumProps {
  entries: LeaderboardEntry[];
  className?: string;
  ariaLabel?: string;
}

export function Podium({
  entries,
  className,
  ariaLabel = "Top-three podium",
}: PodiumProps) {
  const topThree = entries.slice(0, 3);

  return (
    <ol
      aria-label={ariaLabel}
      className={cn(
        "podium-grid grid grid-cols-3 items-end gap-2 sm:gap-3",
        className,
      )}
    >
      {topThree.map((entry) => (
        <li
          className={cn(
            "podium-place flex min-w-0 flex-col items-center rounded-t-2xl border border-white/10 bg-white/[0.045] px-2 pt-4 text-center",
            entry.rank === 1 &&
              "podium-first border-[var(--color-antique-gold-400)]/35 bg-[var(--color-antique-gold-400)]/8",
            entry.rank === 2 && "podium-second",
            entry.rank === 3 && "podium-third",
          )}
          key={entry.id}
        >
          {entry.rank === 1 ? (
            <Crown
              aria-hidden="true"
              className="mb-2 text-[var(--color-antique-gold-400)]"
              size={20}
            />
          ) : (
            <span className="mb-2 text-xs font-black text-white/45">
              #{entry.rank}
            </span>
          )}
          <ParticipantAvatar
            accent={entry.accent}
            initials={entry.initials}
            name={entry.displayName}
            size="md"
          />
          <span className="mt-2 max-w-full truncate text-xs font-bold text-white sm:text-sm">
            {entry.displayName}
          </span>
          <span className="font-score mt-1 text-lg font-black text-[var(--color-paper-50)]">
            {entry.points}
          </span>
          <span className="mt-3 block h-[var(--podium-height)] w-full rounded-t-lg bg-white/[0.06]" />
        </li>
      ))}
    </ol>
  );
}
