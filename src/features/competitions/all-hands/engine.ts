import { competitionLimits } from "../domain/config";
import type {
  CompetitionFormValues,
  ParticipantReference,
  PublishedCompetition,
} from "../domain/types";
import {
  participantReferenceWarnings,
  validateCompetition,
} from "../domain/validation";
import type {
  AllHandsActivationReview,
  AllHandsCompetitionRun,
  AllHandsConfigSnapshot,
  AllHandsPointBreakdown,
  AllHandsSession,
  AllHandsSessionResult,
  AllHandsStandingRow,
  AllHandsStandings,
  AllHandsTeam,
  CreateAllHandsSessionInput,
  CustomPointEntry,
  DerivedSessionAward,
  NumericResult,
  NumericResultEntry,
  PlacementResultEntry,
  SessionResultEntity,
  AllHandsResultInput,
} from "./types";

export class AllHandsValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AllHandsValidationError";
  }
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new AllHandsValidationError(message);
}

function plainText(value: string, maximum: number) {
  return (
    value.length <= maximum &&
    !/[<>]/.test(value) &&
    !Array.from(value).some((character) => {
      const code = character.charCodeAt(0);
      return code < 32 || code === 127;
    })
  );
}

function sameMembers(left: string[], right: string[]) {
  return (
    left.length === right.length &&
    [...left].sort().join("|") === [...right].sort().join("|")
  );
}

export function reviewAllHandsActivation(
  competition: PublishedCompetition,
  participants: ParticipantReference[],
  runtimeExists: boolean,
): AllHandsActivationReview {
  const errors: string[] = [];
  const warnings: string[] = [];
  if (competition.status !== "scheduled") {
    errors.push("Only a scheduled competition can be activated.");
  }
  if (competition.format !== "all-hands") {
    errors.push("This engine is available only for All Hands.");
  }
  if (runtimeExists) errors.push("A competition run already exists.");
  const validation = validateCompetition(
    competition as CompetitionFormValues,
    "publish",
  );
  errors.push(
    ...validation
      .filter((item) => item.severity === "error")
      .map((item) => item.message),
  );
  warnings.push(
    ...validation
      .filter((item) => item.severity === "warning")
      .map((item) => item.message),
  );
  participantReferenceWarnings(
    competition.participantIds,
    participants,
  ).forEach((warning) => errors.push(warning.message));
  if (competition.formatConfig.kind !== "all-hands") {
    errors.push("All Hands settings are missing.");
  }
  if (competition.scoringConfig.kind !== "all-hands") {
    errors.push("All Hands scoring is missing.");
  }
  return {
    canActivate: errors.length === 0,
    errors: [...new Set(errors)],
    warnings: [...new Set(warnings)],
    participantCount: competition.participantIds.length,
  };
}

export function createAllHandsRun(
  competition: PublishedCompetition,
  activatedByUid: string,
  activatedAt: number,
): AllHandsCompetitionRun {
  assert(
    competition.status === "scheduled" &&
      competition.format === "all-hands" &&
      competition.formatConfig.kind === "all-hands" &&
      competition.scoringConfig.kind === "all-hands",
    "This competition is not ready for All Hands activation.",
  );
  const format = competition.formatConfig;
  const scoring = competition.scoringConfig;
  const configSnapshot: AllHandsConfigSnapshot = {
    format: "all-hands",
    resultMode: format.resultMode,
    sessionPlan:
      format.sessionPlan.kind === "planned"
        ? {
            kind: "fixed",
            plannedSessionCount: format.sessionPlan.sessionCount,
          }
        : { kind: "open-ended" },
    allowTeams: format.allowTeams,
    teamAwardPolicy: "each-member",
    metrics: {
      primaryLabel: format.primaryMetricLabel,
      primaryDirection: format.primaryMetricDirection,
      secondaryLabel: format.secondaryMetricLabel,
      secondaryDirection: format.secondaryMetricDirection,
      allowNegativeScores: format.allowNegativeScores,
    },
    tieHandling: format.tieHandling,
    winnerBonus: scoring.winnerBonus,
    participationPoints: scoring.participationPoints,
    placementPoints: structuredClone(scoring.placementPoints),
  };
  return {
    competitionId: competition.id,
    format: "all-hands",
    stage: "sessions",
    competitionRevision: competition.revision,
    eligibleParticipantIds: [...competition.participantIds],
    eligibleParticipantIndex: Object.fromEntries(
      competition.participantIds.map((id) => [id, true]),
    ),
    configSnapshot,
    sessions: {},
    tieResolutions: {},
    placements: null,
    currentSessionId: null,
    sessionCount: 0,
    resultCount: 0,
    createdAt: activatedAt,
    updatedAt: activatedAt,
    activatedAt,
    activatedByUid,
    completedAt: null,
    completedByUid: null,
    revision: 1,
    schemaVersion: 1,
  };
}

