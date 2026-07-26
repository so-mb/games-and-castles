import { useMemo, useState } from "react";
import {
  AlertTriangle,
  Archive,
  ArrowDown,
  ArrowUp,
  Copy,
  FilePenLine,
  Plus,
  Play,
  RotateCcw,
  Send,
  Trash2,
} from "lucide-react";
import { Button } from "../../../components/ui/Button";
import { ContentIcon } from "../../../components/ui/ContentIcon";
import { Modal } from "../../../components/ui/Modal";
import { StatusBadge } from "../../../components/ui/StatusBadge";
import { useParticipants } from "../../participants/ParticipantsProvider";
import { useCompetitions } from "../CompetitionsProvider";
import { formatPresentation } from "../domain/config";
import {
  participantReferenceWarnings,
  validateCompetition,
} from "../domain/validation";
import type {
  CompetitionDraft,
  CompetitionRecord,
  PublishedCompetition,
} from "../domain/types";
import { CompetitionWizard } from "../wizard/CompetitionWizard";
import type { CompetitionRun } from "../engine/types";
import {
  ActivationReview,
  MerryGoRoundControlRoom,
} from "./MerryGoRoundControlRoom";

type StudioTab = "drafts" | "scheduled" | "active" | "completed" | "archived";
type PendingAction =
  | { kind: "delete"; record: CompetitionDraft }
  | { kind: "archive"; record: PublishedCompetition }
  | { kind: "restore"; record: PublishedCompetition }
  | null;

function updatedLabel(timestamp: number) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(timestamp);
}

function validationCount(
  record: CompetitionRecord,
  participants: ReturnType<typeof useParticipants>["organizerParticipants"],
) {
  return (
    validateCompetition(record, "publish").length +
    participantReferenceWarnings(record.participantIds, participants).length
  );
}

function StudioCard({
  record,
  warningCount,
  actions,
}: {
  record: CompetitionRecord;
  warningCount: number;
  actions: React.ReactNode;
}) {
  return (
    <article className="rounded-2xl border border-white/10 bg-white/[0.035] p-4">
      <div className="flex items-start gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-[var(--color-electric-cyan-400)]">
          <ContentIcon name={record.iconKey} size={20} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h4 className="truncate font-extrabold">
              {record.title || "Untitled draft"}
            </h4>
            <StatusBadge
              tone={
                record.status === "scheduled"
                  ? "live"
                  : record.status === "archived"
                    ? "neutral"
                    : "gold"
              }
            >
              {record.status}
            </StatusBadge>
          </div>
          <p className="mt-1 text-sm text-white/58">
            {record.gameName || "Game name not set"} ·{" "}
            {formatPresentation[record.format].label}
          </p>
          <p className="mt-1 text-xs text-white/40">
            {record.participantIds.length} players · Revision {record.revision}{" "}
            · {updatedLabel(record.updatedAt)}
          </p>
          {warningCount > 0 ? (
            <p className="mt-3 flex items-center gap-2 text-xs font-semibold text-[var(--color-warning-500)]">
              <AlertTriangle aria-hidden="true" size={15} />
              {warningCount} validation note{warningCount === 1 ? "" : "s"}
            </p>
          ) : null}
        </div>
      </div>
      <div className="mt-4 flex flex-wrap gap-2 border-t border-white/8 pt-3">
        {actions}
      </div>
    </article>
  );
}

