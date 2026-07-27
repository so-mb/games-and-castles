import {
  get,
  onValue,
  push,
  ref,
  update,
  type Database,
  type Unsubscribe,
} from "firebase/database";
import type {
  CompetitionAuditEntry,
  ParticipantReference,
  PublishedCompetition,
} from "../domain/types";
import { parseCompetitionRecord } from "../domain/runtime";
import { createCompetitionRun, reviewActivation } from "../engine/activation";
import {
  completeCompetitionRun,
  generateRunKnockout,
  recordMatchResult,
  reopenCompetitionRun,
  resolveRunTie,
  returnMatchToPending,
  setMatchInProgress,
  type RecordResultOptions,
} from "../engine/lifecycle";
import {
  parseCompetitionRun,
  parseCompetitionRunCollection,
} from "../engine/runtime";
import type { AnyCompetitionRun, CompetitionRun } from "../engine/types";

export class CompetitionRunConflictError extends Error {
  constructor() {
    super(
      "This competition changed on another device. Reload the latest state before continuing.",
    );
    this.name = "CompetitionRunConflictError";
  }
}

const phaseFourAuditActions = new Set<CompetitionAuditEntry["action"]>([
  "competition-activated",
  "draw-fixtures-generated",
  "competition-run-reset",
  "match-started",
  "match-returned-to-pending",
  "match-result-recorded",
  "match-result-corrected",
  "session-created",
  "session-started",
  "session-returned-to-pending",
  "session-result-recorded",
  "session-result-corrected",
  "session-voided",
  "session-restored",
  "session-deleted",
  "completion-review-opened",
  "tie-resolved",
  "tie-resolution-invalidated",
  "knockout-generated",
  "knockout-reset",
  "downstream-results-cascaded",
  "competition-completed",
  "competition-reopened",
]);

function parsePhaseFourAuditEntries(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return [];
  return Object.entries(value)
    .flatMap(([id, raw]) => {
      if (!raw || typeof raw !== "object" || Array.isArray(raw)) return [];
      const entry = raw as Partial<CompetitionAuditEntry>;
      if (
        entry.id !== id ||
        !entry.action ||
        !phaseFourAuditActions.has(entry.action) ||
        entry.entityType !== "competition" ||
        typeof entry.entityId !== "string" ||
        typeof entry.actorUid !== "string" ||
        typeof entry.occurredAt !== "number" ||
        typeof entry.summary !== "string" ||
        entry.schemaVersion !== 1
      ) {
        return [];
      }
      return [entry as CompetitionAuditEntry];
    })
    .sort((left, right) => right.occurredAt - left.occurredAt);
}

function runWriteError() {
  return new Error(
    "Firebase rejected the competition operation. Reload the latest state and review it before trying again.",
  );
}

function auditValue(
  id: string,
  action: string,
  competitionId: string,
  uid: string,
  beforeRevision: number | null,
  afterRevision: number | null,
  summary: string,
  now: number,
) {
  return {
    id,
    action,
    entityType: "competition",
    entityId: competitionId,
    actorUid: uid,
    ...(beforeRevision === null ? {} : { beforeRevision }),
    ...(afterRevision === null ? {} : { afterRevision }),
    occurredAt: now,
    summary,
    schemaVersion: 1,
  };
}

function createAuditKey(database: Database) {
  const auditRef = push(ref(database, "audit"));
  if (!auditRef.key) throw new Error("Could not create an audit entry.");
  return auditRef.key;
}

async function readRun(database: Database, competitionId: string) {
  const snapshot = await get(ref(database, `competitionRuns/${competitionId}`));
  return parseCompetitionRun(snapshot.val());
}

async function readCompetition(database: Database, competitionId: string) {
  const snapshot = await get(ref(database, `competitions/${competitionId}`));
  const competition = parseCompetitionRecord(snapshot.val());
  return competition && competition.status !== "draft" ? competition : null;
}

async function writeRunMutation(
  database: Database,
  uid: string,
  source: CompetitionRun,
  next: CompetitionRun,
  action: string,
  summary: string,
  additionalAudit: Array<{ action: string; summary: string }> = [],
) {
  const auditId = createAuditKey(database);
  const additionalEntries = additionalAudit.map((entry) => ({
    ...entry,
    id: createAuditKey(database),
  }));
  try {
    await update(ref(database), {
      [`competitionRuns/${source.competitionId}`]: next,
      [`audit/${auditId}`]: auditValue(
        auditId,
        action,
        source.competitionId,
        uid,
        source.revision,
        next.revision,
        summary,
        next.updatedAt,
      ),
      ...Object.fromEntries(
        additionalEntries.map((entry) => [
          `audit/${entry.id}`,
          auditValue(
            entry.id,
            entry.action,
            source.competitionId,
            uid,
            source.revision,
            next.revision,
            entry.summary,
            next.updatedAt,
          ),
        ]),
      ),
    });
  } catch {
    const latest = await readRun(database, source.competitionId).catch(
      () => null,
    );
    if (!latest || latest.revision !== source.revision) {
      throw new CompetitionRunConflictError();
    }
    throw runWriteError();
  }
}

