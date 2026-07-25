import { cn } from "../../lib/cn";

interface ParticipantAvatarProps {
  initials: string;
  name: string;
  accent?: "cyan" | "gold" | "red" | "neutral";
  size?: "sm" | "md" | "lg";
  className?: string;
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
}: ParticipantAvatarProps) {
  return (
    <span
      aria-label={`${name} avatar`}
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full border font-extrabold tracking-wide",
        accents[accent],
        sizes[size],
        className,
      )}
      role="img"
    >
      {initials}
    </span>
  );
}
