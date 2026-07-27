import { motion, useReducedMotion } from "framer-motion";
import { Crown, RefreshCw, Trophy, Users } from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "../../../components/ui/Button";
import { ParticipantAvatar } from "../../../components/ui/ParticipantAvatar";
import { StatusBadge } from "../../../components/ui/StatusBadge";
import { Surface } from "../../../components/ui/Surface";
import type { Participant } from "../../participants/types";
import type { PublishedCompetition } from "../domain/types";
import {
  matchScore,
  matchStatusLabel,
  seriesLabel,
} from "../engine/presentation";
import { deriveGroupPointBreakdown } from "../group-knockout/points";
import { deriveGroupStandings } from "../group-knockout/standings";
import type {
  GroupCompetitionMatch,
  GroupKnockoutRun,
} from "../group-knockout/types";

function initials(displayName: string) {
  return displayName
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

function Player({
  participantId,
  participants,
  compact = false,
}: {
  participantId: string | null;
  participants: Participant[];
  compact?: boolean;
}) {
  const participant = participantResolver(participants)(participantId);
  if (!participant)
    return <span className="text-white/38">Awaiting player</span>;
  return (
    <span className="flex min-w-0 items-center gap-2">
      <ParticipantAvatar
        accent={participant.avatar.tone}
        icon={participant.avatar.icon}
        initials={initials(participant.displayName)}
        name={participant.displayName}
        size="sm"
      />
      <span className={`truncate font-bold ${compact ? "text-xs" : "text-sm"}`}>
        {participant.displayName}
      </span>
    </span>
  );
}

function groupLabel(run: GroupKnockoutRun, groupId: string | undefined) {
  return run.groups.find((group) => group.id === groupId)?.label ?? "Knockout";
}

function groupForParticipant(
  run: GroupKnockoutRun,
  participantId: string | null,
) {
  if (!participantId) return null;
  return (
    run.groups.find((group) => group.participantIds.includes(participantId)) ??
    null
  );
}

function ReadOnlyMatchCard({
  match,
  participants,
  run,
  showOrder = false,
}: {
  match: GroupCompetitionMatch;
  participants: Participant[];
  run: GroupKnockoutRun;
  showOrder?: boolean;
}) {
  return (
    <article
      className={`rounded-2xl border p-4 ${
        match.status === "in-progress"
          ? "border-[var(--color-electric-cyan-400)] bg-[var(--color-electric-cyan-400)]/8"
          : "border-white/10 bg-white/[0.035]"
      }`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-xs font-bold tracking-[0.1em] text-white/42 uppercase">
          {match.stage === "group-stage"
            ? `${groupLabel(run, match.groupId)} · Round ${match.fixtureRound} · Leg ${match.leg}`
            : match.stage === "third-place"
              ? "Third place"
              : `Knockout round ${match.bracketRound}`}
        </span>
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
      </div>
      <div className="mt-4 grid gap-3">
        {(["A", "B"] as const).map((side) => {
          const participantId =
            side === "A" ? match.participantAId : match.participantBId;
          const seed = side === "A" ? match.seedA : match.seedB;
          const origin = groupForParticipant(run, participantId);
          return (
            <div
              className="flex min-w-0 items-center justify-between gap-3"
              key={side}
            >
              {participantId ? (
                <Player
                  participantId={participantId}
                  participants={participants}
                />
              ) : (
                <span className="text-sm font-bold text-white/35">
                  {match.isBye ? "BYE" : "Awaiting winner"}
                </span>
              )}
              <span className="shrink-0 text-right text-[0.68rem] font-bold text-white/38">
                {seed ? `Seed ${seed}` : ""}
                {seed && origin ? " · " : ""}
                {origin?.label ?? ""}
              </span>
            </div>
          );
        })}
      </div>
      <div className="mt-4 flex items-center justify-between border-t border-white/8 pt-3 text-xs">
        <span className="text-white/42">
          {showOrder
            ? `Recommended match ${match.globalSequence}`
            : "Series score"}
        </span>
        <strong className="font-score text-base text-white/72">
          {matchScore(match)}
        </strong>
      </div>
    </article>
  );
}

type PublicGroupTab =
  "live" | "draw" | "fixtures" | "standings" | "bracket" | "points";

export function GroupFormatExperience({
  competition,
  run,
  participants,
}: {
  competition: PublishedCompetition;
  run: GroupKnockoutRun;
  participants: Participant[];
}) {
  const reducedMotion = useReducedMotion();
  const [tab, setTab] = useState<PublicGroupTab>("live");
  const [groupFilter, setGroupFilter] = useState<string>("all");
  const [replayKey, setReplayKey] = useState(0);
  const standings = useMemo(
    () => run.groups.map((group) => deriveGroupStandings(run, group.id)),
    [run],
  );
  const matches = Object.values(run.matches).sort(
    (left, right) => left.globalSequence - right.globalSequence,
  );
  const groupMatches = matches.filter(
    (match): match is GroupCompetitionMatch & { stage: "group-stage" } =>
      match.stage === "group-stage",
  );
  const filteredFixtures = groupMatches.filter(
    (match) => groupFilter === "all" || match.groupId === groupFilter,
  );
  const liveMatch = matches.find((match) => match.status === "in-progress");
  const nextMatch =
    liveMatch ??
    matches.find(
      (match) =>
        !match.result &&
        !match.isBye &&
        match.participantAId &&
        match.participantBId,
    );
  const recent = matches
    .filter((match) => match.result)
    .slice(-5)
    .reverse();
  const points = deriveGroupPointBreakdown(run).sort(
    (left, right) => right.total - left.total,
  );
  const placements = run.placements?.entries ?? [];
  const completedRealMatches = matches.filter(
    (match) => !match.isBye && match.status === "completed",
  ).length;
  const realMatches = matches.filter((match) => !match.isBye).length;
  const progress = realMatches
    ? Math.round((completedRealMatches / realMatches) * 100)
    : 0;
  const qualified = new Set(
    run.qualification?.entries.map((entry) => entry.participantId) ?? [],
  );

  return (
    <Surface
      as="article"
      className="overflow-hidden p-0"
      variant="championship"
    >
      <header className="border-b border-white/10 bg-[radial-gradient(circle_at_top_right,rgba(47,218,255,0.12),transparent_45%)] p-5 sm:p-7">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-bold tracking-[0.15em] text-[var(--color-antique-gold-400)] uppercase">
              Group Format · live Firebase data
            </p>
            <h4 className="mt-2 text-2xl font-extrabold">
              {competition.title}
            </h4>
            <p className="mt-1 text-sm text-white/58">
              {competition.gameName} · {run.groups.length} groups ·{" "}
              {run.configSnapshot.roundRobinLegs === 2 ? "Double" : "Single"}{" "}
              round robin · {seriesLabel(run.configSnapshot.series)}
            </p>
          </div>
          <StatusBadge tone={run.stage === "completed" ? "gold" : "live"}>
            {run.stage.replace("-", " ")}
          </StatusBadge>
        </div>
        <div className="mt-5 grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
          <div>
            <div className="flex justify-between gap-4 text-xs font-bold text-white/48">
              <span>
                {completedRealMatches} of {realMatches} matches complete
              </span>
              <span>{progress}%</span>
            </div>
            <div
              aria-label={`${progress}% of competition matches complete`}
              aria-valuemax={100}
              aria-valuemin={0}
              aria-valuenow={progress}
              className="mt-2 h-2 overflow-hidden rounded-full bg-white/10"
              role="progressbar"
            >
              <div
                className="h-full rounded-full bg-[var(--color-electric-cyan-400)]"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
          <p className="text-xs font-bold text-white/48">
            {run.configSnapshot.qualifiersPerGroup} qualify per group
          </p>
        </div>
        {placements.length > 0 ? (
          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            {placements
              .filter((placement) => placement.place && placement.place <= 3)
              .map((placement) => (
                <div
                  className="rounded-2xl border border-[var(--color-antique-gold-400)]/25 bg-[var(--color-antique-gold-400)]/8 p-4"
                  key={placement.participantId}
                >
                  <p className="flex items-center gap-2 text-xs font-bold tracking-[0.1em] text-[var(--color-antique-gold-400)] uppercase">
                    {placement.place === 1 ? (
                      <Crown aria-hidden="true" size={15} />
                    ) : (
                      <Trophy aria-hidden="true" size={15} />
                    )}
                    {placement.placementBand}
                  </p>
                  <p className="mt-2 font-extrabold">
                    {participantResolver(participants)(placement.participantId)
                      ?.displayName ?? "Unavailable participant"}
                  </p>
                </div>
              ))}
          </div>
        ) : null}
      </header>

      <div className="p-5 sm:p-7">
        <div
          aria-label={`${competition.title} views`}
          className="flex gap-2 overflow-x-auto pb-2"
          role="tablist"
        >
          {(
            [
              ["live", "Live"],
              ["draw", "Draw"],
              ["fixtures", "Fixtures"],
              ["standings", "Groups"],
              ["bracket", "Bracket"],
              ["points", "Points"],
            ] as const
          ).map(([id, label]) => (
            <button
              aria-selected={tab === id}
              className={`min-h-11 shrink-0 rounded-full border px-4 text-sm font-bold focus-visible:outline-3 focus-visible:outline-[var(--color-electric-cyan-400)] ${
                tab === id
                  ? "border-[var(--color-electric-cyan-400)] bg-[var(--color-electric-cyan-400)]/12 text-[var(--color-electric-cyan-400)]"
                  : "border-white/10 text-white/55"
              }`}
              key={id}
              onClick={() => setTab(id)}
              role="tab"
              type="button"
            >
              {label}
            </button>
          ))}
        </div>

        <div className="mt-5" role="tabpanel">
          {tab === "live" ? (
            <div className="grid gap-5 lg:grid-cols-[1.15fr_0.85fr]">
              <section aria-labelledby={`${competition.id}-next`}>
                <h5 className="font-extrabold" id={`${competition.id}-next`}>
                  {liveMatch ? "Live now" : "Up next"}
                </h5>
                <div className="mt-3">
                  {nextMatch ? (
                    <ReadOnlyMatchCard
                      match={nextMatch}
                      participants={participants}
                      run={run}
                      showOrder
                    />
                  ) : (
                    <p className="rounded-2xl border border-dashed border-white/15 p-6 text-sm text-white/55">
                      No match is ready while the organizer reviews the next
                      stage.
                    </p>
                  )}
                </div>
              </section>
              <section aria-labelledby={`${competition.id}-recent`}>
                <h5 className="font-extrabold" id={`${competition.id}-recent`}>
                  Recent results
                </h5>
                <ul className="mt-3 space-y-2 text-sm">
                  {recent.length ? (
                    recent.map((match) => (
                      <li
                        className="rounded-xl border border-white/10 p-3"
                        key={match.id}
                      >
                        <strong>
                          {participantResolver(participants)(
                            match.result!.winnerId,
                          )?.displayName ?? "Unavailable participant"}
                        </strong>{" "}
                        won {match.result!.participantAWins}–
                        {match.result!.participantBWins}
                      </li>
                    ))
                  ) : (
                    <li className="text-white/52">Results will appear here.</li>
                  )}
                </ul>
                {run.stage === "qualification-review" && run.qualification ? (
                  <p className="mt-4 rounded-xl border border-[var(--color-electric-cyan-400)]/20 bg-[var(--color-electric-cyan-400)]/6 p-4 text-sm text-white/65">
                    Qualification is confirmed. The organizer is reviewing the
                    cross-group seed order and{" "}
                    {run.knockout?.bracketSize ?? "the"} bracket.
                  </p>
                ) : null}
              </section>
            </div>
          ) : null}

          {tab === "draw" ? (
            <div>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="max-w-2xl text-sm leading-6 text-white/55">
                  These are the persisted assignments confirmed by the
                  organizer. Replaying this presentation never regenerates the
                  draw.
                </p>
                <Button
                  onClick={() => setReplayKey((value) => value + 1)}
                  variant="quiet"
                >
                  <RefreshCw aria-hidden="true" size={16} /> Replay draw
                </Button>
              </div>
              <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                {run.groups.map((group, groupIndex) => (
                  <motion.section
                    animate={{ opacity: 1, y: 0 }}
                    className="rounded-2xl border border-[var(--color-antique-gold-400)]/20 bg-white/[0.035] p-5"
                    initial={reducedMotion ? false : { opacity: 0, y: 10 }}
                    key={`${replayKey}-${group.id}`}
                    transition={{ delay: groupIndex * 0.08, duration: 0.22 }}
                  >
                    <h5 className="flex items-center gap-2 font-display text-xl font-semibold text-[var(--color-antique-gold-400)]">
                      <Users aria-hidden="true" size={18} /> {group.label}
                    </h5>
                    <ol className="mt-4 space-y-2">
                      {group.participantIds.map((participantId, index) => (
                        <motion.li
                          animate={{ opacity: 1, x: 0 }}
                          className="flex items-center gap-3 rounded-xl border border-white/8 p-3"
                          initial={
                            reducedMotion ? false : { opacity: 0, x: -8 }
                          }
                          key={`${replayKey}-${participantId}`}
                          transition={{
                            delay: groupIndex * 0.08 + index * 0.06,
                            duration: 0.18,
                          }}
                        >
                          <span className="font-score text-sm text-white/35">
                            {index + 1}
                          </span>
                          <Player
                            participantId={participantId}
                            participants={participants}
                          />
                        </motion.li>
                      ))}
                    </ol>
                  </motion.section>
                ))}
              </div>
            </div>
          ) : null}

          {tab === "fixtures" ? (
            <div>
              <div
                aria-label="Filter fixtures by group"
                className="flex gap-2 overflow-x-auto pb-2"
              >
                {[{ id: "all", label: "All groups" }, ...run.groups].map(
                  (group) => (
                    <button
                      aria-pressed={groupFilter === group.id}
                      className={`min-h-11 shrink-0 rounded-full border px-4 text-sm font-bold ${
                        groupFilter === group.id
                          ? "border-[var(--color-antique-gold-400)] text-[var(--color-antique-gold-400)]"
                          : "border-white/10 text-white/52"
                      }`}
                      key={group.id}
                      onClick={() => setGroupFilter(group.id)}
                      type="button"
                    >
                      {group.label}
                    </button>
                  ),
                )}
              </div>
              <div className="mt-4 grid gap-3 lg:grid-cols-2">
                {filteredFixtures.map((match) => (
                  <ReadOnlyMatchCard
                    key={match.id}
                    match={match}
                    participants={participants}
                    run={run}
                    showOrder
                  />
                ))}
              </div>
            </div>
          ) : null}

          {tab === "standings" ? (
            <div className="grid gap-4 lg:grid-cols-2">
              {standings.map((result) => {
                const group = run.groups.find(
                  (candidate) => candidate.id === result.groupId,
                )!;
                return (
                  <section
                    className="rounded-2xl border border-white/10 p-4"
                    key={group.id}
                  >
                    <h5 className="flex items-center gap-2 font-display text-xl font-semibold text-[var(--color-antique-gold-400)]">
                      <Users aria-hidden="true" size={18} /> {group.label}
                    </h5>
                    <div className="mt-3 overflow-x-auto">
                      <table className="w-full min-w-[590px] text-sm">
                        <thead className="text-left text-xs text-white/42">
                          <tr>
                            <th className="pb-2">#</th>
                            <th className="pb-2">Player</th>
                            <th className="pb-2 text-right">P</th>
                            <th className="pb-2 text-right">W</th>
                            <th className="pb-2 text-right">L</th>
                            <th className="pb-2 text-right">RW</th>
                            <th className="pb-2 text-right">RD</th>
                            <th className="pb-2 text-right">Pts</th>
                          </tr>
                        </thead>
                        <tbody>
                          {result.rows.map((row) => {
                            const qualifies = run.qualification
                              ? qualified.has(row.participantId)
                              : row.rank <=
                                run.configSnapshot.qualifiersPerGroup;
                            return (
                              <tr
                                className="border-t border-white/8"
                                key={row.participantId}
                              >
                                <td className="py-3 font-score">{row.rank}</td>
                                <th className="py-3 text-left">
                                  <span className="flex items-center gap-2">
                                    <Player
                                      compact
                                      participantId={row.participantId}
                                      participants={participants}
                                    />
                                    {qualifies ? (
                                      <StatusBadge tone="success">
                                        {run.qualification
                                          ? "Qualified"
                                          : "Qualification line"}
                                      </StatusBadge>
                                    ) : null}
                                    {row.tied ? (
                                      <StatusBadge tone="warning">
                                        Tie
                                      </StatusBadge>
                                    ) : null}
                                  </span>
                                </th>
                                <td className="py-3 text-right">
                                  {row.played}
                                </td>
                                <td className="py-3 text-right">
                                  {row.matchWins}
                                </td>
                                <td className="py-3 text-right">
                                  {row.matchLosses}
                                </td>
                                <td className="py-3 text-right">
                                  {row.roundsWon}
                                </td>
                                <td className="py-3 text-right">
                                  {row.roundDifferential}
                                </td>
                                <td className="py-3 text-right font-bold">
                                  {row.tablePoints}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </section>
                );
              })}
              {run.qualification ? (
                <section className="rounded-2xl border border-[var(--color-success-500)]/25 bg-[var(--color-success-500)]/8 p-4 lg:col-span-2">
                  <h5 className="font-extrabold">Qualification snapshot</h5>
                  <ol className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
                    {run.qualification.entries.map((entry) => (
                      <li
                        className="flex items-center justify-between gap-3 rounded-xl border border-white/10 p-3"
                        key={entry.participantId}
                      >
                        <Player
                          participantId={entry.participantId}
                          participants={participants}
                        />
                        <span className="shrink-0 text-xs font-bold text-white/48">
                          {groupLabel(run, entry.groupId)} rank{" "}
                          {entry.groupRank}
                        </span>
                      </li>
                    ))}
                  </ol>
                  {run.knockout ? (
                    <p className="mt-3 text-sm text-white/58">
                      {run.knockout.seedOrder.length} seeds ·{" "}
                      {run.knockout.bracketSize} bracket slots ·{" "}
                      {run.knockout.bracketSize - run.knockout.seedOrder.length}{" "}
                      BYEs awarded to the highest seeds
                    </p>
                  ) : null}
                </section>
              ) : null}
            </div>
          ) : null}

          {tab === "bracket" ? (
            run.knockout ? (
              <div>
                <div className="overflow-x-auto pb-3">
                  <div className="flex min-w-max gap-5">
                    {run.knockout.rounds.map((round) => (
                      <section className="w-72" key={round.number}>
                        <h5 className="mb-3 font-extrabold">{round.label}</h5>
                        <div className="space-y-3">
                          {round.matchIds.map((matchId) => (
                            <ReadOnlyMatchCard
                              key={matchId}
                              match={run.matches[matchId]!}
                              participants={participants}
                              run={run}
                            />
                          ))}
                        </div>
                      </section>
                    ))}
                    {run.knockout.thirdPlaceMatchId ? (
                      <section className="w-72">
                        <h5 className="mb-3 font-extrabold">Third place</h5>
                        <ReadOnlyMatchCard
                          match={run.matches[run.knockout.thirdPlaceMatchId]!}
                          participants={participants}
                          run={run}
                        />
                      </section>
                    ) : null}
                  </div>
                </div>
                {run.knockout.sameGroupRematchWarning ? (
                  <p className="rounded-xl border border-[var(--color-warning-500)]/25 p-4 text-sm text-[var(--color-warning-500)]">
                    {run.knockout.sameGroupRematchWarning}
                  </p>
                ) : null}
              </div>
            ) : (
              <p className="rounded-2xl border border-dashed border-white/15 p-8 text-center text-sm text-white/55">
                The knockout bracket appears after group qualification and
                cross-group seeds are confirmed.
              </p>
            )
          ) : null}

          {tab === "points" ? (
            <div>
              <p className="mb-4 text-sm text-white/52">
                Projected, itemized Group Format points only. The global weekend
                ledger begins in Phase 7.
              </p>
              <div className="space-y-2">
                {points.map((entry, index) => (
                  <details
                    className="rounded-xl border border-white/10 p-4"
                    key={entry.participantId}
                  >
                    <summary className="flex min-h-11 cursor-pointer items-center justify-between gap-4">
                      <span className="font-bold">
                        {index + 1}.{" "}
                        {participantResolver(participants)(entry.participantId)
                          ?.displayName ?? "Unavailable participant"}
                      </span>
                      <span className="font-score text-xl text-[var(--color-antique-gold-400)]">
                        {entry.total}
                      </span>
                    </summary>
                    <ul className="mt-3 space-y-2 border-t border-white/8 pt-3 text-sm text-white/58">
                      {entry.items.length ? (
                        entry.items.map((item) => (
                          <li
                            className="flex justify-between gap-4"
                            key={item.id}
                          >
                            <span>{item.label}</span>
                            <strong>+{item.points}</strong>
                          </li>
                        ))
                      ) : (
                        <li>No points yet.</li>
                      )}
                    </ul>
                  </details>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </Surface>
  );
}