export function sessionEntities(
  session: AllHandsSession,
): SessionResultEntity[] {
  if (session.mode === "individual") {
    return session.participantIds.map((participantId) => ({
      kind: "participant",
      id: participantId,
      participantId,
    }));
  }
  return session.entityIds.map((teamId) => {
    const team = session.teams[teamId];
    assert(team, "A session team is missing.");
    return {
      kind: "team",
      id: team.id,
      teamId: team.id,
      participantIds: team.participantIds,
    };
  });
}

function validateTeams(
  teams: AllHandsTeam[],
  participantIds: string[],
  eligible: Record<string, true>,
) {
  assert(teams.length >= 2, "A team session needs at least two teams.");
  const teamIds = new Set<string>();
  const names = new Set<string>();
  const assigned: string[] = [];
  for (const team of teams) {
    assert(
      team.id.length > 0 && team.id.length <= 128,
      "A team ID is invalid.",
    );
    assert(!teamIds.has(team.id), "Team IDs must be unique.");
    teamIds.add(team.id);
    const name = team.name.trim();
    assert(
      name.length >= 2 &&
        plainText(name, competitionLimits.teamName) &&
        !names.has(name.toLocaleLowerCase()),
      "Team names must be unique plain text.",
    );
    names.add(name.toLocaleLowerCase());
    assert(team.participantIds.length >= 1, "Every team needs a participant.");
    for (const participantId of team.participantIds) {
      assert(eligible[participantId], "A team participant is not eligible.");
      assigned.push(participantId);
    }
  }
  assert(
    new Set(assigned).size === assigned.length,
    "A participant can belong to only one team in a session.",
  );
  assert(
    sameMembers(assigned, participantIds),
    "Every selected participant must belong to exactly one team.",
  );
}

export function createAllHandsSession(
  run: AllHandsCompetitionRun,
  input: CreateAllHandsSessionInput,
): AllHandsCompetitionRun {
  assert(run.stage !== "completed", "A completed competition is read-only.");
  assert(!run.sessions[input.id], "This session already exists.");
  assert(
    run.sessionCount < competitionLimits.sessions,
    "The session limit is reached.",
  );
  assert(
    !input.startImmediately || !run.currentSessionId,
    "Return the current live session to pending before starting another.",
  );
  const participantIds = [...input.participantIds];
  assert(
    participantIds.length >= 2 &&
      participantIds.length <= competitionLimits.participants,
    "Choose at least two eligible participants.",
  );
  assert(
    new Set(participantIds).size === participantIds.length,
    "A participant can appear only once in a session.",
  );
  participantIds.forEach((id) =>
    assert(run.eligibleParticipantIndex[id], "A participant is not eligible."),
  );
  const title =
    input.title.trim().replace(/\s+/g, " ") ||
    `Session ${run.sessionCount + 1}`;
  assert(
    title.length >= 2 && plainText(title, competitionLimits.sessionTitle),
    `Session title must be plain text up to ${competitionLimits.sessionTitle} characters.`,
  );
  if (input.mode === "team") {
    assert(run.configSnapshot.allowTeams, "Team sessions are not enabled.");
    validateTeams(input.teams, participantIds, run.eligibleParticipantIndex);
  } else {
    assert(
      input.teams.length === 0,
      "Individual sessions cannot contain teams.",
    );
  }
  const teams = Object.fromEntries(
    input.teams.map((team) => [
      team.id,
      { ...team, name: team.name.trim().replace(/\s+/g, " ") },
    ]),
  );
  const session: AllHandsSession = {
    id: input.id,
    competitionId: run.competitionId,
    title,
    sequence: run.sessionCount + 1,
    mode: input.mode,
    participantIds,
    participantIndex: Object.fromEntries(
      participantIds.map((id) => [id, true]),
    ),
    teams,
    entityIds:
      input.mode === "individual"
        ? [...participantIds]
        : input.teams.map((team) => team.id),
    entityIndex: Object.fromEntries(
      (input.mode === "individual"
        ? participantIds
        : input.teams.map((team) => team.id)
      ).map((id) => [id, true]),
    ),
    teamAssignments:
      input.mode === "team"
        ? Object.fromEntries(
            input.teams.flatMap((team) =>
              team.participantIds.map((participantId) => [
                participantId,
                team.id,
              ]),
            ),
          )
        : {},
    status: input.startImmediately ? "in-progress" : "pending",
    result: null,
    createdAt: input.now,
    createdByUid: input.organizerUid,
    startedAt: input.startImmediately ? input.now : null,
    startedByUid: input.startImmediately ? input.organizerUid : null,
    completedAt: null,
    completedByUid: null,
    voidedAt: null,
    voidedByUid: null,
    voidReason: null,
    revision: 1,
    schemaVersion: 1,
  };
  return {
    ...run,
    stage: "sessions",
    sessions: { ...run.sessions, [session.id]: session },
    tieResolutions: {},
    currentSessionId: input.startImmediately
      ? session.id
      : run.currentSessionId,
    sessionCount: run.sessionCount + 1,
    updatedAt: input.now,
    revision: run.revision + 1,
  };
}

