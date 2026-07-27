import { get, push, ref, update, type Database } from "firebase/database";
import type {
  ParticipantReference,
  PublishedCompetition,
} from "../domain/types";
import { parseCompetitionRecord } from "../domain/runtime";
import { participantReferenceWarnings } from "../domain/validation";
import {
  beginQualificationReview,
  completeGroupCompetition,
  generateGroupKnockout,
  recordGroupMatchResult,
  reopenGroupCompetition,
  resetGroupKnockout,
  resolveCrossGroupSeedTie,
  resolveGroupTie,
  returnGroupMatchToPending,
  setGroupMatchInProgress,
  type GroupRecordResultOptions,
} from "../group-knockout/engine";
import { reviewGroupActivation } from "../group-knockout/generation";
import { parseGroupKnockoutRun } from "../group-knockout/runtime";
import type { GroupKnockoutRun } from "../group-knockout/types";
import { CompetitionRunConflictError } from "./runs";

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

function auditKey(database: Database) {
  const auditRef = push(ref(database, "audit"));
  if (!auditRef.key) throw new Error("Could not create an audit entry.");
  return auditRef.key;
}

async function readRun(database: Database, competitionId: string) {
  const snapshot = await get(ref(database, `competitionRuns/${competitionId}`));
  return parseGroupKnockoutRun(snapshot.val());
}

async function readCompetition(database: Database, competitionId: string) {
  const snapshot = await get(ref(database, `competitions/${competitionId}`));
  const competition = parseCompetitionRecord(snapshot.val());
  return competition && competition.status !== "draft" ? competition : null;
}

async function writeMutation(
  database: Database,
  uid: string,
  source: GroupKnockoutRun,
  next: GroupKnockoutRun,
  action: string,
  summary: string,
  additionalAudit: Array<{ action: string; summary: string }> = [],
) {
  const entries = [
    { id: auditKey(database), action, summary },
    ...additionalAudit.map((entry) => ({ ...entry, id: auditKey(database) })),
  ];
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
    const latest = await readRun(database, source.competitionId).catch(
      () => null,
    );
    if (!latest || latest.revision !== source.revision) {
      throw new CompetitionRunConflictError();
    }
    throw new Error(
      "Firebase rejected the Group Format operation. Reload the latest state before trying again.",
    );
  }
}

function sameSnapshot(
  competition: PublishedCompetition,
  run: GroupKnockoutRun,
) {
  const review = reviewGroupActivation(competition, false);
  return (
    run.competitionId === competition.id &&
    run.competitionRevision === competition.revision &&
    JSON.stringify(run.participantIds) ===
      JSON.stringify(competition.participantIds) &&
    competition.formatConfig.kind === "group-knockout" &&
    competition.scoringConfig.kind === "head-to-head" &&
    run.configSnapshot.resolvedGroupCount === review.resolvedGroupCount &&
    run.configSnapshot.expectedGroupMatchCount ===
      review.expectedGroupMatchCount &&
    run.configSnapshot.groupCountMode ===
      competition.formatConfig.groupCountMode &&
    run.configSnapshot.qualifiersPerGroup ===
      competition.formatConfig.qualifiersPerGroup &&
    run.configSnapshot.roundRobinLegs ===
      competition.formatConfig.roundRobinLegs &&
    run.configSnapshot.includeThirdPlace ===
      competition.formatConfig.includeThirdPlace &&
    JSON.stringify(run.configSnapshot.series) ===
      JSON.stringify(competition.formatConfig.series) &&
    JSON.stringify(run.configSnapshot.tableScoring) ===
      JSON.stringify(competition.scoringConfig.table) &&
    JSON.stringify(run.configSnapshot.overallScoring) ===
      JSON.stringify(competition.scoringConfig.overall)
  );
}

