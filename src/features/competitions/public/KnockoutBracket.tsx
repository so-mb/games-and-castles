import { ChevronRight, Crown, Route } from "lucide-react";
import type { ReactNode } from "react";
import { ParticipantAvatar } from "../../../components/ui/ParticipantAvatar";
import { StatusBadge } from "../../../components/ui/StatusBadge";
import type { Participant } from "../../participants/types";
import { matchScore, matchStatusLabel } from "../engine/presentation";
import type { CompetitionMatch, KnockoutRound } from "../engine/types";

export interface BracketSourceEntry {
  participantId: string;
  seed: number;
  context: string;
}

interface KnockoutBracketProps<TMatch extends CompetitionMatch> {
  id: string;
  rounds: KnockoutRound[];
  matches: Record<string, TMatch>;
  participants: Participant[];
  sourceLabel: string;
  sourceDescription: string;
  sourceEntries: BracketSourceEntry[];
  thirdPlaceMatchId?: string | null;
  matchSlotHeight?: number;
  headingLevel?: 4 | 5;
  renderMatch?: (match: TMatch) => ReactNode;
}

function initials(displayName: string) {
  return displayName
    .split(/\s+/)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function PublicBracketMatch({
  match,
  participants,
}: {
  match: CompetitionMatch;
  participants: Participant[];
}) {
  const participantById = new Map(
    participants.map((participant) => [participant.id, participant]),
  );

  return (
    <article
      className={`overflow-hidden rounded-2xl border bg-[var(--color-night-900)] shadow-[0_14px_36px_rgba(0,0,0,0.2)] ${
        match.status === "in-progress"
          ? "border-[var(--color-electric-cyan-400)]"
          : "border-white/12"
      }`}
    >
      <div className="flex items-center justify-between gap-3 border-b border-white/8 bg-white/[0.035] px-3 py-2">
        <span className="text-[0.65rem] font-bold tracking-[0.1em] text-white/42 uppercase">
          {match.stage === "third-place"
            ? "Third-place match"
            : `Match ${match.bracketSlot ?? match.sequenceInRound}`}
        </span>
        <StatusBadge
          className="min-h-6 px-2 py-0.5 text-[0.6rem]"
          tone={
            match.status === "in-progress"
              ? "live"
              : match.status === "completed"
                ? "success"
                : "neutral"
          }
        >
          {matchStatusLabel(match)}
        </StatusBadge>
      </div>
      <div className="divide-y divide-white/8">
        {(["A", "B"] as const).map((side) => {
          const participantId =
            side === "A" ? match.participantAId : match.participantBId;
          const seed = side === "A" ? match.seedA : match.seedB;
          const participant = participantId
            ? participantById.get(participantId)
            : null;
          const winner = Boolean(
            participantId && match.result?.winnerId === participantId,
          );
          const score = match.result
            ? side === "A"
              ? match.result.participantAWins
              : match.result.participantBWins
            : null;

          return (
            <div
              className={`flex min-h-12 items-center gap-2 px-3 py-2 ${
                winner ? "bg-[var(--color-antique-gold-400)]/8" : ""
              }`}
              key={side}
            >
              <span className="w-5 shrink-0 text-center font-score text-[0.68rem] font-black text-white/38">
                {seed ?? "—"}
              </span>
              {participant ? (
                <ParticipantAvatar
                  accent={participant.avatar.tone}
                  className="size-7"
                  icon={participant.avatar.icon}
                  initials={initials(participant.displayName)}
                  name={participant.displayName}
                  size="sm"
                  winner={winner}
                />
              ) : null}
              <span
                className={`min-w-0 flex-1 truncate text-xs font-bold ${
                  participant ? "text-white/82" : "text-white/35"
                }`}
              >
                {participant?.displayName ??
                  (match.isBye ? "BYE" : "Awaiting winner")}
              </span>
              {score !== null ? (
                <strong className="font-score text-sm tabular-nums">
                  {score}
                </strong>
              ) : null}
            </div>
          );
        })}
      </div>
      <span className="sr-only">Series score {matchScore(match)}</span>
    </article>
  );
}

function matchPosition(index: number, matchCount: number, height: number) {
  return ((index + 0.5) / matchCount) * height;
}

function RoundConnectors({
  currentCount,
  height,
  previousCount,
}: {
  currentCount: number;
  height: number;
  previousCount: number;
}) {
  return (
    <svg
      aria-hidden="true"
      className="pointer-events-none absolute top-0 -left-10 h-full w-10 overflow-visible"
      preserveAspectRatio="none"
      viewBox={`0 0 40 ${height}`}
    >
      {Array.from({ length: currentCount }, (_, index) => {
        const firstSource = index * 2;
        const secondSource = firstSource + 1;
        const firstY = matchPosition(firstSource, previousCount, height);
        const secondY = matchPosition(secondSource, previousCount, height);
        const destinationY = matchPosition(index, currentCount, height);
        return (
          <g key={index}>
            <path
              d={`M 0 ${firstY} H 20 V ${destinationY} H 40`}
              fill="none"
              stroke="var(--color-antique-gold-400)"
              strokeOpacity="0.46"
              strokeWidth="1.5"
              vectorEffect="non-scaling-stroke"
            />
            <path
              d={`M 0 ${secondY} H 20 V ${destinationY}`}
              fill="none"
              stroke="var(--color-antique-gold-400)"
              strokeOpacity="0.46"
              strokeWidth="1.5"
              vectorEffect="non-scaling-stroke"
            />
          </g>
        );
      })}
    </svg>
  );
}

export function KnockoutBracket<TMatch extends CompetitionMatch>({
  id,
  rounds,
  matches,
  participants,
  sourceLabel,
  sourceDescription,
  sourceEntries,
  thirdPlaceMatchId = null,
  matchSlotHeight = 154,
  headingLevel = 5,
  renderMatch,
}: KnockoutBracketProps<TMatch>) {
  const participantById = new Map(
    participants.map((participant) => [participant.id, participant]),
  );
  const firstRoundCount = rounds[0]?.matchIds.length ?? 1;
  const trackHeight = Math.max(280, firstRoundCount * matchSlotHeight);
  const Heading = headingLevel === 4 ? "h4" : "h5";
  const RoundHeading = headingLevel === 4 ? "h5" : "h6";

  return (
    <section aria-labelledby={`${id}-title`}>
      <div className="flex items-center gap-2">
        <Route
          aria-hidden="true"
          className="text-[var(--color-electric-cyan-400)]"
          size={19}
        />
        <Heading className="text-lg font-extrabold" id={`${id}-title`}>
          Knockout bracket
        </Heading>
      </div>
      <div className="mt-3 rounded-2xl border border-white/10 bg-black/10 p-4">
        <div className="flex flex-wrap items-center gap-2 text-xs font-bold">
          <span className="rounded-full border border-white/12 bg-white/[0.04] px-3 py-1.5 text-white/68">
            {sourceLabel}
          </span>
          <ChevronRight
            aria-hidden="true"
            className="text-white/30"
            size={16}
          />
          <span className="rounded-full border border-[var(--color-antique-gold-400)]/30 bg-[var(--color-antique-gold-400)]/8 px-3 py-1.5 text-[var(--color-antique-gold-400)]">
            {sourceEntries.length} qualifiers seeded
          </span>
          <ChevronRight
            aria-hidden="true"
            className="text-white/30"
            size={16}
          />
          <span className="rounded-full border border-[var(--color-electric-cyan-400)]/30 bg-[var(--color-electric-cyan-400)]/8 px-3 py-1.5 text-[var(--color-electric-cyan-400)]">
            Knockout pathway
          </span>
        </div>
        <p className="mt-3 text-xs leading-5 text-white/48">
          {sourceDescription}
        </p>
        <ol className="mt-3 flex flex-wrap gap-2">
          {sourceEntries.map((entry) => (
            <li
              className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.035] px-3 py-2 text-xs"
              key={entry.participantId}
            >
              <span className="font-score font-black text-[var(--color-antique-gold-400)]">
                {entry.seed}
              </span>
              <strong>
                {participantById.get(entry.participantId)?.displayName ??
                  "Unavailable participant"}
              </strong>
              <span className="text-white/38">{entry.context}</span>
            </li>
          ))}
        </ol>
      </div>
      <p className="mt-4 text-xs font-semibold text-white/42">
        Swipe or scroll sideways to follow the route to the final.
      </p>
      <div
        aria-label="Knockout bracket rounds"
        className="mt-3 overflow-x-auto overscroll-x-contain pb-4"
        tabIndex={0}
      >
        <div className="flex min-w-max gap-10 pr-3">
          {rounds.map((round, roundIndex) => {
            const roundMatches = round.matchIds.map(
              (matchId) => matches[matchId],
            );
            const previousCount =
              roundIndex > 0 ? rounds[roundIndex - 1]!.matchIds.length : 0;
            return (
              <section
                aria-label={round.label}
                className="w-[17rem] shrink-0"
                key={round.number}
              >
                <div className="flex items-center gap-2 border-b border-white/10 pb-3">
                  <span className="flex size-7 items-center justify-center rounded-full border border-[var(--color-antique-gold-400)]/30 font-score text-xs font-black text-[var(--color-antique-gold-400)]">
                    {round.number}
                  </span>
                  <RoundHeading className="font-extrabold">
                    {round.label}
                  </RoundHeading>
                </div>
                <div
                  className="relative mt-3"
                  style={{ height: `${trackHeight}px` }}
                >
                  {roundIndex > 0 ? (
                    <RoundConnectors
                      currentCount={roundMatches.length}
                      height={trackHeight}
                      previousCount={previousCount}
                    />
                  ) : null}
                  {roundMatches.map((match, index) =>
                    match ? (
                      <div
                        className="absolute right-0 left-0 -translate-y-1/2"
                        key={match.id}
                        style={{
                          top: `${matchPosition(
                            index,
                            roundMatches.length,
                            trackHeight,
                          )}px`,
                        }}
                      >
                        {renderMatch ? (
                          renderMatch(match)
                        ) : (
                          <PublicBracketMatch
                            match={match}
                            participants={participants}
                          />
                        )}
                      </div>
                    ) : null,
                  )}
                </div>
              </section>
            );
          })}
        </div>
      </div>
      {thirdPlaceMatchId && matches[thirdPlaceMatchId] ? (
        <section
          aria-labelledby={`${id}-third-place`}
          className="mt-2 max-w-[17rem]"
        >
          <div className="mb-3 flex items-center gap-2">
            <Crown
              aria-hidden="true"
              className="text-[var(--color-antique-gold-400)]"
              size={17}
            />
            <RoundHeading className="font-extrabold" id={`${id}-third-place`}>
              Third place
            </RoundHeading>
          </div>
          {renderMatch ? (
            renderMatch(matches[thirdPlaceMatchId]!)
          ) : (
            <PublicBracketMatch
              match={matches[thirdPlaceMatchId]!}
              participants={participants}
            />
          )}
        </section>
      ) : null}
    </section>
  );
}
