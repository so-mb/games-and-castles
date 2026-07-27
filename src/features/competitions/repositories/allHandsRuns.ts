import { get, push, ref, update, type Database } from "firebase/database";
import {
  completeAllHandsRun,
  createAllHandsRun,
  createAllHandsSession,
  deletePendingAllHandsSession,
  recordAllHandsResult,
  reopenAllHandsRun,
  requestAllHandsCompletionReview,
  resolveAllHandsTie,
  restoreAllHandsSession,
  reviewAllHandsActivation,
  returnAllHandsSessionToPending,
  startAllHandsSession,
  voidAllHandsSession,
} from "../all-hands/engine";
import { parseAllHandsRun } from "../all-hands/runtime";
import type {
  AllHandsCompetitionRun,
  AllHandsResultInput,
  AllHandsTeam,
} from "../all-hands/types";
import { parseCompetitionRecord } from "../domain/runtime";
import type {
  CompetitionAuditEntry,
  ParticipantReference,
  PublishedCompetition,
} from "../domain/types";
import { CompetitionRunConflictError } from "./runs";

function auditKey(database: Database) {
  const entry = push(ref(database, "audit"));
  if (!entry.key) throw new Error("Could not create an audit entry.");
  return entry.key;
}

function auditValue(
  id: string,
  action: CompetitionAuditEntry["action"],
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

async function readAllHandsRun(database: Database, competitionId: string) {
  const snapshot = await get(ref(database, `competitionRuns/${competitionId}`));
  return parseAllHandsRun(snapshot.val());
}

async function readCompetition(database: Database, competitionId: string) {
  const snapshot = await get(ref(database, `competitions/${competitionId}`));
  const competition = parseCompetitionRecord(snapshot.val());
  return competition && competition.status !== "draft" ? competition : null;
}

async function writeMutation(
  database: Database,
  uid: string,
  source: AllHandsCompetitionRun,
  next: AllHandsCompetitionRun,
  action: CompetitionAuditEntry["action"],
  summary: string,
  additionalAudit: Array<{
    action: CompetitionAuditEntry["action"];
    summary: string;
  }> = [],
) {
  const entries = [{ action, summary }, ...additionalAudit].map((entry) => ({
    ...entry,
    id: auditKey(database),
  }));
  try {
    await update(ref(database), {
      [`competitionRuns/${source.competitionId}`]: next,
      ...Object.fromEntries(
        entries.map((entry) => [
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
    const latest = await readAllHandsRun(database, source.competitionId).catch(
      () => null,
    );
    if (!latest || latest.revision !== source.revision) {
      throw new CompetitionRunConflictError();
    }
    throw new Error(
      "Firebase rejected the All Hands operation. Reload and review the latest state before trying again.",
    );
  }
}

export async function activateAllHandsCompetition(
  database: Database,
  uid: string,
  competition: PublishedCompetition,
  participants: ParticipantReference[],
) {
  const existing = await get(
    ref(database, `competitionRuns/${competition.id}`),
  );
  const review = reviewAllHandsActivation(
    competition,
    participants,
    existing.exists(),
  );
  if (!review.canActivate) throw new Error(review.errors[0]);
  const now = Date.now();
  const run = createAllHandsRun(competition, uid, now);
  const nextCompetition: PublishedCompetition = {
    ...competition,
    status: "active",
    updatedAt: now,
    updatedByUid: uid,
    revision: competition.revision + 1,
  };
  const auditId = auditKey(database);
  try {
    await update(ref(database), {
      [`competitionRuns/${competition.id}`]: run,
      [`competitions/${competition.id}`]: nextCompetition,
      [`audit/${auditId}`]: auditValue(
        auditId,
        "competition-activated",
        competition.id,
        uid,
        competition.revision,
        run.revision,
        "All Hands activated with frozen configuration and eligible participants.",
        now,
      ),
    });
  } catch {
    const [latestCompetition, latestRun] = await Promise.all([
      readCompetition(database, competition.id).catch(() => null),
      readAllHandsRun(database, competition.id).catch(() => null),
    ]);
    if (
      latestRun ||
      !latestCompetition ||
      latestCompetition.revision !== competition.revision
    ) {
      throw new CompetitionRunConflictError();
    }
    throw new Error("Firebase rejected All Hands activation.");
  }
}

export async function addAllHandsSession(
  database: Database,
  uid: string,
  run: AllHandsCompetitionRun,
  input: {
    title: string;
    mode: "individual" | "team";
    participantIds: string[];
    teams: AllHandsTeam[];
    startImmediately: boolean;
  },
) {
  const sessionRef = push(
    ref(database, `competitionRuns/${run.competitionId}/sessions`),
  );
  if (!sessionRef.key) throw new Error("Could not create a session.");
  const now = Date.now();
  const next = createAllHandsSession(run, {
    ...input,
    id: sessionRef.key,
    organizerUid: uid,
    now,
  });
  await writeMutation(
    database,
    uid,
    run,
    next,
    "session-created",
    input.startImmediately
      ? "All Hands session created and started."
      : "Pending All Hands session created.",
    input.startImmediately
      ? [{ action: "session-started", summary: "All Hands session started." }]
      : [],
  );
}

export async function startStoredAllHandsSession(
  database: Database,
  uid: string,
  run: AllHandsCompetitionRun,
  sessionId: string,
  expectedRevision: number,
) {
  const next = startAllHandsSession(
    run,
    sessionId,
    expectedRevision,
    uid,
    Date.now(),
  );
  await writeMutation(
    database,
    uid,
    run,
    next,
    "session-started",
    "All Hands session started.",
  );
}

export async function returnStoredAllHandsSessionToPending(
  database: Database,
  uid: string,
  run: AllHandsCompetitionRun,
  sessionId: string,
  expectedRevision: number,
) {
  const next = returnAllHandsSessionToPending(
    run,
    sessionId,
    expectedRevision,
    Date.now(),
  );
  await writeMutation(
    database,
    uid,
    run,
    next,
    "session-returned-to-pending",
    "All Hands session returned to pending.",
  );
}

export async function saveAllHandsResult(
  database: Database,
  uid: string,
  run: AllHandsCompetitionRun,
  sessionId: string,
  expectedRevision: number,
  input: AllHandsResultInput,
) {
  const correcting = Boolean(run.sessions[sessionId]?.result);
  const hadTie = Object.keys(run.tieResolutions).length > 0;
  const next = recordAllHandsResult(
    run,
    sessionId,
    expectedRevision,
    input,
    uid,
    Date.now(),
  );
  await writeMutation(
    database,
    uid,
    run,
    next,
    correcting ? "session-result-corrected" : "session-result-recorded",
    correcting
      ? "All Hands session result corrected and derived standings recalculated."
      : "All Hands session result recorded.",
    hadTie
      ? [
          {
            action: "tie-resolution-invalidated",
            summary:
              "Final tie decisions invalidated by a changed session result.",
          },
        ]
      : [],
  );
}

export async function voidStoredAllHandsSession(
  database: Database,
  uid: string,
  run: AllHandsCompetitionRun,
  sessionId: string,
  expectedRevision: number,
  reason: string,
) {
  const hadTie = Object.keys(run.tieResolutions).length > 0;
  const next = voidAllHandsSession(
    run,
    sessionId,
    expectedRevision,
    uid,
    Date.now(),
    reason,
  );
  await writeMutation(
    database,
    uid,
    run,
    next,
    "session-voided",
    "All Hands session voided and excluded from derived standings.",
    hadTie
      ? [
          {
            action: "tie-resolution-invalidated",
            summary: "Final tie decisions invalidated by a voided session.",
          },
        ]
      : [],
  );
}

export async function restoreStoredAllHandsSession(
  database: Database,
  uid: string,
  run: AllHandsCompetitionRun,
  sessionId: string,
  expectedRevision: number,
) {
  const hadTie = Object.keys(run.tieResolutions).length > 0;
  const next = restoreAllHandsSession(
    run,
    sessionId,
    expectedRevision,
    Date.now(),
  );
  await writeMutation(
    database,
    uid,
    run,
    next,
    "session-restored",
    "All Hands session restored to derived standings.",
    hadTie
      ? [
          {
            action: "tie-resolution-invalidated",
            summary: "Final tie decisions invalidated by a restored session.",
          },
        ]
      : [],
  );
}

export async function deleteStoredPendingAllHandsSession(
  database: Database,
  uid: string,
  run: AllHandsCompetitionRun,
  sessionId: string,
  expectedRevision: number,
) {
  const next = deletePendingAllHandsSession(
    run,
    sessionId,
    expectedRevision,
    Date.now(),
  );
  await writeMutation(
    database,
    uid,
    run,
    next,
    "session-deleted",
    "Pending All Hands session deleted before play.",
  );
}

export async function beginAllHandsCompletionReview(
  database: Database,
  uid: string,
  run: AllHandsCompetitionRun,
) {
  const next = requestAllHandsCompletionReview(run, Date.now());
  await writeMutation(
    database,
    uid,
    run,
    next,
    "completion-review-opened",
    "All Hands completion review opened; final standings checked for ties.",
  );
}

export async function saveAllHandsTieResolution(
  database: Database,
  uid: string,
  run: AllHandsCompetitionRun,
  participantIds: string[],
  orderedParticipantIds: string[],
  reason: string | null,
) {
  const next = resolveAllHandsTie(
    run,
    participantIds,
    orderedParticipantIds,
    reason,
    uid,
    Date.now(),
  );
  await writeMutation(
    database,
    uid,
    run,
    next,
    "tie-resolved",
    "All Hands final tie ordered by the organizer.",
  );
}

export async function completeStoredAllHandsCompetition(
  database: Database,
  uid: string,
  competition: PublishedCompetition,
  run: AllHandsCompetitionRun,
) {
  if (competition.status !== "active") throw new CompetitionRunConflictError();
  const now = Date.now();
  const nextRun = completeAllHandsRun(run, uid, now);
  const nextCompetition: PublishedCompetition = {
    ...competition,
    status: "completed",
    updatedAt: now,
    updatedByUid: uid,
    revision: competition.revision + 1,
  };
  const id = auditKey(database);
  try {
    await update(ref(database), {
      [`competitionRuns/${competition.id}`]: nextRun,
      [`competitions/${competition.id}`]: nextCompetition,
      [`audit/${id}`]: auditValue(
        id,
        "competition-completed",
        competition.id,
        uid,
        run.revision,
        nextRun.revision,
        "All Hands completed with final placements.",
        now,
      ),
    });
  } catch {
    throw new CompetitionRunConflictError();
  }
}

export async function reopenStoredAllHandsCompetition(
  database: Database,
  uid: string,
  competition: PublishedCompetition,
  run: AllHandsCompetitionRun,
) {
  if (competition.status !== "completed")
    throw new CompetitionRunConflictError();
  const now = Date.now();
  const nextRun = reopenAllHandsRun(run, now);
  const nextCompetition: PublishedCompetition = {
    ...competition,
    status: "active",
    updatedAt: now,
    updatedByUid: uid,
    revision: competition.revision + 1,
  };
  const id = auditKey(database);
  try {
    await update(ref(database), {
      [`competitionRuns/${competition.id}`]: nextRun,
      [`competitions/${competition.id}`]: nextCompetition,
      [`audit/${id}`]: auditValue(
        id,
        "competition-reopened",
        competition.id,
        uid,
        run.revision,
        nextRun.revision,
        "All Hands reopened with session history preserved.",
        now,
      ),
    });
  } catch {
    throw new CompetitionRunConflictError();
  }
}

export async function resetStoredAllHandsRun(
  database: Database,
  uid: string,
  competition: PublishedCompetition,
  run: AllHandsCompetitionRun,
) {
  if (competition.status !== "active" || run.resultCount !== 0) {
    throw new Error(
      "Only an All Hands run with no recorded results can be reset.",
    );
  }
  const now = Date.now();
  const nextCompetition: PublishedCompetition = {
    ...competition,
    status: "scheduled",
    updatedAt: now,
    updatedByUid: uid,
    revision: competition.revision + 1,
  };
  const id = auditKey(database);
  try {
    await update(ref(database), {
      [`competitionRuns/${competition.id}`]: null,
      [`competitions/${competition.id}`]: nextCompetition,
      [`audit/${id}`]: auditValue(
        id,
        "competition-run-reset",
        competition.id,
        uid,
        run.revision,
        null,
        "Pre-result All Hands run reset to scheduled.",
        now,
      ),
    });
  } catch {
    throw new CompetitionRunConflictError();
  }
}
