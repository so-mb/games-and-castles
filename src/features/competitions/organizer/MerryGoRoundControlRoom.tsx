import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Play,
  RotateCcw,
  Trophy,
} from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "../../../components/ui/Button";
import { Modal } from "../../../components/ui/Modal";
import { StatusBadge } from "../../../components/ui/StatusBadge";
import type { Participant } from "../../participants/types";
import { useCompetitions } from "../CompetitionsProvider";
import { MerryGoRoundGrandWinner } from "../MerryGoRoundGrandWinner";
import type { PublishedCompetition } from "../domain/types";
import { reviewActivation } from "../engine/activation";
import { canCompleteCompetition } from "../engine/lifecycle";
import {
  matchScore,
  matchStatusLabel,
  knockoutChampionParticipantId,
  runProgress,
  runStageLabel,
  seriesLabel,
} from "../engine/presentation";
import {
  deriveStandings,
  qualificationBlockingTies,
} from "../engine/standings";
import { nextPowerOfTwo } from "../engine/knockout";
import type { CompetitionMatch, CompetitionRun } from "../engine/types";
import { KnockoutBracket } from "../public/KnockoutBracket";
import { SeriesResultDialog } from "./SeriesResultDialog";
import { TieResolutionPanel } from "./TieResolutionPanel";

function participantName(
  participants: Participant[],
  participantId: string | null,
) {
  return (
    participants.find((participant) => participant.id === participantId)
      ?.displayName ??
    (participantId ? "Unavailable participant" : "Waiting for qualifier")
  );
}

function ControlMatchCard({
  match,
  participants,
  canMutate,
  run,
  onResult,
}: {
  match: CompetitionMatch;
  participants: Participant[];
  canMutate: boolean;
  run: CompetitionRun;
  onResult: (match: CompetitionMatch) => void;
}) {
  const competitions = useCompetitions();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const action = async (callback: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await callback();
    } catch (nextError) {
      setError(
        nextError instanceof Error
          ? nextError.message
          : "The match could not be updated.",
      );
    } finally {
      setBusy(false);
    }
  };
  return (
    <article
      className={`rounded-2xl border p-4 ${match.status === "in-progress" ? "border-[var(--color-electric-cyan-400)] bg-[var(--color-electric-cyan-400)]/8" : "border-white/10 bg-white/[0.035]"}`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
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
        <span className="font-score font-black tabular-nums">
          {matchScore(match)}
        </span>
      </div>
      <div className="mt-4 grid grid-cols-[1fr_auto_1fr] items-center gap-3 text-center">
        <strong className="truncate">
          {participantName(participants, match.participantAId)}
        </strong>
        <span className="text-white/28">vs</span>
        <strong className="truncate">
          {participantName(participants, match.participantBId)}
        </strong>
      </div>
      {!match.isBye ? (
        <div className="mt-4 flex flex-wrap gap-2 border-t border-white/8 pt-3">
          {match.status === "in-progress" ? (
            <Button
              disabled={!canMutate || busy}
              onClick={() => onResult(match)}
              variant="dark"
            >
              Record result
            </Button>
          ) : match.result ? (
            <Button
              disabled={!canMutate || busy}
              onClick={() => onResult(match)}
              variant="darkSecondary"
            >
              Correct result
            </Button>
          ) : match.participantAId && match.participantBId ? (
            <Button
              disabled={!canMutate || busy}
              onClick={() =>
                void action(() =>
                  competitions.startMatch(run, match.id, match.revision),
                )
              }
              variant="dark"
            >
              <Play aria-hidden="true" size={16} /> Start match
            </Button>
          ) : null}
          {match.status === "in-progress" ? (
            <Button
              disabled={!canMutate || busy}
              onClick={() =>
                void action(() =>
                  competitions.returnMatchToPending(
                    run,
                    match.id,
                    match.revision,
                  ),
                )
              }
              variant="darkSecondary"
            >
              Return to pending
            </Button>
          ) : null}
        </div>
      ) : null}
      {error ? (
        <p className="mt-3 text-xs text-[#ffc3c6]" role="alert">
          {error}
        </p>
      ) : null}
    </article>
  );
}

