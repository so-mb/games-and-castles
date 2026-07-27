import { useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  CheckCircle2,
  CirclePlus,
  Play,
  RotateCcw,
  Trash2,
  Trophy,
  Users,
} from "lucide-react";
import { Button } from "../../../components/ui/Button";
import { Modal } from "../../../components/ui/Modal";
import { StatusBadge } from "../../../components/ui/StatusBadge";
import type { Participant } from "../../participants/types";
import {
  canReviewAllHandsCompletion,
  deriveAllHandsCompetitionPointBreakdown,
  deriveAllHandsStandings,
  numericPlacements,
  reviewAllHandsActivation,
  sessionEntities,
} from "../all-hands/engine";
import type {
  AllHandsCompetitionRun,
  AllHandsResultInput,
  AllHandsSession,
  AllHandsTeam,
  CustomPointEntry,
  NumericResultEntry,
  PlacementResultEntry,
  SessionResultEntity,
} from "../all-hands/types";
import { competitionLimits, formatPresentation } from "../domain/config";
import type { PublishedCompetition } from "../domain/types";
import { useCompetitions } from "../CompetitionsProvider";

const inputClass =
  "mt-2 min-h-11 w-full rounded-xl border border-white/15 bg-white/7 px-3 text-base text-white outline-none focus:border-[var(--color-electric-cyan-400)] focus:ring-3 focus:ring-[var(--color-electric-cyan-400)]/18";
const labelClass = "block text-sm font-bold text-white";

function participantName(participants: Participant[], id: string) {
  return (
    participants.find((participant) => participant.id === id)?.displayName ??
    "Unavailable participant"
  );
}

function participantIssue(participants: Participant[], id: string) {
  const participant = participants.find((candidate) => candidate.id === id);
  if (!participant) return "Missing participant";
  if (participant.status !== "active") return "Inactive participant";
  return null;
}

function entityLabel(
  entity: SessionResultEntity,
  session: AllHandsSession,
  participants: Participant[],
) {
  return entity.kind === "participant"
    ? participantName(participants, entity.participantId)
    : `${session.teams[entity.teamId]?.name ?? "Unavailable team"} — ${entity.participantIds
        .map((id) => participantName(participants, id))
        .join(", ")}`;
}

function move<T>(items: T[], index: number, direction: -1 | 1) {
  const target = index + direction;
  if (target < 0 || target >= items.length) return items;
  const next = [...items];
  [next[index], next[target]] = [next[target]!, next[index]!];
  return next;
}