function getSession(
  run: AllHandsCompetitionRun,
  sessionId: string,
  expectedRevision: number,
) {
  assert(
    run.stage !== "completed",
    "Reopen the competition before changing sessions.",
  );
  const session = run.sessions[sessionId];
  assert(session, "This session is unavailable.");
  assert(
    session.revision === expectedRevision,
    "This session changed on another device. Reload the latest version before saving.",
  );
  return session;
}

export function startAllHandsSession(
  run: AllHandsCompetitionRun,
  sessionId: string,
  expectedRevision: number,
  organizerUid: string,
  now: number,
) {
  const session = getSession(run, sessionId, expectedRevision);
  assert(session.status === "pending", "Only a pending session can start.");
  assert(
    !run.currentSessionId,
    "Return the current live session to pending first.",
  );
  const next = {
    ...session,
    status: "in-progress" as const,
    startedAt: now,
    startedByUid: organizerUid,
    revision: session.revision + 1,
  };
  return mutateSession(run, next, now, { currentSessionId: sessionId });
}

export function returnAllHandsSessionToPending(
  run: AllHandsCompetitionRun,
  sessionId: string,
  expectedRevision: number,
  now: number,
) {
  const session = getSession(run, sessionId, expectedRevision);
  assert(
    session.status === "in-progress" && !session.result,
    "Only an unfinished live session can return to pending.",
  );
  const next = {
    ...session,
    status: "pending" as const,
    startedAt: null,
    startedByUid: null,
    revision: session.revision + 1,
  };
  return mutateSession(run, next, now, { currentSessionId: null });
}

export function deletePendingAllHandsSession(
  run: AllHandsCompetitionRun,
  sessionId: string,
  expectedRevision: number,
  now: number,
) {
  const session = getSession(run, sessionId, expectedRevision);
  assert(
    session.status === "pending" && !session.result,
    "Only a pending session can be deleted.",
  );
  const sessions = { ...run.sessions };
  delete sessions[sessionId];
  return {
    ...run,
    sessions,
    tieResolutions: {},
    sessionCount: run.sessionCount - 1,
    updatedAt: now,
    revision: run.revision + 1,
  };
}

function mutateSession(
  run: AllHandsCompetitionRun,
  session: AllHandsSession,
  now: number,
  extra: Partial<AllHandsCompetitionRun> = {},
) {
  return {
    ...run,
    ...extra,
    stage: "sessions" as const,
    sessions: { ...run.sessions, [session.id]: session },
    tieResolutions: {},
    placements: null,
    completedAt: null,
    completedByUid: null,
    updatedAt: now,
    revision: run.revision + 1,
  };
}

