import { cn } from "../../lib/cn";
import type { ContentIcon as ContentIconName } from "../../types/content";
import { ContentIcon } from "./ContentIcon";

interface ParticipantAvatarProps {
  initials: string;
  name: string;
  accent?: "cyan" | "gold" | "red" | "neutral";
  size?: "sm" | "md" | "lg";
  className?: string;
  icon?: ContentIconName;
  winner?: boolean;
}

const accents = {
  cyan: "border-[var(--color-electric-cyan-400)]/40 bg-[var(--color-electric-cyan-400)]/12 text-[var(--color-electric-cyan-400)]",
  gold: "border-[var(--color-antique-gold-400)]/40 bg-[var(--color-antique-gold-400)]/12 text-[var(--color-antique-gold-400)]",
  red: "border-[#ff9ca1]/35 bg-[#ff9ca1]/10 text-[#ffb3b7]",
  neutral: "border-white/15 bg-white/7 text-[var(--color-paper-50)]",
};

const sizes = {
  sm: "size-9 text-xs",
  md: "size-11 text-sm",
  lg: "size-14 text-base",
};

export function ParticipantAvatar({
  initials,
  name,
  accent = "neutral",
  size = "md",
  className,
  icon,
  winner = false,
}: ParticipantAvatarProps) {
  return (
    <span
      aria-label={`${name} avatar${winner ? ", winner" : ""}`}
      className={cn(
        "relative inline-flex shrink-0 items-center justify-center rounded-full border font-extrabold tracking-wide",
        accents[accent],
        sizes[size],
        className,
      )}
      role="img"
    >
      {icon ? (
        <ContentIcon name={icon} size={size === "lg" ? 24 : 18} />
      ) : (
        initials
      )}
      {winner ? (
        <span
          aria-hidden="true"
          className="absolute -top-2 -right-1 flex size-5 rotate-12 items-center justify-center rounded-full border border-[var(--color-antique-gold-400)]/45 bg-[var(--color-night-900)] text-[var(--color-antique-gold-400)] shadow-md"
        >
          <ContentIcon name="crown" size={11} strokeWidth={2.4} />
        </span>
      ) : null}
    </span>
  );
}
