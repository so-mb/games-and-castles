import { motion, useReducedMotion } from "framer-motion";
import { RotateCcw, Sparkles, Swords, Trophy } from "lucide-react";
import { useState } from "react";
import { Button } from "../../../components/ui/Button";
import { ParticipantAvatar } from "../../../components/ui/ParticipantAvatar";
import { StatusBadge } from "../../../components/ui/StatusBadge";
import { Surface } from "../../../components/ui/Surface";
import type { Participant } from "../../participants/types";
import { MerryGoRoundGrandWinner } from "../MerryGoRoundGrandWinner";
import type { PublishedCompetition } from "../domain/types";
import { deriveCompetitionPointBreakdown } from "../engine/points";
import {
  matchScore,
  matchStatusLabel,
  knockoutChampionParticipantId,
  runProgress,
  runStageLabel,
  seriesLabel,
} from "../engine/presentation";
import { deriveStandings } from "../engine/standings";
import type { CompetitionMatch, CompetitionRun } from "../engine/types";
import { KnockoutBracket } from "./KnockoutBracket";

function initials(name: string) {
  return name
    .split(/\s+/)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function participantResolver(participants: Participant[]) {
  const byId = new Map(
    participants.map((participant) => [participant.id, participant]),
  );
  return (participantId: string | null) => {
    if (!participantId) return null;
    return (
      byId.get(participantId) ?? {
        id: participantId,
        displayName: "Unavailable participant",
        avatar: { icon: "trophy" as const, tone: "neutral" as const },
        status: "inactive" as const,
      }
    );
  };
}

function PlayerName({
  participantId,
  participants,
  winner = false,
}: {
  participantId: string | null;
  participants: Participant[];
  winner?: boolean;
}) {
  const participant = participantResolver(participants)(participantId);
  if (!participant)
    return <span className="text-white/38">Awaiting qualifier</span>;
  return (
    <span className="flex min-w-0 items-center gap-2">
      <ParticipantAvatar
        accent={participant.avatar.tone}
        icon={participant.avatar.icon}
        initials={initials(participant.displayName)}
        name={participant.displayName}
        size="sm"
        winner={winner}
      />
      <span className="truncate font-bold">{participant.displayName}</span>
    </span>
  );
}

function MatchCard({
  match,
  participants,
}: {
  match: CompetitionMatch;
  participants: Participant[];
}) {
  return (
    <article
      className={`rounded-2xl border p-4 ${match.status === "in-progress" ? "border-[var(--color-electric-cyan-400)] bg-[var(--color-electric-cyan-400)]/8" : "border-white/10 bg-white/[0.035]"}`}
    >
      <div className="flex items-center justify-between gap-3">
        <StatusBadge
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
        <span className="font-score text-sm font-black tabular-nums text-white/58">
          {matchScore(match)}
        </span>
      </div>
      <div className="mt-4 grid gap-3 text-sm">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            {match.isBye && !match.participantAId ? (
              <span className="font-bold text-white/38">BYE</span>
            ) : (
              <PlayerName
                participantId={match.participantAId}
                participants={participants}
                winner={match.result?.winnerId === match.participantAId}
              />
            )}
            {match.seedA ? (
              <span className="mt-1 block pl-11 text-[0.68rem] font-bold text-white/35">
                Seed {match.seedA}
              </span>
            ) : null}
          </div>
          {match.result ? (
            <strong>{match.result.participantAWins}</strong>
          ) : null}
        </div>
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            {match.isBye && !match.participantBId ? (
              <span className="font-bold text-white/38">BYE</span>
            ) : (
              <PlayerName
                participantId={match.participantBId}
                participants={participants}
                winner={match.result?.winnerId === match.participantBId}
              />
            )}
            {match.seedB ? (
              <span className="mt-1 block pl-11 text-[0.68rem] font-bold text-white/35">
                Seed {match.seedB}
              </span>
            ) : null}
          </div>
          {match.result ? (
            <strong>{match.result.participantBWins}</strong>
          ) : null}
        </div>
      </div>
    </article>
  );
}

function Standings({
  run,
  participants,
}: {
  run: CompetitionRun;
  participants: Participant[];
}) {
  const standings = deriveStandings(
    run.participantIds,
    Object.values(run.matches),
    run.configSnapshot.tableScoring,
    Object.values(run.tieResolutions),
  );
  const display = participantResolver(participants);
  return (
    <section aria-labelledby={`${run.competitionId}-standings`}>
      <h5
        className="text-lg font-extrabold"
        id={`${run.competitionId}-standings`}
      >
        Round-robin standings
      </h5>
      <p className="mt-1 text-xs leading-5 text-white/45">
        Qualification table only. These points set the knockout seeds; the
        knockout final decides the Grand Winner.
      </p>
      <div className="mt-3 overflow-x-auto rounded-2xl border border-white/10">
        <table className="w-full min-w-[42rem] border-collapse text-left text-sm">
          <thead className="bg-white/5 text-xs tracking-wide text-white/52 uppercase">
            <tr>
              <th className="px-3 py-3">Rank</th>
              <th className="px-3 py-3">Participant</th>
              <th className="px-3 py-3">P</th>
              <th className="px-3 py-3">W</th>
              <th className="px-3 py-3">D</th>
              <th className="px-3 py-3">L</th>
              <th className="px-3 py-3">Rounds</th>
              <th className="px-3 py-3">Diff</th>
              <th className="px-3 py-3">Points</th>
              <th className="px-3 py-3">Qualification</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/8">
            {standings.rows.map((row, index) => {
              const participant = display(row.participantId)!;
              const qualifies = index < run.configSnapshot.qualificationCount;
              return (
                <tr key={row.participantId}>
                  <td className="px-3 py-3 font-black tabular-nums">
                    {row.rank}
                    {row.tied ? "=" : ""}
                  </td>
                  <td className="max-w-52 truncate px-3 py-3 font-bold">
                    {participant.displayName}
                  </td>
                  <td className="px-3 py-3 tabular-nums">{row.played}</td>
                  <td className="px-3 py-3 tabular-nums">{row.matchWins}</td>
                  <td className="px-3 py-3 tabular-nums">{row.matchDraws}</td>
                  <td className="px-3 py-3 tabular-nums">{row.matchLosses}</td>
                  <td className="px-3 py-3 tabular-nums">{row.roundsWon}</td>
                  <td className="px-3 py-3 tabular-nums">
                    {row.roundDifferential > 0 ? "+" : ""}
                    {row.roundDifferential}
                  </td>
                  <td className="px-3 py-3 font-black tabular-nums text-[var(--color-electric-cyan-400)]">
                    {row.tablePoints}
                  </td>
                  <td className="px-3 py-3 text-xs font-bold">
                    {qualifies ? "Qualifier position" : "Outside line"}
                    {row.decidedBy === "unresolved" ? " · Tie unresolved" : ""}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function ProjectedPoints({
  run,
  participants,
}: {
  run: CompetitionRun;
  participants: Participant[];
}) {
  const display = participantResolver(participants);
  const breakdown = deriveCompetitionPointBreakdown(run).sort(
    (a, b) => b.total - a.total,
  );
  return (
    <section aria-labelledby={`${run.competitionId}-points`}>
      <h5 className="text-lg font-extrabold" id={`${run.competitionId}-points`}>
        Projected championship points
      </h5>
      <p className="mt-1 text-xs leading-5 text-white/45">
        Competition-only awards. The championship table rebuilds from this
        competition’s current ledger source.
      </p>
      <ul className="mt-3 grid gap-3 sm:grid-cols-2">
        {breakdown.map((entry) => (
          <li
            className="rounded-2xl border border-white/10 bg-white/[0.035] p-4"
            key={entry.participantId}
          >
            <div className="flex items-center justify-between gap-3">
              <strong className="truncate">
                {display(entry.participantId)!.displayName}
              </strong>
              <span className="font-score text-xl font-black text-[var(--color-antique-gold-400)]">
                {entry.total}
              </span>
            </div>
            {entry.items.length ? (
              <ul className="mt-3 space-y-1 text-xs text-white/52">
                {entry.items.map((item) => (
                  <li key={item.id}>
                    {item.label}: +{item.points}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-xs text-white/38">No points yet</p>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}

function Bracket({
  run,
  participants,
}: {
  run: CompetitionRun;
  participants: Participant[];
}) {
  if (!run.knockout) return null;
  return (
    <KnockoutBracket
      id={`${run.competitionId}-bracket`}
      matches={run.matches}
      participants={participants}
      rounds={run.knockout.rounds}
      sourceDescription="The final round-robin table sets the seed order. Each winner then follows the connected path towards the final."
      sourceEntries={run.knockout.seedOrder.map((participantId, index) => ({
        participantId,
        seed: index + 1,
        context: `Table #${index + 1}`,
      }))}
      sourceLabel="Round-robin standings"
      thirdPlaceMatchId={run.knockout.thirdPlaceMatchId}
    />
  );
}

export function MerryGoRoundExperience({
  competition,
  run,
  participants,
}: {
  competition: PublishedCompetition;
  run: CompetitionRun;
  participants: Participant[];
}) {
  const reducedMotion = useReducedMotion();
  const [celebrationReplay, setCelebrationReplay] = useState(0);
  const progress = runProgress(run);
  const current = run.currentMatchId
    ? run.matches[run.currentMatchId]
    : Object.values(run.matches)
        .filter(
          (match) =>
            !match.isBye &&
            !match.result &&
            match.participantAId &&
            match.participantBId,
        )
        .sort((a, b) => a.globalSequence - b.globalSequence)[0];
  const display = participantResolver(participants);
  const grandWinnerId = knockoutChampionParticipantId(run);
  return (
    <Surface
      as="article"
      className="p-5 sm:p-7"
      variant={
        competition.status === "completed" ? "celebration" : "championship"
      }
    >
      <div className="flex flex-wrap items-start justify-between gap-5">
        <div>
          <p className="text-xs font-bold tracking-[0.14em] text-[var(--color-antique-gold-400)] uppercase">
            Merry-Go-Round · {runStageLabel(run.stage)}
          </p>
          <h4 className="mt-2 text-2xl font-extrabold">{competition.title}</h4>
          <p className="mt-1 font-semibold text-white/68">
            {competition.gameName}
          </p>
        </div>
        <StatusBadge
          tone={competition.status === "active" ? "live" : "success"}
        >
          {competition.status === "active" ? "Live competition" : "Final"}
        </StatusBadge>
      </div>
      {grandWinnerId ? (
        <MerryGoRoundGrandWinner
          headingLevel={5}
          id={`${run.competitionId}-grand-winner`}
          participantId={grandWinnerId}
          participants={participants}
        />
      ) : null}
      {run.placements ? (
        <section
          className="mt-5 rounded-2xl border border-[var(--color-antique-gold-400)]/20 p-5"
          aria-labelledby={`${run.competitionId}-placements`}
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h5
                className="font-extrabold"
                id={`${run.competitionId}-placements`}
              >
                Final placements
              </h5>
              <p className="mt-1 text-xs text-white/42">
                Persisted completion snapshot
              </p>
            </div>
            <Button
              onClick={() => setCelebrationReplay((value) => value + 1)}
              variant="quiet"
            >
              <RotateCcw aria-hidden="true" size={15} /> Replay celebration
            </Button>
          </div>
          <motion.ol
            animate={
              reducedMotion ? undefined : { opacity: [0.6, 1], y: [4, 0] }
            }
            className="mt-4 grid gap-3 sm:grid-cols-3"
            key={celebrationReplay}
            transition={{ duration: 0.35 }}
          >
            {run.placements.entries
              .filter((entry) => entry.place && entry.place <= 3)
              .map((entry) => (
                <li
                  className="rounded-xl bg-white/[0.04] p-4 text-center"
                  key={entry.participantId}
                >
                  <Sparkles
                    aria-hidden="true"
                    className="mx-auto text-[var(--color-antique-gold-400)]"
                    size={18}
                  />
                  <p className="mt-2 text-xs font-bold tracking-wide text-white/42 uppercase">
                    {entry.placementBand}
                  </p>
                  <p className="mt-1 font-black">
                    {display(entry.participantId)!.displayName}
                  </p>
                </li>
              ))}
          </motion.ol>
        </section>
      ) : null}
      <dl className="mt-6 grid grid-cols-2 gap-3 rounded-2xl border border-white/10 bg-white/[0.025] p-4 sm:grid-cols-4">
        <div>
          <dt className="text-xs text-white/42">Participants</dt>
          <dd className="mt-1 font-black">{run.participantIds.length}</dd>
        </div>
        <div>
          <dt className="text-xs text-white/42">Series</dt>
          <dd className="mt-1 font-black">
            {seriesLabel(run.configSnapshot.series)}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-white/42">Progress</dt>
          <dd className="mt-1 font-black">
            {progress.completed}/{progress.total}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-white/42">Stage</dt>
          <dd className="mt-1 font-black">{runStageLabel(run.stage)}</dd>
        </div>
      </dl>
      <div
        className="mt-3 h-2 overflow-hidden rounded-full bg-white/8"
        role="progressbar"
        aria-label="Competition progress"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={progress.percentage}
      >
        <div
          className="h-full rounded-full bg-[var(--color-electric-cyan-400)]"
          style={{ width: `${progress.percentage}%` }}
        />
      </div>
      {current ? (
        <section
          aria-labelledby={`${run.competitionId}-live`}
          className="mt-7 rounded-2xl border-2 border-[var(--color-electric-cyan-400)]/65 bg-[var(--color-electric-cyan-400)]/7 p-5"
        >
          <div className="flex items-center gap-2">
            <Swords
              aria-hidden="true"
              size={20}
              className="text-[var(--color-electric-cyan-400)]"
            />
            <h5 id={`${run.competitionId}-live`} className="font-extrabold">
              {current.status === "in-progress"
                ? "Now playing"
                : "Recommended next match"}
            </h5>
          </div>
          <div className="mt-4">
            <MatchCard match={current} participants={participants} />
          </div>
        </section>
      ) : null}
      <div className="mt-8 space-y-9">
        <section aria-labelledby={`${run.competitionId}-fixtures`}>
          <h5
            className="text-lg font-extrabold"
            id={`${run.competitionId}-fixtures`}
          >
            Round-robin fixtures
          </h5>
          <div className="mt-3 grid gap-4 lg:grid-cols-2">
            {run.roundRobin.rounds.map((round) => (
              <section
                className="rounded-2xl border border-white/8 p-4"
                key={round.number}
              >
                <h6 className="text-sm font-extrabold">
                  Fixture round {round.number}
                </h6>
                {round.byeParticipantId ? (
                  <p className="mt-1 text-xs text-white/48">
                    BYE · {display(round.byeParticipantId)!.displayName}
                  </p>
                ) : null}
                <div className="mt-3 grid gap-3">
                  {round.matchIds.map((id) => (
                    <MatchCard
                      key={id}
                      match={run.matches[id]!}
                      participants={participants}
                    />
                  ))}
                </div>
              </section>
            ))}
          </div>
        </section>
        <Standings run={run} participants={participants} />
        <ProjectedPoints run={run} participants={participants} />
        <Bracket run={run} participants={participants} />
      </div>
      {competition.status === "completed" ? (
        <p className="mt-8 flex items-center gap-2 text-sm font-bold text-[var(--color-antique-gold-400)]">
          <Trophy aria-hidden="true" size={18} /> Historical result · read only
        </p>
      ) : null}
    </Surface>
  );
}