function validateEntityCoverage(entityIds: string[], resultIds: string[]) {
  assert(
    new Set(resultIds).size === resultIds.length,
    "A result entity appears more than once.",
  );
  assert(
    sameMembers(entityIds, resultIds),
    "Every session entity must appear exactly once.",
  );
}

function validatePlacementEntries(
  entries: PlacementResultEntry[],
  entityIds: string[],
  shared: boolean,
) {
  validateEntityCoverage(
    entityIds,
    entries.map((entry) => entry.entityId),
  );
  entries.forEach((entry) =>
    assert(
      Number.isInteger(entry.placement) && entry.placement >= 1,
      "Placements must be positive whole numbers.",
    ),
  );
  const ordered = [...entries].sort(
    (left, right) => left.placement - right.placement,
  );
  assert(ordered[0]?.placement === 1, "Placements must begin at 1.");
  if (!shared) {
    assert(
      new Set(ordered.map((entry) => entry.placement)).size === ordered.length,
      "Manual-order results cannot contain tied placements.",
    );
    ordered.forEach((entry, index) =>
      assert(
        entry.placement === index + 1,
        "Placements must form a complete order.",
      ),
    );
    return;
  }
  let index = 0;
  while (index < ordered.length) {
    const place = ordered[index]!.placement;
    assert(
      place === index + 1,
      "Shared placements must use competition ranking such as 1, 1, 3.",
    );
    while (ordered[index]?.placement === place) index += 1;
  }
}

function compareNumeric(
  left: NumericResultEntry,
  right: NumericResultEntry,
  config: AllHandsConfigSnapshot,
) {
  const primary = left.primaryScore - right.primaryScore;
  if (primary !== 0)
    return config.metrics.primaryDirection === "higher" ? -primary : primary;
  if (
    config.metrics.secondaryLabel &&
    left.secondaryScore !== null &&
    right.secondaryScore !== null &&
    left.secondaryScore !== right.secondaryScore
  ) {
    const secondary = left.secondaryScore - right.secondaryScore;
    return config.metrics.secondaryDirection === "higher"
      ? -secondary
      : secondary;
  }
  return 0;
}

export function numericPlacements(
  result: Pick<NumericResult, "entries" | "manualOrderEntityIds">,
  config: AllHandsConfigSnapshot,
) {
  const manualPosition = new Map(
    (result.manualOrderEntityIds ?? []).map((id, index) => [id, index]),
  );
  const sorted = [...result.entries].sort((left, right) => {
    const comparison = compareNumeric(left, right, config);
    if (comparison !== 0) return comparison;
    if (config.tieHandling === "manual-order") {
      return (
        (manualPosition.get(left.entityId) ?? Number.MAX_SAFE_INTEGER) -
        (manualPosition.get(right.entityId) ?? Number.MAX_SAFE_INTEGER)
      );
    }
    return 0;
  });
  const placements: PlacementResultEntry[] = [];
  sorted.forEach((entry, index) => {
    const previous = sorted[index - 1];
    const tied = previous && compareNumeric(previous, entry, config) === 0;
    placements.push({
      entityId: entry.entityId,
      placement:
        tied && config.tieHandling === "shared-placement"
          ? placements[index - 1]!.placement
          : index + 1,
    });
  });
  return placements;
}

function validateNumeric(
  input: Extract<AllHandsResultInput, { kind: "numeric" }>,
  entityIds: string[],
  config: AllHandsConfigSnapshot,
) {
  assert(
    input.mode === config.resultMode,
    "Numeric result mode does not match the frozen configuration.",
  );
  validateEntityCoverage(
    entityIds,
    input.entries.map((entry) => entry.entityId),
  );
  input.entries.forEach((entry) => {
    assert(
      Number.isFinite(entry.primaryScore),
      "Every primary score must be a finite number.",
    );
    assert(
      !config.metrics.secondaryLabel || Number.isFinite(entry.secondaryScore),
      "Every configured secondary score must be a finite number.",
    );
    assert(
      config.metrics.secondaryLabel || entry.secondaryScore === null,
      "A secondary score was supplied without a configured metric.",
    );
    assert(
      config.metrics.allowNegativeScores ||
        (entry.primaryScore >= 0 &&
          (entry.secondaryScore === null || entry.secondaryScore >= 0)),
      "Negative scores are not enabled for this competition.",
    );
  });
  if (config.tieHandling === "manual-order") {
    assert(
      Array.isArray(input.manualOrderEntityIds) &&
        sameMembers(input.manualOrderEntityIds, entityIds),
      "Manual tie ordering must include every result entity.",
    );
  } else {
    assert(
      input.manualOrderEntityIds === null,
      "Shared ties cannot contain a manual order.",
    );
  }
}