export function subscribeCompetitionRuns(
  database: Database,
  onData: (result: { runs: AnyCompetitionRun[]; invalidIds: string[] }) => void,
  onError: (error: Error) => void,
): Unsubscribe {
  return onValue(
    ref(database, "competitionRuns"),
    (snapshot) => onData(parseCompetitionRunCollection(snapshot.val())),
    onError,
  );
}

export function subscribePhaseFourAudit(
  database: Database,
  onData: (entries: CompetitionAuditEntry[]) => void,
  onError: (error: Error) => void,
): Unsubscribe {
  return onValue(
    ref(database, "audit"),
    (snapshot) => onData(parsePhaseFourAuditEntries(snapshot.val())),
    onError,
  );
}

export async function activateCompetition(
  database: Database,
  uid: string,
  competition: PublishedCompetition,
  participants: ParticipantReference[],
) {
  const existingRun = await readRun(database, competition.id);
  const review = reviewActivation(
    competition,
    participants,
    Boolean(existingRun),
  );
  if (!review.canActivate) throw new Error(review.errors[0]);
  const now = Date.now();
  const run = createCompetitionRun(competition, uid, now);
  const activeCompetition: PublishedCompetition = {
    ...competition,
    status: "active",
    updatedAt: now,
    updatedByUid: uid,
    revision: competition.revision + 1,
  };
  const auditId = createAuditKey(database);
  const fixtureAuditId = createAuditKey(database);
  try {
    await update(ref(database), {
      [`competitionRuns/${competition.id}`]: run,
      [`competitions/${competition.id}`]: activeCompetition,
      [`audit/${auditId}`]: auditValue(
        auditId,
        "competition-activated",
        competition.id,
        uid,
        competition.revision,
        run.revision,
        "Competition activated; secure draw and round-robin fixtures generated.",
        now,
      ),
      [`audit/${fixtureAuditId}`]: auditValue(
        fixtureAuditId,
        "draw-fixtures-generated",
        competition.id,
        uid,
        competition.revision,
        run.revision,
        "Secure draw and round-robin fixtures generated from the frozen snapshot.",
        now,
      ),
    });
  } catch {
    const [latestCompetition, latestRun] = await Promise.all([
      readCompetition(database, competition.id).catch(() => null),
      readRun(database, competition.id).catch(() => null),
    ]);
    if (
      latestRun ||
      !latestCompetition ||
      latestCompetition.revision !== competition.revision
    ) {
      throw new CompetitionRunConflictError();
    }
    throw runWriteError();
  }
}

export async function startRunMatch(
  database: Database,
  uid: string,
  run: CompetitionRun,
  matchId: string,
  expectedMatchRevision: number,
) {
  const next = setMatchInProgress(
    run,
    matchId,
    expectedMatchRevision,
    Date.now(),
  );
  await writeRunMutation(
    database,
    uid,
    run,
    next,
    "match-started",
    "Match marked as in progress.",
  );
}

export async function returnRunMatchToPending(
  database: Database,
  uid: string,
  run: CompetitionRun,
  matchId: string,
  expectedMatchRevision: number,
) {
  const next = returnMatchToPending(
    run,
    matchId,
    expectedMatchRevision,
    Date.now(),
  );
  await writeRunMutation(
    database,
    uid,
    run,
    next,
    "match-returned-to-pending",
    "Match returned to pending.",
  );
}

export async function saveRunMatchResult(
  database: Database,
  uid: string,
  run: CompetitionRun,
  matchId: string,
  options: Omit<RecordResultOptions, "organizerUid" | "now">,
) {
  const correcting = run.matches[matchId]?.result !== null;
  const hadKnockout = Boolean(run.knockout);
  const previousTieCount = Object.keys(run.tieResolutions).length;
  const previousCompletedDescendants = Object.values(run.matches).filter(
    (match) => match.stage !== "round-robin" && match.result,
  ).length;
  const next = recordMatchResult(run, matchId, {
    ...options,
    organizerUid: uid,
    now: Date.now(),
  });
  await writeRunMutation(
    database,
    uid,
    run,
    next,
    correcting ? "match-result-corrected" : "match-result-recorded",
    correcting
      ? hadKnockout && !next.knockout
        ? "Match result corrected; knockout bracket reset after confirmation."
        : "Match result corrected and dependent state recalculated."
      : "Match result recorded.",
    [
      ...(hadKnockout && !next.knockout
        ? [
            {
              action: "knockout-reset",
              summary:
                "Knockout bracket reset after a confirmed round-robin correction.",
            },
          ]
        : []),
      ...(previousTieCount > Object.keys(next.tieResolutions).length
        ? [
            {
              action: "tie-resolution-invalidated",
              summary:
                "A stored tie decision was invalidated by changed source results.",
            },
          ]
        : []),
      ...(correcting &&
      run.matches[matchId]?.stage !== "round-robin" &&
      Object.values(next.matches).filter(
        (match) => match.stage !== "round-robin" && match.result,
      ).length < previousCompletedDescendants
        ? [
            {
              action: "downstream-results-cascaded",
              summary:
                "Dependent knockout results were cleared after a confirmed correction.",
            },
          ]
        : []),
    ],
  );
}

