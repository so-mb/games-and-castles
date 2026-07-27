import { validateSeries } from "../domain/validation";
import { competitionLimits } from "../domain/config";
import { validateMatchResult } from "./series";
import { parseAllHandsRun } from "../all-hands/runtime";
import type {
  CompetitionMatch,
  CompetitionRun,
  KnockoutRuntime,
  PlacementSnapshot,
  RoundRobinCompetitionConfigSnapshot,
  RoundRobinRuntime,
  TieResolution,
} from "./types";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasOnlyKeys(value: Record<string, unknown>, allowed: string[]) {
  return Object.keys(value).every((key) => allowed.includes(key));
}

function isInteger(value: unknown, minimum = 0) {
  return (
    typeof value === "number" &&
    Number.isFinite(value) &&
    Number.isInteger(value) &&
    value >= minimum
  );
}

function stringArray(
  value: unknown,
  maximum: number = competitionLimits.participants,
): value is string[] {
  return (
    Array.isArray(value) &&
    value.length <= maximum &&
    value.every(
      (item) =>
        typeof item === "string" &&
        item.length > 0 &&
        item.length <= competitionLimits.participantId,
    )
  );
}

function scoreMap(value: unknown, keys: string[]) {
  return (
    isRecord(value) &&
    Object.keys(value).length === keys.length &&
    keys.every(
      (key) =>
        isInteger(value[key]) && Number(value[key]) <= competitionLimits.score,
    )
  );
}

function parseConfig(
  value: unknown,
): RoundRobinCompetitionConfigSnapshot | null {
  if (
    !isRecord(value) ||
    !hasOnlyKeys(value, [
      "format",
      "series",
      "allowDraws",
      "qualificationCount",
      "includeThirdPlace",
      "tableScoring",
      "overallScoring",
    ]) ||
    value.format !== "round-robin-knockout" ||
    value.allowDraws !== false ||
    !isRecord(value.series) ||
    !hasOnlyKeys(value.series, ["kind", "winsRequired", "maximumRounds"]) ||
    validateSeries(value.series as never).length > 0 ||
    !isInteger(value.qualificationCount, 2) ||
    typeof value.includeThirdPlace !== "boolean" ||
    !scoreMap(value.tableScoring, [
      "pointsForMatchWin",
      "pointsForDraw",
      "pointsForMatchLoss",
    ]) ||
    !scoreMap(value.overallScoring, [
      "matchWinBonus",
      "pointsPerRoundWon",
      "participationPoints",
      "qualificationBonus",
      "competitionWinnerBonus",
      "runnerUpBonus",
      "thirdPlaceBonus",
    ])
  ) {
    return null;
  }
  return value as unknown as RoundRobinCompetitionConfigSnapshot;
}

function parseResult(
  value: unknown,
  match: CompetitionMatch,
  series: RoundRobinCompetitionConfigSnapshot["series"],
) {
  if (value === null || value === undefined) return null;
  if (
    !isRecord(value) ||
    !hasOnlyKeys(value, [
      "roundWinnerIds",
      "participantAWins",
      "participantBWins",
      "winnerId",
      "isDraw",
      "completedAt",
      "completedByUid",
      "resultRevision",
    ]) ||
    !stringArray(value.roundWinnerIds, series.maximumRounds) ||
    !isInteger(value.participantAWins) ||
    !isInteger(value.participantBWins) ||
    typeof value.winnerId !== "string" ||
    value.isDraw !== false ||
    !isInteger(value.completedAt) ||
    typeof value.completedByUid !== "string" ||
    !isInteger(value.resultRevision, 1)
  ) {
    return null;
  }
  const result = value as unknown as NonNullable<CompetitionMatch["result"]>;
  return validateMatchResult(match, series, result) ? result : null;
}

