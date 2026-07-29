import { motion, useReducedMotion } from "framer-motion";
import { AlertTriangle, Crown, Trophy, Users } from "lucide-react";
import { ParticipantAvatar } from "../../../components/ui/ParticipantAvatar";
import { StatusBadge } from "../../../components/ui/StatusBadge";
import { Surface } from "../../../components/ui/Surface";
import type { Participant } from "../../participants/types";
import {
  deriveAllHandsCompetitionPointBreakdown,
  deriveAllHandsSessionAwards,
  deriveAllHandsStandings,
  numericPlacements,
  sessionEntities,
} from "../all-hands/engine";
import type {
  AllHandsCompetitionRun,
  AllHandsSession,
  SessionResultEntity,
} from "../all-hands/types";
import type { PublishedCompetition } from "../domain/types";
import { winningAllHandsParticipantIds } from "./winEvents";

function person(participants: Participant[], id: string) {
  return participants.find((participant) => participant.id === id);
}

function name(participants: Participant[], id: string) {
  return person(participants, id)?.displayName ?? "Unavailable participant";
}

function initials(value: string) {
  return value
    .split(/\s+/)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function entityName(
  entity: SessionResultEntity,
  session: AllHandsSession,
  participants: Participant[],
) {
  return entity.kind === "participant"
    ? name(participants, entity.participantId)
    : (session.teams[entity.teamId]?.name ?? "Unavailable team");
}

function resultSummary(
  session: AllHandsSession,
  run: AllHandsCompetitionRun,
  participants: Participant[],
) {
  const result = session.result;
  if (!result) return "Result pending";
  const entities = sessionEntities(session);
  const label = (id: string) =>
    entityName(
      entities.find((entity) => entity.id === id)!,
      session,
      participants,
    );
  if (result.kind === "winner-only")
    return `Winner: ${label(result.winnerEntityId)}`;
  if (result.kind === "custom") {
    return result.entries
      .map((entry) => `${label(entry.entityId)} ${entry.points} pts`)
      .join(" · ");
  }
  const placements =
    result.kind === "placement"
      ? result.entries
      : numericPlacements(result, run.configSnapshot);
  return [...placements]
    .sort((left, right) => left.placement - right.placement)
    .map((entry) => `${entry.placement}. ${label(entry.entityId)}`)
    .join(" · ");
}

function PublicSessionCard({
  session,
  run,
  participants,
}: {
  session: AllHandsSession;
  run: AllHandsCompetitionRun;
  participants: Participant[];
}) {
  const awards = deriveAllHandsSessionAwards(session, run.configSnapshot);
  const winnerIds = winningAllHandsParticipantIds(session, run.configSnapshot);
  return (
    <article
      className={`rounded-2xl border p-4 ${
        session.status === "in-progress"
          ? "border-[var(--color-electric-cyan-400)] bg-[var(--color-electric-cyan-400)]/8"
          : "border-white/10 bg-white/[0.035]"
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <span className="text-xs text-white/40">
            Session {session.sequence}
          </span>
          <h5 className="mt-1 font-extrabold">{session.title}</h5>
        </div>
        <StatusBadge
          tone={
            session.status === "in-progress"
              ? "live"
              : session.status === "completed"
                ? "success"
                : session.status === "voided"
                  ? "warning"
                  : "neutral"
          }
        >
          {session.status === "in-progress"
            ? "Now playing"
            : session.status.replaceAll("-", " ")}
        </StatusBadge>
      </div>
      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        {sessionEntities(session).map((entity) => (
          <div
            className="flex items-center gap-3 rounded-xl border border-white/8 p-3"
            key={entity.id}
          >
            {entity.kind === "participant" ? (
              <ParticipantAvatar
                accent={
                  person(participants, entity.participantId)?.avatar.tone ??
                  "neutral"
                }
                icon={person(participants, entity.participantId)?.avatar.icon}
                initials={initials(name(participants, entity.participantId))}
                name={name(participants, entity.participantId)}
                size="sm"
                winner={winnerIds.includes(entity.participantId)}
              />
            ) : (
              <span className="flex size-9 items-center justify-center rounded-full border border-white/12 text-[var(--color-electric-cyan-400)]">
                <Users aria-hidden="true" size={17} />
              </span>
            )}
            <div className="min-w-0">
              <strong className="block truncate">
                {entityName(entity, session, participants)}
              </strong>
              {entity.kind === "team" ? (
                <span className="block truncate text-xs text-white/42">
                  {entity.participantIds
                    .map((id) => name(participants, id))
                    .join(", ")}
                </span>
              ) : null}
            </div>
          </div>
        ))}
      </div>
      {session.result ? (
        <p className="mt-4 text-sm leading-6 text-white/68">
          {resultSummary(session, run, participants)}
        </p>
      ) : null}
      {session.status === "voided" ? (
        <p className="mt-3 text-sm text-[var(--color-warning-500)]">
          Voided — this preserved result does not count.
        </p>
      ) : null}
      {awards.length ? (
        <details className="mt-4 border-t border-white/8 pt-3 text-sm">
          <summary className="cursor-pointer font-bold text-white/70">
            Session point breakdown
          </summary>
          <ul className="mt-2 space-y-1 text-white/52">
            {awards.map((award) => (
              <li className="flex justify-between gap-3" key={award.id}>
                <span>
                  {name(participants, award.participantId)} · {award.label}
                </span>
                <strong>+{award.points}</strong>
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </article>
  );
}

export function AllHandsExperience({
  competition,
  run,
  participants,
}: {
  competition: PublishedCompetition;
  run: AllHandsCompetitionRun;
  participants: Participant[];
}) {
  const reducedMotion = useReducedMotion();
  const sessions = Object.values(run.sessions).sort(
    (left, right) => left.sequence - right.sequence,
  );
  const standings = deriveAllHandsStandings(run);
  const breakdown = deriveAllHandsCompetitionPointBreakdown(run);
  const missing = run.eligibleParticipantIds.filter(
    (id) => !person(participants, id),
  );
  const completedCount = sessions.filter(
    (session) => session.status === "completed",
  ).length;
  const planned =
    run.configSnapshot.sessionPlan.kind === "fixed"
      ? run.configSnapshot.sessionPlan.plannedSessionCount
      : null;
  const podium = run.placements?.entries
    .filter((entry) => entry.place <= 3)
    .sort((left, right) => left.place - right.place);
  return (
    <Surface
      as="article"
      className="overflow-hidden p-0"
      variant="championship"
    >
      <div className="border-b border-white/8 bg-[radial-gradient(circle_at_top_right,rgba(54,214,208,0.12),transparent_45%)] p-5 sm:p-7">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-bold tracking-[0.15em] text-[var(--color-electric-cyan-400)] uppercase">
              All Hands · realtime table
            </p>
            <h4 className="mt-2 text-2xl font-extrabold">
              {competition.title}
            </h4>
            <p className="mt-1 text-sm text-white/58">
              {competition.gameName} ·{" "}
              {run.configSnapshot.resultMode.replaceAll("-", " ")} ·{" "}
              {run.eligibleParticipantIds.length} eligible
            </p>
          </div>
          <StatusBadge
            tone={
              run.stage === "completed"
                ? "gold"
                : run.currentSessionId
                  ? "live"
                  : "neutral"
            }
          >
            {run.stage === "completed"
              ? "Final"
              : run.currentSessionId
                ? "Live"
                : "Active"}
          </StatusBadge>
        </div>
        <p className="mt-4 text-sm text-white/52">
          {completedCount} completed
          {planned ? ` of ${planned} planned` : " · open-ended plan"}
          {run.currentSessionId
            ? ` · ${run.sessions[run.currentSessionId]?.title ?? "Session"} is now playing`
            : ""}
        </p>
        {missing.length ? (
          <p className="mt-3 flex items-center gap-2 text-xs text-[var(--color-warning-500)]">
            <AlertTriangle aria-hidden="true" size={15} /> A frozen participant
            is missing or inactive; their result identity remains preserved.
          </p>
        ) : null}
      </div>
      {podium?.length ? (
        <motion.section
          animate={{ opacity: 1, y: 0 }}
          aria-labelledby={`${run.competitionId}-podium`}
          className="border-b border-white/8 p-5 text-center sm:p-7"
          initial={reducedMotion ? false : { opacity: 0, y: 12 }}
        >
          <Crown
            aria-hidden="true"
            className="mx-auto text-[var(--color-antique-gold-400)]"
            size={32}
          />
          <h5
            className="mt-3 text-xl font-extrabold"
            id={`${run.competitionId}-podium`}
          >
            Final podium
          </h5>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            {podium.map((entry) => (
              <div
                className="rounded-2xl border border-[var(--color-antique-gold-400)]/20 p-4"
                key={entry.participantId}
              >
                <span className="text-xs text-white/42">
                  Place {entry.place}
                </span>
                <strong className="mt-1 block">
                  {name(participants, entry.participantId)}
                </strong>
                <span className="mt-1 block text-sm text-[var(--color-antique-gold-400)]">
                  {entry.totalCompetitionPoints} points
                </span>
              </div>
            ))}
          </div>
        </motion.section>
      ) : null}
      <div className="grid gap-8 p-5 sm:p-7 lg:grid-cols-[1.2fr_0.8fr]">
        <section aria-labelledby={`${run.competitionId}-sessions`}>
          <h5
            className="text-xl font-extrabold"
            id={`${run.competitionId}-sessions`}
          >
            Session history
          </h5>
          <div className="mt-4 grid gap-3">
            {sessions.length ? (
              sessions.map((session) => (
                <PublicSessionCard
                  key={session.id}
                  participants={participants}
                  run={run}
                  session={session}
                />
              ))
            ) : (
              <div className="rounded-2xl border border-dashed border-white/15 p-6 text-center">
                <Trophy aria-hidden="true" className="mx-auto text-white/30" />
                <p className="mt-3 font-bold">The table is ready</p>
                <p className="mt-1 text-sm text-white/45">
                  The organizer has not created the first session yet.
                </p>
              </div>
            )}
          </div>
        </section>
        <div className="space-y-8">
          <section aria-labelledby={`${run.competitionId}-standings`}>
            <h5
              className="text-xl font-extrabold"
              id={`${run.competitionId}-standings`}
            >
              Standings
            </h5>
            <div className="mt-4 overflow-x-auto rounded-2xl border border-white/10">
              <table className="w-full min-w-[28rem] text-left text-sm">
                <thead className="bg-white/5 text-xs text-white/48">
                  <tr>
                    <th className="px-3 py-3">Rank</th>
                    <th className="px-3 py-3">Participant</th>
                    <th className="px-3 py-3">Played</th>
                    <th className="px-3 py-3">Wins</th>
                    <th className="px-3 py-3">Points</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/8">
                  {standings.rows.map((row) => (
                    <tr key={row.participantId}>
                      <td className="px-3 py-3 font-black">
                        {row.rank}
                        {row.tied ? "=" : ""}
                      </td>
                      <td className="max-w-40 truncate px-3 py-3 font-bold">
                        {name(participants, row.participantId)}
                      </td>
                      <td className="px-3 py-3">{row.sessionsPlayed}</td>
                      <td className="px-3 py-3">{row.sessionWins}</td>
                      <td className="px-3 py-3 font-black text-[var(--color-electric-cyan-400)]">
                        {row.competitionPoints}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
          <section aria-labelledby={`${run.competitionId}-points`}>
            <h5
              className="text-xl font-extrabold"
              id={`${run.competitionId}-points`}
            >
              Projected points
            </h5>
            <p className="mt-1 text-xs leading-5 text-white/42">
              Itemized competition awards. The championship table rebuilds from
              this competition’s current ledger source.
            </p>
            <div className="mt-3 space-y-2">
              {breakdown.map((item) => (
                <details
                  className="rounded-xl border border-white/10 p-3"
                  key={item.participantId}
                >
                  <summary className="cursor-pointer text-sm font-bold">
                    {name(participants, item.participantId)} · {item.total}
                  </summary>
                  <ul className="mt-2 space-y-1 text-xs text-white/48">
                    {item.items.length ? (
                      item.items.map((award) => (
                        <li key={award.id}>
                          {award.sessionLabel}: {award.label} (+{award.points})
                        </li>
                      ))
                    ) : (
                      <li>No awards yet.</li>
                    )}
                  </ul>
                </details>
              ))}
            </div>
          </section>
        </div>
      </div>
    </Surface>
  );
}