function validateCustom(entries: CustomPointEntry[], entityIds: string[]) {
  validateEntityCoverage(
    entityIds,
    entries.map((entry) => entry.entityId),
  );
  entries.forEach((entry) => {
    assert(
      Number.isInteger(entry.points) &&
        entry.points >= 0 &&
        entry.points <= competitionLimits.customPoints,
      `Custom points must be a whole number from 0 to ${competitionLimits.customPoints}.`,
    );
    assert(
      entry.note === null ||
        plainText(entry.note, competitionLimits.resultNote),
      `Custom notes must be plain text up to ${competitionLimits.resultNote} characters.`,
    );
  });
}

export function recordAllHandsResult(
  run: AllHandsCompetitionRun,
  sessionId: string,
  expectedRevision: number,
  input: AllHandsResultInput,
  organizerUid: string,
  now: number,
) {
  const session = getSession(run, sessionId, expectedRevision);
  assert(
    session.status === "in-progress" || session.status === "completed",
    "Start the session before recording a result.",
  );
  validateAllHandsResultInput(session, run.configSnapshot, input);
  const resultRevision = (session.result?.resultRevision ?? 0) + 1;
  const result = {
    ...structuredClone(input),
    entityIndex: Object.fromEntries(
      (input.kind === "winner-only"
        ? session.entityIds
        : input.entries.map((entry) => entry.entityId)
      ).map((id) => [id, true]),
    ),
    completedAt: now,
    completedByUid: organizerUid,
    resultRevision,
  } as AllHandsSessionResult;
  const next: AllHandsSession = {
    ...session,
    status: "completed",
    result,
    completedAt: now,
    completedByUid: organizerUid,
    voidedAt: null,
    voidedByUid: null,
    voidReason: null,
    revision: session.revision + 1,
  };
  const wasResult = Boolean(session.result);
  return mutateSession(run, next, now, {
    currentSessionId:
      run.currentSessionId === sessionId ? null : run.currentSessionId,
    resultCount: run.resultCount + (wasResult ? 0 : 1),
  });
}

export function validateAllHandsResultInput(
  session: AllHandsSession,
  config: AllHandsConfigSnapshot,
  input: AllHandsResultInput,
) {
  const entityIds = session.entityIds;
  const mode = config.resultMode;
  if (mode === "winner-only") {
    assert(input.kind === "winner-only", "A winner-only result is required.");
    assert(
      entityIds.includes(input.winnerEntityId),
      "Choose a winner from this session.",
    );
  } else if (mode === "placement") {
    assert(input.kind === "placement", "A placement result is required.");
    validatePlacementEntries(
      input.entries,
      entityIds,
      config.tieHandling === "shared-placement",
    );
  } else if (mode === "custom") {
    assert(input.kind === "custom", "A custom point result is required.");
    validateCustom(input.entries, entityIds);
  } else {
    assert(input.kind === "numeric", "A numeric result is required.");
    validateNumeric(input, entityIds, config);
  }
}

export function voidAllHandsSession(
  run: AllHandsCompetitionRun,
  sessionId: string,
  expectedRevision: number,
  organizerUid: string,
  now: number,
  reason: string,
) {
  const session = getSession(run, sessionId, expectedRevision);
  assert(
    session.status === "completed" && session.result,
    "Only a completed session can be voided.",
  );
  const normalized = reason.trim().replace(/\s+/g, " ");
  assert(
    normalized.length >= 2 &&
      plainText(normalized, competitionLimits.resultNote),
    "Give a short plain-text reason for voiding.",
  );
  return mutateSession(
    run,
    {
      ...session,
      status: "voided",
      voidedAt: now,
      voidedByUid: organizerUid,
      voidReason: normalized,
      revision: session.revision + 1,
    },
    now,
  );
}

