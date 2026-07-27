import { RotateCcw } from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "../../../components/ui/Button";
import { Modal } from "../../../components/ui/Modal";
import { ParticipantAvatar } from "../../../components/ui/ParticipantAvatar";
import type { Participant } from "../../participants/types";
import { descendantMatchIds } from "../engine/knockout";
import {
  appendRoundWinner,
  deriveSeriesProgress,
  undoLastRound,
} from "../engine/series";
import type { CompetitionMatch, CompetitionRun } from "../engine/types";
import type { GroupKnockoutRun } from "../group-knockout/types";

function participantName(
  participants: Participant[],
  participantId: string | null,
) {
  return (
    participants.find((participant) => participant.id === participantId)
      ?.displayName ?? "Unavailable participant"
  );
}

function participantAvatar(
  participants: Participant[],
  participantId: string | null,
) {
  const participant = participants.find((entry) => entry.id === participantId);
  if (!participant) return null;
  return (
    <ParticipantAvatar
      accent={participant.avatar.tone}
      icon={participant.avatar.icon}
      initials={participant.displayName.slice(0, 2).toUpperCase()}
      name={participant.displayName}
      size="sm"
    />
  );
}

export function SeriesResultDialog({
  match,
  run,
  participants,
  onClose,
  onSave,
}: {
  match: CompetitionMatch | null;
  run: CompetitionRun | GroupKnockoutRun;
  participants: Participant[];
  onClose: () => void;
  onSave: (options: {
    expectedMatchRevision: number;
    roundWinnerIds: string[];
    resetKnockout?: boolean;
    cascade?: boolean;
  }) => Promise<void>;
}) {
  const [roundWinnerIds, setRoundWinnerIds] = useState<string[]>(
    match?.result?.roundWinnerIds ?? [],
  );
  const [confirmedImpact, setConfirmedImpact] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const progress = useMemo(() => {
    if (!match) return null;
    try {
      return deriveSeriesProgress(
        match,
        run.configSnapshot.series,
        roundWinnerIds,
      );
    } catch {
      return null;
    }
  }, [match, roundWinnerIds, run.configSnapshot.series]);
  const correcting = Boolean(match?.result);
  const resetsKnockout =
    correcting &&
    (match?.stage === "round-robin" || match?.stage === "group-stage") &&
    Boolean(run.knockout);
  const cascadesKnockout = Boolean(
    correcting &&
    match &&
    match.stage !== "round-robin" &&
    match.stage !== "group-stage" &&
    descendantMatchIds(run.matches, match.id).some((id) => {
      const descendant = run.matches[id];
      return (
        Boolean(descendant?.result) || descendant?.status === "in-progress"
      );
    }),
  );
  const requiresImpactConfirmation = resetsKnockout || cascadesKnockout;
  const participantAName = participantName(
    participants,
    match?.participantAId ?? null,
  );
  const participantBName = participantName(
    participants,
    match?.participantBId ?? null,
  );

  return (
    <Modal
      description="Record each individual round in order. Totals and the series winner are derived from this sequence."
      onClose={onClose}
      open={match !== null}
      title={correcting ? "Correct match result" : "Record match result"}
    >
      {match && progress ? (
        <div>
          <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.035] p-4 text-center">
            <strong className="flex min-w-0 flex-col items-center gap-2 truncate">
              {participantAvatar(participants, match.participantAId)}
              <span className="truncate">{participantAName}</span>
            </strong>
            <p
              aria-live="polite"
              className="font-score text-3xl font-black tabular-nums"
            >
              {progress.participantAWins}
              <span className="px-2 text-white/30">:</span>
              {progress.participantBWins}
            </p>
            <strong className="flex min-w-0 flex-col items-center gap-2 truncate">
              {participantAvatar(participants, match.participantBId)}
              <span className="truncate">{participantBName}</span>
            </strong>
          </div>
          <p className="mt-3 text-center text-sm text-white/52">
            First to {progress.winsRequired} wins · Round{" "}
            {roundWinnerIds.length + (progress.complete ? 0 : 1)}
          </p>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            {[
              { id: match.participantAId!, name: participantAName },
              { id: match.participantBId!, name: participantBName },
            ].map((participant) => (
              <Button
                aria-label={`Record ${participant.name} as winner of round ${roundWinnerIds.length + 1}`}
                disabled={progress.complete}
                key={participant.id}
                onClick={() => {
                  try {
                    setRoundWinnerIds((current) =>
                      appendRoundWinner(
                        match,
                        run.configSnapshot.series,
                        current,
                        participant.id,
                      ),
                    );
                    setError(null);
                  } catch (nextError) {
                    setError(
                      nextError instanceof Error
                        ? nextError.message
                        : "That round cannot be recorded.",
                    );
                  }
                }}
                variant="dark"
              >
                {participant.name} won round {roundWinnerIds.length + 1}
              </Button>
            ))}
          </div>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <Button
              disabled={roundWinnerIds.length === 0}
              onClick={() =>
                setRoundWinnerIds((current) => undoLastRound(current))
              }
              variant="quiet"
            >
              <RotateCcw aria-hidden="true" size={16} /> Undo last round
            </Button>
            <ol
              aria-label="Recorded round winners"
              className="flex flex-wrap gap-2 text-xs text-white/55"
            >
              {roundWinnerIds.map((winnerId, index) => (
                <li
                  className="rounded-full border border-white/10 px-3 py-1.5"
                  key={`${index}-${winnerId}`}
                >
                  R{index + 1}: {participantName(participants, winnerId)}
                </li>
              ))}
            </ol>
          </div>
          {requiresImpactConfirmation ? (
            <label className="mt-5 flex min-h-11 items-start gap-3 rounded-xl border border-[var(--color-warning-500)]/30 bg-[var(--color-warning-500)]/8 p-4 text-sm text-[var(--color-warning-500)]">
              <input
                className="mt-1 size-5 shrink-0"
                checked={confirmedImpact}
                onChange={(event) => setConfirmedImpact(event.target.checked)}
                type="checkbox"
              />
              <span>
                {resetsKnockout
                  ? "I understand this correction resets the complete knockout bracket and its results before recalculating qualification."
                  : "I understand dependent downstream matches and results may be cleared while unrelated bracket branches remain intact."}
              </span>
            </label>
          ) : null}
          {error ? (
            <p
              className="mt-4 rounded-xl border border-[#ff9ca1]/25 bg-[#ff9ca1]/8 p-3 text-sm text-[#ffc3c6]"
              role="alert"
            >
              {error}
            </p>
          ) : null}
          <div className="mt-6 flex flex-wrap justify-end gap-3">
            <Button disabled={saving} onClick={onClose} variant="quiet">
              Cancel
            </Button>
            <Button
              disabled={
                !progress.complete ||
                saving ||
                (requiresImpactConfirmation && !confirmedImpact)
              }
              onClick={() => {
                setSaving(true);
                setError(null);
                void onSave({
                  expectedMatchRevision: match.revision,
                  roundWinnerIds,
                  ...(resetsKnockout ? { resetKnockout: true } : {}),
                  ...(cascadesKnockout ? { cascade: true } : {}),
                })
                  .then(onClose)
                  .catch((nextError: unknown) => {
                    setSaving(false);
                    setError(
                      nextError instanceof Error
                        ? nextError.message
                        : "The result could not be saved.",
                    );
                  });
              }}
              variant="dark"
            >
              {saving
                ? "Saving…"
                : correcting
                  ? "Confirm correction"
                  : "Confirm result"}
            </Button>
          </div>
        </div>
      ) : null}
    </Modal>
  );
}
