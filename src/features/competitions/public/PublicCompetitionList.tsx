import { AlertTriangle, CalendarClock, WifiOff } from "lucide-react";
import { EmptyState } from "../../../components/feedback/EmptyState";
import { ContentIcon } from "../../../components/ui/ContentIcon";
import { ParticipantAvatar } from "../../../components/ui/ParticipantAvatar";
import { StatusBadge } from "../../../components/ui/StatusBadge";
import { Surface } from "../../../components/ui/Surface";
import { useConnection } from "../../live/ConnectionProvider";
import { useFirebase } from "../../live/FirebaseProvider";
import { useParticipants } from "../../participants/ParticipantsProvider";
import type { Participant } from "../../participants/types";
import { useCompetitions } from "../CompetitionsProvider";
import {
  balancedGroupSizes,
  groupMatchEstimate,
  knockoutMatchEstimate,
  roundRobinMatchCount,
} from "../domain/estimates";
import { formatPresentation } from "../domain/config";
import { resolveParticipants } from "../domain/transforms";
import type { PublishedCompetition } from "../domain/types";
import { MerryGoRoundExperience } from "./MerryGoRoundExperience";

function initials(name: string) {
  return name
    .split(/\s+/)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function configurationSummary(competition: PublishedCompetition) {
  const config = competition.formatConfig;
  if (config.kind === "round-robin-knockout") {
    return `${roundRobinMatchCount(competition.participantIds.length)} initial-stage matches · ${config.qualificationCount} qualify`;
  }
  if (config.kind === "all-hands") {
    const sessions =
      config.sessionPlan.kind === "open-ended"
        ? "Open-ended sessions"
        : `${config.sessionPlan.sessionCount} planned session${config.sessionPlan.sessionCount === 1 ? "" : "s"}`;
    return `${sessions} · ${config.resultMode.replaceAll("-", " ")}`;
  }
  const groupSizes = balancedGroupSizes(
    competition.participantIds.length,
    config.groupCount,
  );
  const groupMatches = groupMatchEstimate(groupSizes, config.roundRobinLegs);
  const qualifierCount = config.groupCount * config.qualifiersPerGroup;
  const knockoutMatches = knockoutMatchEstimate(
    qualifierCount,
    config.includeThirdPlace,
  );
  return `${config.groupCount} groups · ${groupMatches} group matches · ${knockoutMatches} knockout matches later`;
}

function participantAvatar(
  participantId: string,
  allParticipants: Participant[],
) {
  return allParticipants.find(
    (participant) => participant.id === participantId,
  );
}

export function ScheduledCompetitionCard({
  competition,
  participants,
}: {
  competition: PublishedCompetition;
  participants: Participant[];
}) {
  const resolved = resolveParticipants(
    competition.participantIds,
    participants,
  );
  return (
    <Surface as="article" className="p-5 sm:p-6" variant="championship">
      <div className="flex items-start justify-between gap-4">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-[var(--color-electric-cyan-400)]">
          <ContentIcon name={competition.iconKey} size={22} />
        </span>
        <StatusBadge tone="live">Scheduled · fixtures pending</StatusBadge>
      </div>
      <p className="mt-5 text-xs font-bold tracking-[0.14em] text-[var(--color-antique-gold-400)] uppercase">
        {formatPresentation[competition.format].label}
      </p>
      <h4 className="mt-2 text-xl font-extrabold">{competition.title}</h4>
      <p className="mt-1 text-sm font-semibold text-white/72">
        {competition.gameName}
      </p>
      {competition.description ? (
        <p className="mt-3 text-sm leading-6 text-white/52">
          {competition.description}
        </p>
      ) : null}
      <p className="mt-4 text-sm leading-6 text-white/55">
        {configurationSummary(competition)}
      </p>
      <div className="mt-5 flex items-center justify-between gap-4 border-t border-white/8 pt-4">
        <div
          aria-label={`${resolved.length} selected participants`}
          className="flex -space-x-2"
        >
          {resolved.slice(0, 6).map((participant) => {
            const live = participantAvatar(participant.id, participants);
            return (
              <ParticipantAvatar
                accent={live?.avatar.tone ?? "neutral"}
                className="ring-2 ring-[var(--color-night-800)]"
                icon={live?.avatar.icon}
                initials={initials(participant.displayName)}
                key={participant.id}
                name={participant.displayName}
                size="sm"
              />
            );
          })}
        </div>
        <span className="text-xs font-bold text-white/48">
          {resolved.length} player{resolved.length === 1 ? "" : "s"}
        </span>
      </div>
    </Surface>
  );
}

export function PublicCompetitionList() {
  const firebase = useFirebase();
  const connection = useConnection();
  const competitions = useCompetitions();
  const participants = useParticipants();
  const runningCompetitions = [
    ...competitions.active,
    ...competitions.completed,
  ];

  return (
    <section aria-labelledby="scheduled-games-title" className="mt-12">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-bold tracking-[0.16em] text-[var(--color-electric-cyan-400)] uppercase">
            Real Firebase data
          </p>
          <h3
            className="font-display mt-2 text-3xl font-semibold sm:text-4xl"
            id="scheduled-games-title"
          >
            Live and scheduled games
          </h3>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-white/55">
            Follow Merry-Go-Round fixtures and results live. Friday remains
            flexible—competition cards never assign a fixed start time.
          </p>
        </div>
        {firebase.status === "ready" ? (
          <StatusBadge tone={connection === "online" ? "live" : "warning"}>
            {`${runningCompetitions.length} live or completed · ${competitions.scheduled.length} scheduled`}
          </StatusBadge>
        ) : null}
      </div>

      {firebase.status !== "ready" ? (
        <Surface className="mt-6 p-5 sm:p-6" variant="championship">
          <StatusBadge tone="neutral">Live games unavailable</StatusBadge>
          <h4 className="mt-4 text-xl font-extrabold">
            Competition data is waiting backstage
          </h4>
          <p className="mt-2 text-sm leading-6 text-white/55">
            The static weekend page and championship preview remain available.
          </p>
        </Surface>
      ) : competitions.publicState === "loading" ? (
        <p
          className="mt-6 rounded-2xl border border-white/10 bg-white/[0.035] p-6 text-sm text-white/55"
          role="status"
        >
          Loading scheduled games…
        </p>
      ) : competitions.publicState === "error" ? (
        <p
          className="mt-6 flex items-center gap-2 rounded-2xl border border-[#ff9ca1]/25 bg-[#ff9ca1]/8 p-5 text-sm text-[#ffc3c6]"
          role="alert"
        >
          <WifiOff aria-hidden="true" size={18} />
          Scheduled games could not be loaded. The preview below is still sample
          content.
        </p>
      ) : (
        <>
          {competitions.publicMalformedCount +
            competitions.runtimeMalformedCount >
          0 ? (
            <p
              className="mt-6 flex items-center gap-2 rounded-2xl border border-[var(--color-warning-500)]/30 bg-[var(--color-warning-500)]/8 p-4 text-sm text-[var(--color-warning-500)]"
              role="alert"
            >
              <AlertTriangle aria-hidden="true" size={18} />
              One or more malformed competition or runtime records were safely
              omitted.
            </p>
          ) : null}
          {connection === "offline" ? (
            <p
              className="mt-6 flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.035] p-4 text-sm text-white/58"
              role="status"
            >
              <WifiOff aria-hidden="true" size={18} />
              Offline — saved competition cards may be out of date.
            </p>
          ) : null}
          {runningCompetitions.length > 0 ? (
            <div className="mt-6 grid gap-6">
              {runningCompetitions.map((competition) => {
                const run = competitions.runs.find(
                  (candidate) => candidate.competitionId === competition.id,
                );
                return run && competition.format === "round-robin-knockout" ? (
                  <MerryGoRoundExperience
                    competition={competition}
                    key={competition.id}
                    participants={participants.activeParticipants}
                    run={run}
                  />
                ) : (
                  <Surface
                    as="article"
                    className="p-5 sm:p-6"
                    key={competition.id}
                    variant="championship"
                  >
                    <StatusBadge tone="warning">
                      Live data unavailable
                    </StatusBadge>
                    <h4 className="mt-3 text-xl font-extrabold">
                      {competition.title}
                    </h4>
                    <p className="mt-2 text-sm text-white/55">
                      This competition runtime is temporarily unavailable.
                    </p>
                  </Surface>
                );
              })}
            </div>
          ) : null}
          {competitions.scheduled.length === 0 &&
          runningCompetitions.length === 0 ? (
            <div className="mt-6">
              <EmptyState
                description="An organizer can publish the first configuration from Competition Studio. No sample game is shown as live data."
                icon="trophy"
                title="Games begin soon"
              />
            </div>
          ) : (
            <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {competitions.scheduled.map((competition) => (
                <ScheduledCompetitionCard
                  competition={competition}
                  key={competition.id}
                  participants={participants.activeParticipants}
                />
              ))}
            </div>
          )}
        </>
      )}
      <p className="mt-4 flex items-center gap-2 text-xs text-white/42">
        <CalendarClock aria-hidden="true" size={15} />
        Merry-Go-Round can run live. All Hands and Group Format engines arrive
        in later phases.
      </p>
    </section>
  );
}