function parseMatches(
  value: unknown,
  competitionId: string,
  participantIndex: Record<string, true>,
  config: RoundRobinCompetitionConfigSnapshot,
) {
  if (!isRecord(value)) return null;
  const matches: Record<string, CompetitionMatch> = {};
  for (const [id, raw] of Object.entries(value)) {
    if (
      !isRecord(raw) ||
      !hasOnlyKeys(raw, [
        "id",
        "competitionId",
        "stage",
        "fixtureRound",
        "sequenceInRound",
        "bracketRound",
        "bracketSlot",
        "globalSequence",
        "participantAId",
        "participantBId",
        "sourceA",
        "sourceB",
        "seedA",
        "seedB",
        "isBye",
        "status",
        "result",
        "revision",
        "schemaVersion",
      ]) ||
      raw.id !== id ||
      raw.competitionId !== competitionId ||
      !["round-robin", "knockout", "third-place"].includes(String(raw.stage)) ||
      !["pending", "ready", "in-progress", "completed"].includes(
        String(raw.status),
      ) ||
      !isInteger(raw.globalSequence, 1) ||
      !isInteger(raw.sequenceInRound, 1) ||
      !isInteger(raw.revision, 1) ||
      raw.schemaVersion !== 1 ||
      typeof raw.isBye !== "boolean" ||
      !(
        raw.participantAId === null ||
        raw.participantAId === undefined ||
        (typeof raw.participantAId === "string" &&
          participantIndex[raw.participantAId])
      ) ||
      !(
        raw.participantBId === null ||
        raw.participantBId === undefined ||
        (typeof raw.participantBId === "string" &&
          participantIndex[raw.participantBId])
      ) ||
      (typeof raw.participantAId === "string" &&
        raw.participantAId === raw.participantBId) ||
      (raw.stage === "round-robin" &&
        (typeof raw.participantAId !== "string" ||
          typeof raw.participantBId !== "string"))
    ) {
      return null;
    }
    const match = {
      ...(raw as unknown as CompetitionMatch),
      fixtureRound:
        typeof raw.fixtureRound === "number" ? raw.fixtureRound : null,
      bracketRound:
        typeof raw.bracketRound === "number" ? raw.bracketRound : null,
      bracketSlot: typeof raw.bracketSlot === "number" ? raw.bracketSlot : null,
      participantAId:
        typeof raw.participantAId === "string" ? raw.participantAId : null,
      participantBId:
        typeof raw.participantBId === "string" ? raw.participantBId : null,
    };
    const result = parseResult(raw.result, match, config.series);
    if (raw.result !== null && raw.result !== undefined && !result) return null;
    match.result = result;
    if (
      (match.result && match.status !== "completed") ||
      (!match.result && match.status === "completed" && !match.isBye) ||
      (match.isBye && match.stage === "round-robin")
    ) {
      return null;
    }
    matches[id] = match;
  }
  const roundRobin = Object.values(matches).filter(
    (match) => match.stage === "round-robin",
  );
  const pairs = roundRobin.map((match) =>
    [match.participantAId!, match.participantBId!].sort().join(":"),
  );
  if (new Set(pairs).size !== pairs.length) return null;
  for (const match of Object.values(matches)) {
    for (const source of [match.sourceA, match.sourceB]) {
      if (
        source &&
        (!isRecord(source) ||
          !hasOnlyKeys(source, ["matchId", "outcome"]) ||
          typeof source.matchId !== "string" ||
          !matches[source.matchId] ||
          !["winner", "loser"].includes(source.outcome))
      ) {
        return null;
      }
    }
  }
  return matches;
}

function validRoundRobin(
  value: unknown,
  matches: Record<string, CompetitionMatch>,
  participantCount: number,
  participantIndex: Record<string, true>,
): value is RoundRobinRuntime {
  const expectedMatchCount = (participantCount * (participantCount - 1)) / 2;
  const expectedRoundCount =
    participantCount % 2 === 0 ? participantCount - 1 : participantCount;
  if (
    !isRecord(value) ||
    !hasOnlyKeys(value, [
      "fixtureRoundCount",
      "expectedMatchCount",
      "rounds",
    ]) ||
    !isInteger(value.fixtureRoundCount, 1) ||
    !isInteger(value.expectedMatchCount, 1) ||
    !Array.isArray(value.rounds) ||
    value.fixtureRoundCount !== expectedRoundCount ||
    value.expectedMatchCount !== expectedMatchCount ||
    value.rounds.length !== expectedRoundCount
  ) {
    return false;
  }
  const roundRobinMatches = Object.values(matches).filter(
    (match) => match.stage === "round-robin",
  );
  if (roundRobinMatches.length !== expectedMatchCount) return false;

  const seenMatchIds = new Set<string>();
  const seenByeIds = new Set<string>();
  for (const [index, rawRound] of value.rounds.entries()) {
    if (
      !isRecord(rawRound) ||
      !hasOnlyKeys(rawRound, ["number", "matchIds", "byeParticipantId"]) ||
      rawRound.number !== index + 1 ||
      !stringArray(rawRound.matchIds, participantCount) ||
      new Set(rawRound.matchIds).size !== rawRound.matchIds.length
    ) {
      return false;
    }
    const roundParticipants = new Set<string>();
    const roundSequences = new Set<number>();
    for (const id of rawRound.matchIds) {
      const match = matches[id];
      if (
        !match ||
        match.stage !== "round-robin" ||
        match.fixtureRound !== rawRound.number ||
        match.sequenceInRound < 1 ||
        match.sequenceInRound > rawRound.matchIds.length ||
        roundSequences.has(match.sequenceInRound) ||
        seenMatchIds.has(id) ||
        !match.participantAId ||
        !match.participantBId ||
        roundParticipants.has(match.participantAId) ||
        roundParticipants.has(match.participantBId)
      ) {
        return false;
      }
      seenMatchIds.add(id);
      roundSequences.add(match.sequenceInRound);
      roundParticipants.add(match.participantAId);
      roundParticipants.add(match.participantBId);
    }
    const byeParticipantId = rawRound.byeParticipantId;
    if (participantCount % 2 === 0) {
      if (byeParticipantId !== null && byeParticipantId !== undefined) {
        return false;
      }
    } else if (
      typeof byeParticipantId !== "string" ||
      participantIndex[byeParticipantId] !== true ||
      seenByeIds.has(byeParticipantId) ||
      roundParticipants.has(byeParticipantId)
    ) {
      return false;
    } else {
      seenByeIds.add(byeParticipantId);
    }
    if (
      roundParticipants.size !==
      (participantCount % 2 === 0 ? participantCount : participantCount - 1)
    ) {
      return false;
    }
  }
  return (
    seenMatchIds.size === roundRobinMatches.length &&
    (participantCount % 2 === 0 || seenByeIds.size === participantCount)
  );
}

