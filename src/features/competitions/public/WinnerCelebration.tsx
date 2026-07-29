import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Crown, Sparkles, X } from "lucide-react";
import { IconButton } from "../../../components/ui/IconButton";
import { ParticipantAvatar } from "../../../components/ui/ParticipantAvatar";
import type { Participant } from "../../participants/types";
import type { WinEvent } from "./winEvents";

const burstPieces = [
  { x: -58, y: -30, rotate: -55 },
  { x: -38, y: -54, rotate: -25 },
  { x: -12, y: -62, rotate: 20 },
  { x: 18, y: -58, rotate: 48 },
  { x: 46, y: -44, rotate: 75 },
  { x: 62, y: -18, rotate: 105 },
  { x: -50, y: 8, rotate: -90 },
  { x: 52, y: 12, rotate: 135 },
];

function initials(name: string) {
  return name
    .split(/\s+/)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function isParticipant(
  participant: Participant | undefined,
): participant is Participant {
  return Boolean(participant);
}

function burstClassName(index: number) {
  const color =
    index % 3 === 0
      ? "bg-[var(--color-electric-cyan-400)]"
      : index % 3 === 1
        ? "bg-[var(--color-antique-gold-400)]"
        : "bg-[#ff9ca1]";
  return `absolute size-1.5 rounded-sm ${color}`;
}

export function WinnerCelebration({
  event,
  participants,
  ownParticipantId,
  competitionTitle,
  onDismiss,
}: {
  event: WinEvent | null;
  participants: Participant[];
  ownParticipantId: string | null;
  competitionTitle: string;
  onDismiss: () => void;
}) {
  const reducedMotion = useReducedMotion();
  const winners = event
    ? event.participantIds
        .map((id) => participants.find((participant) => participant.id === id))
        .filter(isParticipant)
    : [];
  const ownWin =
    event?.participantIds.includes(ownParticipantId ?? "") ?? false;
  const winner = winners[0];
  const completionLabel =
    event?.kind === "session" ? "Session complete" : "Round complete";
  const title = ownWin
    ? winners.length > 1
      ? "Your team won!"
      : "You won!"
    : winners.length > 1
      ? "Team victory!"
      : `${winner?.displayName ?? "A participant"} wins!`;

  return (
    <AnimatePresence>
      {event ? (
        <motion.aside
          animate={{ opacity: 1, scale: 1, y: 0 }}
          aria-label="Win celebration"
          className="fixed right-3 bottom-20 left-3 z-[80] mx-auto max-w-sm overflow-hidden rounded-2xl border border-[var(--color-antique-gold-400)]/45 bg-[var(--color-night-900)]/96 p-4 pr-14 text-white shadow-[var(--shadow-gold)] sm:right-5 sm:bottom-5 sm:left-auto sm:w-[22rem]"
          exit={reducedMotion ? undefined : { opacity: 0, scale: 0.98, y: 8 }}
          initial={reducedMotion ? false : { opacity: 0, scale: 0.96, y: 14 }}
          key={event.id}
          transition={{ duration: 0.2, ease: "easeOut" }}
        >
          <IconButton
            className="absolute top-1.5 right-1.5 border-white/15 text-white/55 hover:text-white"
            label="Dismiss win celebration"
            onClick={onDismiss}
          >
            <X aria-hidden="true" size={16} />
          </IconButton>
          <div
            aria-atomic="true"
            aria-live="polite"
            className="relative flex items-center gap-4"
            role="status"
          >
            <div className="relative">
              {winner ? (
                <ParticipantAvatar
                  accent={winner.avatar.tone}
                  className="participant-avatar-celebrate"
                  icon={winner.avatar.icon}
                  initials={initials(winner.displayName)}
                  name={winner.displayName}
                  size="lg"
                  winner
                />
              ) : (
                <span className="flex size-14 items-center justify-center rounded-full border border-[var(--color-antique-gold-400)]/35 bg-[var(--color-antique-gold-400)]/10 text-[var(--color-antique-gold-400)]">
                  <Crown aria-hidden="true" size={24} />
                </span>
              )}
              {!reducedMotion ? (
                <span aria-hidden="true" className="absolute inset-1/2">
                  {burstPieces.map((piece, index) => (
                    <motion.span
                      animate={{
                        opacity: [0, 1, 0],
                        rotate: piece.rotate,
                        scale: [0.6, 1, 0.7],
                        x: piece.x,
                        y: piece.y,
                      }}
                      className={burstClassName(index)}
                      initial={{ opacity: 0, scale: 0, x: 0, y: 0 }}
                      key={`${event.id}-${index}`}
                      transition={{
                        delay: index * 0.035,
                        duration: 0.72,
                        ease: "easeOut",
                      }}
                    />
                  ))}
                </span>
              ) : null}
            </div>
            <div className="min-w-0 flex-1">
              <p className="flex items-center gap-2 text-xs font-bold tracking-[0.14em] text-[var(--color-antique-gold-400)] uppercase">
                <Sparkles aria-hidden="true" size={15} />
                {completionLabel}
              </p>
              <p className="mt-1 text-xl font-black">{title}</p>
              <p className="mt-1 truncate text-sm text-white/55">
                {competitionTitle}
              </p>
            </div>
          </div>
        </motion.aside>
      ) : null}
    </AnimatePresence>
  );
}
