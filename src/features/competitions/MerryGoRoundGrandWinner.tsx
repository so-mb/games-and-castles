import { Crown, Sparkles, Trophy } from "lucide-react";
import { ParticipantAvatar } from "../../components/ui/ParticipantAvatar";
import { StatusBadge } from "../../components/ui/StatusBadge";
import type { Participant } from "../participants/types";

function initials(name: string) {
  return name
    .split(/\s+/)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export function MerryGoRoundGrandWinner({
  id,
  headingLevel = 4,
  participantId,
  participants,
}: {
  id: string;
  headingLevel?: 4 | 5;
  participantId: string;
  participants: Participant[];
}) {
  const Heading = headingLevel === 4 ? "h4" : "h5";
  const participant = participants.find((entry) => entry.id === participantId);
  const displayName = participant?.displayName ?? "Unavailable participant";

  return (
    <section
      aria-labelledby={id}
      className="relative mt-6 overflow-hidden rounded-3xl border-2 border-[var(--color-antique-gold-400)]/65 bg-[var(--color-antique-gold-400)]/10 p-5 shadow-[var(--shadow-gold)] sm:p-6"
    >
      <div
        aria-hidden="true"
        className="absolute -top-16 -right-12 size-40 rounded-full border border-[var(--color-antique-gold-400)]/15"
      />
      <div
        aria-hidden="true"
        className="absolute top-4 right-5 text-[var(--color-antique-gold-400)]/25"
      >
        <Sparkles size={32} />
      </div>
      <div className="relative flex flex-col gap-5 sm:flex-row sm:items-center">
        <div className="relative w-fit shrink-0">
          {participant ? (
            <ParticipantAvatar
              accent={participant.avatar.tone}
              className="ring-4 ring-[var(--color-antique-gold-400)]/45 ring-offset-4 ring-offset-[var(--color-night-900)]"
              icon={participant.avatar.icon}
              initials={initials(displayName)}
              name={displayName}
              size="lg"
              winner
            />
          ) : (
            <span className="flex size-14 items-center justify-center rounded-full border border-[var(--color-antique-gold-400)]/35 bg-black/15 text-[var(--color-antique-gold-400)]">
              <Crown aria-hidden="true" size={26} />
            </span>
          )}
          <span className="absolute -right-3 -bottom-3 flex size-8 items-center justify-center rounded-full border-2 border-[var(--color-night-900)] bg-[var(--color-antique-gold-400)] text-[var(--color-night-950)]">
            <Crown aria-hidden="true" size={16} />
          </span>
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-3">
            <p className="text-xs font-black tracking-[0.16em] text-[var(--color-antique-gold-400)] uppercase">
              Knockout champion
            </p>
            <StatusBadge tone="success">Final champion</StatusBadge>
          </div>
          <Heading
            className="font-display mt-2 text-3xl font-semibold sm:text-4xl"
            id={id}
          >
            Grand Winner
          </Heading>
          <p className="mt-2 text-2xl font-black text-white sm:text-3xl">
            {displayName}
          </p>
        </div>
      </div>
      <p className="relative mt-5 flex items-start gap-3 border-t border-[var(--color-antique-gold-400)]/20 pt-4 text-sm leading-6 text-white/72">
        <Trophy
          aria-hidden="true"
          className="mt-0.5 shrink-0 text-[var(--color-antique-gold-400)]"
          size={18}
        />
        The knockout final determines the Grand Winner. Round-robin points
        decide qualification and seeding only; they do not override this result.
      </p>
    </section>
  );
}