export function AllHandsActivationReview({
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
  const review = reviewAllHandsActivation(competition, participants, false);
  const config =
    competition.formatConfig.kind === "all-hands"
      ? competition.formatConfig
      : null;
  const scoring =
    competition.scoringConfig.kind === "all-hands"
      ? competition.scoringConfig
      : null;
  return (
    <section aria-labelledby="all-hands-activation-title">
      <Button onClick={onBack} variant="quiet">
        <ArrowLeft aria-hidden="true" size={16} /> Back to Studio
      </Button>
      <p className="mt-5 text-xs font-bold tracking-[0.14em] text-[var(--color-electric-cyan-400)] uppercase">
        All Hands activation review
      </p>
      <h3
        className="mt-2 text-2xl font-extrabold"
        id="all-hands-activation-title"
      >
        {competition.title}
      </h3>
      <p className="mt-1 text-sm text-white/58">
        {competition.gameName} · {formatPresentation[competition.format].label}
      </p>
      <dl className="mt-6 grid gap-3 rounded-2xl border border-white/10 bg-white/[0.035] p-5 sm:grid-cols-2">
        <div>
          <dt className="text-xs text-white/42">Eligible participants</dt>
          <dd className="mt-1 font-black">
            {competition.participantIds.length}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-white/42">Result mode</dt>
          <dd className="mt-1 font-black">
            {config?.resultMode.replaceAll("-", " ")}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-white/42">Session policy</dt>
          <dd className="mt-1 font-black">
            {config?.sessionPlan.kind === "planned"
              ? `${config.sessionPlan.sessionCount} fixed sessions`
              : "Open-ended"}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-white/42">Teams</dt>
          <dd className="mt-1 font-black">
            {config?.allowTeams
              ? "Enabled · each member receives full award"
              : "Individuals only"}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-white/42">Metrics</dt>
          <dd className="mt-1 font-black">
            {config?.primaryMetricLabel || "No numeric metric"}
            {config?.secondaryMetricLabel
              ? ` · ${config.secondaryMetricLabel}`
              : ""}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-white/42">Tie policy</dt>
          <dd className="mt-1 font-black">
            {config?.tieHandling === "manual-order"
              ? "Organizer ordering"
              : "Shared placement"}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-white/42">Winner / participation</dt>
          <dd className="mt-1 font-black">
            {scoring?.winnerBonus ?? 0} / {scoring?.participationPoints ?? 0}{" "}
            points
          </dd>
        </div>
        <div>
          <dt className="text-xs text-white/42">Completion awards</dt>
          <dd className="mt-1 font-black">None configured</dd>
        </div>
      </dl>
      <div className="mt-5 rounded-xl border border-[var(--color-antique-gold-400)]/25 bg-[var(--color-antique-gold-400)]/7 p-4 text-sm leading-6 text-white/65">
        <strong className="text-white">Frozen at activation:</strong>{" "}
        participant eligibility, result mode, session policy, metrics, tie
        policy, and scoring become the immutable runtime snapshot.
      </div>
      {review.errors.length ? (
        <div
          className="mt-5 rounded-xl border border-[#ff9ca1]/25 bg-[#ff9ca1]/8 p-4"
          role="alert"
        >
          <p className="font-bold text-[#ffc3c6]">Activation is blocked</p>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-[#ffc3c6]">
            {review.errors.map((item) => (
              <li key={item}>{item}</li>
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
          disabled={!review.canActivate || !competitions.canMutate}
          onClick={() => setConfirming(true)}
          variant="dark"
        >
          <Play aria-hidden="true" size={16} /> Activate All Hands
        </Button>
      </div>
      <Modal
        description="This creates the shared runtime, freezes the reviewed configuration, and changes the public competition to active."
        onClose={() => setConfirming(false)}
        open={confirming}
        title="Freeze configuration and activate?"
      >
        <div className="flex justify-end gap-3">
          <Button onClick={() => setConfirming(false)} variant="quiet">
            Keep scheduled
          </Button>
          <Button
            disabled={busy}
            onClick={() => {
              setBusy(true);
              setError(null);
              void competitions
                .activate(competition)
                .then(onActivated)
                .catch((nextError: unknown) => {
                  setError(
                    nextError instanceof Error
                      ? nextError.message
                      : "Activation failed.",
                  );
                  setConfirming(false);
                })
                .finally(() => setBusy(false));
            }}
            variant="dark"
          >
            Confirm activation
          </Button>
        </div>
      </Modal>
    </section>
  );
}

function NewSessionDialog({
  run,
  participants,
  open,
  onClose,
}: {
  run: AllHandsCompetitionRun;
  participants: Participant[];
  open: boolean;
  onClose: () => void;
}) {
  const competitions = useCompetitions();
  const available = run.eligibleParticipantIds.filter(
    (id) => !participantIssue(participants, id),
  );
  const [title, setTitle] = useState("");
  const [mode, setMode] = useState<"individual" | "team">("individual");
  const [selected, setSelected] = useState<string[]>(available);
  const [teams, setTeams] = useState<AllHandsTeam[]>([
    { id: "team-1", name: "Team 1", participantIds: [] },
    { id: "team-2", name: "Team 2", participantIds: [] },
  ]);
  const [reviewing, setReviewing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const assignedTeams = teams.map((team) => ({
    ...team,
    participantIds: team.participantIds.filter((id) => selected.includes(id)),
  }));
  const submit = async (startImmediately: boolean) => {
    setBusy(true);
    setError(null);
    try {
      await competitions.createAllHandsSession(run, {
        title,
        mode,
        participantIds: selected,
        teams: mode === "team" ? assignedTeams : [],
        startImmediately,
      });
      onClose();
    } catch (nextError) {
      setError(
        nextError instanceof Error
          ? nextError.message
          : "The session could not be created.",
      );
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal
      description="Choose a participant subset, optionally assign teams, then save explicitly. No field is written while you edit."
      onClose={onClose}
      open={open}
      title="Create All Hands session"
    >
      <div className="space-y-5">
        <label className={labelClass}>
          Session title <span className="text-white/42">(optional)</span>
          <input
            className={inputClass}
            maxLength={competitionLimits.sessionTitle}
            onChange={(event) => setTitle(event.target.value)}
            placeholder={`Session ${run.sessionCount + 1}`}
            value={title}
          />
        </label>
        <fieldset>
          <legend className="text-sm font-bold">Play mode</legend>
          <div className="mt-2 grid grid-cols-2 gap-2">
            {(["individual", "team"] as const).map((value) => (
              <label
                className="flex min-h-11 items-center gap-2 rounded-xl border border-white/12 px-3"
                key={value}
              >
                <input
                  checked={mode === value}
                  disabled={value === "team" && !run.configSnapshot.allowTeams}
                  name="session-mode"
                  onChange={() => setMode(value)}
                  type="radio"
                />
                {value === "team" ? "Teams" : "Individuals"}
              </label>
            ))}
          </div>
        </fieldset>
        <fieldset>
          <legend className="text-sm font-bold">Participants</legend>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            {run.eligibleParticipantIds.map((id) => {
              const issue = participantIssue(participants, id);
              return (
                <label
                  className="flex min-h-11 items-center gap-2 rounded-xl border border-white/12 px-3 text-sm"
                  key={id}
                >
                  <input
                    checked={selected.includes(id)}
                    disabled={Boolean(issue)}
                    onChange={() =>
                      setSelected((current) =>
                        current.includes(id)
                          ? current.filter((candidate) => candidate !== id)
                          : [...current, id],
                      )
                    }
                    type="checkbox"
                  />
                  <span className="min-w-0 flex-1 truncate">
                    {participantName(participants, id)}
                  </span>
                  {issue ? (
                    <span className="text-xs text-[var(--color-warning-500)]">
                      {issue}
                    </span>
                  ) : null}
                </label>
              );
            })}
          </div>
        </fieldset>
        {mode === "team" ? (
          <fieldset>
            <div className="flex items-center justify-between gap-3">
              <legend className="text-sm font-bold">Team assignment</legend>
              <Button
                disabled={teams.length >= selected.length}
                onClick={() =>
                  setTeams((current) => [
                    ...current,
                    {
                      id: `team-${current.length + 1}`,
                      name: `Team ${current.length + 1}`,
                      participantIds: [],
                    },
                  ])
                }
                variant="quiet"
              >
                <CirclePlus aria-hidden="true" size={16} /> Add team
              </Button>
            </div>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              {teams.map((team, index) => (
                <label className={labelClass} key={team.id}>
                  Team {index + 1} name
                  <input
                    className={inputClass}
                    maxLength={competitionLimits.teamName}
                    onChange={(event) =>
                      setTeams((current) =>
                        current.map((candidate) =>
                          candidate.id === team.id
                            ? { ...candidate, name: event.target.value }
                            : candidate,
                        ),
                      )
                    }
                    value={team.name}
                  />
                </label>
              ))}
            </div>
            <div className="mt-4 grid gap-3">
              {selected.map((id) => (
                <label className={labelClass} key={id}>
                  {participantName(participants, id)}
                  <select
                    className={inputClass}
                    onChange={(event) =>
                      setTeams((current) =>
                        current.map((team) => ({
                          ...team,
                          participantIds: [
                            ...team.participantIds.filter(
                              (candidate) => candidate !== id,
                            ),
                            ...(team.id === event.target.value ? [id] : []),
                          ],
                        })),
                      )
                    }
                    value={
                      teams.find((team) => team.participantIds.includes(id))
                        ?.id ?? ""
                    }
                  >
                    <option value="">Choose team</option>
                    {teams.map((team) => (
                      <option key={team.id} value={team.id}>
                        {team.name}
                      </option>
                    ))}
                  </select>
                </label>
              ))}
            </div>
          </fieldset>
        ) : null}
        <div className="rounded-xl border border-white/10 bg-white/[0.035] p-4 text-sm text-white/58">
          Result mode:{" "}
          <strong className="text-white">
            {run.configSnapshot.resultMode.replaceAll("-", " ")}
          </strong>
          {mode === "team"
            ? " · Every member receives the full team award."
            : ""}
        </div>
        {error ? (
          <p className="text-sm text-[#ffc3c6]" role="alert">
            {error}
          </p>
        ) : null}
        {reviewing ? (
          <p
            className="rounded-xl border border-[var(--color-electric-cyan-400)]/25 bg-[var(--color-electric-cyan-400)]/7 p-4 text-sm"
            role="status"
          >
            Ready to create {title.trim() || `Session ${run.sessionCount + 1}`}{" "}
            with {selected.length} participants. Choose whether it stays pending
            or starts now.
          </p>
        ) : null}
        <div className="flex flex-wrap justify-end gap-3">
          <Button onClick={onClose} variant="quiet">
            Cancel
          </Button>
          {!reviewing ? (
            <Button onClick={() => setReviewing(true)} variant="dark">
              Review session
            </Button>
          ) : (
            <>
              <Button
                disabled={busy}
                onClick={() => void submit(false)}
                variant="quiet"
              >
                Save pending
              </Button>
              <Button
                disabled={busy}
                onClick={() => void submit(true)}
                variant="dark"
              >
                <Play aria-hidden="true" size={16} /> Start now
              </Button>
            </>
          )}
        </div>
      </div>
    </Modal>
  );
}

function ResultDialog({
  run,
  session,
  participants,
  onClose,
}: {
  run: AllHandsCompetitionRun;
  session: AllHandsSession;
  participants: Participant[];
  onClose: () => void;
}) {
  const competitions = useCompetitions();
  const entities = sessionEntities(session);
  const existing = session.result;
  const [winnerId, setWinnerId] = useState(
    existing?.kind === "winner-only" ? existing.winnerEntityId : "",
  );
  const initialPlacement =
    existing?.kind === "placement"
      ? [...existing.entries].sort(
          (left, right) => left.placement - right.placement,
        )
      : entities.map((entity, index) => ({
          entityId: entity.id,
          placement: index + 1,
        }));
  const [placementOrder, setPlacementOrder] = useState(
    initialPlacement.map((entry) => entry.entityId),
  );
  const [sharedWithPrevious, setSharedWithPrevious] = useState<Set<string>>(
    new Set(
      initialPlacement
        .filter(
          (entry, index) =>
            index > 0 &&
            entry.placement === initialPlacement[index - 1]!.placement,
        )
        .map((entry) => entry.entityId),
    ),
  );
  const [numericEntries, setNumericEntries] = useState<NumericResultEntry[]>(
    existing?.kind === "numeric"
      ? existing.entries
      : entities.map((entity) => ({
          entityId: entity.id,
          primaryScore: 0,
          secondaryScore: run.configSnapshot.metrics.secondaryLabel ? 0 : null,
        })),
  );
  const [manualOrder, setManualOrder] = useState(
    existing?.kind === "numeric" && existing.manualOrderEntityIds
      ? existing.manualOrderEntityIds
      : entities.map((entity) => entity.id),
  );
  const [customEntries, setCustomEntries] = useState<CustomPointEntry[]>(
    existing?.kind === "custom"
      ? existing.entries
      : entities.map((entity) => ({
          entityId: entity.id,
          points: 0,
          note: null,
        })),
  );
  const [reviewing, setReviewing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const config = run.configSnapshot;
  const placementEntries: PlacementResultEntry[] = [];
  placementOrder.forEach((entityId, index) => {
    const previous = placementEntries[index - 1];
    placementEntries.push({
      entityId,
      placement:
        config.tieHandling === "shared-placement" &&
        sharedWithPrevious.has(entityId) &&
        previous
          ? previous.placement
          : index + 1,
    });
  });
  const input: AllHandsResultInput =
    config.resultMode === "winner-only"
      ? { kind: "winner-only", winnerEntityId: winnerId }
      : config.resultMode === "placement"
        ? { kind: "placement", entries: placementEntries }
        : config.resultMode === "custom"
          ? { kind: "custom", entries: customEntries }
          : {
              kind: "numeric",
              mode: config.resultMode,
              entries: numericEntries,
              manualOrderEntityIds:
                config.tieHandling === "manual-order" ? manualOrder : null,
            };
  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      await competitions.recordAllHandsResult(
        run,
        session.id,
        session.revision,
        input,
      );
      onClose();
    } catch (nextError) {
      setError(
        nextError instanceof Error
          ? nextError.message
          : "The result could not be saved.",
      );
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal
      description={`${existing ? "Correct" : "Record"} the complete ${config.resultMode.replaceAll("-", " ")} result. Changes are written only after confirmation.`}
      onClose={onClose}
      open
      title={`${existing ? "Correct" : "Record"} ${session.title}`}
    >
      <div className="space-y-5">
        {config.resultMode === "winner-only" ? (
          <fieldset>
            <legend className="text-sm font-bold">
              Choose exactly one winner
            </legend>
            <div className="mt-3 grid gap-2">
              {entities.map((entity) => (
                <label
                  className="flex min-h-12 items-center gap-3 rounded-xl border border-white/12 px-4"
                  key={entity.id}
                >
                  <input
                    checked={winnerId === entity.id}
                    name="winner"
                    onChange={() => setWinnerId(entity.id)}
                    type="radio"
                  />
                  <span>{entityLabel(entity, session, participants)}</span>
                </label>
              ))}
            </div>
          </fieldset>
        ) : config.resultMode === "placement" ? (
          <fieldset>
            <legend className="text-sm font-bold">Finishing order</legend>
            <p className="mt-1 text-xs text-white/48">
              Move controls are keyboard and touch accessible.
            </p>
            <div className="mt-3 space-y-2">
              {placementOrder.map((id, index) => {
                const entity = entities.find(
                  (candidate) => candidate.id === id,
                )!;
                return (
                  <div
                    className="rounded-xl border border-white/12 p-3"
                    key={id}
                  >
                    <div className="flex items-center gap-2">
                      <strong className="w-7 tabular-nums">
                        {placementEntries[index]!.placement}
                      </strong>
                      <span className="min-w-0 flex-1 truncate">
                        {entityLabel(entity, session, participants)}
                      </span>
                      <Button
                        aria-label={`Move ${entityLabel(entity, session, participants)} up`}
                        disabled={index === 0}
                        onClick={() =>
                          setPlacementOrder((current) =>
                            move(current, index, -1),
                          )
                        }
                        variant="quiet"
                      >
                        <ArrowUp aria-hidden="true" size={16} />
                      </Button>
                      <Button
                        aria-label={`Move ${entityLabel(entity, session, participants)} down`}
                        disabled={index === placementOrder.length - 1}
                        onClick={() =>
                          setPlacementOrder((current) =>
                            move(current, index, 1),
                          )
                        }
                        variant="quiet"
                      >
                        <ArrowDown aria-hidden="true" size={16} />
                      </Button>
                    </div>
                    {config.tieHandling === "shared-placement" && index > 0 ? (
                      <label className="mt-2 flex min-h-11 items-center gap-2 text-sm text-white/62">
                        <input
                          checked={sharedWithPrevious.has(id)}
                          onChange={() =>
                            setSharedWithPrevious((current) => {
                              const next = new Set(current);
                              if (next.has(id)) next.delete(id);
                              else next.add(id);
                              return next;
                            })
                          }
                          type="checkbox"
                        />
                        Share placement with previous entity
                      </label>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </fieldset>
        ) : config.resultMode === "highest-score" ||
          config.resultMode === "lowest-score" ? (
          <>
            <fieldset>
              <legend className="text-sm font-bold">Numeric scores</legend>
              <p className="mt-1 text-xs text-white/48">
                {config.metrics.primaryDirection === "higher"
                  ? "Higher"
                  : "Lower"}{" "}
                {config.metrics.primaryLabel || "primary score"} ranks first
                {config.metrics.secondaryLabel
                  ? `; ${config.metrics.secondaryDirection === "higher" ? "higher" : "lower"} ${config.metrics.secondaryLabel} breaks a primary tie.`
                  : "."}
              </p>
              <div className="mt-3 grid gap-3">
                {numericEntries.map((entry, index) => {
                  const entity = entities.find(
                    (candidate) => candidate.id === entry.entityId,
                  )!;
                  return (
                    <div
                      className="grid gap-3 rounded-xl border border-white/12 p-3 sm:grid-cols-2"
                      key={entry.entityId}
                    >
                      <label className={labelClass}>
                        {entityLabel(entity, session, participants)} —{" "}
                        {config.metrics.primaryLabel || "Score"}
                        <input
                          className={inputClass}
                          onChange={(event) =>
                            setNumericEntries((current) =>
                              current.map((item, itemIndex) =>
                                itemIndex === index
                                  ? {
                                      ...item,
                                      primaryScore: Number(event.target.value),
                                    }
                                  : item,
                              ),
                            )
                          }
                          step="any"
                          type="number"
                          value={entry.primaryScore}
                        />
                      </label>
                      {config.metrics.secondaryLabel ? (
                        <label className={labelClass}>
                          {entityLabel(entity, session, participants)} —{" "}
                          {config.metrics.secondaryLabel}
                          <input
                            className={inputClass}
                            onChange={(event) =>
                              setNumericEntries((current) =>
                                current.map((item, itemIndex) =>
                                  itemIndex === index
                                    ? {
                                        ...item,
                                        secondaryScore: Number(
                                          event.target.value,
                                        ),
                                      }
                                    : item,
                                ),
                              )
                            }
                            step="any"
                            type="number"
                            value={entry.secondaryScore ?? 0}
                          />
                        </label>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </fieldset>
            <div className="rounded-xl border border-white/10 bg-white/[0.035] p-4 text-sm">
              <strong>Placement preview:</strong>{" "}
              {numericPlacements(
                {
                  entries: numericEntries,
                  manualOrderEntityIds:
                    config.tieHandling === "manual-order" ? manualOrder : null,
                },
                config,
              )
                .map(
                  (entry) =>
                    `${entry.placement}. ${entityLabel(
                      entities.find((entity) => entity.id === entry.entityId)!,
                      session,
                      participants,
                    )}`,
                )
                .join(" · ")}
            </div>
            {config.tieHandling === "manual-order" ? (
              <fieldset>
                <legend className="text-sm font-bold">
                  Manual order for remaining metric ties
                </legend>
                <div className="mt-3 space-y-2">
                  {manualOrder.map((id, index) => (
                    <div
                      className="flex items-center gap-2 rounded-xl border border-white/12 p-2"
                      key={id}
                    >
                      <span className="min-w-0 flex-1 truncate">
                        {entityLabel(
                          entities.find((entity) => entity.id === id)!,
                          session,
                          participants,
                        )}
                      </span>
                      <Button
                        aria-label="Move tied entity up"
                        disabled={index === 0}
                        onClick={() =>
                          setManualOrder((current) => move(current, index, -1))
                        }
                        variant="quiet"
                      >
                        <ArrowUp aria-hidden="true" size={16} />
                      </Button>
                      <Button
                        aria-label="Move tied entity down"
                        disabled={index === manualOrder.length - 1}
                        onClick={() =>
                          setManualOrder((current) => move(current, index, 1))
                        }
                        variant="quiet"
                      >
                        <ArrowDown aria-hidden="true" size={16} />
                      </Button>
                    </div>
                  ))}
                </div>
              </fieldset>
            ) : null}
          </>
        ) : (
          <fieldset>
            <legend className="text-sm font-bold">
              Organizer-defined points
            </legend>
            <p className="mt-1 text-xs text-white/48">
              Every entity receives a bounded non-negative integer award.
            </p>
            <div className="mt-3 grid gap-3">
              {customEntries.map((entry, index) => {
                const entity = entities.find(
                  (candidate) => candidate.id === entry.entityId,
                )!;
                return (
                  <div
                    className="grid gap-3 rounded-xl border border-white/12 p-3 sm:grid-cols-[9rem_1fr]"
                    key={entry.entityId}
                  >
                    <label className={labelClass}>
                      {entityLabel(entity, session, participants)} points
                      <input
                        className={inputClass}
                        inputMode="numeric"
                        max={competitionLimits.customPoints}
                        min={0}
                        onChange={(event) =>
                          setCustomEntries((current) =>
                            current.map((item, itemIndex) =>
                              itemIndex === index
                                ? {
                                    ...item,
                                    points: Number(event.target.value),
                                  }
                                : item,
                            ),
                          )
                        }
                        type="number"
                        value={entry.points}
                      />
                    </label>
                    <label className={labelClass}>
                      Optional note
                      <input
                        className={inputClass}
                        maxLength={competitionLimits.resultNote}
                        onChange={(event) =>
                          setCustomEntries((current) =>
                            current.map((item, itemIndex) =>
                              itemIndex === index
                                ? { ...item, note: event.target.value || null }
                                : item,
                            ),
                          )
                        }
                        value={entry.note ?? ""}
                      />
                    </label>
                  </div>
                );
              })}
            </div>
            <p className="mt-3 text-sm font-bold">
              Allocated total:{" "}
              {customEntries.reduce((sum, entry) => sum + entry.points, 0)}{" "}
              points
            </p>
          </fieldset>
        )}
        {reviewing ? (
          <p
            className="rounded-xl border border-[var(--color-electric-cyan-400)]/25 bg-[var(--color-electric-cyan-400)]/7 p-4 text-sm"
            role="status"
          >
            Review complete. Saving will{" "}
            {existing
              ? "replace the previous raw result and recalculate standings"
              : "complete this session and update standings"}
            .
          </p>
        ) : null}
        {error ? (
          <p className="text-sm text-[#ffc3c6]" role="alert">
            {error}
          </p>
        ) : null}
        <div className="flex flex-wrap justify-end gap-3">
          <Button onClick={onClose} variant="quiet">
            Cancel
          </Button>
          {!reviewing ? (
            <Button onClick={() => setReviewing(true)} variant="dark">
              Review result
            </Button>
          ) : (
            <Button disabled={busy} onClick={() => void save()} variant="dark">
              Confirm and save
            </Button>
          )}
        </div>
      </div>
    </Modal>
  );
}

function StandingsTable({
  run,
  participants,
}: {
  run: AllHandsCompetitionRun;
  participants: Participant[];
}) {
  const standings = deriveAllHandsStandings(run);
  return (
    <section aria-labelledby="all-hands-standings-title">
      <h4 className="text-xl font-extrabold" id="all-hands-standings-title">
        Competition standings
      </h4>
      <div className="mt-3 overflow-x-auto rounded-2xl border border-white/10">
        <table className="w-full min-w-[42rem] border-collapse text-left text-sm">
          <thead className="bg-white/5 text-xs tracking-wide text-white/52 uppercase">
            <tr>
              <th className="px-3 py-3">Rank</th>
              <th className="px-3 py-3">Participant</th>
              <th className="px-3 py-3">Sessions</th>
              <th className="px-3 py-3">Wins</th>
              <th className="px-3 py-3">2nd</th>
              <th className="px-3 py-3">3rd</th>
              <th className="px-3 py-3">Average</th>
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
                <td className="max-w-48 truncate px-3 py-3 font-bold">
                  {participantName(participants, row.participantId)}
                </td>
                <td className="px-3 py-3 tabular-nums">{row.sessionsPlayed}</td>
                <td className="px-3 py-3 tabular-nums">{row.sessionWins}</td>
                <td className="px-3 py-3 tabular-nums">
                  {row.secondPlaceFinishes}
                </td>
                <td className="px-3 py-3 tabular-nums">
                  {row.thirdPlaceFinishes}
                </td>
                <td className="px-3 py-3 tabular-nums">
                  {row.averagePlacement?.toFixed(2) ?? "—"}
                </td>
                <td className="px-3 py-3 font-black tabular-nums text-[var(--color-electric-cyan-400)]">
                  {row.competitionPoints}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export function AllHandsControlRoom({
  competition,
  run,
  participants,
  onBack,
}: {
  competition: PublishedCompetition;
  run: AllHandsCompetitionRun;
  participants: Participant[];
  onBack: () => void;
}) {
  const competitions = useCompetitions();
  const [creating, setCreating] = useState(false);
  const [resultSession, setResultSession] = useState<AllHandsSession | null>(
    null,
  );
  const [confirmAction, setConfirmAction] = useState<
    | { kind: "void" | "restore" | "delete"; session: AllHandsSession }
    | { kind: "complete" | "reopen" | "reset" }
    | null
  >(null);
  const [voidReason, setVoidReason] = useState("Result withdrawn by organizer");
  const [tieOrder, setTieOrder] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const standings = deriveAllHandsStandings(run);
  const pointBreakdown = deriveAllHandsCompetitionPointBreakdown(run);
  const sessions = useMemo(
    () =>
      Object.values(run.sessions).sort(
        (left, right) => left.sequence - right.sequence,
      ),
    [run.sessions],
  );
  const firstTie = standings.unresolvedTieGroups.find((group) =>
    group.some(
      (id) =>
        (standings.rows.find((row) => row.participantId === id)?.rank ?? 99) <=
        3,
    ),
  );
  const completeReview = canReviewAllHandsCompletion(run);
  const action = async (callback: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await callback();
    } catch (nextError) {
      setError(
        nextError instanceof Error
          ? nextError.message
          : "The operation failed.",
      );
    } finally {
      setBusy(false);
    }
  };
  return (
    <section aria-labelledby="all-hands-control-title">
      <Button onClick={onBack} variant="quiet">
        <ArrowLeft aria-hidden="true" size={16} /> Back to Studio
      </Button>
      <div className="mt-5 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-bold tracking-[0.14em] text-[var(--color-electric-cyan-400)] uppercase">
            All Hands Table
          </p>
          <h3
            className="mt-2 text-2xl font-extrabold"
            id="all-hands-control-title"
          >
            {competition.title}
          </h3>
          <p className="mt-1 text-sm text-white/58">
            {competition.gameName} ·{" "}
            {run.configSnapshot.resultMode.replaceAll("-", " ")} · Revision{" "}
            {run.revision}
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
          {run.stage.replaceAll("-", " ")}
        </StatusBadge>
      </div>
      <div className="mt-6 grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-4">
          <span className="text-xs text-white/42">Completed sessions</span>
          <strong className="mt-1 block text-2xl">
            {
              sessions.filter((session) => session.status === "completed")
                .length
            }
          </strong>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-4">
          <span className="text-xs text-white/42">Eligible players</span>
          <strong className="mt-1 block text-2xl">
            {run.eligibleParticipantIds.length}
          </strong>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-4">
          <span className="text-xs text-white/42">Plan</span>
          <strong className="mt-1 block text-lg">
            {run.configSnapshot.sessionPlan.kind === "fixed"
              ? `${run.configSnapshot.sessionPlan.plannedSessionCount} fixed`
              : "Open-ended"}
          </strong>
        </div>
      </div>
      {error ? (
        <p
          className="mt-4 rounded-xl border border-[#ff9ca1]/25 bg-[#ff9ca1]/8 p-4 text-sm text-[#ffc3c6]"
          role="alert"
        >
          {error}
        </p>
      ) : null}
      <div className="mt-6 flex flex-wrap gap-2">
        {run.stage !== "completed" ? (
          <Button
            disabled={!competitions.canMutate}
            onClick={() => setCreating(true)}
            variant="dark"
          >
            <CirclePlus aria-hidden="true" size={16} /> Create session
          </Button>
        ) : null}
        {run.resultCount === 0 && run.stage !== "completed" ? (
          <Button
            disabled={!competitions.canMutate}
            onClick={() => setConfirmAction({ kind: "reset" })}
            variant="quiet"
          >
            <RotateCcw aria-hidden="true" size={16} /> Reset pre-result run
          </Button>
        ) : null}
        {run.stage === "sessions" ? (
          <Button
            disabled={!competitions.canMutate || !completeReview.allowed}
            onClick={() =>
              void action(() => competitions.reviewAllHandsCompletion(run))
            }
            variant="quiet"
          >
            Review completion
          </Button>
        ) : null}
        {run.stage === "completion-review" ? (
          <Button
            disabled={!competitions.canMutate || Boolean(firstTie)}
            onClick={() => setConfirmAction({ kind: "complete" })}
            variant="dark"
          >
            <Trophy aria-hidden="true" size={16} /> Complete competition
          </Button>
        ) : null}
        {run.stage === "completed" ? (
          <Button
            disabled={!competitions.canMutate}
            onClick={() => setConfirmAction({ kind: "reopen" })}
            variant="quiet"
          >
            <RotateCcw aria-hidden="true" size={16} /> Reopen competition
          </Button>
        ) : null}
      </div>
      {!completeReview.allowed && run.stage !== "completed" ? (
        <p className="mt-2 text-xs text-white/45">{completeReview.reason}</p>
      ) : null}
      <div className="mt-8 grid gap-4">
        <div className="flex items-center justify-between gap-3">
          <h4 className="text-xl font-extrabold">Session deck</h4>
          <span className="text-sm text-white/45">{sessions.length} total</span>
        </div>
        {sessions.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-white/15 p-8 text-center">
            <Users aria-hidden="true" className="mx-auto text-white/35" />
            <p className="mt-3 font-bold">No sessions yet</p>
            <p className="mt-1 text-sm text-white/48">
              Create a pending session or start the table immediately.
            </p>
          </div>
        ) : (
          sessions.map((session) => {
            const missing = session.participantIds.filter((id) =>
              participantIssue(participants, id),
            );
            return (
              <article
                className={`rounded-2xl border p-4 ${session.status === "in-progress" ? "border-[var(--color-electric-cyan-400)] bg-[var(--color-electric-cyan-400)]/8" : "border-white/10 bg-white/[0.035]"}`}
                key={session.id}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <span className="text-xs text-white/40">
                      Session {session.sequence}
                    </span>
                    <h5 className="mt-1 font-extrabold">{session.title}</h5>
                    <p className="mt-1 text-sm text-white/52">
                      {session.mode === "team"
                        ? `${Object.keys(session.teams).length} teams`
                        : `${session.participantIds.length} participants`}
                    </p>
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
                    {session.status.replaceAll("-", " ")}
                  </StatusBadge>
                </div>
                <div className="mt-3 flex flex-wrap gap-2 text-xs text-white/58">
                  {session.mode === "team"
                    ? Object.values(session.teams).map((team) => (
                        <span
                          className="rounded-full border border-white/10 px-3 py-1"
                          key={team.id}
                        >
                          {team.name}:{" "}
                          {team.participantIds
                            .map((id) => participantName(participants, id))
                            .join(", ")}
                        </span>
                      ))
                    : session.participantIds.map((id) => (
                        <span
                          className="rounded-full border border-white/10 px-3 py-1"
                          key={id}
                        >
                          {participantName(participants, id)}
                        </span>
                      ))}
                </div>
                {missing.length ? (
                  <p className="mt-3 flex items-center gap-2 text-xs text-[var(--color-warning-500)]">
                    <AlertTriangle aria-hidden="true" size={15} /> Missing or
                    inactive runtime participant; starting is blocked.
                  </p>
                ) : null}
                {session.status === "voided" ? (
                  <p className="mt-3 text-sm text-[var(--color-warning-500)]">
                    Excluded: {session.voidReason}
                  </p>
                ) : null}
                {session.result ? (
                  <p className="mt-3 text-sm text-white/58">
                    Result revision {session.result.resultRevision} ·{" "}
                    {session.result.kind.replaceAll("-", " ")}
                  </p>
                ) : null}
                <div className="mt-4 flex flex-wrap gap-2 border-t border-white/8 pt-3">
                  {session.status === "pending" ? (
                    <>
                      <Button
                        disabled={!competitions.canMutate || missing.length > 0}
                        onClick={() =>
                          void action(() =>
                            competitions.startAllHandsSession(
                              run,
                              session.id,
                              session.revision,
                            ),
                          )
                        }
                        variant="dark"
                      >
                        <Play aria-hidden="true" size={16} /> Start
                      </Button>
                      <Button
                        disabled={!competitions.canMutate}
                        onClick={() =>
                          setConfirmAction({ kind: "delete", session })
                        }
                        variant="quiet"
                      >
                        <Trash2 aria-hidden="true" size={16} /> Delete
                      </Button>
                    </>
                  ) : null}
                  {session.status === "in-progress" ? (
                    <>
                      <Button
                        disabled={!competitions.canMutate}
                        onClick={() => setResultSession(session)}
                        variant="dark"
                      >
                        Enter result
                      </Button>
                      <Button
                        disabled={!competitions.canMutate}
                        onClick={() =>
                          void action(() =>
                            competitions.returnAllHandsSessionToPending(
                              run,
                              session.id,
                              session.revision,
                            ),
                          )
                        }
                        variant="quiet"
                      >
                        Return to pending
                      </Button>
                    </>
                  ) : null}
                  {session.status === "completed" ? (
                    <>
                      <Button
                        disabled={
                          !competitions.canMutate || run.stage === "completed"
                        }
                        onClick={() => setResultSession(session)}
                        variant="quiet"
                      >
                        Correct result
                      </Button>
                      <Button
                        disabled={
                          !competitions.canMutate || run.stage === "completed"
                        }
                        onClick={() =>
                          setConfirmAction({ kind: "void", session })
                        }
                        variant="quiet"
                      >
                        Void
                      </Button>
                    </>
                  ) : null}
                  {session.status === "voided" ? (
                    <Button
                      disabled={
                        !competitions.canMutate || run.stage === "completed"
                      }
                      onClick={() =>
                        setConfirmAction({ kind: "restore", session })
                      }
                      variant="quiet"
                    >
                      <RotateCcw aria-hidden="true" size={16} /> Restore
                    </Button>
                  ) : null}
                </div>
              </article>
            );
          })
        )}
      </div>
      <div className="mt-10">
        <StandingsTable participants={participants} run={run} />
      </div>
      {run.stage === "completion-review" && firstTie ? (
        <section
          className="mt-8 rounded-2xl border border-[var(--color-warning-500)]/30 bg-[var(--color-warning-500)]/7 p-5"
          aria-labelledby="final-tie-title"
        >
          <h4 className="font-extrabold" id="final-tie-title">
            Final podium tie requires an organizer order
          </h4>
          <p className="mt-2 text-sm text-white/58">
            Automatic points, wins, placement counts, and comparable average
            placement remain equal.
          </p>
          <div className="mt-4 space-y-2">
            {(tieOrder.length ? tieOrder : firstTie).map(
              (id, index, current) => (
                <div
                  className="flex items-center gap-2 rounded-xl border border-white/12 p-2"
                  key={id}
                >
                  <span className="min-w-0 flex-1 truncate">
                    {participantName(participants, id)}
                  </span>
                  <Button
                    aria-label={`Move ${participantName(participants, id)} up`}
                    disabled={index === 0}
                    onClick={() =>
                      setTieOrder(
                        move(tieOrder.length ? tieOrder : firstTie, index, -1),
                      )
                    }
                    variant="quiet"
                  >
                    <ArrowUp aria-hidden="true" size={16} />
                  </Button>
                  <Button
                    aria-label={`Move ${participantName(participants, id)} down`}
                    disabled={index === current.length - 1}
                    onClick={() =>
                      setTieOrder(
                        move(tieOrder.length ? tieOrder : firstTie, index, 1),
                      )
                    }
                    variant="quiet"
                  >
                    <ArrowDown aria-hidden="true" size={16} />
                  </Button>
                </div>
              ),
            )}
          </div>
          <Button
            className="mt-4"
            disabled={!competitions.canMutate}
            onClick={() =>
              void action(() =>
                competitions.resolveAllHandsTie(
                  run,
                  firstTie,
                  tieOrder.length ? tieOrder : firstTie,
                  null,
                ),
              )
            }
            variant="dark"
          >
            Confirm tie order
          </Button>
        </section>
      ) : null}
      <section className="mt-10" aria-labelledby="projected-points-title">
        <h4 className="text-xl font-extrabold" id="projected-points-title">
          Projected weekend points
        </h4>
        <p className="mt-1 text-sm text-white/48">
          These itemized All Hands awards rank this competition and preview its
          future Phase 7 contribution. No global leaderboard is live yet.
        </p>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {pointBreakdown.map((breakdown) => (
            <details
              className="rounded-2xl border border-white/10 bg-white/[0.035] p-4"
              key={breakdown.participantId}
            >
              <summary className="cursor-pointer font-bold">
                {participantName(participants, breakdown.participantId)} ·{" "}
                {breakdown.total} points
              </summary>
              <ul className="mt-3 space-y-2 text-sm text-white/58">
                {breakdown.items.length ? (
                  breakdown.items.map((item) => (
                    <li className="flex justify-between gap-3" key={item.id}>
                      <span>
                        {item.sessionLabel}: {item.label}
                      </span>
                      <strong className="text-white">+{item.points}</strong>
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
      {run.stage === "completed" && run.placements ? (
        <section
          className="mt-10 rounded-3xl border border-[var(--color-antique-gold-400)]/30 bg-[var(--color-antique-gold-400)]/8 p-6 text-center"
          aria-labelledby="all-hands-champion"
        >
          <CheckCircle2
            aria-hidden="true"
            className="mx-auto text-[var(--color-antique-gold-400)]"
            size={34}
          />
          <p className="mt-3 text-xs tracking-[0.16em] text-[var(--color-antique-gold-400)] uppercase">
            Final All Hands result
          </p>
          <h4 className="font-display mt-2 text-3xl" id="all-hands-champion">
            Champion:{" "}
            {participantName(
              participants,
              run.placements.entries.find((entry) => entry.place === 1)
                ?.participantId ?? "",
            )}
          </h4>
          <p className="mt-2 text-sm text-white/58">
            Runner-up:{" "}
            {participantName(
              participants,
              run.placements.entries.find((entry) => entry.place === 2)
                ?.participantId ?? "",
            )}{" "}
            · Third:{" "}
            {participantName(
              participants,
              run.placements.entries.find((entry) => entry.place === 3)
                ?.participantId ?? "",
            )}
          </p>
        </section>
      ) : null}
      <NewSessionDialog
        key={creating ? "open" : "closed"}
        onClose={() => setCreating(false)}
        open={creating}
        participants={participants}
        run={run}
      />
      {resultSession ? (
        <ResultDialog
          onClose={() => setResultSession(null)}
          participants={participants}
          run={run}
          session={resultSession}
        />
      ) : null}
      <Modal
        description={
          confirmAction?.kind === "void"
            ? "The result remains preserved but stops contributing to standings and projected points."
            : confirmAction?.kind === "restore"
              ? "The preserved result is revalidated and returns to standings."
              : confirmAction?.kind === "delete"
                ? "Only this unstarted pending session is removed."
                : confirmAction?.kind === "complete"
                  ? "Final placements are persisted and the competition becomes read-only."
                  : confirmAction?.kind === "reopen"
                    ? "All sessions remain; final metadata and tie decisions are cleared before further edits."
                    : "The runtime is removed and the unchanged Phase 3 configuration returns to scheduled."
        }
        onClose={() => setConfirmAction(null)}
        open={confirmAction !== null}
        title={
          confirmAction?.kind === "void"
            ? "Void this completed session?"
            : confirmAction?.kind === "restore"
              ? "Restore this session?"
              : confirmAction?.kind === "delete"
                ? "Delete this pending session?"
                : confirmAction?.kind === "complete"
                  ? "Complete All Hands?"
                  : confirmAction?.kind === "reopen"
                    ? "Reopen this completed competition?"
                    : "Reset this pre-result run?"
        }
      >
        {confirmAction?.kind === "void" ? (
          <label className={labelClass}>
            Void reason
            <input
              className={inputClass}
              maxLength={competitionLimits.resultNote}
              onChange={(event) => setVoidReason(event.target.value)}
              value={voidReason}
            />
          </label>
        ) : null}
        {confirmAction?.kind === "reopen" ? (
          <p className="rounded-xl border border-[var(--color-warning-500)]/30 p-4 text-sm">
            <strong>Strong confirmation:</strong> correcting a completed result
            is blocked until this explicit reopen succeeds.
          </p>
        ) : null}
        <div className="mt-5 flex justify-end gap-3">
          <Button onClick={() => setConfirmAction(null)} variant="quiet">
            Cancel
          </Button>
          <Button
            disabled={busy}
            onClick={() => {
              const pending = confirmAction;
              if (!pending) return;
              void action(async () => {
                if (pending.kind === "void")
                  await competitions.voidAllHandsSession(
                    run,
                    pending.session.id,
                    pending.session.revision,
                    voidReason,
                  );
                else if (pending.kind === "restore")
                  await competitions.restoreAllHandsSession(
                    run,
                    pending.session.id,
                    pending.session.revision,
                  );
                else if (pending.kind === "delete")
                  await competitions.deleteAllHandsSession(
                    run,
                    pending.session.id,
                    pending.session.revision,
                  );
                else if (pending.kind === "complete")
                  await competitions.completeAllHands(competition, run);
                else if (pending.kind === "reopen")
                  await competitions.reopenAllHands(competition, run);
                else await competitions.resetAllHands(competition, run);
                setConfirmAction(null);
              });
            }}
            variant="dark"
          >
            Confirm
          </Button>
        </div>
      </Modal>
    </section>
  );
}
