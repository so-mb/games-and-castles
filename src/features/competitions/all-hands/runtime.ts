import { competitionLimits } from "../domain/config";
import { validateAllHandsResultInput } from "./engine";
import type {
  AllHandsCompetitionRun,
  AllHandsConfigSnapshot,
  AllHandsPlacementSnapshot,
  AllHandsSession,
  AllHandsSessionResult,
  AllHandsTeam,
  AllHandsTieResolution,
  AllHandsResultInput,
} from "./types";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasOnlyKeys(value: Record<string, unknown>, allowed: string[]) {
  return Object.keys(value).every((key) => allowed.includes(key));
}

function isInteger(
  value: unknown,
  minimum = 0,
  maximum = Number.MAX_SAFE_INTEGER,
) {
  return (
    typeof value === "number" &&
    Number.isFinite(value) &&
    Number.isInteger(value) &&
    value >= minimum &&
    value <= maximum
  );
}

function isString(value: unknown, maximum = 128) {
  return (
    typeof value === "string" && value.length > 0 && value.length <= maximum
  );
}

function stringArray(
  value: unknown,
  maximum = competitionLimits.participants,
): value is string[] {
  return (
    Array.isArray(value) &&
    value.length <= maximum &&
    value.every((item) => isString(item, competitionLimits.participantId)) &&
    new Set(value).size === value.length
  );
}

function parseConfig(value: unknown): AllHandsConfigSnapshot | null {
  if (
    !isRecord(value) ||
    !hasOnlyKeys(value, [
      "format",
      "resultMode",
      "sessionPlan",
      "allowTeams",
      "teamAwardPolicy",
      "metrics",
      "tieHandling",
      "winnerBonus",
      "participationPoints",
      "placementPoints",
    ]) ||
    value.format !== "all-hands" ||
    ![
      "winner-only",
      "placement",
      "highest-score",
      "lowest-score",
      "custom",
    ].includes(String(value.resultMode)) ||
    !isRecord(value.sessionPlan) ||
    !isRecord(value.metrics) ||
    typeof value.allowTeams !== "boolean" ||
    value.teamAwardPolicy !== "each-member" ||
    !["shared-placement", "manual-order"].includes(String(value.tieHandling)) ||
    !isInteger(value.winnerBonus, 0, competitionLimits.score) ||
    !isInteger(value.participationPoints, 0, competitionLimits.score) ||
    !Array.isArray(value.placementPoints)
  ) {
    return null;
  }
  const plan = value.sessionPlan;
  if (!(
    (plan.kind === "open-ended" && hasOnlyKeys(plan, ["kind"])) ||
    (plan.kind === "fixed" &&
      hasOnlyKeys(plan, ["kind", "plannedSessionCount"]) &&
      isInteger(plan.plannedSessionCount, 1, competitionLimits.sessions))
  )) {
    return null;
  }
  const metrics = value.metrics;
  if (
    !hasOnlyKeys(metrics, [
      "primaryLabel",
      "primaryDirection",
      "secondaryLabel",
      "secondaryDirection",
      "allowNegativeScores",
    ]) ||
    !(
      metrics.primaryLabel === null ||
      metrics.primaryLabel === undefined ||
      (typeof metrics.primaryLabel === "string" &&
        metrics.primaryLabel.length <= competitionLimits.metricLabel)
    ) ||
    !["higher", "lower"].includes(String(metrics.primaryDirection)) ||
    !(
      metrics.secondaryLabel === null ||
      metrics.secondaryLabel === undefined ||
      (typeof metrics.secondaryLabel === "string" &&
        metrics.secondaryLabel.length <= competitionLimits.metricLabel)
    ) ||
    !(
      metrics.secondaryDirection === null ||
      metrics.secondaryDirection === undefined ||
      ["higher", "lower"].includes(String(metrics.secondaryDirection))
    ) ||
    typeof metrics.allowNegativeScores !== "boolean"
  ) {
    return null;
  }
  const placementPoints: Array<{ place: number; points: number }> = [];
  const places = new Set<number>();
  for (const raw of value.placementPoints) {
    if (
      !isRecord(raw) ||
      !hasOnlyKeys(raw, ["place", "points"]) ||
      !isInteger(raw.place, 1, competitionLimits.participants) ||
      !isInteger(raw.points, 0, competitionLimits.score) ||
      places.has(Number(raw.place))
    ) {
      return null;
    }
    places.add(Number(raw.place));
    placementPoints.push({
      place: Number(raw.place),
      points: Number(raw.points),
    });
  }
  return {
    ...(value as unknown as AllHandsConfigSnapshot),
    metrics: {
      ...(metrics as unknown as AllHandsConfigSnapshot["metrics"]),
      primaryLabel:
        typeof metrics.primaryLabel === "string" ? metrics.primaryLabel : null,
      secondaryLabel:
        typeof metrics.secondaryLabel === "string"
          ? metrics.secondaryLabel
          : null,
      secondaryDirection:
        metrics.secondaryDirection === "higher" ||
        metrics.secondaryDirection === "lower"
          ? metrics.secondaryDirection
          : null,
    },
    placementPoints,
  };
}