export function restoreAllHandsSession(
  run: AllHandsCompetitionRun,
  sessionId: string,
  expectedRevision: number,
  now: number,
) {
  const session = getSession(run, sessionId, expectedRevision);
  assert(
    session.status === "voided" && session.result,
    "Only a valid voided result can be restored.",
  );
  return mutateSession(
    run,
    {
      ...session,
      status: "completed",
      voidedAt: null,
      voidedByUid: null,
      voidReason: null,
      revision: session.revision + 1,
    },
    now,
  );
}

function resultPlacements(
  session: AllHandsSession,
  config: AllHandsConfigSnapshot,
) {
  const result = session.result;
  if (!result) return [];
  if (result.kind === "placement") return result.entries;
  if (result.kind === "numeric") return numericPlacements(result, config);
  if (result.kind === "winner-only") {
    return [{ entityId: result.winnerEntityId, placement: 1 }];
  }
  return [];
}

function participantsForEntity(entity: SessionResultEntity) {
  return entity.kind === "participant"
    ? [entity.participantId]
    : entity.participantIds;
}

export function deriveAllHandsSessionAwards(
  session: AllHandsSession,
  config: AllHandsConfigSnapshot,
): DerivedSessionAward[] {
  if (session.status !== "completed" || !session.result) return [];
  const entities = sessionEntities(session);
  const byId = new Map(entities.map((entity) => [entity.id, entity]));
  const awards: DerivedSessionAward[] = [];
  const add = (
    entityId: string,
    source: DerivedSessionAward["awardKind"],
    points: number,
    label: string,
  ) => {
    if (points === 0) return;
    const entity = byId.get(entityId);
    assert(entity, "A result references an unavailable entity.");
    participantsForEntity(entity).forEach((participantId) =>
      awards.push({
        id: `${session.id}:${participantId}:${source}:${awards.length}`,
        sessionId: session.id,
        sessionLabel: session.title,
        participantId,
        source: entity.kind === "team" ? "team-result" : source,
        awardKind: source,
        points,
        label:
          entity.kind === "team"
            ? `${entity.kind === "team" ? session.teams[entity.teamId]!.name : "Team"}: ${label}`
            : label,
      }),
    );
  };
  if (config.participationPoints > 0) {
    entities.forEach((entity) =>
      add(
        entity.id,
        "participation",
        config.participationPoints,
        `Participation in ${session.title}`,
      ),
    );
  }
  if (session.result.kind === "custom") {
    session.result.entries.forEach((entry) =>
      add(
        entry.entityId,
        "custom",
        entry.points,
        entry.note || `Organizer-defined award in ${session.title}`,
      ),
    );
    return awards;
  }
  if (session.result.kind === "winner-only") {
    add(
      session.result.winnerEntityId,
      "winner",
      config.winnerBonus,
      `Session winner bonus in ${session.title}`,
    );
    return awards;
  }
  const placements = resultPlacements(session, config);
  placements.forEach((entry) => {
    const points =
      config.placementPoints.find((award) => award.place === entry.placement)
        ?.points ?? 0;
    add(
      entry.entityId,
      "placement",
      points,
      `Place ${entry.placement} in ${session.title}`,
    );
  });
  return awards;
}

function compareStanding(
  left: AllHandsStandingRow,
  right: AllHandsStandingRow,
) {
  return (
    right.competitionPoints - left.competitionPoints ||
    right.sessionWins - left.sessionWins ||
    right.secondPlaceFinishes - left.secondPlaceFinishes ||
    right.thirdPlaceFinishes - left.thirdPlaceFinishes ||
    (left.averagePlacement ?? Number.MAX_SAFE_INTEGER) -
      (right.averagePlacement ?? Number.MAX_SAFE_INTEGER)
  );
}

function sameSportingRank(
  left: AllHandsStandingRow,
  right: AllHandsStandingRow,
) {
  return compareStanding(left, right) === 0;
}