function validTieResolutions(
  value: unknown,
  participantIndex: Record<string, true>,
): value is Record<string, TieResolution> {
  if (value === undefined || value === null) return true;
  if (!isRecord(value)) return false;
  return Object.entries(value).every(
    ([id, resolution]) =>
      isRecord(resolution) &&
      hasOnlyKeys(resolution, [
        "id",
        "participantIds",
        "orderedParticipantIds",
        "reason",
        "resultFingerprint",
        "resolvedAt",
        "resolvedByUid",
        "schemaVersion",
      ]) &&
      resolution.id === id &&
      stringArray(resolution.participantIds) &&
      resolution.participantIds.length >= 2 &&
      stringArray(resolution.orderedParticipantIds) &&
      resolution.participantIds.length ===
        resolution.orderedParticipantIds.length &&
      resolution.participantIds.every((participantId) =>
        Boolean(participantIndex[participantId]),
      ) &&
      new Set(resolution.orderedParticipantIds).size ===
        resolution.participantIds.length &&
      [...resolution.orderedParticipantIds].sort().join("|") ===
        [...resolution.participantIds].sort().join("|") &&
      typeof resolution.reason === "string" &&
      resolution.reason.length <= 160 &&
      typeof resolution.resultFingerprint === "string" &&
      isInteger(resolution.resolvedAt) &&
      typeof resolution.resolvedByUid === "string" &&
      resolution.schemaVersion === 1,
  );
}

function validKnockout(
  value: unknown,
  matches: Record<string, CompetitionMatch>,
  participantIndex: Record<string, true>,
  qualificationCount: number,
  includeThirdPlace: boolean,
): value is KnockoutRuntime | null {
  if (value === null || value === undefined) return true;
  return (
    isRecord(value) &&
    hasOnlyKeys(value, [
      "qualificationParticipantIds",
      "seedOrder",
      "bracketSize",
      "rounds",
      "thirdPlaceMatchId",
      "sourceResultFingerprint",
      "generatedAt",
      "generatedByUid",
      "generationVersion",
    ]) &&
    stringArray(value.qualificationParticipantIds) &&
    stringArray(value.seedOrder) &&
    value.seedOrder.length === qualificationCount &&
    value.seedOrder.length === value.qualificationParticipantIds.length &&
    value.seedOrder.every((id) => participantIndex[id]) &&
    new Set(value.seedOrder).size === value.seedOrder.length &&
    [...value.seedOrder].sort().join("|") ===
      [...value.qualificationParticipantIds].sort().join("|") &&
    isInteger(value.bracketSize, 2) &&
    (Number(value.bracketSize) & (Number(value.bracketSize) - 1)) === 0 &&
    Number(value.bracketSize) >= qualificationCount &&
    Number(value.bracketSize) < qualificationCount * 2 &&
    Array.isArray(value.rounds) &&
    value.rounds.length === Math.log2(Number(value.bracketSize)) &&
    value.rounds.every(
      (round, index) =>
        isRecord(round) &&
        hasOnlyKeys(round, ["number", "label", "matchIds"]) &&
        isInteger(round.number, 1) &&
        round.number === index + 1 &&
        typeof round.label === "string" &&
        stringArray(round.matchIds) &&
        round.matchIds.length ===
          Number(value.bracketSize) / 2 ** Number(round.number) &&
        new Set(round.matchIds).size === round.matchIds.length &&
        round.matchIds.every(
          (id) =>
            matches[id]?.stage === "knockout" &&
            matches[id]?.bracketRound === round.number,
        ),
    ) &&
    new Set(
      value.rounds.flatMap((round) =>
        isRecord(round) && Array.isArray(round.matchIds)
          ? (round.matchIds as string[])
          : [],
      ),
    ).size ===
      Number(value.bracketSize) - 1 &&
    Object.values(matches).filter((match) => match.stage === "knockout")
      .length ===
      Number(value.bracketSize) - 1 &&
    Object.values(matches).filter((match) => match.stage === "third-place")
      .length === (includeThirdPlace ? 1 : 0) &&
    (includeThirdPlace
      ? typeof value.thirdPlaceMatchId === "string" &&
        matches[value.thirdPlaceMatchId]?.stage === "third-place"
      : value.thirdPlaceMatchId === null ||
        value.thirdPlaceMatchId === undefined) &&
    typeof value.sourceResultFingerprint === "string" &&
    isInteger(value.generatedAt) &&
    typeof value.generatedByUid === "string" &&
    value.generationVersion === 1
  );
}

