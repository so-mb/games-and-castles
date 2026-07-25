import { cn } from "../../lib/cn";
import type { LeaderboardEntry } from "../../types/content";
import { ParticipantAvatar } from "./ParticipantAvatar";

interface LeaderboardRowProps {
  entry: LeaderboardEntry;
  className?: string;
}

export function LeaderboardRow({ entry, className }: LeaderboardRowProps) {
  return (
    <li
      className={cn(
        "grid grid-cols-[2rem_auto_1fr_auto] items-center gap-3 rounded-xl border border-white/8 bg-white/[0.035] px-3 py-3",
        className,
      )}
    >
      <span
        className="font-score text-center text-sm font-extrabold text-white/55"
        aria-label={`Rank ${entry.rank}`}
      >
        {entry.rank}
      </span>
      <ParticipantAvatar
        accent={entry.accent}
        initials={entry.initials}
        name={entry.displayName}
        size="sm"
      />
      <span className="min-w-0">
        <span className="block truncate text-sm font-bold text-white">
          {entry.displayName}
        </span>
        <span className="block truncate text-xs text-white/48">
          {entry.note}
        </span>
      </span>
      <span className="font-score text-right text-lg font-black text-[var(--color-paper-50)]">
        {entry.points}
        <span className="ml-1 text-[0.65rem] font-bold tracking-wide text-white/45 uppercase">
          pts
        </span>
      </span>
    </li>
  );
}