export function CompetitionStudio() {
  const competitions = useCompetitions();
  const participants = useParticipants();
  const [tab, setTab] = useState<StudioTab>("drafts");
  const [editor, setEditor] = useState<CompetitionRecord | "new" | null>(null);
  const [viewing, setViewing] = useState<PublishedCompetition | null>(null);
  const [activating, setActivating] = useState<PublishedCompetition | null>(
    null,
  );
  const [controlling, setControlling] = useState<PublishedCompetition | null>(
    null,
  );
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const selectedRecords =
    tab === "drafts"
      ? competitions.drafts
      : tab === "scheduled"
        ? competitions.scheduled
        : tab === "active"
          ? competitions.active
          : tab === "completed"
            ? competitions.completed
            : competitions.archived;

  const latestEditor = useMemo(() => {
    if (!editor || editor === "new") return null;
    return (
      [
        ...competitions.drafts,
        ...competitions.scheduled,
        ...competitions.active,
        ...competitions.completed,
        ...competitions.archived,
      ].find((record) => record.id === editor.id) ?? null
    );
  }, [
    competitions.archived,
    competitions.active,
    competitions.completed,
    competitions.drafts,
    competitions.scheduled,
    editor,
  ]);

  const controlledRun: CompetitionRun | null = controlling
    ? (competitions.runs.find((run) => run.competitionId === controlling.id) ??
      null)
    : null;

  if (activating) {
    const latest = competitions.scheduled.find(
      (competition) => competition.id === activating.id,
    );
    return latest ? (
      <ActivationReview
        competition={latest}
        onBack={() => setActivating(null)}
        onActivated={() => {
          setActivating(null);
          setTab("active");
        }}
        participants={participants.organizerParticipants}
      />
    ) : (
      <p role="status">Activation accepted. Loading the Control Room…</p>
    );
  }

  if (controlling) {
    const latest = [...competitions.active, ...competitions.completed].find(
      (competition) => competition.id === controlling.id,
    );
    return latest && controlledRun ? (
      <MerryGoRoundControlRoom
        competition={latest}
        onBack={() => setControlling(null)}
        participants={participants.organizerParticipants}
        run={controlledRun}
      />
    ) : (
      <div>
        <Button onClick={() => setControlling(null)} variant="quiet">
          Back to Studio
        </Button>
        <p
          className="mt-5 rounded-xl border border-[var(--color-warning-500)]/30 p-4 text-sm text-[var(--color-warning-500)]"
          role="alert"
        >
          This competition runtime is unavailable or malformed.
        </p>
      </div>
    );
  }

  const perform = async (id: string, action: () => Promise<unknown>) => {
    if (busyId) return;
    setBusyId(id);
    setActionError(null);
    try {
      await action();
    } catch (error) {
      setActionError(
        error instanceof Error
          ? error.message
          : "The competition action failed.",
      );
    } finally {
      setBusyId(null);
    }
  };

  if (editor) {
    return (
      <CompetitionWizard
        canMutate={competitions.canMutate}
        latestRecord={latestEditor}
        onCancel={() => setEditor(null)}
        onPublish={async (record, values) => {
          await competitions.publish(record, values);
        }}
        onSaveDraft={async (record, values) => {
          await competitions.saveDraft(record, values);
        }}
        onSaveScheduled={async (record, values) => {
          await competitions.saveScheduled(record, values);
        }}
        participants={participants.organizerParticipants}
        record={editor === "new" ? null : editor}
      />
    );
  }

  if (viewing) {
    return (
      <div>
        <div className="flex items-start justify-between gap-4">
          <div>
            <StatusBadge tone="neutral">Archived</StatusBadge>
            <h3 className="mt-3 text-2xl font-extrabold">{viewing.title}</h3>
            <p className="mt-1 text-sm text-white/58">
              {viewing.gameName} · {formatPresentation[viewing.format].label}
            </p>
          </div>
          <ContentIcon name={viewing.iconKey} size={28} />
        </div>
        <dl className="mt-6 grid gap-4 rounded-2xl border border-white/10 bg-white/[0.035] p-5 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-white/42">Participants</dt>
            <dd className="mt-1 font-bold">{viewing.participantIds.length}</dd>
          </div>
          <div>
            <dt className="text-white/42">Revision</dt>
            <dd className="mt-1 font-bold">{viewing.revision}</dd>
          </div>
          <div>
            <dt className="text-white/42">Published</dt>
            <dd className="mt-1 font-bold">
              {updatedLabel(viewing.publishedAt)}
            </dd>
          </div>
          <div>
            <dt className="text-white/42">Play state</dt>
            <dd className="mt-1 font-bold">No fixtures or results</dd>
          </div>
        </dl>
        <div className="mt-6 flex flex-wrap justify-end gap-3">
          <Button onClick={() => setViewing(null)} variant="quiet">
            Back to archive
          </Button>
          <Button
            disabled={!competitions.canMutate}
            onClick={() =>
              setPendingAction({ kind: "restore", record: viewing })
            }
            variant="dark"
          >
            <RotateCcw aria-hidden="true" size={17} />
            Restore
          </Button>
        </div>
      </div>
    );
  }

  return (
    <section aria-labelledby="competition-studio-title">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-bold tracking-[0.14em] text-[var(--color-electric-cyan-400)] uppercase">
            Game-master console
          </p>
          <h3
            className="mt-2 text-2xl font-extrabold"
            id="competition-studio-title"
          >
            Competition Studio
          </h3>
          <p className="mt-2 max-w-xl text-sm leading-6 text-white/55">
            Configure the flexible Friday order, then activate Merry-Go-Round
            competitions and control their live results here.
          </p>
        </div>
        <Button
          disabled={!competitions.canMutate}
          onClick={() => setEditor("new")}
          variant="dark"
        >
          <Plus aria-hidden="true" size={17} />
          New competition
        </Button>
      </div>

      <div className="mt-6 flex gap-2 overflow-x-auto pb-2" role="tablist">
        {(
          [
            ["drafts", "Drafts", competitions.drafts.length],
            ["scheduled", "Scheduled", competitions.scheduled.length],
            ["active", "Active", competitions.active.length],
            ["completed", "Completed", competitions.completed.length],
            ["archived", "Archived", competitions.archived.length],
          ] as const
        ).map(([id, label, count]) => (
          <button
            aria-selected={tab === id}
            className={`min-h-11 rounded-full border px-4 text-sm font-bold focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-[var(--color-electric-cyan-400)] ${
              tab === id
                ? "border-[var(--color-electric-cyan-400)] bg-[var(--color-electric-cyan-400)]/12 text-[var(--color-electric-cyan-400)]"
                : "border-white/10 text-white/55"
            }`}
            key={id}
            onClick={() => setTab(id)}
            role="tab"
            type="button"
          >
            {label} · {count}
          </button>
        ))}
      </div>

      {actionError || competitions.errorMessage ? (
        <p
          className="mt-4 rounded-xl border border-[#ff9ca1]/25 bg-[#ff9ca1]/8 p-4 text-sm text-[#ffc3c6]"
          role="alert"
        >
          {actionError ?? competitions.errorMessage}
        </p>
      ) : null}
      {competitions.organizerMalformedCount > 0 ? (
        <p
          className="mt-4 flex items-center gap-2 rounded-xl border border-[var(--color-warning-500)]/30 bg-[var(--color-warning-500)]/8 p-4 text-sm text-[var(--color-warning-500)]"
          role="alert"
        >
          <AlertTriangle aria-hidden="true" size={18} />
          Malformed remote competition data was safely omitted.
        </p>
      ) : null}

      {competitions.organizerState === "loading" ? (
        <p className="py-12 text-center text-sm text-white/55" role="status">
          Loading Competition Studio…
        </p>
      ) : selectedRecords.length === 0 ? (
        <div className="mt-5 rounded-2xl border border-dashed border-white/15 p-8 text-center">
          <ContentIcon
            className="mx-auto text-white/35"
            name="trophy"
            size={28}
          />
          <h4 className="mt-3 font-extrabold">
            No{" "}
            {tab === "drafts"
              ? "drafts"
              : tab === "scheduled"
                ? "scheduled games"
                : tab === "active"
                  ? "active games"
                  : tab === "completed"
                    ? "completed games"
                    : "archived games"}
          </h4>
          <p className="mt-1 text-sm text-white/48">
            {tab === "drafts"
              ? "Create a private draft to begin."
              : tab === "scheduled"
                ? "Published competition configurations appear here."
                : tab === "active"
                  ? "Activated Merry-Go-Round competitions appear here."
                  : tab === "completed"
                    ? "Completed competitions stay available as read-only history."
                    : "Archived competitions stay preserved here."}
          </p>
        </div>
      ) : (
        <div className="mt-5 grid gap-3 lg:grid-cols-2" role="tabpanel">
          {selectedRecords.map((record, index) => (
            <StudioCard
              actions={
                record.status === "draft" ? (
                  <>
                    <Button onClick={() => setEditor(record)} variant="quiet">
                      <FilePenLine aria-hidden="true" size={16} /> Edit
                    </Button>
                    <Button
                      disabled={!competitions.canMutate || busyId === record.id}
                      onClick={() =>
                        void perform(record.id, () =>
                          competitions.duplicate(record),
                        )
                      }
                      variant="quiet"
                    >
                      <Copy aria-hidden="true" size={16} /> Duplicate
                    </Button>
                    <Button onClick={() => setEditor(record)} variant="quiet">
                      <Send aria-hidden="true" size={16} /> Publish
                    </Button>
                    <Button
                      disabled={!competitions.canMutate}
                      onClick={() =>
                        setPendingAction({ kind: "delete", record })
                      }
                      variant="quiet"
                    >
                      <Trash2 aria-hidden="true" size={16} /> Delete
                    </Button>
                  </>
                ) : record.status === "scheduled" ? (
                  <>
                    <Button onClick={() => setEditor(record)} variant="quiet">
                      <FilePenLine aria-hidden="true" size={16} /> Edit
                    </Button>
                    <Button
                      aria-label={`Move ${record.title} earlier`}
                      disabled={
                        !competitions.canMutate ||
                        index === 0 ||
                        busyId === record.id
                      }
                      onClick={() =>
                        void perform(record.id, () =>
                          competitions.reorder(record.id, "earlier"),
                        )
                      }
                      variant="quiet"
                    >
                      <ArrowUp aria-hidden="true" size={16} /> Earlier
                    </Button>
                    <Button
                      aria-label={`Move ${record.title} later`}
                      disabled={
                        !competitions.canMutate ||
                        index === selectedRecords.length - 1 ||
                        busyId === record.id
                      }
                      onClick={() =>
                        void perform(record.id, () =>
                          competitions.reorder(record.id, "later"),
                        )
                      }
                      variant="quiet"
                    >
                      <ArrowDown aria-hidden="true" size={16} /> Later
                    </Button>
                    <Button
                      disabled={
                        !competitions.canMutate ||
                        record.format !== "round-robin-knockout"
                      }
                      onClick={() => setActivating(record)}
                      variant="dark"
                    >
                      <Play aria-hidden="true" size={16} />
                      {record.format === "round-robin-knockout"
                        ? "Activate"
                        : "Engine coming later"}
                    </Button>
                    <Button
                      disabled={!competitions.canMutate}
                      onClick={() =>
                        setPendingAction({ kind: "archive", record })
                      }
                      variant="quiet"
                    >
                      <Archive aria-hidden="true" size={16} /> Archive
                    </Button>
                  </>
                ) : record.status === "active" ||
                  record.status === "completed" ? (
                  <Button onClick={() => setControlling(record)} variant="dark">
                    <Play aria-hidden="true" size={16} />
                    {record.status === "completed"
                      ? "View result"
                      : "Open Control Room"}
                  </Button>
                ) : (
                  <>
                    <Button onClick={() => setViewing(record)} variant="quiet">
                      View
                    </Button>
                    <Button
                      disabled={!competitions.canMutate}
                      onClick={() =>
                        setPendingAction({ kind: "restore", record })
                      }
                      variant="quiet"
                    >
                      <RotateCcw aria-hidden="true" size={16} /> Restore
                    </Button>
                  </>
                )
              }
              key={record.id}
              record={record}
              warningCount={validationCount(
                record,
                participants.organizerParticipants,
              )}
            />
          ))}
        </div>
      )}

      <Modal
        description={
          pendingAction?.kind === "delete"
            ? "This private draft has no fixtures or results. Deletion cannot be undone."
            : pendingAction?.kind === "archive"
              ? "The competition will leave the public scheduled list but remain preserved in Firebase."
              : "The competition will return to the public scheduled list without a fixed time."
        }
        onClose={() => setPendingAction(null)}
        open={pendingAction !== null}
        title={
          pendingAction?.kind === "delete"
            ? "Delete this draft?"
            : pendingAction?.kind === "archive"
              ? "Archive this competition?"
              : "Restore this competition?"
        }
      >
        <div className="flex flex-wrap justify-end gap-3">
          <Button onClick={() => setPendingAction(null)} variant="quiet">
            Cancel
          </Button>
          <Button
            disabled={!competitions.canMutate || busyId !== null}
            onClick={() => {
              const action = pendingAction;
              if (!action) return;
              void perform(action.record.id, async () => {
                if (action.kind === "delete")
                  await competitions.deleteDraft(action.record);
                else if (action.kind === "archive")
                  await competitions.archive(action.record);
                else await competitions.restore(action.record);
                setPendingAction(null);
                setViewing(null);
              });
            }}
            variant="dark"
          >
            {pendingAction?.kind === "delete"
              ? "Delete draft"
              : pendingAction?.kind === "archive"
                ? "Archive competition"
                : "Restore competition"}
          </Button>
        </div>
      </Modal>
    </section>
  );
}