function parseTeams(
  value: unknown,
  participantIndex: Record<string, true>,
): Record<string, AllHandsTeam> | null {
  if (value === undefined || value === null) return {};
  if (!isRecord(value)) return null;
  const teams: Record<string, AllHandsTeam> = {};
  const names = new Set<string>();
  const assigned = new Set<string>();
  for (const [id, raw] of Object.entries(value)) {
    if (
      !isRecord(raw) ||
      !hasOnlyKeys(raw, ["id", "name", "participantIds"]) ||
      raw.id !== id ||
      !isString(raw.name, competitionLimits.teamName) ||
      !stringArray(raw.participantIds) ||
      raw.participantIds.length < 1 ||
      names.has(String(raw.name).toLocaleLowerCase()) ||
      raw.participantIds.some(
        (participantId) =>
          !participantIndex[participantId] || assigned.has(participantId),
      )
    ) {
      return null;
    }
    names.add(String(raw.name).toLocaleLowerCase());
    raw.participantIds.forEach((participantId) => assigned.add(participantId));
    teams[id] = raw as unknown as AllHandsTeam;
  }
  return teams;
}

function resultInput(result: AllHandsSessionResult): AllHandsResultInput {
  if (result.kind === "winner-only") {
    return { kind: result.kind, winnerEntityId: result.winnerEntityId };
  }
  if (result.kind === "placement") {
    return { kind: result.kind, entries: result.entries };
  }
  if (result.kind === "custom") {
    return { kind: result.kind, entries: result.entries };
  }
  return {
    kind: result.kind,
    mode: result.mode,
    entries: result.entries,
    manualOrderEntityIds: result.manualOrderEntityIds,
  };
}