function validPlacements(
  value: unknown,
  participantIndex: Record<string, true>,
): value is PlacementSnapshot | null {
  if (value === null || value === undefined) return true;
  return (
    isRecord(value) &&
    hasOnlyKeys(value, [
      "entries",
      "completedAt",
      "completedByUid",
      "runtimeRevision",
      "schemaVersion",
    ]) &&
    Array.isArray(value.entries) &&
    new Set(
      value.entries
        .filter(isRecord)
        .map((entry) => String(entry.participantId)),
    ).size === value.entries.length &&
    value.entries.every(
      (entry) =>
        isRecord(entry) &&
        hasOnlyKeys(entry, [
          "participantId",
          "place",
          "placementBand",
          "eliminationStage",
        ]) &&
        typeof entry.participantId === "string" &&
        participantIndex[entry.participantId] &&
        (entry.place === null || isInteger(entry.place, 1)) &&
        typeof entry.placementBand === "string" &&
        typeof entry.eliminationStage === "string",
    ) &&
    isInteger(value.completedAt) &&
    typeof value.completedByUid === "string" &&
    isInteger(value.runtimeRevision, 1) &&
    value.schemaVersion === 1
  );
}

export function parseCompetitionRun(value: unknown): CompetitionRun | null {
  if (
    !isRecord(value) ||
    !hasOnlyKeys(value, [
      "competitionId",
      "format",
      "stage",
      "competitionRevision",
      "participantIds",
      "participantIndex",
      "randomizedParticipantIds",
      "randomizedPositions",
      "configSnapshot",
      "roundRobin",
      "matches",
      "tieResolutions",
      "knockout",
      "placements",
      "currentMatchId",
      "resultCount",
      "generationVersion",
      "createdAt",
      "updatedAt",
      "activatedAt",
      "activatedByUid",
      "completedAt",
      "completedByUid",
      "revision",
      "schemaVersion",
    ]) ||
    typeof value.competitionId !== "string" ||
    value.format !== "round-robin-knockout" ||
    !["round-robin", "qualification-review", "knockout", "completed"].includes(
      String(value.stage),
    ) ||
    !isInteger(value.competitionRevision, 1) ||
    !stringArray(value.participantIds) ||
    value.participantIds.length < 2 ||
    new Set(value.participantIds).size !== value.participantIds.length ||
    !stringArray(value.randomizedParticipantIds) ||
    value.randomizedParticipantIds.length !== value.participantIds.length ||
    new Set(value.randomizedParticipantIds).size !==
      value.participantIds.length ||
    [...value.randomizedParticipantIds].sort().join("|") !==
      [...value.participantIds].sort().join("|") ||
    !isRecord(value.participantIndex) ||
    !isRecord(value.randomizedPositions)
  ) {
    return null;
  }
  const participantIds = value.participantIds as string[];
  const participantIndex = value.participantIndex as Record<string, true>;
  const randomizedPositions = value.randomizedPositions as Record<
    string,
    unknown
  >;
  if (
    Object.keys(participantIndex).length !== participantIds.length ||
    participantIds.some((id) => participantIndex[id] !== true) ||
    participantIds.some(
      (id) =>
        randomizedPositions[id] !==
        (value.randomizedParticipantIds as string[]).indexOf(id),
    )
  ) {
    return null;
  }
  const config = parseConfig(value.configSnapshot);
  if (!config || config.qualificationCount > participantIds.length) return null;
  const matches = parseMatches(
    value.matches,
    value.competitionId,
    participantIndex,
    config,
  );
  if (
    !matches ||
    !validRoundRobin(
      value.roundRobin,
      matches,
      participantIds.length,
      participantIndex,
    ) ||
    !validTieResolutions(value.tieResolutions, participantIndex) ||
    !validKnockout(
      value.knockout,
      matches,
      participantIndex,
      config.qualificationCount,
      config.includeThirdPlace,
    ) ||
    !validPlacements(value.placements, participantIndex) ||
    !(
      value.currentMatchId === null ||
      value.currentMatchId === undefined ||
      (typeof value.currentMatchId === "string" &&
        matches[value.currentMatchId])
    ) ||
    !isInteger(value.resultCount) ||
    value.resultCount !==
      Object.values(matches).filter((match) => match.result !== null).length ||
    value.generationVersion !== 1 ||
    !isInteger(value.createdAt) ||
    !isInteger(value.updatedAt) ||
    !isInteger(value.activatedAt) ||
    typeof value.activatedByUid !== "string" ||
    !(
      value.completedAt === null ||
      value.completedAt === undefined ||
      isInteger(value.completedAt)
    ) ||
    !(
      value.completedByUid === null ||
      value.completedByUid === undefined ||
      typeof value.completedByUid === "string"
    ) ||
    !isInteger(value.revision, 1) ||
    value.schemaVersion !== 1
  ) {
    return null;
  }
  const inProgressMatches = Object.values(matches).filter(
    (match) => match.status === "in-progress",
  );
  const hasKnockout = value.knockout !== null && value.knockout !== undefined;
  const hasPlacements =
    value.placements !== null && value.placements !== undefined;
  const hasCompletion =
    typeof value.completedAt === "number" &&
    typeof value.completedByUid === "string";
  if (
    inProgressMatches.length > 1 ||
    (inProgressMatches.length === 1
      ? value.currentMatchId !== inProgressMatches[0]!.id
      : value.currentMatchId !== null && value.currentMatchId !== undefined) ||
    (value.stage === "completed"
      ? !hasKnockout || !hasPlacements || !hasCompletion
      : hasPlacements || hasCompletion) ||
    (value.stage === "knockout" && !hasKnockout) ||
    ((value.stage === "round-robin" ||
      value.stage === "qualification-review") &&
      hasKnockout)
  ) {
    return null;
  }
  const roundRobin = value.roundRobin as unknown as RoundRobinRuntime;
  const knockout = value.knockout as KnockoutRuntime | null | undefined;
  const placements = value.placements as PlacementSnapshot | null | undefined;
  return {
    ...(value as unknown as CompetitionRun),
    configSnapshot: config,
    matches,
    roundRobin: {
      ...roundRobin,
      rounds: roundRobin.rounds.map((round) => ({
        ...round,
        byeParticipantId: round.byeParticipantId ?? null,
      })),
    },
    tieResolutions: (value.tieResolutions ?? {}) as Record<
      string,
      TieResolution
    >,
    knockout: knockout
      ? ({
          ...knockout,
          thirdPlaceMatchId:
            typeof knockout.thirdPlaceMatchId === "string"
              ? knockout.thirdPlaceMatchId
              : null,
        } as KnockoutRuntime)
      : null,
    placements: placements
      ? ({
          ...placements,
          entries: placements.entries.map((entry) => ({
            ...entry,
            place: typeof entry.place === "number" ? entry.place : null,
          })),
        } as PlacementSnapshot)
      : null,
    currentMatchId:
      typeof value.currentMatchId === "string" ? value.currentMatchId : null,
    completedAt:
      typeof value.completedAt === "number" ? value.completedAt : null,
    completedByUid:
      typeof value.completedByUid === "string" ? value.completedByUid : null,
  };
}

export function parseCompetitionRunCollection(value: unknown) {
  if (value === null || value === undefined) {
    return {
      runs: [] as import("./types").AnyCompetitionRun[],
      invalidIds: [] as string[],
    };
  }
  if (!isRecord(value)) {
    return { runs: [] as CompetitionRun[], invalidIds: ["collection"] };
  }
  const runs: import("./types").AnyCompetitionRun[] = [];
  const invalidIds: string[] = [];
  Object.entries(value).forEach(([id, raw]) => {
    const run =
      isRecord(raw) && raw.format === "all-hands"
        ? parseAllHandsRun(raw)
        : parseCompetitionRun(raw);
    if (!run || run.competitionId !== id) invalidIds.push(id);
    else runs.push(run);
  });
  return { runs, invalidIds };
}
