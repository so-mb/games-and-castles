import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ChevronDown } from "lucide-react";
import type { ReactNode } from "react";
import { ContentIcon } from "../../../components/ui/ContentIcon";
import { ParticipantAvatar } from "../../../components/ui/ParticipantAvatar";
import { StatusBadge } from "../../../components/ui/StatusBadge";
import type { Participant } from "../../participants/types";
import { formatPresentation } from "../domain/config";
import type { PublishedCompetition } from "../domain/types";

function initials(name: string) {
  return name
    .split(/\s+/)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export function CompetitionAccordion({
  children,
  competition,
  expanded,
  onToggle,
  participants,
}: {
  children: ReactNode;
  competition: PublishedCompetition;
  expanded: boolean;
  onToggle: () => void;
  participants: Participant[];
}) {
  const reducedMotion = useReducedMotion();
  const panelId = `competition-panel-${competition.id}`;
  const summaryId = `competition-summary-${competition.id}`;
  const visibleParticipants = competition.participantIds
    .map((id) => participants.find((participant) => participant.id === id))
    .filter((participant): participant is Participant => Boolean(participant));

  return (
    <section
      aria-labelledby={summaryId}
      className={`overflow-hidden rounded-[1.6rem] border bg-[var(--color-night-900)] shadow-[0_20px_55px_rgba(0,0,0,0.22)] transition-colors ${expanded ? "border-[var(--color-electric-cyan-400)]/55" : "border-white/10 hover:border-white/20"}`}
    >
      <button
        aria-controls={panelId}
        aria-expanded={expanded}
        aria-label={`${expanded ? "Collapse" : "Expand"} ${competition.title}`}
        className="group grid min-h-24 w-full cursor-pointer grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-4 p-4 text-left focus-visible:outline-3 focus-visible:-outline-offset-4 focus-visible:outline-[var(--color-electric-cyan-400)] sm:min-h-28 sm:gap-5 sm:p-5"
        onClick={onToggle}
        type="button"
      >
        <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-[var(--color-electric-cyan-400)] shadow-[inset_0_1px_rgba(255,255,255,0.05)] sm:size-14">
          <ContentIcon name={competition.iconKey} size={24} />
        </span>

        <span className="min-w-0">
          <span className="block text-[0.68rem] font-black tracking-[0.14em] text-[var(--color-antique-gold-400)] uppercase">
            {formatPresentation[competition.format].label}
          </span>
          <span
            aria-level={4}
            className="mt-1 block truncate text-lg font-extrabold text-white sm:text-xl"
            id={summaryId}
            role="heading"
          >
            {competition.title}
          </span>
          <span className="mt-0.5 block truncate text-sm font-semibold text-white/52">
            {competition.gameName}
          </span>
          <span className="mt-3 flex items-center gap-3">
            <span aria-hidden="true" className="flex -space-x-2">
              {visibleParticipants.slice(0, 4).map((participant) => (
                <ParticipantAvatar
                  accent={participant.avatar.tone}
                  className="size-7 ring-2 ring-[var(--color-night-900)]"
                  icon={participant.avatar.icon}
                  initials={initials(participant.displayName)}
                  key={participant.id}
                  name={participant.displayName}
                  size="sm"
                />
              ))}
            </span>
            <span className="text-xs font-bold text-white/40">
              {competition.participantIds.length} player
              {competition.participantIds.length === 1 ? "" : "s"}
            </span>
          </span>
        </span>

        <span className="flex flex-col items-end gap-3">
          <StatusBadge
            className="min-h-6 px-2 py-0.5 text-[0.62rem] sm:min-h-8 sm:px-3 sm:py-1 sm:text-xs"
            tone={competition.status === "completed" ? "success" : "live"}
          >
            {competition.status === "completed" ? "Completed" : "Live"}
          </StatusBadge>
          <span className="flex items-center gap-2 text-xs font-bold text-white/48">
            <span className="hidden lg:inline">
              {expanded ? "Close board" : "Open board"}
            </span>
            <span
              aria-hidden="true"
              className={`flex size-10 items-center justify-center rounded-full border transition duration-200 ${expanded ? "rotate-180 border-[var(--color-electric-cyan-400)]/50 bg-[var(--color-electric-cyan-400)]/10 text-[var(--color-electric-cyan-400)]" : "border-white/12 bg-white/5 text-white/60 group-hover:border-white/25 group-hover:text-white"}`}
            >
              <ChevronDown size={19} />
            </span>
          </span>
        </span>
      </button>

      <AnimatePresence initial={false}>
        {expanded ? (
          <motion.div
            animate={{ height: "auto", opacity: 1 }}
            aria-labelledby={summaryId}
            className="overflow-hidden"
            exit={reducedMotion ? { opacity: 0 } : { height: 0, opacity: 0 }}
            id={panelId}
            initial={reducedMotion ? false : { height: 0, opacity: 0 }}
            role="region"
            transition={{ duration: reducedMotion ? 0 : 0.24, ease: "easeOut" }}
          >
            <div className="border-t border-white/8 bg-black/10 p-2 sm:p-3">
              {children}
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </section>
  );
}