export async function saveTieResolution(
  database: Database,
  uid: string,
  run: CompetitionRun,
  participantIds: string[],
  orderedParticipantIds: string[],
  reason: string,
) {
  const next = resolveRunTie(
    run,
    participantIds,
    orderedParticipantIds,
    uid,
    Date.now(),
    reason,
  );
  await writeRunMutation(
    database,
    uid,
    run,
    next,
    "tie-resolved",
    "Unresolved qualification tie ordered by the organizer.",
  );
}

export async function createRunKnockout(
  database: Database,
  uid: string,
  run: CompetitionRun,
) {
  const next = generateRunKnockout(run, uid, Date.now());
  await writeRunMutation(
    database,
    uid,
    run,
    next,
    "knockout-generated",
    "Seeded knockout bracket generated from confirmed standings.",
  );
}

export async function completeRunCompetition(
  database: Database,
  uid: string,
  competition: PublishedCompetition,
  run: CompetitionRun,
) {
  if (competition.status !== "active") {
    throw new CompetitionRunConflictError();
  }
  const now = Date.now();
  const nextRun = completeCompetitionRun(run, uid, now);
  const nextCompetition: PublishedCompetition = {
    ...competition,
    status: "completed",
    updatedAt: now,
    updatedByUid: uid,
    revision: competition.revision + 1,
  };
  const auditId = createAuditKey(database);
  try {
    await update(ref(database), {
      [`competitionRuns/${competition.id}`]: nextRun,
      [`competitions/${competition.id}`]: nextCompetition,
      [`audit/${auditId}`]: auditValue(
        auditId,
        "competition-completed",
        competition.id,
        uid,
        run.revision,
        nextRun.revision,
        "Competition completed with final placements.",
        now,
      ),
    });
  } catch {
    throw new CompetitionRunConflictError();
  }
}

export async function reopenRunCompetition(
  database: Database,
  uid: string,
  competition: PublishedCompetition,
  run: CompetitionRun,
) {
  if (competition.status !== "completed") {
    throw new CompetitionRunConflictError();
  }
  const now = Date.now();
  const nextRun = reopenCompetitionRun(run, now);
  const nextCompetition: PublishedCompetition = {
    ...competition,
    status: "active",
    updatedAt: now,
    updatedByUid: uid,
    revision: competition.revision + 1,
  };
  const auditId = createAuditKey(database);
  try {
    await update(ref(database), {
      [`competitionRuns/${competition.id}`]: nextRun,
      [`competitions/${competition.id}`]: nextCompetition,
      [`audit/${auditId}`]: auditValue(
        auditId,
        "competition-reopened",
        competition.id,
        uid,
        run.revision,
        nextRun.revision,
        "Completed competition reopened with existing results preserved.",
        now,
      ),
    });
  } catch {
    throw new CompetitionRunConflictError();
  }
}

export async function resetCompetitionRun(
  database: Database,
  uid: string,
  competition: PublishedCompetition,
  run: CompetitionRun,
) {
  if (competition.status !== "active" || run.resultCount !== 0) {
    throw new Error("Only a run with no recorded results can be reset.");
  }
  const now = Date.now();
  const nextCompetition: PublishedCompetition = {
    ...competition,
    status: "scheduled",
    updatedAt: now,
    updatedByUid: uid,
    revision: competition.revision + 1,
  };
  const auditId = createAuditKey(database);
  try {
    await update(ref(database), {
      [`competitionRuns/${competition.id}`]: null,
      [`competitions/${competition.id}`]: nextCompetition,
      [`audit/${auditId}`]: auditValue(
        auditId,
        "competition-run-reset",
        competition.id,
        uid,
        run.revision,
        null,
        "Pre-result competition run reset to scheduled.",
        now,
      ),
    });
  } catch {
    throw new CompetitionRunConflictError();
  }
}