export function deriveAllHandsStandings(
  run: AllHandsCompetitionRun,
): AllHandsStandings {
  const sessions = Object.values(run.sessions).filter(
    (session) => session.status === "completed" && session.result,
  );
  const rows = run.eligibleParticipantIds.map<AllHandsStandingRow>(
    (participantId) => {
      const participantSessions = sessions.filter(
        (session) => session.participantIndex[participantId],
      );
      const awards = sessions.flatMap((session) =>
        deriveAllHandsSessionAwards(session, run.configSnapshot).filter(
          (award) => award.participantId === participantId,
        ),
      );
      const placements = participantSessions.flatMap((session) => {
        const entity = sessionEntities(session).find((candidate) =>
          participantsForEntity(candidate).includes(participantId),
        );
        if (!entity) return [];
        const placement = resultPlacements(session, run.configSnapshot).find(
          (entry) => entry.entityId === entity.id,
        );
        return placement ? [placement.placement] : [];
      });
      const placementCounts = Object.fromEntries(
        [...new Set(placements)].map((place) => [
          String(place),
          placements.filter((candidate) => candidate === place).length,
        ]),
      );
      return {
        participantId,
        rank: 0,
        tied: false,
        competitionPoints: awards.reduce((sum, award) => sum + award.points, 0),
        sessionsPlayed: participantSessions.length,
        sessionWins: placementCounts["1"] ?? 0,
        secondPlaceFinishes: placementCounts["2"] ?? 0,
        thirdPlaceFinishes: placementCounts["3"] ?? 0,
        placementCounts,
        averagePlacement: placements.length
          ? placements.reduce((sum, place) => sum + place, 0) /
            placements.length
          : null,
        participationCount: participantSessions.length,
        customPoints: awards
          .filter(
            (award) =>
              award.source === "custom" || award.source === "team-result",
          )
          .reduce((sum, award) => sum + award.points, 0),
        teamSessions: participantSessions.filter(
          (session) => session.mode === "team",
        ).length,
        remainingPlannedSessions:
          run.configSnapshot.sessionPlan.kind === "fixed"
            ? Math.max(
                0,
                run.configSnapshot.sessionPlan.plannedSessionCount -
                  sessions.length,
              )
            : null,
      };
    },
  );
  rows.sort(compareStanding);
  const unresolvedTieGroups: string[][] = [];
  let index = 0;
  while (index < rows.length) {
    let end = index + 1;
    while (end < rows.length && sameSportingRank(rows[index]!, rows[end]!))
      end += 1;
    const group = rows.slice(index, end);
    const resolution = Object.values(run.tieResolutions).find((item) =>
      sameMembers(
        item.participantIds,
        group.map((row) => row.participantId),
      ),
    );
    if (resolution) {
      const order = new Map(
        resolution.orderedParticipantIds.map((id, position) => [id, position]),
      );
      group.sort(
        (left, right) =>
          (order.get(left.participantId) ?? 0) -
          (order.get(right.participantId) ?? 0),
      );
      rows.splice(index, group.length, ...group);
      group.forEach((row, offset) => {
        row.rank = index + offset + 1;
        row.tied = false;
      });
    } else {
      group.forEach((row) => {
        row.rank = index + 1;
        row.tied = group.length > 1;
      });
      if (group.length > 1) {
        unresolvedTieGroups.push(group.map((row) => row.participantId));
      }
    }
    index = end;
  }
  const standingsFingerprint = rows
    .map(
      (row) =>
        `${row.participantId}:${row.competitionPoints}:${row.sessionWins}:${row.secondPlaceFinishes}:${row.thirdPlaceFinishes}:${row.averagePlacement ?? "-"}`,
    )
    .join("|");
  return { rows, unresolvedTieGroups, standingsFingerprint };
}

export function deriveAllHandsCompetitionPointBreakdown(
  run: AllHandsCompetitionRun,
): AllHandsPointBreakdown[] {
  const items = Object.values(run.sessions).flatMap((session) =>
    deriveAllHandsSessionAwards(session, run.configSnapshot),
  );
  return run.eligibleParticipantIds.map((participantId) => {
    const participantItems = items.filter(
      (item) => item.participantId === participantId,
    );
    return {
      participantId,
      total: participantItems.reduce((sum, item) => sum + item.points, 0),
      items: participantItems,
    };
  });
}