export async function activateGroupCompetition(
  database: Database,
  uid: string,
  competition: PublishedCompetition,
  participants: ParticipantReference[],
  previewRun: GroupKnockoutRun,
) {
  const review = reviewGroupActivation(competition, false);
  const referenceIssues = participantReferenceWarnings(
    competition.participantIds,
    participants,
  );
  if (!review.canActivate || referenceIssues.length > 0) {
    throw new Error(review.errors[0] ?? referenceIssues[0]!.message);
  }
  if (
    !parseGroupKnockoutRun(previewRun) ||
    !sameSnapshot(competition, previewRun)
  ) {
    throw new CompetitionRunConflictError();
  }
  const [existingRun, latestCompetition] = await Promise.all([
    readRun(database, competition.id),
    readCompetition(database, competition.id),
  ]);
  if (
    existingRun ||
    !latestCompetition ||
    latestCompetition.status !== "scheduled" ||
    latestCompetition.revision !== competition.revision
  ) {
    throw new CompetitionRunConflictError();
  }
  const activeCompetition: PublishedCompetition = {
    ...competition,
    status: "active",
    updatedAt: Date.now(),
    updatedByUid: uid,
    revision: competition.revision + 1,
  };
  const persistedRun: GroupKnockoutRun = {
    ...previewRun,
    activatedAt: activeCompetition.updatedAt,
    activatedByUid: uid,
    updatedAt: activeCompetition.updatedAt,
  };
  const activationId = auditKey(database);
  const drawId = auditKey(database);
  try {
    await update(ref(database), {
      [`competitionRuns/${competition.id}`]: persistedRun,
      [`competitions/${competition.id}`]: activeCompetition,
      [`audit/${activationId}`]: auditValue(
        activationId,
        "competition-activated",
        competition.id,
        uid,
        competition.revision,
        persistedRun.revision,
        "Group Format activated from the confirmed local draw preview.",
        persistedRun.activatedAt,
      ),
      [`audit/${drawId}`]: auditValue(
        drawId,
        "group-draw-generated",
        competition.id,
        uid,
        competition.revision,
        persistedRun.revision,
        "Secure balanced group draw and interleaved fixtures persisted atomically.",
        persistedRun.activatedAt,
      ),
    });
  } catch {
    throw new CompetitionRunConflictError();
  }
}

export async function startStoredGroupMatch(
  database: Database,
  uid: string,
  run: GroupKnockoutRun,
  matchId: string,
  expectedMatchRevision: number,
) {
  const next = setGroupMatchInProgress(
    run,
    matchId,
    expectedMatchRevision,
    Date.now(),
  );
  await writeMutation(
    database,
    uid,
    run,
    next,
    "match-started",
    "Group Format match marked as in progress.",
  );
}

export async function returnStoredGroupMatchToPending(
  database: Database,
  uid: string,
  run: GroupKnockoutRun,
  matchId: string,
  expectedMatchRevision: number,
) {
  const next = returnGroupMatchToPending(
    run,
    matchId,
    expectedMatchRevision,
    Date.now(),
  );
  await writeMutation(
    database,
    uid,
    run,
    next,
    "match-returned-to-pending",
    "Group Format match returned to pending.",
  );
}

export async function saveStoredGroupResult(
  database: Database,
  uid: string,
  run: GroupKnockoutRun,
  matchId: string,
  options: Omit<GroupRecordResultOptions, "organizerUid" | "now">,
) {
  const previousMatch = run.matches[matchId];
  const correcting = previousMatch?.result !== null;
  const hadKnockout = Boolean(run.knockout);
  const previousTieCount = Object.keys(run.tieResolutions).length;
  const previousCompletedKnockout = Object.values(run.matches).filter(
    (match) => match.stage !== "group-stage" && match.result,
  ).length;
  const next = recordGroupMatchResult(run, matchId, {
    ...options,
    organizerUid: uid,
    now: Date.now(),
  });
  await writeMutation(
    database,
    uid,
    run,
    next,
    correcting ? "match-result-corrected" : "match-result-recorded",
    correcting
      ? "Group Format result corrected and dependent state recalculated."
      : "Group Format result recorded.",
    [
      ...(hadKnockout && !next.knockout
        ? [
            {
              action: "knockout-reset",
              summary:
                "Complete Group Format knockout reset after a confirmed group-stage correction.",
            },
          ]
        : []),
      ...(Object.keys(next.tieResolutions).length < previousTieCount
        ? [
            {
              action: "tie-resolution-invalidated",
              summary:
                "A group tie decision was invalidated by changed source results.",
            },
          ]
        : []),
      ...(correcting &&
      previousMatch?.stage !== "group-stage" &&
      Object.values(next.matches).filter(
        (match) => match.stage !== "group-stage" && match.result,
      ).length < previousCompletedKnockout
        ? [
            {
              action: "downstream-results-cascaded",
              summary:
                "Dependent Group Format knockout results were cleared after correction.",
            },
          ]
        : []),
    ],
  );
}

