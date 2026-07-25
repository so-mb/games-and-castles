import { LockKeyhole } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "../../lib/cn";
import type { LockedDisplayState } from "../../types/content";
import { ContentIcon } from "./ContentIcon";
import { StatusBadge } from "./StatusBadge";
import { Surface } from "./Surface";

interface LockedContentCardProps {
  state: LockedDisplayState;
  children?: ReactNode;
  className?: string;
}

export function LockedContentCard({
  state,
  children,
  className,
}: LockedContentCardProps) {
  return (
    <Surface
      className={cn(
        "locked-card relative overflow-hidden p-5 sm:p-7 lg:p-9",
        className,
      )}
      variant="locked"
    >
      <div aria-hidden="true" className="vault-dial">
        <span className="vault-dial-inner">
          <LockKeyhole size={26} strokeWidth={1.8} />
        </span>
      </div>
      <div className="relative z-10 max-w-xl">
        <div className="mb-6 flex items-center justify-between gap-4">
          <span className="flex size-11 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-[var(--color-antique-gold-400)]">
            <ContentIcon name={state.icon} size={22} />
          </span>
          <StatusBadge icon="crown" tone="gold">
            {state.status}
          </StatusBadge>
        </div>
        <p className="text-xs font-bold tracking-[0.18em] text-[var(--color-electric-cyan-400)] uppercase">
          {state.eyebrow}
        </p>
        <h3 className="font-display mt-3 text-4xl leading-none font-semibold sm:text-5xl">
          {state.title}
        </h3>
        <p className="mt-5 text-base leading-7 text-[var(--color-paper-300)]">
          {state.description}
        </p>
        {state.countLabel ? (
          <p className="font-score mt-5 text-lg font-extrabold text-[var(--color-antique-gold-400)]">
            {state.countLabel}
          </p>
        ) : null}
        <p className="mt-4 flex items-start gap-2 text-sm leading-6 text-white/55">
          <LockKeyhole aria-hidden="true" className="mt-1 shrink-0" size={15} />
          {state.phaseNote}
        </p>
      </div>
      {children ? <div className="relative z-10 mt-8">{children}</div> : null}
    </Surface>
  );
}