function parseResult(value: unknown): AllHandsSessionResult | null | false {
  if (value === undefined || value === null) return null;
  if (
    !isRecord(value) ||
    !isInteger(value.completedAt) ||
    !isString(value.completedByUid) ||
    !isInteger(value.resultRevision, 1)
  ) {
    return false;
  }
  if (value.kind === "winner-only") {
    return hasOnlyKeys(value, [
      "kind",
      "winnerEntityId",
      "entityIndex",
      "completedAt",
      "completedByUid",
      "resultRevision",
    ]) &&
      isString(value.winnerEntityId) &&
      isRecord(value.entityIndex)
      ? (value as unknown as AllHandsSessionResult)
      : false;
  }
  if (value.kind === "placement") {
    if (
      !hasOnlyKeys(value, [
        "kind",
        "entries",
        "entityIndex",
        "completedAt",
        "completedByUid",
        "resultRevision",
      ]) ||
      !Array.isArray(value.entries) ||
      !isRecord(value.entityIndex) ||
      value.entries.some(
        (entry) =>
          !isRecord(entry) ||
          !hasOnlyKeys(entry, ["entityId", "placement"]) ||
          !isString(entry.entityId) ||
          !isInteger(entry.placement, 1, competitionLimits.participants),
      )
    ) {
      return false;
    }
    return value as unknown as AllHandsSessionResult;
  }
  if (value.kind === "numeric") {
    if (
      !hasOnlyKeys(value, [
        "kind",
        "mode",
        "entries",
        "manualOrderEntityIds",
        "entityIndex",
        "completedAt",
        "completedByUid",
        "resultRevision",
      ]) ||
      !["highest-score", "lowest-score"].includes(String(value.mode)) ||
      !isRecord(value.entityIndex) ||
      !Array.isArray(value.entries) ||
      value.entries.some(
        (entry) =>
          !isRecord(entry) ||
          !hasOnlyKeys(entry, ["entityId", "primaryScore", "secondaryScore"]) ||
          !isString(entry.entityId) ||
          typeof entry.primaryScore !== "number" ||
          !Number.isFinite(entry.primaryScore) ||
          !(
            entry.secondaryScore === null ||
            entry.secondaryScore === undefined ||
            (typeof entry.secondaryScore === "number" &&
              Number.isFinite(entry.secondaryScore))
          ),
      ) ||
      !(
        value.manualOrderEntityIds === null ||
        value.manualOrderEntityIds === undefined ||
        stringArray(value.manualOrderEntityIds)
      )
    ) {
      return false;
    }
    return {
      ...(value as unknown as AllHandsSessionResult),
      manualOrderEntityIds: Array.isArray(value.manualOrderEntityIds)
        ? value.manualOrderEntityIds
        : null,
      entries: value.entries.map((entry) => ({
        ...entry,
        secondaryScore:
          isRecord(entry) && typeof entry.secondaryScore === "number"
            ? entry.secondaryScore
            : null,
      })),
    } as AllHandsSessionResult;
  }
  if (value.kind === "custom") {
    if (
      !hasOnlyKeys(value, [
        "kind",
        "entries",
        "entityIndex",
        "completedAt",
        "completedByUid",
        "resultRevision",
      ]) ||
      !Array.isArray(value.entries) ||
      !isRecord(value.entityIndex) ||
      value.entries.some(
        (entry) =>
          !isRecord(entry) ||
          !hasOnlyKeys(entry, ["entityId", "points", "note"]) ||
          !isString(entry.entityId) ||
          !isInteger(entry.points, 0, competitionLimits.customPoints) ||
          !(
            entry.note === null ||
            entry.note === undefined ||
            (typeof entry.note === "string" &&
              entry.note.length <= competitionLimits.resultNote)
          ),
      )
    ) {
      return false;
    }
    return {
      ...(value as unknown as AllHandsSessionResult),
      entries: value.entries.map((entry) => ({
        ...entry,
        note:
          isRecord(entry) && typeof entry.note === "string" ? entry.note : null,
      })),
    } as AllHandsSessionResult;
  }
  return false;
}