export function canReviewAllHandsCompletion(run: AllHandsCompetitionRun) {
  const sessions = Object.values(run.sessions);
  const completed = sessions.filter(
    (session) => session.status === "completed",
  ).length;
  if (sessions.some((session) => session.status === "in-progress")) {
    return {
      allowed: false,
      reason: "Finish or return the live session to pending first.",
    };
  }
  if (run.configSnapshot.sessionPlan.kind === "fixed") {
    const required = run.configSnapshot.sessionPlan.plannedSessionCount;
    if (completed < required) {
      return {
        allowed: false,
        reason: `${required - completed} more completed session${required - completed === 1 ? " is" : "s are"} required.`,
      };
    }
  } else if (completed < 1) {
    return { allowed: false, reason: "Complete at least one session first." };
  }
  return { allowed: true, reason: null };
}

export function requestAllHandsCompletionReview(
  run: AllHandsCompetitionRun,
  now: number,
) {
  const review = canReviewAllHandsCompletion(run);
  assert(review.allowed, review.reason ?? "Completion review is unavailable.");
  return {
    ...run,
    stage: "completion-review" as const,
    updatedAt: now,
    revision: run.revision + 1,
  };
}

export function resolveAllHandsTie(
  run: AllHandsCompetitionRun,
  participantIds: string[],
  orderedParticipantIds: string[],
  reason: string | null,
  organizerUid: string,
  now: number,
) {
  assert(
    run.stage === "completion-review",
    "Enter completion review before resolving a tie.",
  );
  const standings = deriveAllHandsStandings(run);
  assert(
    standings.unresolvedTieGroups.some((group) =>
      sameMembers(group, participantIds),
    ),
    "This tie is no longer unresolved.",
  );
  assert(
    sameMembers(participantIds, orderedParticipantIds),
    "The tie order must include every tied participant once.",
  );
  const normalizedReason = reason?.trim().replace(/\s+/g, " ") || null;
  assert(
    normalizedReason === null ||
      plainText(normalizedReason, competitionLimits.resultNote),
    "Tie-resolution notes must be short plain text.",
  );
  const id = `final-${[...participantIds].sort().join("-")}`;
  return {
    ...run,
    tieResolutions: {
      ...run.tieResolutions,
      [id]: {
        id,
        participantIds: [...participantIds],
        orderedParticipantIds: [...orderedParticipantIds],
        reason: normalizedReason,
        standingsFingerprint: standings.standingsFingerprint,
        resolvedAt: now,
        resolvedByUid: organizerUid,
        schemaVersion: 1 as const,
      },
    },
    updatedAt: now,
    revision: run.revision + 1,
  };
}

export function completeAllHandsRun(
  run: AllHandsCompetitionRun,
  organizerUid: string,
  now: number,
) {
  assert(run.stage === "completion-review", "Review completion first.");
  const review = canReviewAllHandsCompletion(run);
  assert(review.allowed, review.reason ?? "Completion is unavailable.");
  const standings = deriveAllHandsStandings(run);
  const podiumTie = standings.unresolvedTieGroups.find((group) =>
    group.some(
      (id) =>
        (standings.rows.find((row) => row.participantId === id)?.rank ?? 99) <=
        3,
    ),
  );
  assert(
    !podiumTie,
    "Resolve every tie affecting the final podium before completing.",
  );
  const nextRevision = run.revision + 1;
  return {
    ...run,
    stage: "completed" as const,
    placements: {
      entries: standings.rows.map((row) => ({
        participantId: row.participantId,
        place: row.rank,
        totalCompetitionPoints: row.competitionPoints,
        sessionWins: row.sessionWins,
        secondPlaceFinishes: row.secondPlaceFinishes,
        thirdPlaceFinishes: row.thirdPlaceFinishes,
        completionAwards: 0,
      })),
      completedAt: now,
      completedByUid: organizerUid,
      runtimeRevision: nextRevision,
      schemaVersion: 1 as const,
    },
    completedAt: now,
    completedByUid: organizerUid,
    updatedAt: now,
    revision: nextRevision,
  };
}

export function reopenAllHandsRun(run: AllHandsCompetitionRun, now: number) {
  assert(run.stage === "completed", "Only a completed competition can reopen.");
  return {
    ...run,
    stage: "sessions" as const,
    tieResolutions: {},
    placements: null,
    completedAt: null,
    completedByUid: null,
    updatedAt: now,
    revision: run.revision + 1,
  };
}
