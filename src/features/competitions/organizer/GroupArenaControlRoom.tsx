import { motion, useReducedMotion } from "framer-motion";
import {
  ArrowLeft,
  Pause,
  Play,
  RefreshCw,
  RotateCcw,
  ShieldCheck,
  Trophy,
} from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "../../../components/ui/Button";
import { Modal } from "../../../components/ui/Modal";
import { StatusBadge } from "../../../components/ui/StatusBadge";
import type { Participant } from "../../participants/types";
import { useCompetitions } from "../CompetitionsProvider";
import type { PublishedCompetition } from "../domain/types";
import {
  canCompleteGroupCompetition,
  generateGroupKnockout as previewGroupKnockout,
} from "../group-knockout/engine";
import { createGroupDrawPreview } from "../group-knockout/generation";
import { deriveGroupPointBreakdown } from "../group-knockout/points";
import {
  deriveCrossGroupSeeds,
  deriveGroupStandings,
  groupQualificationBlockingTies,
} from "../group-knockout/standings";
import type {
  GroupCompetitionMatch,
  GroupKnockoutRun,
} from "../group-knockout/types";
import type { CompetitionMatch } from "../engine/types";
import { FormIndicator } from "../public/FormIndicator";
import { deriveParticipantForm } from "../public/form";
import { KnockoutBracket } from "../public/KnockoutBracket";
import { SeriesResultDialog } from "./SeriesResultDialog";
import { TieResolutionPanel } from "./TieResolutionPanel";

function participantName(
  participants: Participant[],
  participantId: string | null,
) {
  return (
    participants.find((participant) => participant.id === participantId)
      ?.displayName ?? "Player unavailable"
  );
}