function parseSessions(
  value: unknown,
  competitionId: string,
  eligibleIndex: Record<string, true>,
  config: AllHandsConfigSnapshot,
): Record<string, AllHandsSession> | null {
  if (value === undefined || value === null) return {};
  if (!isRecord(value)) return null;
  const sessions: Record<string, AllHandsSession> = {};
  const sequences = new Set<number>();
  for (const [id, raw] of Object.entries(value)) {
    if (
      !isRecord(raw) ||
      !hasOnlyKeys(raw, [
        "id",
        "competitionId",
        "title",
        "sequence",
        "mode",
        "participantIds",
        "participantIndex",
        "teams",
        "entityIds",
        "entityIndex",
        "teamAssignments",
        "status",
        "result",
        "createdAt",
        "createdByUid",
        "startedAt",
        "startedByUid",
        "completedAt",
        "completedByUid",
        "voidedAt",
        "voidedByUid",
        "voidReason",
        "revision",
        "schemaVersion",
      ]) ||
      raw.id !== id ||
      raw.competitionId !== competitionId ||
      !isString(raw.title, competitionLimits.sessionTitle) ||
      !isInteger(raw.sequence, 1, competitionLimits.sessions) ||
      sequences.has(Number(raw.sequence)) ||
      !["individual", "team"].includes(String(raw.mode)) ||
      !stringArray(raw.participantIds) ||
      raw.participantIds.length < 2 ||
      raw.participantIds.some(
        (participantId) => !eligibleIndex[participantId],
      ) ||
      !isRecord(raw.participantIndex) ||
      Object.keys(raw.participantIndex).length !== raw.participantIds.length ||
      raw.participantIds.some(
        (participantId) =>
          (raw.participantIndex as Record<string, unknown>)[participantId] !==
          true,
      ) ||
      !stringArray(raw.entityIds) ||
      raw.entityIds.length < 2 ||
      !isRecord(raw.entityIndex) ||
      Object.keys(raw.entityIndex).length !== raw.entityIds.length ||
      raw.entityIds.some(
        (entityId) =>
          (raw.entityIndex as Record<string, unknown>)[entityId] !== true,
      ) ||
      !["pending", "in-progress", "completed", "voided"].includes(
        String(raw.status),
      ) ||
      !isInteger(raw.createdAt) ||
      !isString(raw.createdByUid) ||
      !isInteger(raw.revision, 1) ||
      raw.schemaVersion !== 1
    ) {
      return null;
    }
    sequences.add(Number(raw.sequence));
    const participantIndex = raw.participantIndex as Record<string, true>;
    const teams = parseTeams(raw.teams, participantIndex);
    if (!teams) return null;
    if (
      (raw.mode === "individual" &&
        (Object.keys(teams).length > 0 ||
          (raw.teamAssignments !== undefined &&
            raw.teamAssignments !== null &&
            (!isRecord(raw.teamAssignments) ||
              Object.keys(raw.teamAssignments).length > 0)) ||
          !sameStringArrays(raw.entityIds, raw.participantIds))) ||
      (raw.mode === "team" &&
        (!config.allowTeams ||
          !isRecord(raw.teamAssignments) ||
          Object.keys(raw.teamAssignments).length !==
            raw.participantIds.length ||
          Object.values(teams).some((team) =>
            team.participantIds.some(
              (participantId) =>
                (raw.teamAssignments as Record<string, unknown>)[
                  participantId
                ] !== team.id,
            ),
          ) ||
          Object.keys(teams).length < 2 ||
          !sameStringArrays(raw.entityIds, Object.keys(teams)) ||
          !sameStringArrays(
            raw.participantIds,
            Object.values(teams).flatMap((team) => team.participantIds),
          )))
    ) {
      return null;
    }
    const result = parseResult(raw.result);
    if (result === false) return null;
    const session: AllHandsSession = {
      ...(raw as unknown as AllHandsSession),
      teams,
      teamAssignments: isRecord(raw.teamAssignments)
        ? (raw.teamAssignments as Record<string, string>)
        : {},
      result,
      startedAt: typeof raw.startedAt === "number" ? raw.startedAt : null,
      startedByUid:
        typeof raw.startedByUid === "string" ? raw.startedByUid : null,
      completedAt: typeof raw.completedAt === "number" ? raw.completedAt : null,
      completedByUid:
        typeof raw.completedByUid === "string" ? raw.completedByUid : null,
      voidedAt: typeof raw.voidedAt === "number" ? raw.voidedAt : null,
      voidedByUid: typeof raw.voidedByUid === "string" ? raw.voidedByUid : null,
      voidReason: typeof raw.voidReason === "string" ? raw.voidReason : null,
    };
    const shouldHaveResult =
      session.status === "completed" || session.status === "voided";
    if (
      shouldHaveResult !== Boolean(result) ||
      (session.status === "in-progress" && !session.startedAt) ||
      (session.status === "pending" && session.startedAt !== null) ||
      (shouldHaveResult && (!session.completedAt || !session.completedByUid)) ||
      (session.status === "voided" &&
        (!session.voidedAt || !session.voidedByUid || !session.voidReason)) ||
      (session.status !== "voided" &&
        (session.voidedAt !== null ||
          session.voidedByUid !== null ||
          session.voidReason !== null))
    ) {
      return null;
    }
    if (result) {
      if (
        Object.keys(result.entityIndex).length !== session.entityIds.length ||
        session.entityIds.some((id) => result.entityIndex[id] !== true)
      ) {
        return null;
      }
      try {
        validateAllHandsResultInput(session, config, resultInput(result));
      } catch {
        return null;
      }
    }
    sessions[id] = session;
  }
  return sessions;
}