export function ActivationReview({
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
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const config =
    competition.formatConfig.kind === "round-robin-knockout"
      ? competition.formatConfig
      : null;
  const review = reviewActivation(competition, participants, false);
  const blockers = review.errors;
  const count = competition.participantIds.length;
  const selectedParticipants = competition.participantIds.map((id) =>
    participants.find((participant) => participant.id === id),
  );
  return (
    <section aria-labelledby="activation-review-title">
      <Button onClick={onBack} variant="quiet">
        <ArrowLeft aria-hidden="true" size={16} /> Back to Studio
      </Button>
      <p className="mt-5 text-xs font-bold tracking-[0.14em] text-[var(--color-electric-cyan-400)] uppercase">
        Activation review
      </p>
      <h3 className="mt-2 text-2xl font-extrabold" id="activation-review-title">
        {competition.title}
      </h3>
      <p className="mt-1 text-sm text-white/58">
        {competition.gameName} · Merry-Go-Round
      </p>
      <dl className="mt-6 grid gap-3 rounded-2xl border border-white/10 bg-white/[0.035] p-5 sm:grid-cols-2">
        <div>
          <dt className="text-xs text-white/42">Participants</dt>
          <dd className="mt-1 font-black">{count}</dd>
        </div>
        <div>
          <dt className="text-xs text-white/42">Round robin</dt>
          <dd className="mt-1 font-black">
            {review.expectedMatchCount} matches · {review.expectedFixtureRounds}{" "}
            fixture rounds
          </dd>
        </div>
        <div>
          <dt className="text-xs text-white/42">Series</dt>
          <dd className="mt-1 font-black">
            {config ? seriesLabel(config.series) : "Unavailable"}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-white/42">Qualification</dt>
          <dd className="mt-1 font-black">
            Top {config?.qualificationCount ?? 0}
            {config?.includeThirdPlace
              ? " · third place required"
              : " · no third-place match"}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-white/42">Knockout estimate</dt>
          <dd className="mt-1 font-black">
            {review.bracketSize || "—"} slots · {review.knockoutMatchCount}{" "}
            matches
          </dd>
        </div>
        <div>
          <dt className="text-xs text-white/42">Table scoring</dt>
          <dd className="mt-1 font-black">
            {competition.scoringConfig.kind === "head-to-head"
              ? `${competition.scoringConfig.table.pointsForMatchWin}/${competition.scoringConfig.table.pointsForDraw}/${competition.scoringConfig.table.pointsForMatchLoss} win/draw/loss`
              : "Unavailable"}
          </dd>
        </div>
      </dl>
      <section
        className="mt-5 rounded-2xl border border-white/10 p-5"
        aria-labelledby="activation-participants"
      >
        <h4 className="font-extrabold" id="activation-participants">
          Official participant field
        </h4>
        <ol className="mt-3 grid gap-2 sm:grid-cols-2">
          {selectedParticipants.map((participant, index) => (
            <li
              className="flex items-center justify-between rounded-xl bg-white/[0.035] px-3 py-2 text-sm"
              key={competition.participantIds[index]}
            >
              <span>{participant?.displayName ?? "Missing participant"}</span>
              <span
                className={
                  participant?.status === "active"
                    ? "text-white/42"
                    : "text-[var(--color-warning-500)]"
                }
              >
                {participant?.status ?? "missing"}
              </span>
            </li>
          ))}
        </ol>
      </section>
      {competition.scoringConfig.kind === "head-to-head" ? (
        <section
          className="mt-5 rounded-2xl border border-white/10 p-5"
          aria-labelledby="activation-scoring"
        >
          <h4 className="font-extrabold" id="activation-scoring">
            Projected competition scoring
          </h4>
          <p className="mt-2 text-sm leading-6 text-white/55">
            Match win +{competition.scoringConfig.overall.matchWinBonus}; each
            individual round +
            {competition.scoringConfig.overall.pointsPerRoundWon}; participation
            +{competition.scoringConfig.overall.participationPoints};
            qualification +
            {competition.scoringConfig.overall.qualificationBonus}; winner +
            {competition.scoringConfig.overall.competitionWinnerBonus};
            runner-up +{competition.scoringConfig.overall.runnerUpBonus}; third
            place +{competition.scoringConfig.overall.thirdPlaceBonus}.
          </p>
        </section>
      ) : null}
      <div className="mt-5 rounded-2xl border border-white/10 p-5">
        <h4 className="font-extrabold">Frozen at activation</h4>
        <p className="mt-2 text-sm leading-6 text-white/55">
          Participant IDs, format, series, qualification, table scoring,
          projected competition scoring and the one-time randomized draw are
          persisted as the immutable runtime snapshot. Participant display names
          continue resolving by ID.
        </p>
      </div>
      {review.warnings.length ? (
        <div className="mt-5 rounded-2xl border border-white/10 p-5">
          <h4 className="font-extrabold">Review notes</h4>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-white/55">
            {review.warnings.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        </div>
      ) : null}
      {blockers.length ? (
        <div className="mt-5 rounded-2xl border border-[var(--color-warning-500)]/30 bg-[var(--color-warning-500)]/8 p-5">
          <h4 className="flex items-center gap-2 font-extrabold text-[var(--color-warning-500)]">
            <AlertTriangle aria-hidden="true" size={18} /> Activation blocked
          </h4>
          <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-white/62">
            {blockers.map((blocker, index) => (
              <li key={`${index}-${blocker}`}>{blocker}</li>
            ))}
          </ul>
        </div>
      ) : null}
      {error ? (
        <p className="mt-4 text-sm text-[#ffc3c6]" role="alert">
          {error}
        </p>
      ) : null}
      <div className="mt-6 flex flex-wrap justify-end gap-3">
        <Button onClick={onBack} variant="quiet">
          Cancel
        </Button>
        <Button
          disabled={!competitions.canMutate || blockers.length > 0}
          onClick={() => setConfirming(true)}
          variant="dark"
        >
          Activate Merry-Go-Round
        </Button>
      </div>
      <Modal
        description="This securely randomizes participants once, generates every round-robin fixture, freezes the configuration, and changes the competition to active."
        onClose={() => setConfirming(false)}
        open={confirming}
        title="Create the official draw?"
      >
        <div className="flex flex-wrap justify-end gap-3">
          <Button
            disabled={busy}
            onClick={() => setConfirming(false)}
            variant="quiet"
          >
            Keep scheduled
          </Button>
          <Button
            disabled={busy}
            onClick={() => {
              setBusy(true);
              setError(null);
              void competitions
                .activate(competition)
                .then(() => {
                  setConfirming(false);
                  onActivated();
                })
                .catch((nextError: unknown) => {
                  setBusy(false);
                  setConfirming(false);
                  setError(
                    nextError instanceof Error
                      ? nextError.message
                      : "Activation failed.",
                  );
                });
            }}
            variant="dark"
          >
            {busy ? "Activating…" : "Confirm activation"}
          </Button>
        </div>
      </Modal>
    </section>
  );
}

export function MerryGoRoundControlRoom({
  competition,
  run,
  participants,
  onBack,
}: {
  competition: PublishedCompetition;
  run: CompetitionRun;
  participants: Participant[];
  onBack: () => void;
}) {
  const competitions = useCompetitions();
  const [resultMatch, setResultMatch] = useState<CompetitionMatch | null>(null);
  const [confirmation, setConfirmation] = useState<
    "knockout" | "complete" | "reset" | "reopen" | null
  >(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reopenConfirmed, setReopenConfirmed] = useState(false);
  const standings = useMemo(
    () =>
      deriveStandings(
        run.participantIds,
        Object.values(run.matches),
        run.configSnapshot.tableScoring,
        Object.values(run.tieResolutions),
      ),
    [run],
  );
  const blockingTies = qualificationBlockingTies(
    standings,
    run.configSnapshot.qualificationCount,
  );
  const qualifiers = standings.rows.slice(
    0,
    run.configSnapshot.qualificationCount,
  );
  const knockoutSlots = nextPowerOfTwo(run.configSnapshot.qualificationCount);
  const progress = runProgress(run);
  const grandWinnerId = knockoutChampionParticipantId(run);
  const runtimeWarnings = run.participantIds.flatMap((id) => {
    const participant = participants.find((entry) => entry.id === id);
    return !participant
      ? ["A runtime participant record is missing."]
      : participant.status !== "active"
        ? [
            `${participant.displayName} is inactive but remains frozen in this run.`,
          ]
        : [];
  });
  const roundRobinMatches = Object.values(run.matches)
    .filter((match) => match.stage === "round-robin")
    .sort((a, b) => a.globalSequence - b.globalSequence);
  const auditEntries = competitions.auditEntries
    .filter((entry) => entry.entityId === run.competitionId)
    .slice(0, 8);
  const perform = async (action: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await action();
      setConfirmation(null);
    } catch (nextError) {
      setError(
        nextError instanceof Error
          ? nextError.message
          : "The competition operation failed.",
      );
    } finally {
      setBusy(false);
    }
  };
  return (
    <section aria-labelledby="control-room-title">
      <Button onClick={onBack} variant="quiet">
        <ArrowLeft aria-hidden="true" size={16} /> Back to Studio
      </Button>
      <div className="mt-5 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-bold tracking-[0.14em] text-[var(--color-electric-cyan-400)] uppercase">
            Merry-Go-Round Control Room
          </p>
          <h3 className="mt-2 text-2xl font-extrabold" id="control-room-title">
            {competition.title}
          </h3>
          <p className="mt-1 text-sm text-white/58">
            {competition.gameName} · {runStageLabel(run.stage)} · Runtime
            revision {run.revision}
          </p>
        </div>
        <StatusBadge
          tone={run.stage === "completed" ? "success" : "live"}
        >{`${progress.completed}/${progress.total} results`}</StatusBadge>
      </div>
      {runtimeWarnings.length ? (
        <div
          className="mt-5 rounded-2xl border border-[var(--color-warning-500)]/30 bg-[var(--color-warning-500)]/8 p-4 text-sm text-[var(--color-warning-500)]"
          role="alert"
        >
          {runtimeWarnings.map((warning) => (
            <p key={warning}>{warning}</p>
          ))}
        </div>
      ) : null}
      {error ? (
        <p
          className="mt-5 rounded-xl border border-[#ff9ca1]/25 bg-[#ff9ca1]/8 p-4 text-sm text-[#ffc3c6]"
          role="alert"
        >
          {error}
        </p>
      ) : null}
      {grandWinnerId ? (
        <MerryGoRoundGrandWinner
          id={`${run.competitionId}-organizer-grand-winner`}
          participantId={grandWinnerId}
          participants={participants}
        />
      ) : null}
      <section
        className="mt-6 rounded-2xl border border-white/10 bg-white/[0.025] p-5"
        aria-labelledby="persisted-draw"
      >
        <h4 className="font-extrabold" id="persisted-draw">
          Persisted draw order
        </h4>
        <p className="mt-1 text-xs text-white/42">
          Generated once with secure randomization at activation; reconnects
          never redraw it.
        </p>
        <ol className="mt-3 flex flex-wrap gap-2">
          {run.randomizedParticipantIds.map((participantId, index) => (
            <li
              className="rounded-full border border-white/10 px-3 py-1.5 text-xs font-bold"
              key={participantId}
            >
              {index + 1}. {participantName(participants, participantId)}
            </li>
          ))}
        </ol>
      </section>
      {run.stage === "qualification-review" && !run.knockout ? (
        <section
          className="mt-6 rounded-2xl border border-[var(--color-electric-cyan-400)]/30 bg-[var(--color-electric-cyan-400)]/7 p-5"
          aria-labelledby="qualification-review-summary"
        >
          <h4 className="font-extrabold" id="qualification-review-summary">
            Round robin complete · review qualification
          </h4>
          <p className="mt-2 text-sm text-white/58">
            Confirm the final seed order before generating a {knockoutSlots}
            -slot bracket.{" "}
            {knockoutSlots - run.configSnapshot.qualificationCount} bye
            {knockoutSlots - run.configSnapshot.qualificationCount === 1
              ? ""
              : "s"}{" "}
            will go to the highest seeds. Third-place match:{" "}
            {run.configSnapshot.includeThirdPlace ? "required" : "not included"}
            .
          </p>
          <ol className="mt-4 grid gap-2 sm:grid-cols-2">
            {qualifiers.map((row, index) => (
              <li
                className="flex items-center justify-between rounded-xl border border-white/10 bg-black/10 px-3 py-2 text-sm"
                key={row.participantId}
              >
                <span>
                  <strong className="mr-2">Seed {index + 1}</strong>
                  {participantName(participants, row.participantId)}
                </span>
                <span className="text-xs text-white/42">
                  {row.tablePoints} pts
                </span>
              </li>
            ))}
          </ol>
          <p className="mt-4 text-xs leading-5 text-[var(--color-warning-500)]">
            Correcting any round-robin result after generation requires an
            explicit complete knockout reset; it is never silently reseeded.
          </p>
        </section>
      ) : null}
      {run.stage !== "completed" ? (
        <div className="mt-6 flex flex-wrap gap-3">
          {run.resultCount === 0 ? (
            <Button
              disabled={!competitions.canMutate}
              onClick={() => setConfirmation("reset")}
              variant="quiet"
            >
              <RotateCcw aria-hidden="true" size={16} /> Reset unstarted run
            </Button>
          ) : null}
          {run.stage === "qualification-review" && !run.knockout ? (
            <Button
              disabled={!competitions.canMutate || blockingTies.length > 0}
              onClick={() => setConfirmation("knockout")}
              variant="dark"
            >
              <Trophy aria-hidden="true" size={16} /> Review and generate
              knockout
            </Button>
          ) : null}
          {run.stage === "knockout" && canCompleteCompetition(run) ? (
            <Button
              disabled={!competitions.canMutate}
              onClick={() => setConfirmation("complete")}
              variant="dark"
            >
              <CheckCircle2 aria-hidden="true" size={16} /> Complete competition
            </Button>
          ) : null}
        </div>
      ) : (
        <div className="mt-6">
          <Button
            disabled={!competitions.canMutate}
            onClick={() => setConfirmation("reopen")}
            variant="quiet"
          >
            <RotateCcw aria-hidden="true" size={16} /> Reopen competition
          </Button>
        </div>
      )}
      {run.stage === "qualification-review" && blockingTies[0] ? (
        <div className="mt-6">
          <TieResolutionPanel
            disabled={!competitions.canMutate}
            key={blockingTies[0].join("|")}
            onConfirm={(order, reason) =>
              competitions.resolveTie(run, blockingTies[0]!, order, reason)
            }
            participantIds={blockingTies[0]}
            participants={participants}
          />
        </div>
      ) : null}
      <section className="mt-8" aria-labelledby="control-standings">
        <h4 className="text-xl font-extrabold" id="control-standings">
          Round-robin qualification standings
        </h4>
        <p className="mt-1 text-xs leading-5 text-white/45">
          These points determine qualification and knockout seeding only. The
          knockout final decides the Grand Winner.
        </p>
        <ol className="mt-3 grid gap-2 sm:grid-cols-2">
          {standings.rows.map((row, index) => (
            <li
              className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.035] p-3"
              key={row.participantId}
            >
              <span className="w-7 font-black tabular-nums">
                {row.rank}
                {row.tied ? "=" : ""}
              </span>
              <span className="min-w-0 flex-1 truncate font-bold">
                {participantName(participants, row.participantId)}
              </span>
              <span className="font-score font-black text-[var(--color-electric-cyan-400)]">
                {row.tablePoints}
              </span>
              <span className="sr-only">
                {index < run.configSnapshot.qualificationCount
                  ? "Qualifier position"
                  : "Outside qualification"}
                {row.decidedBy === "unresolved" ? ", tie unresolved" : ""}
              </span>
            </li>
          ))}
        </ol>
      </section>
      <section className="mt-8" aria-labelledby="round-robin-control">
        <h4 className="text-xl font-extrabold" id="round-robin-control">
          Round-robin matches
        </h4>
        <div className="mt-4 grid gap-3 lg:grid-cols-2">
          {roundRobinMatches.map((match) => (
            <ControlMatchCard
              canMutate={competitions.canMutate && run.stage !== "completed"}
              key={match.id}
              match={match}
              onResult={setResultMatch}
              participants={participants}
              run={run}
            />
          ))}
        </div>
      </section>
      {run.knockout ? (
        <div className="mt-8">
          <KnockoutBracket
            id={`${run.competitionId}-organizer-bracket`}
            headingLevel={4}
            matches={run.matches}
            matchSlotHeight={240}
            participants={participants}
            renderMatch={(match) => (
              <ControlMatchCard
                canMutate={competitions.canMutate && run.stage !== "completed"}
                match={match}
                onResult={setResultMatch}
                participants={participants}
                run={run}
              />
            )}
            rounds={run.knockout.rounds}
            sourceDescription="The confirmed round-robin table sets this seed order. Connected paths make each winner’s next match clear."
            sourceEntries={run.knockout.seedOrder.map(
              (participantId, index) => ({
                participantId,
                seed: index + 1,
                context: `Table #${index + 1}`,
              }),
            )}
            sourceLabel="Round-robin standings"
            thirdPlaceMatchId={run.knockout.thirdPlaceMatchId}
          />
        </div>
      ) : null}
      <section
        className="mt-8 rounded-2xl border border-white/10 p-5"
        aria-labelledby="audit-summary"
      >
        <h4 className="font-extrabold" id="audit-summary">
          Audit activity
        </h4>
        <p className="mt-2 text-sm text-white/52">
          Organizer-authored runtime events are append-only. Current runtime
          revision: {run.revision}.
        </p>
        {auditEntries.length ? (
          <ol className="mt-4 space-y-3">
            {auditEntries.map((entry) => (
              <li
                className="border-l-2 border-white/12 pl-3 text-sm"
                key={entry.id}
              >
                <p className="font-semibold text-white/75">{entry.summary}</p>
                <p className="mt-1 text-xs text-white/38">
                  {new Date(entry.occurredAt).toLocaleString()} ·{" "}
                  {entry.action.replaceAll("-", " ")}
                </p>
              </li>
            ))}
          </ol>
        ) : (
          <p className="mt-4 text-sm text-white/38">
            No Phase 4 audit events are available yet.
          </p>
        )}
      </section>
      {resultMatch ? (
        <SeriesResultDialog
          key={`${resultMatch.id}-${resultMatch.revision}`}
          match={resultMatch}
          onClose={() => setResultMatch(null)}
          onSave={(options) =>
            competitions.recordResult(run, resultMatch.id, options)
          }
          participants={participants}
          run={run}
        />
      ) : null}
      <Modal
        description={
          confirmation === "knockout"
            ? `Seeds: ${standings.rows
                .slice(0, run.configSnapshot.qualificationCount)
                .map(
                  (row, index) =>
                    `${index + 1}. ${participantName(participants, row.participantId)}`,
                )
                .join(
                  " · ",
                )}. Byes go to the highest seeds when the field is not a power of two.`
            : confirmation === "complete"
              ? "Final placements will be persisted and the competition becomes read-only."
              : confirmation === "reset"
                ? "The secure draw and all generated fixtures will be deleted. This is allowed only because no result exists; the competition returns to scheduled."
                : "All existing results remain. Completion metadata and placements are removed, and the knockout returns to an editable active state."
        }
        onClose={() => {
          setConfirmation(null);
          setReopenConfirmed(false);
        }}
        open={confirmation !== null}
        title={
          confirmation === "knockout"
            ? "Generate seeded knockout?"
            : confirmation === "complete"
              ? "Complete this competition?"
              : confirmation === "reset"
                ? "Reset this unstarted run?"
                : "Reopen this completed competition?"
        }
      >
        {confirmation === "reopen" ? (
          <label className="mb-5 flex min-h-11 items-start gap-3 rounded-xl border border-[var(--color-warning-500)]/30 bg-[var(--color-warning-500)]/8 p-4 text-sm text-[var(--color-warning-500)]">
            <input
              checked={reopenConfirmed}
              className="mt-1 size-5 shrink-0"
              onChange={(event) => setReopenConfirmed(event.target.checked)}
              type="checkbox"
            />
            <span>
              I understand this makes completed match controls editable again
              while preserving every existing result.
            </span>
          </label>
        ) : null}
        <div className="flex flex-wrap justify-end gap-3">
          <Button
            disabled={busy}
            onClick={() => {
              setConfirmation(null);
              setReopenConfirmed(false);
            }}
            variant="quiet"
          >
            Cancel
          </Button>
          <Button
            disabled={busy || (confirmation === "reopen" && !reopenConfirmed)}
            onClick={() =>
              void perform(() =>
                confirmation === "knockout"
                  ? competitions.generateKnockout(run)
                  : confirmation === "complete"
                    ? competitions.complete(competition, run)
                    : confirmation === "reset"
                      ? competitions.resetRun(competition, run)
                      : competitions.reopen(competition, run),
              )
            }
            variant="dark"
          >
            {busy
              ? "Saving…"
              : confirmation === "knockout"
                ? "Generate bracket"
                : confirmation === "complete"
                  ? "Confirm completion"
                  : confirmation === "reset"
                    ? "Reset run"
                    : "Confirm reopen"}
          </Button>
        </div>
      </Modal>
    </section>
  );
}