export function GroupActivationReview({
  competition,
  participants,
  onBack,
  onActivated,
}: {
  competition: PublishedCompetition;
  participants: Participant[];
  onBack: () => void;
  onActivated: () => void;
}) {
  const competitions = useCompetitions();
  const reducedMotion = useReducedMotion();
  const organizerUid = "local-draw-preview";
  const [preview, setPreview] = useState(() =>
    createGroupDrawPreview(competition, organizerUid, Date.now()),
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const reshuffle = () => {
    setPreview(createGroupDrawPreview(competition, organizerUid, Date.now()));
    setError(null);
  };
  return (
    <section aria-labelledby="group-activation-title">
      <Button onClick={onBack} variant="quiet">
        <ArrowLeft aria-hidden="true" size={17} /> Back to Studio
      </Button>
      <div className="mt-5 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-bold tracking-[0.14em] text-[var(--color-electric-cyan-400)] uppercase">
            Local draw preview
          </p>
          <h3
            className="mt-2 text-2xl font-extrabold"
            id="group-activation-title"
          >
            Confirm {competition.title}
          </h3>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-white/58">
            This secure shuffle is local only. The competition remains scheduled
            until you confirm; confirmation atomically stores this exact draw,
            its balanced groups, and fixtures.
          </p>
        </div>
        <StatusBadge tone="warning">Still scheduled</StatusBadge>
      </div>
      <dl className="mt-5 grid gap-3 rounded-2xl border border-white/10 bg-white/[0.035] p-4 text-sm sm:grid-cols-3">
        <div>
          <dt className="text-white/45">Groups</dt>
          <dd className="mt-1 font-bold">
            {preview.review.resolvedGroupCount}
          </dd>
        </div>
        <div>
          <dt className="text-white/45">Group matches</dt>
          <dd className="mt-1 font-bold">
            {preview.review.expectedGroupMatchCount}
          </dd>
        </div>
        <div>
          <dt className="text-white/45">Knockout field</dt>
          <dd className="mt-1 font-bold">
            {preview.review.qualifierCount} qualifiers ·{" "}
            {preview.review.bracketSize} slots
          </dd>
        </div>
      </dl>
      {preview.review.warnings.map((warning) => (
        <p
          className="mt-3 rounded-xl border border-[var(--color-warning-500)]/25 bg-[var(--color-warning-500)]/8 p-3 text-sm text-[var(--color-warning-500)]"
          key={warning}
        >
          {warning}
        </p>
      ))}
      <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {preview.run.groups.map((group, groupIndex) => (
          <motion.article
            animate={{ opacity: 1, y: 0 }}
            className="rounded-2xl border border-[var(--color-antique-gold-400)]/20 bg-white/[0.035] p-5"
            initial={reducedMotion ? false : { opacity: 0, y: 10 }}
            key={`${preview.run.draw.generatedAt}-${group.id}`}
            transition={{ delay: groupIndex * 0.08, duration: 0.2 }}
          >
            <h4 className="font-display text-xl font-semibold text-[var(--color-antique-gold-400)]">
              {group.label}
            </h4>
            <ol className="mt-4 space-y-2 text-sm">
              {group.participantIds.map((participantId, index) => (
                <motion.li
                  animate={{ opacity: 1, x: 0 }}
                  className="flex items-center gap-3 rounded-xl border border-white/8 p-3"
                  initial={reducedMotion ? false : { opacity: 0, x: -8 }}
                  key={participantId}
                  transition={{
                    delay: groupIndex * 0.08 + index * 0.05,
                    duration: 0.16,
                  }}
                >
                  <span className="font-score text-white/40">{index + 1}</span>
                  <strong>
                    {participantName(participants, participantId)}
                  </strong>
                </motion.li>
              ))}
            </ol>
          </motion.article>
        ))}
      </div>
      {error ? (
        <p className="mt-4 text-sm text-[#ffc3c6]" role="alert">
          {error}
        </p>
      ) : null}
      <div className="mt-6 flex flex-wrap justify-end gap-3">
        <Button disabled={saving} onClick={reshuffle} variant="quiet">
          <RefreshCw aria-hidden="true" size={17} /> Reshuffle preview
        </Button>
        <Button
          disabled={!competitions.canMutate || saving}
          onClick={() => {
            setSaving(true);
            setError(null);
            void competitions
              .activateGroup(competition, preview.run)
              .then(onActivated)
              .catch((nextError: unknown) => {
                setSaving(false);
                setError(
                  nextError instanceof Error
                    ? nextError.message
                    : "The draw could not be confirmed.",
                );
              });
          }}
          variant="dark"
        >
          <ShieldCheck aria-hidden="true" size={17} />
          {saving ? "Confirming…" : "Confirm exact draw & activate"}
        </Button>
      </div>
    </section>
  );
}

function MatchCard({
  match,
  participants,
  groupLabel,
  disabled,
  onStart,
  onReturn,
  onResult,
}: {
  match: GroupCompetitionMatch;
  participants: Participant[];
  groupLabel?: string;
  disabled: boolean;
  onStart: () => void;
  onReturn: () => void;
  onResult: () => void;
}) {
  const ready = Boolean(
    match.participantAId && match.participantBId && !match.isBye,
  );
  return (
    <article className="rounded-2xl border border-white/10 bg-white/[0.035] p-4">
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
        <span className="font-bold tracking-[0.12em] text-white/42 uppercase">
          {groupLabel ??
            (match.stage === "third-place"
              ? "Third place"
              : `Knockout round ${match.bracketRound}`)}
          {match.stage === "group-stage" ? ` · Leg ${match.leg}` : ""}
        </span>
        <StatusBadge
          tone={
            match.status === "in-progress"
              ? "live"
              : match.status === "completed"
                ? "gold"
                : "neutral"
          }
        >
          {match.isBye ? "Bye" : match.status.replace("-", " ")}
        </StatusBadge>
      </div>
      <div className="mt-4 grid grid-cols-[1fr_auto_1fr] items-center gap-3 text-center">
        <strong className="min-w-0 truncate">
          {participantName(participants, match.participantAId)}
        </strong>
        <span className="font-score text-xl text-white/35">vs</span>
        <strong className="min-w-0 truncate">
          {participantName(participants, match.participantBId)}
        </strong>
      </div>
      {match.result ? (
        <p className="mt-3 text-center text-sm font-bold text-[var(--color-antique-gold-400)]">
          {participantName(participants, match.result.winnerId)} won{" "}
          {match.result.participantAWins}–{match.result.participantBWins}
        </p>
      ) : null}
      {ready && !match.result ? (
        <div className="mt-4 flex justify-center gap-2">
          {match.status !== "in-progress" ? (
            <Button disabled={disabled} onClick={onStart} variant="quiet">
              <Play aria-hidden="true" size={16} /> Start
            </Button>
          ) : (
            <Button
              disabled={disabled}
              onClick={onReturn}
              variant="darkSecondary"
            >
              <Pause aria-hidden="true" size={16} /> Return to pending
            </Button>
          )}
          <Button disabled={disabled} onClick={onResult} variant="dark">
            Record result
          </Button>
        </div>
      ) : match.result ? (
        <Button
          className="mt-4 w-full"
          disabled={disabled}
          onClick={onResult}
          variant="darkSecondary"
        >
          Correct result
        </Button>
      ) : null}
    </article>
  );
}

type ArenaTab = "arena" | "groups" | "bracket" | "points";

export function GroupArenaControlRoom({
  competition,
  run,
  participants,
  onBack,
}: {
  competition: PublishedCompetition;
  run: GroupKnockoutRun;
  participants: Participant[];
  onBack: () => void;
}) {
  const competitions = useCompetitions();
  const [tab, setTab] = useState<ArenaTab>("arena");
  const [selectedMatch, setSelectedMatch] = useState<CompetitionMatch | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmReset, setConfirmReset] = useState<"run" | "knockout" | null>(
    null,
  );
  const standings = useMemo(
    () => run.groups.map((group) => deriveGroupStandings(run, group.id)),
    [run],
  );
  const groupMatches = Object.values(run.matches)
    .filter((match) => match.stage === "group-stage")
    .sort((left, right) => left.globalSequence - right.globalSequence);
  const knockoutMatches = Object.values(run.matches)
    .filter((match) => match.stage !== "group-stage")
    .sort((left, right) => left.globalSequence - right.globalSequence);
  const liveMatch = Object.values(run.matches).find(
    (match) => match.status === "in-progress",
  );
  const nextMatch =
    liveMatch ??
    [...groupMatches, ...knockoutMatches].find(
      (match) =>
        !match.result &&
        !match.isBye &&
        match.participantAId &&
        match.participantBId,
    );
  const criticalGroupTies = standings.flatMap((result) =>
    groupQualificationBlockingTies(
      result,
      run.configSnapshot.qualifiersPerGroup,
    ).map((participantIds) => ({ result, participantIds })),
  );
  const seeds = run.qualification
    ? deriveCrossGroupSeeds(
        run.qualification,
        Object.values(run.seedResolutions),
      )
    : null;
  const bracketPreview = useMemo(() => {
    if (
      run.stage !== "qualification-review" ||
      !seeds ||
      seeds.unresolvedTieGroups.length > 0
    ) {
      return null;
    }
    try {
      return previewGroupKnockout(run, "local-bracket-preview", 0);
    } catch {
      return null;
    }
  }, [run, seeds]);
  const points = deriveGroupPointBreakdown(run).sort(
    (left, right) => right.total - left.total,
  );
  const perform = async (action: () => Promise<void>) => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await action();
    } catch (nextError) {
      setError(
        nextError instanceof Error
          ? nextError.message
          : "The Group Arena action failed.",
      );
    } finally {
      setBusy(false);
    }
  };
  const groupLabel = (match: GroupCompetitionMatch) =>
    match.stage === "group-stage"
      ? run.groups.find((group) => group.id === match.groupId)?.label
      : undefined;

  return (
    <section aria-labelledby="group-arena-title">
      <Button onClick={onBack} variant="quiet">
        <ArrowLeft aria-hidden="true" size={17} /> Back to Studio
      </Button>
      <div className="mt-5 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-bold tracking-[0.14em] text-[var(--color-electric-cyan-400)] uppercase">
            Organizer Group Arena
          </p>
          <h3 className="mt-2 text-2xl font-extrabold" id="group-arena-title">
            {competition.title}
          </h3>
          <p className="mt-2 text-sm text-white/55">
            {competition.gameName} · revision {run.revision}
          </p>
        </div>
        <StatusBadge tone={run.stage === "completed" ? "gold" : "live"}>
          {run.stage.replace("-", " ")}
        </StatusBadge>
      </div>
      <div
        className="mt-6 flex gap-2 overflow-x-auto pb-2"
        role="tablist"
        aria-label="Group Arena views"
      >
        {(["arena", "groups", "bracket", "points"] as const).map((id) => (
          <button
            aria-selected={tab === id}
            className={`min-h-11 shrink-0 rounded-full border px-4 text-sm font-bold focus-visible:outline-3 focus-visible:outline-[var(--color-electric-cyan-400)] ${tab === id ? "border-[var(--color-electric-cyan-400)] bg-[var(--color-electric-cyan-400)]/12 text-[var(--color-electric-cyan-400)]" : "border-white/10 text-white/55"}`}
            key={id}
            onClick={() => setTab(id)}
            role="tab"
            type="button"
          >
            {id === "arena" ? "Live Arena" : id[0]!.toUpperCase() + id.slice(1)}
          </button>
        ))}
      </div>
      {error ? (
        <p
          className="mt-4 rounded-xl border border-[#ff9ca1]/25 bg-[#ff9ca1]/8 p-4 text-sm text-[#ffc3c6]"
          role="alert"
        >
          {error}
        </p>
      ) : null}

      <div className="mt-6" role="tabpanel">
        {tab === "arena" ? (
          <div className="space-y-6">
            {nextMatch ? (
              <div>
                <h4 className="mb-3 flex items-center gap-2 font-extrabold">
                  <Play aria-hidden="true" size={18} />{" "}
                  {liveMatch ? "Live now" : "Up next"}
                </h4>
                <MatchCard
                  disabled={
                    !competitions.canMutate || busy || run.stage === "completed"
                  }
                  groupLabel={groupLabel(nextMatch)}
                  match={nextMatch}
                  onResult={() => setSelectedMatch(nextMatch)}
                  onReturn={() =>
                    void perform(() =>
                      competitions.returnGroupMatchToPending(
                        run,
                        nextMatch.id,
                        nextMatch.revision,
                      ),
                    )
                  }
                  onStart={() =>
                    void perform(() =>
                      competitions.startGroupMatch(
                        run,
                        nextMatch.id,
                        nextMatch.revision,
                      ),
                    )
                  }
                  participants={participants}
                />
              </div>
            ) : (
              <p className="rounded-2xl border border-dashed border-white/15 p-6 text-sm text-white/55">
                No ready match. Review ties or the next stage below.
              </p>
            )}
            <div>
              <h4 className="font-extrabold">Match queue</h4>
              <div className="mt-3 grid gap-3 lg:grid-cols-2">
                {(run.stage === "group-stage"
                  ? groupMatches
                  : knockoutMatches
                ).map((match) => (
                  <MatchCard
                    disabled={
                      !competitions.canMutate ||
                      busy ||
                      run.stage === "completed"
                    }
                    groupLabel={groupLabel(match)}
                    key={match.id}
                    match={match}
                    onResult={() => setSelectedMatch(match)}
                    onReturn={() =>
                      void perform(() =>
                        competitions.returnGroupMatchToPending(
                          run,
                          match.id,
                          match.revision,
                        ),
                      )
                    }
                    onStart={() =>
                      void perform(() =>
                        competitions.startGroupMatch(
                          run,
                          match.id,
                          match.revision,
                        ),
                      )
                    }
                    participants={participants}
                  />
                ))}
              </div>
            </div>
            {run.stage === "group-stage" &&
            standings.every((result) => result.complete) ? (
              <section className="rounded-2xl border border-[var(--color-antique-gold-400)]/25 bg-[var(--color-antique-gold-400)]/7 p-5">
                <h4 className="font-extrabold">Group stage review</h4>
                <p className="mt-2 text-sm text-white/58">
                  {criticalGroupTies.length
                    ? "Resolve the ranking ties shown in Groups before confirming qualification."
                    : "All group matches and critical ties are complete. Freeze the qualification snapshot explicitly."}
                </p>
                <Button
                  className="mt-4"
                  disabled={
                    criticalGroupTies.length > 0 ||
                    !competitions.canMutate ||
                    busy
                  }
                  onClick={() =>
                    void perform(() =>
                      competitions.openQualificationReview(run),
                    )
                  }
                  variant="dark"
                >
                  Confirm qualification snapshot
                </Button>
              </section>
            ) : null}
            {run.stage === "qualification-review" && run.qualification ? (
              <section className="rounded-2xl border border-[var(--color-electric-cyan-400)]/20 bg-[var(--color-electric-cyan-400)]/6 p-5">
                <h4 className="font-extrabold">Qualification confirmed</h4>
                <p className="mt-2 text-sm text-white/58">
                  {run.qualification.entries.length} qualifiers are frozen.{" "}
                  {seeds?.unresolvedTieGroups.length
                    ? "Resolve equal cross-group seeds in Groups."
                    : "Cross-group seeds are ready for bracket generation."}
                </p>
                {bracketPreview?.knockout ? (
                  <div className="mt-4 rounded-xl border border-white/10 bg-black/10 p-4">
                    <p className="text-xs font-bold tracking-[0.1em] text-white/42 uppercase">
                      Local bracket preview
                    </p>
                    <p className="mt-2 text-sm text-white/58">
                      {bracketPreview.knockout.bracketSize} slots ·{" "}
                      {bracketPreview.knockout.bracketSize -
                        bracketPreview.knockout.seedOrder.length}{" "}
                      BYEs for the highest seeds
                    </p>
                    <ol className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
                      {bracketPreview.knockout.seedOrder.map(
                        (participantId, index) => (
                          <li
                            className="flex justify-between gap-3 rounded-lg border border-white/8 px-3 py-2"
                            key={participantId}
                          >
                            <span>
                              {index + 1}.{" "}
                              {participantName(participants, participantId)}
                            </span>
                            <span className="text-xs text-white/42">
                              {run.qualification?.entries
                                .find(
                                  (entry) =>
                                    entry.participantId === participantId,
                                )
                                ?.groupId.replace("group-", "Group ")
                                .toUpperCase()}
                            </span>
                          </li>
                        ),
                      )}
                    </ol>
                    {bracketPreview.knockout.sameGroupRematchWarning ? (
                      <p className="mt-3 text-sm text-[var(--color-warning-500)]">
                        {bracketPreview.knockout.sameGroupRematchWarning}
                      </p>
                    ) : (
                      <p className="mt-3 text-sm text-[var(--color-success-500)]">
                        First-round same-group rematches were avoided.
                      </p>
                    )}
                  </div>
                ) : null}
                <Button
                  className="mt-4"
                  disabled={!bracketPreview || !competitions.canMutate || busy}
                  onClick={() =>
                    void perform(() => competitions.generateGroupKnockout(run))
                  }
                  variant="dark"
                >
                  <Trophy aria-hidden="true" size={17} /> Confirm & generate
                  knockout
                </Button>
              </section>
            ) : null}
            {run.stage === "knockout" && canCompleteGroupCompetition(run) ? (
              <Button
                disabled={!competitions.canMutate || busy}
                onClick={() =>
                  void perform(() =>
                    competitions.completeGroup(competition, run),
                  )
                }
                variant="dark"
              >
                <Trophy aria-hidden="true" size={17} /> Complete competition
              </Button>
            ) : null}
            {run.stage === "completed" ? (
              <Button
                disabled={!competitions.canMutate || busy}
                onClick={() =>
                  void perform(() => competitions.reopenGroup(competition, run))
                }
                variant="dark"
              >
                <RotateCcw aria-hidden="true" size={17} /> Reopen to knockout
              </Button>
            ) : null}
            {run.resultCount === 0 && run.stage === "group-stage" ? (
              <Button
                disabled={!competitions.canMutate || busy}
                onClick={() => setConfirmReset("run")}
                variant="quiet"
              >
                Reset draw and return to scheduled
              </Button>
            ) : null}
          </div>
        ) : null}

        {tab === "groups" ? (
          <div className="grid gap-5 lg:grid-cols-2">
            {standings.map((result) => {
              const group = run.groups.find(
                (candidate) => candidate.id === result.groupId,
              )!;
              const critical = groupQualificationBlockingTies(
                result,
                run.configSnapshot.qualifiersPerGroup,
              );
              return (
                <article
                  className="rounded-2xl border border-white/10 bg-white/[0.035] p-5"
                  key={group.id}
                >
                  <h4 className="font-display text-xl font-semibold text-[var(--color-antique-gold-400)]">
                    {group.label}
                  </h4>
                  <div className="mt-4 overflow-x-auto">
                    <table className="w-full min-w-[570px] text-sm">
                      <thead className="text-left text-xs text-white/42">
                        <tr>
                          <th className="pb-2">#</th>
                          <th className="pb-2">Player</th>
                          <th className="pb-2 text-right">P</th>
                          <th className="pb-2 text-right">W</th>
                          <th className="pb-2 text-right">RD</th>
                          <th className="pb-2 text-right">Pts</th>
                          <th className="pb-2 text-right">Last 5</th>
                        </tr>
                      </thead>
                      <tbody>
                        {result.rows.map((row) => (
                          <tr
                            className="border-t border-white/8"
                            key={row.participantId}
                          >
                            <td className="py-3 font-score">{row.rank}</td>
                            <th className="py-3 text-left">
                              {participantName(participants, row.participantId)}
                              {row.tied ? (
                                <span className="ml-2 text-xs text-[var(--color-warning-500)]">
                                  tied
                                </span>
                              ) : null}
                            </th>
                            <td className="py-3 text-right">{row.played}</td>
                            <td className="py-3 text-right">{row.matchWins}</td>
                            <td className="py-3 text-right">
                              {row.roundDifferential}
                            </td>
                            <td className="py-3 text-right font-bold">
                              {row.tablePoints}
                            </td>
                            <td className="py-3 pl-4">
                              <FormIndicator
                                participantName={participantName(
                                  participants,
                                  row.participantId,
                                )}
                                results={deriveParticipantForm(
                                  groupMatches.filter(
                                    (match) => match.groupId === result.groupId,
                                  ),
                                  row.participantId,
                                )}
                              />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {critical.map((participantIds) => (
                    <div className="mt-4" key={participantIds.join("-")}>
                      <TieResolutionPanel
                        disabled={!competitions.canMutate || busy}
                        onConfirm={(ordered, reason) =>
                          competitions.resolveGroupTie(
                            run,
                            group.id,
                            participantIds,
                            ordered,
                            reason,
                          )
                        }
                        participantIds={participantIds}
                        participants={participants}
                      />
                    </div>
                  ))}
                </article>
              );
            })}
            {seeds?.unresolvedTieGroups.map((tie) => (
              <div
                className="lg:col-span-2"
                key={`${tie.groupRank}-${tie.participantIds.join("-")}`}
              >
                <p className="mb-2 text-sm font-bold text-[var(--color-warning-500)]">
                  Cross-group rank {tie.groupRank} seed tie
                </p>
                <TieResolutionPanel
                  disabled={!competitions.canMutate || busy}
                  onConfirm={(ordered, reason) =>
                    competitions.resolveCrossGroupSeed(
                      run,
                      tie.groupRank,
                      tie.participantIds,
                      ordered,
                      reason,
                    )
                  }
                  participantIds={tie.participantIds}
                  participants={participants}
                />
              </div>
            ))}
          </div>
        ) : null}

        {tab === "bracket" ? (
          run.knockout ? (
            <div>
              {run.knockout.sameGroupRematchWarning ? (
                <p className="mb-4 rounded-xl border border-[var(--color-warning-500)]/25 p-4 text-sm text-[var(--color-warning-500)]">
                  {run.knockout.sameGroupRematchWarning}
                </p>
              ) : null}
              <KnockoutBracket
                id={`${run.competitionId}-organizer-group-bracket`}
                headingLevel={4}
                matches={run.matches}
                matchSlotHeight={260}
                participants={participants}
                renderMatch={(match) => (
                  <MatchCard
                    disabled={
                      !competitions.canMutate ||
                      busy ||
                      run.stage === "completed"
                    }
                    match={match}
                    onResult={() => setSelectedMatch(match)}
                    onReturn={() =>
                      void perform(() =>
                        competitions.returnGroupMatchToPending(
                          run,
                          match.id,
                          match.revision,
                        ),
                      )
                    }
                    onStart={() =>
                      void perform(() =>
                        competitions.startGroupMatch(
                          run,
                          match.id,
                          match.revision,
                        ),
                      )
                    }
                    participants={participants}
                  />
                )}
                rounds={run.knockout.rounds}
                sourceDescription="Confirmed group qualifiers feed the cross-group seed order. The connected rounds show exactly where every winner advances."
                sourceEntries={run.knockout.seedOrder.map(
                  (participantId, index) => {
                    const source = run.qualification?.entries.find(
                      (entry) => entry.participantId === participantId,
                    );
                    const group = source
                      ? run.groups.find((entry) => entry.id === source.groupId)
                      : null;
                    return {
                      participantId,
                      seed: index + 1,
                      context: source
                        ? `${group?.label ?? "Group"} · #${source.groupRank}`
                        : "Qualified",
                    };
                  },
                )}
                sourceLabel="Group standings"
                thirdPlaceMatchId={run.knockout.thirdPlaceMatchId}
              />
              {run.stage !== "completed" ? (
                <Button
                  className="mt-4"
                  disabled={!competitions.canMutate || busy}
                  onClick={() => setConfirmReset("knockout")}
                  variant="quiet"
                >
                  Reset entire knockout
                </Button>
              ) : null}
            </div>
          ) : (
            <p className="rounded-2xl border border-dashed border-white/15 p-8 text-center text-sm text-white/55">
              The bracket appears after qualification and cross-group seeds are
              confirmed.
            </p>
          )
        ) : null}

        {tab === "points" ? (
          <div className="space-y-3">
            <p className="text-sm text-white/55">
              Projected, itemized competition points. The matching championship
              source is synchronized with each valid runtime mutation.
            </p>
            {points.map((entry, index) => (
              <details
                className="rounded-2xl border border-white/10 bg-white/[0.035] p-4"
                key={entry.participantId}
              >
                <summary className="flex min-h-11 cursor-pointer items-center justify-between gap-4 font-bold">
                  <span>
                    {index + 1}.{" "}
                    {participantName(participants, entry.participantId)}
                  </span>
                  <span className="font-score text-xl text-[var(--color-antique-gold-400)]">
                    {entry.total}
                  </span>
                </summary>
                <ul className="mt-3 space-y-2 text-sm text-white/58">
                  {entry.items.length ? (
                    entry.items.map((item) => (
                      <li className="flex justify-between gap-4" key={item.id}>
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
        ) : null}
      </div>

      <SeriesResultDialog
        key={
          selectedMatch
            ? `${selectedMatch.id}:${selectedMatch.revision}`
            : "closed"
        }
        match={selectedMatch}
        onClose={() => setSelectedMatch(null)}
        onSave={(options) =>
          competitions.recordGroupResult(run, selectedMatch!.id, options)
        }
        participants={participants}
        run={run}
      />
      <Modal
        description={
          confirmReset === "run"
            ? "This removes the unplayed draw and fixtures, then returns the competition to scheduled. You can create a new preview afterward."
            : "This removes the complete knockout bracket and all knockout results. The confirmed group results and qualification snapshot remain."
        }
        onClose={() => setConfirmReset(null)}
        open={confirmReset !== null}
        title={
          confirmReset === "run"
            ? "Reset unplayed Group Format?"
            : "Reset complete knockout?"
        }
      >
        <div className="flex justify-end gap-3">
          <Button onClick={() => setConfirmReset(null)} variant="quiet">
            Cancel
          </Button>
          <Button
            disabled={busy}
            onClick={() =>
              void perform(() =>
                confirmReset === "run"
                  ? competitions.resetGroup(competition, run)
                  : competitions.resetGroupKnockout(run),
              ).then(() => setConfirmReset(null))
            }
            variant="dark"
          >
            Confirm reset
          </Button>
        </div>
      </Modal>
    </section>
  );
}