function sameStringArrays(left: unknown, right: unknown) {
  return (
    Array.isArray(left) &&
    Array.isArray(right) &&
    left.length === right.length &&
    [...left].sort().join("|") === [...right].sort().join("|")
  );
}

function parseTieResolutions(
  value: unknown,
  eligibleIndex: Record<string, true>,
): Record<string, AllHandsTieResolution> | null {
  if (value === undefined || value === null) return {};
  if (!isRecord(value)) return null;
  const result: Record<string, AllHandsTieResolution> = {};
  for (const [id, raw] of Object.entries(value)) {
    if (
      !isRecord(raw) ||
      !hasOnlyKeys(raw, [
        "id",
        "participantIds",
        "orderedParticipantIds",
        "reason",
        "standingsFingerprint",
        "resolvedAt",
        "resolvedByUid",
        "schemaVersion",
      ]) ||
      raw.id !== id ||
      !stringArray(raw.participantIds) ||
      raw.participantIds.length < 2 ||
      raw.participantIds.some(
        (participantId) => !eligibleIndex[participantId],
      ) ||
      !stringArray(raw.orderedParticipantIds) ||
      !sameStringArrays(raw.participantIds, raw.orderedParticipantIds) ||
      !(
        raw.reason === null ||
        raw.reason === undefined ||
        (typeof raw.reason === "string" &&
          raw.reason.length <= competitionLimits.resultNote)
      ) ||
      !isString(raw.standingsFingerprint, 4096) ||
      !isInteger(raw.resolvedAt) ||
      !isString(raw.resolvedByUid) ||
      raw.schemaVersion !== 1
    ) {
      return null;
    }
    result[id] = {
      ...(raw as unknown as AllHandsTieResolution),
      reason: typeof raw.reason === "string" ? raw.reason : null,
    };
  }
  return result;
}

function parsePlacements(
  value: unknown,
  eligibleIndex: Record<string, true>,
): AllHandsPlacementSnapshot | null | false {
  if (value === undefined || value === null) return null;
  if (
    !isRecord(value) ||
    !hasOnlyKeys(value, [
      "entries",
      "completedAt",
      "completedByUid",
      "runtimeRevision",
      "schemaVersion",
    ]) ||
    !Array.isArray(value.entries) ||
    value.entries.length !== Object.keys(eligibleIndex).length ||
    value.entries.some(
      (entry) =>
        !isRecord(entry) ||
        !hasOnlyKeys(entry, [
          "participantId",
          "place",
          "totalCompetitionPoints",
          "sessionWins",
          "secondPlaceFinishes",
          "thirdPlaceFinishes",
          "completionAwards",
        ]) ||
        !isString(entry.participantId) ||
        !eligibleIndex[String(entry.participantId)] ||
        !isInteger(entry.place, 1, competitionLimits.participants) ||
        !isInteger(entry.totalCompetitionPoints) ||
        !isInteger(entry.sessionWins) ||
        !isInteger(entry.secondPlaceFinishes) ||
        !isInteger(entry.thirdPlaceFinishes) ||
        !isInteger(entry.completionAwards),
    ) ||
    new Set(
      value.entries.map(
        (entry) => (entry as Record<string, unknown>).participantId,
      ),
    ).size !== value.entries.length ||
    !isInteger(value.completedAt) ||
    !isString(value.completedByUid) ||
    !isInteger(value.runtimeRevision, 1) ||
    value.schemaVersion !== 1
  ) {
    return false;
  }
  return value as unknown as AllHandsPlacementSnapshot;
}