export async function saveStoredGroupTieResolution(
  database: Database,
  uid: string,
  run: GroupKnockoutRun,
  groupId: string,
  participantIds: string[],
  orderedParticipantIds: string[],
  reason: string,
) {
  const next = resolveGroupTie(
    run,
    groupId,
    participantIds,
    orderedParticipantIds,
    uid,
    Date.now(),
    reason,
  );
  await writeMutation(
    database,
    uid,
    run,
    next,
    "tie-resolved",
    "Explicit Group Format standings tie order recorded.",
  );
}

export async function openStoredQualificationReview(
  database: Database,
  uid: string,
  run: GroupKnockoutRun,
) {
  const next = beginQualificationReview(run, uid, Date.now());
  await writeMutation(
    database,
    uid,
    run,
    next,
    "group-stage-completed",
    "Group stage completed and qualification review opened.",
    [
      {
        action: "qualification-snapshot-confirmed",
        summary:
          "Frozen qualification snapshot confirmed from resolved group standings.",
      },
    ],
  );
}

export async function saveStoredCrossGroupSeedResolution(
  database: Database,
  uid: string,
  run: GroupKnockoutRun,
  groupRank: number,
  participantIds: string[],
  orderedParticipantIds: string[],
  reason: string,
) {
  const next = resolveCrossGroupSeedTie(
    run,
    groupRank,
    participantIds,
    orderedParticipantIds,
    uid,
    Date.now(),
    reason,
  );
  await writeMutation(
    database,
    uid,
    run,
    next,
    "cross-group-seed-resolved",
    "Explicit cross-group seed order recorded for an equal rank tier.",
  );
}

export async function generateStoredGroupKnockout(
  database: Database,
  uid: string,
  run: GroupKnockoutRun,
) {
  const next = generateGroupKnockout(run, uid, Date.now());
  await writeMutation(
    database,
    uid,
    run,
    next,
    "knockout-generated",
    "Group Format knockout generated from the confirmed cross-group seeds.",
  );
}

export async function resetStoredGroupKnockout(
  database: Database,
  uid: string,
  run: GroupKnockoutRun,
) {
  const next = resetGroupKnockout(run, Date.now());
  await writeMutation(
    database,
    uid,
    run,
    next,
    "knockout-reset",
    "Complete Group Format knockout reset after explicit confirmation.",
  );
}

export async function completeStoredGroupCompetition(
  database: Database,
  uid: string,
  competition: PublishedCompetition,
  run: GroupKnockoutRun,
) {
  if (competition.status !== "active") throw new CompetitionRunConflictError();
  const now = Date.now();
  const nextRun = completeGroupCompetition(run, uid, now);
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
        "Group Format completed with final placements.",
        now,
      ),
    });
  } catch {
    throw new CompetitionRunConflictError();
  }
}

export async function reopenStoredGroupCompetition(
  database: Database,
  uid: string,
  competition: PublishedCompetition,
  run: GroupKnockoutRun,
) {
  if (competition.status !== "completed")
    throw new CompetitionRunConflictError();
  const now = Date.now();
  const nextRun = reopenGroupCompetition(run, now);
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
        "Group Format reopened to its preserved knockout state.",
        now,
      ),
    });
  } catch {
    throw new CompetitionRunConflictError();
  }
}

export async function resetStoredGroupRun(
  database: Database,
  uid: string,
  competition: PublishedCompetition,
  run: GroupKnockoutRun,
) {
  if (competition.status !== "active" || run.resultCount !== 0) {
    throw new Error("Only a Group Format run with no results can be reset.");
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
        "Pre-result Group Format reset to scheduled.",
        now,
      ),
    });
  } catch {
    throw new CompetitionRunConflictError();
  }
}