export function parseAllHandsRun(
  value: unknown,
): AllHandsCompetitionRun | null {
  if (
    !isRecord(value) ||
    !hasOnlyKeys(value, [
      "competitionId",
      "format",
      "stage",
      "competitionRevision",
      "eligibleParticipantIds",
      "eligibleParticipantIndex",
      "configSnapshot",
      "sessions",
      "tieResolutions",
      "placements",
      "currentSessionId",
      "sessionCount",
      "resultCount",
      "createdAt",
      "updatedAt",
      "activatedAt",
      "activatedByUid",
      "completedAt",
      "completedByUid",
      "revision",
      "schemaVersion",
    ]) ||
    !isString(value.competitionId) ||
    value.format !== "all-hands" ||
    !["sessions", "completion-review", "completed"].includes(
      String(value.stage),
    ) ||
    !isInteger(value.competitionRevision, 1) ||
    !stringArray(value.eligibleParticipantIds) ||
    value.eligibleParticipantIds.length < 2 ||
    !isRecord(value.eligibleParticipantIndex) ||
    Object.keys(value.eligibleParticipantIndex).length !==
      value.eligibleParticipantIds.length ||
    value.eligibleParticipantIds.some(
      (participantId) =>
        (value.eligibleParticipantIndex as Record<string, unknown>)[
          participantId
        ] !== true,
    ) ||
    !isInteger(value.sessionCount, 0, competitionLimits.sessions) ||
    !isInteger(value.resultCount, 0, competitionLimits.sessions) ||
    !isInteger(value.createdAt) ||
    !isInteger(value.updatedAt) ||
    !isInteger(value.activatedAt) ||
    !isString(value.activatedByUid) ||
    !isInteger(value.revision, 1) ||
    value.schemaVersion !== 1
  ) {
    return null;
  }
  const config = parseConfig(value.configSnapshot);
  if (!config) return null;
  const eligibleIndex = value.eligibleParticipantIndex as Record<string, true>;
  const sessions = parseSessions(
    value.sessions,
    String(value.competitionId),
    eligibleIndex,
    config,
  );
  const tieResolutions = parseTieResolutions(
    value.tieResolutions,
    eligibleIndex,
  );
  const placements = parsePlacements(value.placements, eligibleIndex);
  if (!sessions || !tieResolutions || placements === false) return null;
  const live = Object.values(sessions).filter(
    (session) => session.status === "in-progress",
  );
  const currentSessionId =
    typeof value.currentSessionId === "string" ? value.currentSessionId : null;
  const completedAt =
    typeof value.completedAt === "number" ? value.completedAt : null;
  const completedByUid =
    typeof value.completedByUid === "string" ? value.completedByUid : null;
  if (
    value.sessionCount !== Object.keys(sessions).length ||
    value.resultCount !==
      Object.values(sessions).filter((session) => session.result).length ||
    live.length > 1 ||
    (live.length === 1
      ? currentSessionId !== live[0]!.id
      : currentSessionId !== null) ||
    (value.stage === "completed"
      ? !placements || !completedAt || !completedByUid
      : placements !== null ||
        completedAt !== null ||
        completedByUid !== null) ||
    (placements && placements.runtimeRevision !== value.revision)
  ) {
    return null;
  }
  return {
    ...(value as unknown as AllHandsCompetitionRun),
    configSnapshot: config,
    sessions,
    tieResolutions,
    placements,
    currentSessionId,
    completedAt,
    completedByUid,
  };
}
