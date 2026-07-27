import { competitionLimits } from "../domain/config";
import { validateSeries } from "../domain/validation";
import { validateMatchResult } from "../engine/series";
import { nextPowerOfTwo, seededPositions } from "../engine/knockout";
import type { CompetitionMatch } from "../engine/types";
import type {
  CompetitionGroup,
  CrossGroupSeedResolution,
  GroupCompetitionConfigSnapshot,
  GroupCompetitionMatch,
  GroupDrawSnapshot,
  GroupKnockoutRun,
  GroupTieResolution,
  QualificationSnapshot,
} from "./types";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function onlyKeys(value: Record<string, unknown>, allowed: string[]) {
  return Object.keys(value).every((key) => allowed.includes(key));
}

function integer(
  value: unknown,
  minimum = 0,
  maximum = Number.MAX_SAFE_INTEGER,
) {
  return (
    typeof value === "number" &&
    Number.isInteger(value) &&
    value >= minimum &&
    value <= maximum
  );
}

function strings(
  value: unknown,
  maximum: number = competitionLimits.participants,
): value is string[] {
  return (
    Array.isArray(value) &&
    value.length <= maximum &&
    value.every(
      (entry) =>
        typeof entry === "string" &&
        entry.length > 0 &&
        entry.length <= competitionLimits.participantId,
    )
  );
}

function uniqueStrings(
  value: unknown,
  maximum: number = competitionLimits.participants,
): value is string[] {
  return strings(value, maximum) && new Set(value).size === value.length;
}

function scoreRecord(value: unknown, keys: string[]) {
  return (
    isRecord(value) &&
    onlyKeys(value, keys) &&
    keys.every((key) => integer(value[key], 0, competitionLimits.score))
  );
}

function parseConfig(value: unknown): GroupCompetitionConfigSnapshot | null {
  const keys = [
    "format",
    "groupCountMode",
    "resolvedGroupCount",
    "qualifiersPerGroup",
    "roundRobinLegs",
    "series",
    "allowDraws",
    "includeThirdPlace",
    "tableScoring",
    "overallScoring",
    "expectedGroupMatchCount",
    "drawVersion",
    "fixtureGenerationVersion",
    "seedingVersion",
  ];
  if (
    !isRecord(value) ||
    !onlyKeys(value, keys) ||
    !keys.every((key) => key in value) ||
    value.format !== "group-knockout" ||
    !["automatic", "manual"].includes(String(value.groupCountMode)) ||
    !integer(value.resolvedGroupCount, 1, competitionLimits.groups) ||
    !integer(value.qualifiersPerGroup, 1, competitionLimits.participants) ||
    ![1, 2].includes(Number(value.roundRobinLegs)) ||
    !isRecord(value.series) ||
    !onlyKeys(value.series, ["kind", "winsRequired", "maximumRounds"]) ||
    validateSeries(value.series as never).length > 0 ||
    value.allowDraws !== false ||
    typeof value.includeThirdPlace !== "boolean" ||
    !scoreRecord(value.tableScoring, [
      "pointsForMatchWin",
      "pointsForDraw",
      "pointsForMatchLoss",
    ]) ||
    !scoreRecord(value.overallScoring, [
      "matchWinBonus",
      "pointsPerRoundWon",
      "participationPoints",
      "qualificationBonus",
      "competitionWinnerBonus",
      "runnerUpBonus",
      "thirdPlaceBonus",
    ]) ||
    !integer(value.expectedGroupMatchCount, 1, 1000) ||
    value.drawVersion !== 1 ||
    value.fixtureGenerationVersion !== 1 ||
    value.seedingVersion !== 1
  ) {
    return null;
  }
  return value as unknown as GroupCompetitionConfigSnapshot;
}

function parseDraw(
  value: unknown,
  participantIds: string[],
  groups: CompetitionGroup[],
): GroupDrawSnapshot | null {
  const groupIds = new Set(groups.map((group) => group.id));
  if (
    !isRecord(value) ||
    !onlyKeys(value, [
      "shuffledParticipantIds",
      "shuffledPositions",
      "assignments",
      "generatedAt",
      "drawVersion",
    ]) ||
    !uniqueStrings(value.shuffledParticipantIds) ||
    !isRecord(value.shuffledPositions) ||
    !Array.isArray(value.assignments) ||
    !integer(value.generatedAt) ||
    value.drawVersion !== 1
  ) {
    return null;
  }
  const shuffled = value.shuffledParticipantIds as string[];
  if (
    shuffled.length !== participantIds.length ||
    [...shuffled].sort().join("|") !== [...participantIds].sort().join("|") ||
    Object.keys(value.shuffledPositions).length !== participantIds.length ||
    shuffled.some(
      (participantId, index) =>
        (value.shuffledPositions as Record<string, unknown>)[participantId] !==
        index,
    ) ||
    value.assignments.length !== participantIds.length
  ) {
    return null;
  }
  const assignmentIds = new Set<string>();
  for (const assignment of value.assignments) {
    if (
      !isRecord(assignment) ||
      !onlyKeys(assignment, [
        "participantId",
        "shuffledPosition",
        "groupId",
        "positionInGroup",
      ]) ||
      typeof assignment.participantId !== "string" ||
      assignmentIds.has(assignment.participantId) ||
      !groupIds.has(String(assignment.groupId)) ||
      !integer(assignment.shuffledPosition, 0, participantIds.length - 1) ||
      shuffled[Number(assignment.shuffledPosition)] !==
        assignment.participantId ||
      !integer(assignment.positionInGroup, 0, participantIds.length - 1) ||
      groups.find((group) => group.id === assignment.groupId)?.participantIds[
        Number(assignment.positionInGroup)
      ] !== assignment.participantId
    ) {
      return null;
    }
    assignmentIds.add(assignment.participantId);
  }
  return value as unknown as GroupDrawSnapshot;
}

function parseGroups(
  value: unknown,
  participantIds: string[],
  resolvedGroupCount: number,
): CompetitionGroup[] | null {
  if (!Array.isArray(value) || value.length !== resolvedGroupCount) return null;
  const groups: CompetitionGroup[] = [];
  const seen = new Set<string>();
  const groupIds = new Set<string>();
  const groupLabels = new Set<string>();
  for (const [index, group] of value.entries()) {
    const expectedId = `group-${String.fromCharCode(97 + index)}`;
    const expectedLabel = `Group ${String.fromCharCode(65 + index)}`;
    if (
      !isRecord(group) ||
      !onlyKeys(group, ["id", "label", "participantIds"]) ||
      typeof group.id !== "string" ||
      typeof group.label !== "string" ||
      group.id !== expectedId ||
      group.label !== expectedLabel ||
      groupIds.has(group.id) ||
      groupLabels.has(group.label) ||
      !uniqueStrings(group.participantIds) ||
      (group.participantIds as string[]).length < 2
    ) {
      return null;
    }
    groupIds.add(group.id);
    groupLabels.add(group.label);
    for (const participantId of group.participantIds as string[]) {
      if (!participantIds.includes(participantId) || seen.has(participantId)) {
        return null;
      }
      seen.add(participantId);
    }
    groups.push(group as unknown as CompetitionGroup);
  }
  const sizes = groups.map((group) => group.participantIds.length);
  return seen.size === participantIds.length &&
    Math.max(...sizes) - Math.min(...sizes) <= 1
    ? groups
    : null;
}

function parseSource(value: unknown) {
  return (
    value === undefined ||
    (isRecord(value) &&
      onlyKeys(value, ["matchId", "outcome"]) &&
      typeof value.matchId === "string" &&
      ["winner", "loser"].includes(String(value.outcome)))
  );
}

function parseMatches(
  value: unknown,
  competitionId: string,
  participantIndex: Record<string, true>,
  groups: CompetitionGroup[],
  config: GroupCompetitionConfigSnapshot,
) {
  if (!isRecord(value)) return null;
  const matches: Record<string, GroupCompetitionMatch> = {};
  for (const [id, raw] of Object.entries(value)) {
    if (
      !isRecord(raw) ||
      !onlyKeys(raw, [
        "id",
        "competitionId",
        "stage",
        "groupId",
        "leg",
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
      !["group-stage", "knockout", "third-place"].includes(String(raw.stage)) ||
      !["pending", "ready", "in-progress", "completed"].includes(
        String(raw.status),
      ) ||
      typeof raw.isBye !== "boolean" ||
      !integer(raw.globalSequence, 1, 1000) ||
      !integer(raw.sequenceInRound, 1, 32) ||
      !integer(raw.revision, 1) ||
      raw.schemaVersion !== 1 ||
      !parseSource(raw.sourceA) ||
      !parseSource(raw.sourceB) ||
      !(
        raw.participantAId === undefined ||
        raw.participantAId === null ||
        (typeof raw.participantAId === "string" &&
          participantIndex[raw.participantAId])
      ) ||
      !(
        raw.participantBId === undefined ||
        raw.participantBId === null ||
        (typeof raw.participantBId === "string" &&
          participantIndex[raw.participantBId])
      ) ||
      (typeof raw.participantAId === "string" &&
        raw.participantAId === raw.participantBId)
    ) {
      return null;
    }
    if (raw.stage === "group-stage") {
      const group = groups.find((candidate) => candidate.id === raw.groupId);
      if (
        !group ||
        ![1, 2].includes(Number(raw.leg)) ||
        Number(raw.leg) > config.roundRobinLegs ||
        !integer(raw.fixtureRound, 1, 64) ||
        typeof raw.participantAId !== "string" ||
        typeof raw.participantBId !== "string" ||
        !group.participantIds.includes(raw.participantAId) ||
        !group.participantIds.includes(raw.participantBId) ||
        raw.isBye ||
        raw.sourceA !== undefined ||
        raw.sourceB !== undefined ||
        raw.seedA !== undefined ||
        raw.seedB !== undefined ||
        (raw.bracketRound !== undefined && raw.bracketRound !== null) ||
        (raw.bracketSlot !== undefined && raw.bracketSlot !== null)
      ) {
        return null;
      }
    } else if (
      raw.groupId !== undefined ||
      raw.leg !== undefined ||
      (raw.fixtureRound !== undefined && raw.fixtureRound !== null) ||
      !integer(raw.bracketRound, 1, 5) ||
      !integer(raw.bracketSlot, 1, 32)
    ) {
      return null;
    }
    const match: GroupCompetitionMatch = {
      ...(raw as unknown as GroupCompetitionMatch),
      participantAId:
        typeof raw.participantAId === "string" ? raw.participantAId : null,
      participantBId:
        typeof raw.participantBId === "string" ? raw.participantBId : null,
      fixtureRound:
        typeof raw.fixtureRound === "number" ? raw.fixtureRound : null,
      bracketRound:
        typeof raw.bracketRound === "number" ? raw.bracketRound : null,
      bracketSlot: typeof raw.bracketSlot === "number" ? raw.bracketSlot : null,
      result: null,
    };
    if (raw.result !== undefined && raw.result !== null) {
      if (
        !isRecord(raw.result) ||
        !onlyKeys(raw.result, [
          "roundWinnerIds",
          "participantAWins",
          "participantBWins",
          "winnerId",
          "isDraw",
          "completedAt",
          "completedByUid",
          "resultRevision",
        ])
      ) {
        return null;
      }
      const result = raw.result as unknown as NonNullable<
        CompetitionMatch["result"]
      >;
      if (!validateMatchResult(match, config.series, result)) return null;
      match.result = result;
    }
    if (
      (match.result && match.status !== "completed") ||
      (!match.result && match.status === "completed" && !match.isBye)
    ) {
      return null;
    }
    matches[id] = match;
  }
  const sequences = Object.values(matches).map((match) => match.globalSequence);
  const orderedSequences = [...sequences].sort((left, right) => left - right);
  if (
    new Set(sequences).size !== sequences.length ||
    orderedSequences.some((sequence, index) => sequence !== index + 1)
  ) {
    return null;
  }
  for (const match of Object.values(matches)) {
    for (const source of [match.sourceA, match.sourceB]) {
      if (source && !matches[source.matchId]) return null;
    }
  }
  const groupMatches = Object.values(matches).filter(
    (match): match is GroupCompetitionMatch & { stage: "group-stage" } =>
      match.stage === "group-stage",
  );
  if (groupMatches.length !== config.expectedGroupMatchCount) return null;
  for (const group of groups) {
    const expectedPairs =
      (group.participantIds.length * (group.participantIds.length - 1)) / 2;
    const matchesForGroup = groupMatches.filter(
      (match) => match.groupId === group.id,
    );
    if (matchesForGroup.length !== expectedPairs * config.roundRobinLegs) {
      return null;
    }
    const pairKeys = new Set<string>();
    for (let left = 0; left < group.participantIds.length; left += 1) {
      for (
        let right = left + 1;
        right < group.participantIds.length;
        right += 1
      ) {
        pairKeys.add(
          [group.participantIds[left], group.participantIds[right]]
            .sort()
            .join("|"),
        );
      }
    }
    for (const pairKey of pairKeys) {
      const pairMatches = matchesForGroup.filter(
        (match) =>
          [match.participantAId, match.participantBId].sort().join("|") ===
          pairKey,
      );
      const firstLeg = pairMatches.filter((match) => match.leg === 1);
      const secondLeg = pairMatches.filter((match) => match.leg === 2);
      if (
        firstLeg.length !== 1 ||
        secondLeg.length !== config.roundRobinLegs - 1 ||
        (config.roundRobinLegs === 2 &&
          (secondLeg[0]!.participantAId !== firstLeg[0]!.participantBId ||
            secondLeg[0]!.participantBId !== firstLeg[0]!.participantAId))
      ) {
        return null;
      }
    }
  }
  return matches;
}

function parseTieResolutions(
  value: unknown,
  participantIndex: Record<string, true>,
  groups: CompetitionGroup[],
): Record<string, GroupTieResolution> | null {
  const groupIds = new Set(groups.map((group) => group.id));
  if (value === undefined || value === null) return {};
  if (!isRecord(value)) return null;
  for (const [id, resolution] of Object.entries(value)) {
    if (
      !isRecord(resolution) ||
      !onlyKeys(resolution, [
        "id",
        "groupId",
        "participantIds",
        "orderedParticipantIds",
        "reason",
        "standingsFingerprint",
        "resolvedAt",
        "resolvedByUid",
        "schemaVersion",
      ]) ||
      resolution.id !== id ||
      !groupIds.has(String(resolution.groupId)) ||
      !uniqueStrings(resolution.participantIds) ||
      !uniqueStrings(resolution.orderedParticipantIds) ||
      [...(resolution.participantIds as string[])].sort().join("|") !==
        [...(resolution.orderedParticipantIds as string[])].sort().join("|") ||
      !(resolution.participantIds as string[]).every(
        (entry) => participantIndex[entry],
      ) ||
      !(resolution.participantIds as string[]).every((entry) =>
        groups
          .find((group) => group.id === resolution.groupId)
          ?.participantIds.includes(entry),
      ) ||
      typeof resolution.reason !== "string" ||
      resolution.reason.length > 160 ||
      typeof resolution.standingsFingerprint !== "string" ||
      !integer(resolution.resolvedAt) ||
      typeof resolution.resolvedByUid !== "string" ||
      resolution.schemaVersion !== 1
    ) {
      return null;
    }
  }
  return value as Record<string, GroupTieResolution>;
}

function parseQualification(
  value: unknown,
  participantIndex: Record<string, true>,
  groups: CompetitionGroup[],
  config: GroupCompetitionConfigSnapshot,
): QualificationSnapshot | null | false {
  const groupIds = new Set(groups.map((group) => group.id));
  if (value === undefined || value === null) return null;
  if (
    !isRecord(value) ||
    !onlyKeys(value, [
      "entries",
      "byGroup",
      "standingsFingerprints",
      "qualificationFingerprint",
      "confirmedAt",
      "confirmedByUid",
      "runtimeRevision",
      "schemaVersion",
    ]) ||
    !Array.isArray(value.entries) ||
    new Set(value.entries.filter(isRecord).map((entry) => entry.participantId))
      .size !== value.entries.length ||
    !isRecord(value.byGroup) ||
    !isRecord(value.standingsFingerprints) ||
    typeof value.qualificationFingerprint !== "string" ||
    value.qualificationFingerprint.length === 0 ||
    !integer(value.confirmedAt) ||
    typeof value.confirmedByUid !== "string" ||
    !integer(value.runtimeRevision, 1) ||
    value.schemaVersion !== 1
  ) {
    return false;
  }
  if (
    value.entries.length !==
      config.resolvedGroupCount * config.qualifiersPerGroup ||
    Object.keys(value.byGroup).length !== groups.length ||
    Object.keys(value.standingsFingerprints).length !== groups.length
  ) {
    return false;
  }
  const seen = new Set<string>();
  for (const entry of value.entries) {
    if (
      !isRecord(entry) ||
      !onlyKeys(entry, [
        "participantId",
        "groupId",
        "groupRank",
        "played",
        "matchWins",
        "tablePoints",
        "roundsWon",
        "roundsLost",
        "roundDifferential",
      ]) ||
      typeof entry.participantId !== "string" ||
      !participantIndex[entry.participantId] ||
      seen.has(entry.participantId) ||
      !groupIds.has(String(entry.groupId)) ||
      !groups
        .find((group) => group.id === entry.groupId)
        ?.participantIds.includes(entry.participantId) ||
      !integer(entry.groupRank, 1, config.qualifiersPerGroup) ||
      !integer(entry.played, 1, 64) ||
      !integer(entry.matchWins, 0, 64) ||
      !integer(entry.tablePoints, 0, 10000) ||
      !integer(entry.roundsWon, 0, 1000) ||
      !integer(entry.roundsLost, 0, 1000) ||
      !integer(entry.roundDifferential, -1000, 1000)
    ) {
      return false;
    }
    seen.add(entry.participantId);
  }
  for (const group of groups) {
    const entries = (value.entries as Array<Record<string, unknown>>)
      .filter((entry) => entry.groupId === group.id)
      .sort((left, right) => Number(left.groupRank) - Number(right.groupRank));
    const byGroup = value.byGroup[group.id];
    const fingerprint = value.standingsFingerprints[group.id];
    if (
      entries.length !== config.qualifiersPerGroup ||
      !uniqueStrings(byGroup, config.qualifiersPerGroup) ||
      (byGroup as string[]).length !== config.qualifiersPerGroup ||
      entries.some((entry, index) => entry.groupRank !== index + 1) ||
      entries.some(
        (entry, index) => entry.participantId !== (byGroup as string[])[index],
      ) ||
      typeof fingerprint !== "string" ||
      fingerprint.length === 0 ||
      fingerprint.length > 128
    ) {
      return false;
    }
  }
  return value as unknown as QualificationSnapshot;
}

function parseSeedResolutions(
  value: unknown,
  participantIndex: Record<string, true>,
  qualification: QualificationSnapshot | null,
): Record<string, CrossGroupSeedResolution> | null {
  if (value === undefined || value === null) return {};
  if (!isRecord(value)) return null;
  for (const [id, resolution] of Object.entries(value)) {
    if (
      !isRecord(resolution) ||
      !onlyKeys(resolution, [
        "id",
        "groupRank",
        "participantIds",
        "orderedParticipantIds",
        "reason",
        "qualificationFingerprint",
        "resolvedAt",
        "resolvedByUid",
        "schemaVersion",
      ]) ||
      resolution.id !== id ||
      !integer(resolution.groupRank, 1, 32) ||
      !uniqueStrings(resolution.participantIds) ||
      !uniqueStrings(resolution.orderedParticipantIds) ||
      [...(resolution.participantIds as string[])].sort().join("|") !==
        [...(resolution.orderedParticipantIds as string[])].sort().join("|") ||
      !(resolution.participantIds as string[]).every(
        (entry) => participantIndex[entry],
      ) ||
      typeof resolution.reason !== "string" ||
      resolution.reason.length > 160 ||
      typeof resolution.qualificationFingerprint !== "string" ||
      !qualification ||
      resolution.qualificationFingerprint !==
        qualification.qualificationFingerprint ||
      !integer(resolution.resolvedAt) ||
      typeof resolution.resolvedByUid !== "string" ||
      resolution.schemaVersion !== 1
    ) {
      return null;
    }
  }
  return value as Record<string, CrossGroupSeedResolution>;
}

function parseKnockout(
  value: unknown,
  matches: Record<string, GroupCompetitionMatch>,
  qualification: QualificationSnapshot | null,
  includeThirdPlace: boolean,
) {
  if (value === undefined || value === null) return null;
  if (
    !isRecord(value) ||
    !onlyKeys(value, [
      "qualificationParticipantIds",
      "seedOrder",
      "bracketSize",
      "rounds",
      "thirdPlaceMatchId",
      "sourceResultFingerprint",
      "qualificationFingerprint",
      "sameGroupRematchWarning",
      "generatedAt",
      "generatedByUid",
      "generationVersion",
    ]) ||
    !uniqueStrings(value.qualificationParticipantIds) ||
    !uniqueStrings(value.seedOrder) ||
    [...(value.qualificationParticipantIds as string[])].sort().join("|") !==
      [...(value.seedOrder as string[])].sort().join("|") ||
    !qualification ||
    [...(value.seedOrder as string[])].sort().join("|") !==
      qualification.entries
        .map((entry) => entry.participantId)
        .sort()
        .join("|") ||
    (value.seedOrder as string[]).length < 2 ||
    value.bracketSize !==
      nextPowerOfTwo((value.seedOrder as string[]).length) ||
    !Array.isArray(value.rounds) ||
    typeof value.sourceResultFingerprint !== "string" ||
    typeof value.qualificationFingerprint !== "string" ||
    value.qualificationFingerprint !== qualification.qualificationFingerprint ||
    value.sourceResultFingerprint !== value.qualificationFingerprint ||
    !(
      value.sameGroupRematchWarning === undefined ||
      value.sameGroupRematchWarning === null ||
      (typeof value.sameGroupRematchWarning === "string" &&
        value.sameGroupRematchWarning.length <= 240)
    ) ||
    !integer(value.generatedAt) ||
    typeof value.generatedByUid !== "string" ||
    value.generationVersion !== 1
  ) {
    return false;
  }
  const seedOrder = value.seedOrder as string[];
  const bracketSize = value.bracketSize as number;
  const positions = seededPositions(bracketSize);
  const roundCount = Math.log2(bracketSize);
  if (
    value.rounds.length !== roundCount ||
    (includeThirdPlace && roundCount < 2)
  ) {
    return false;
  }
  const bracketMatchIds = new Set<string>();
  for (const [roundIndex, rawRound] of value.rounds.entries()) {
    if (
      !isRecord(rawRound) ||
      !onlyKeys(rawRound, ["number", "label", "matchIds"]) ||
      rawRound.number !== roundIndex + 1 ||
      typeof rawRound.label !== "string" ||
      !uniqueStrings(rawRound.matchIds, 32) ||
      (rawRound.matchIds as string[]).length !==
        bracketSize / 2 ** (roundIndex + 1)
    ) {
      return false;
    }
    for (const [matchIndex, matchId] of (
      rawRound.matchIds as string[]
    ).entries()) {
      const match = matches[matchId];
      if (
        !match ||
        match.stage !== "knockout" ||
        match.id !== `ko-r${roundIndex + 1}-m${matchIndex + 1}` ||
        match.bracketRound !== roundIndex + 1 ||
        match.bracketSlot !== matchIndex + 1 ||
        bracketMatchIds.has(matchId)
      ) {
        return false;
      }
      bracketMatchIds.add(matchId);
      if (roundIndex === 0) {
        const seedA = positions[matchIndex * 2]!;
        const seedB = positions[matchIndex * 2 + 1]!;
        const expectedA = seedOrder[seedA - 1] ?? null;
        const expectedB = seedOrder[seedB - 1] ?? null;
        if (
          match.seedA !== seedA ||
          match.seedB !== seedB ||
          match.participantAId !== expectedA ||
          match.participantBId !== expectedB ||
          match.sourceA ||
          match.sourceB ||
          match.isBye !==
            Boolean((expectedA || expectedB) && !(expectedA && expectedB))
        ) {
          return false;
        }
      } else {
        const expectedA = `ko-r${roundIndex}-m${matchIndex * 2 + 1}`;
        const expectedB = `ko-r${roundIndex}-m${matchIndex * 2 + 2}`;
        if (
          match.seedA !== undefined ||
          match.seedB !== undefined ||
          match.isBye ||
          match.sourceA?.matchId !== expectedA ||
          match.sourceA.outcome !== "winner" ||
          match.sourceB?.matchId !== expectedB ||
          match.sourceB.outcome !== "winner"
        ) {
          return false;
        }
      }
    }
  }
  const expectedThirdPlaceId = includeThirdPlace ? "ko-third-place" : null;
  const thirdPlaceId =
    typeof value.thirdPlaceMatchId === "string"
      ? value.thirdPlaceMatchId
      : null;
  if (thirdPlaceId !== expectedThirdPlaceId) return false;
  if (thirdPlaceId) {
    const match = matches[thirdPlaceId];
    const semifinalRound = value.rounds[roundCount - 2] as Record<
      string,
      unknown
    >;
    const semifinalIds = semifinalRound.matchIds as string[];
    if (
      !match ||
      match.stage !== "third-place" ||
      match.bracketRound !== roundCount ||
      match.bracketSlot !== 2 ||
      match.sourceA?.matchId !== semifinalIds[0] ||
      match.sourceA.outcome !== "loser" ||
      match.sourceB?.matchId !== semifinalIds[1] ||
      match.sourceB.outcome !== "loser" ||
      match.isBye
    ) {
      return false;
    }
  }
  const allKnockoutIds = Object.values(matches)
    .filter((match) => match.stage !== "group-stage")
    .map((match) => match.id);
  if (
    allKnockoutIds.some(
      (matchId) =>
        !bracketMatchIds.has(matchId) && matchId !== expectedThirdPlaceId,
    )
  ) {
    return false;
  }
  return {
    ...value,
    thirdPlaceMatchId: thirdPlaceId,
    sameGroupRematchWarning:
      typeof value.sameGroupRematchWarning === "string"
        ? value.sameGroupRematchWarning
        : null,
  } as GroupKnockoutRun["knockout"];
}

function parsePlacements(
  value: unknown,
  participantIndex: Record<string, true>,
) {
  if (value === undefined || value === null) return null;
  if (
    !isRecord(value) ||
    !onlyKeys(value, [
      "entries",
      "completedAt",
      "completedByUid",
      "runtimeRevision",
      "schemaVersion",
    ]) ||
    !Array.isArray(value.entries) ||
    !value.entries.every(
      (entry) =>
        isRecord(entry) &&
        onlyKeys(entry, [
          "participantId",
          "place",
          "placementBand",
          "eliminationStage",
        ]) &&
        typeof entry.participantId === "string" &&
        participantIndex[entry.participantId] &&
        (entry.place === undefined ||
          entry.place === null ||
          integer(entry.place, 1, 32)) &&
        typeof entry.placementBand === "string" &&
        typeof entry.eliminationStage === "string",
    ) ||
    !integer(value.completedAt) ||
    typeof value.completedByUid !== "string" ||
    !integer(value.runtimeRevision, 1) ||
    value.schemaVersion !== 1
  ) {
    return false;
  }
  return value as unknown as GroupKnockoutRun["placements"];
}

export function parseGroupKnockoutRun(value: unknown): GroupKnockoutRun | null {
  const allowed = [
    "competitionId",
    "format",
    "stage",
    "competitionRevision",
    "participantIds",
    "participantIndex",
    "configSnapshot",
    "draw",
    "groups",
    "matches",
    "tieResolutions",
    "qualification",
    "seedResolutions",
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
  ];
  if (
    !isRecord(value) ||
    !onlyKeys(value, allowed) ||
    typeof value.competitionId !== "string" ||
    value.format !== "group-knockout" ||
    !["group-stage", "qualification-review", "knockout", "completed"].includes(
      String(value.stage),
    ) ||
    !integer(value.competitionRevision, 1) ||
    !uniqueStrings(value.participantIds) ||
    (value.participantIds as string[]).length < 4 ||
    !isRecord(value.participantIndex) ||
    !integer(value.resultCount, 0, 1000) ||
    value.generationVersion !== 1 ||
    !integer(value.createdAt) ||
    !integer(value.updatedAt) ||
    !integer(value.activatedAt) ||
    typeof value.activatedByUid !== "string" ||
    !integer(value.revision, 1) ||
    value.schemaVersion !== 1
  ) {
    return null;
  }
  const participantIds = value.participantIds as string[];
  const participantIndex = value.participantIndex as Record<string, true>;
  if (
    Object.keys(participantIndex).length !== participantIds.length ||
    participantIds.some(
      (participantId) => participantIndex[participantId] !== true,
    )
  ) {
    return null;
  }
  const config = parseConfig(value.configSnapshot);
  if (!config) return null;
  const groups = parseGroups(
    value.groups,
    participantIds,
    config.resolvedGroupCount,
  );
  if (!groups) return null;
  const smallestGroupSize = Math.min(
    ...groups.map((group) => group.participantIds.length),
  );
  if (
    config.qualifiersPerGroup >= smallestGroupSize ||
    config.resolvedGroupCount * config.qualifiersPerGroup < 2
  ) {
    return null;
  }
  const draw = parseDraw(value.draw, participantIds, groups);
  if (!draw) return null;
  const matches = parseMatches(
    value.matches,
    value.competitionId,
    participantIndex,
    groups,
    config,
  );
  if (!matches) return null;
  const tieResolutions = parseTieResolutions(
    value.tieResolutions,
    participantIndex,
    groups,
  );
  const qualification = parseQualification(
    value.qualification,
    participantIndex,
    groups,
    config,
  );
  const seedResolutions = parseSeedResolutions(
    value.seedResolutions,
    participantIndex,
    qualification === false ? null : qualification,
  );
  const knockout = parseKnockout(
    value.knockout,
    matches,
    qualification === false ? null : qualification,
    config.includeThirdPlace,
  );
  const placements = parsePlacements(value.placements, participantIndex);
  if (
    !tieResolutions ||
    !seedResolutions ||
    qualification === false ||
    knockout === false ||
    placements === false ||
    (qualification && qualification.runtimeRevision > Number(value.revision)) ||
    Object.values(matches).filter((match) => match.result !== null).length !==
      value.resultCount ||
    (value.currentMatchId !== undefined &&
      value.currentMatchId !== null &&
      (typeof value.currentMatchId !== "string" ||
        matches[value.currentMatchId]?.status !== "in-progress")) ||
    (value.stage === "group-stage" && (qualification || knockout)) ||
    (value.stage === "qualification-review" && (!qualification || knockout)) ||
    ((value.stage === "knockout" || value.stage === "completed") &&
      (!qualification || !knockout)) ||
    (value.stage !== "group-stage" &&
      Number(value.resultCount) < config.expectedGroupMatchCount) ||
    (value.stage === "completed" &&
      (!placements ||
        !integer(value.completedAt) ||
        typeof value.completedByUid !== "string" ||
        placements.runtimeRevision !== value.revision ||
        placements.completedAt !== value.completedAt ||
        placements.completedByUid !== value.completedByUid ||
        !knockout ||
        placements.entries.length !== knockout.seedOrder.length ||
        [...placements.entries.map((entry) => entry.participantId)]
          .sort()
          .join("|") !== [...knockout.seedOrder].sort().join("|") ||
        placements.entries.filter((entry) => entry.place === 1).length !== 1 ||
        placements.entries.filter((entry) => entry.place === 2).length !== 1 ||
        (config.includeThirdPlace &&
          (placements.entries.filter((entry) => entry.place === 3).length !==
            1 ||
            placements.entries.filter((entry) => entry.place === 4).length !==
              1)) ||
        (!config.includeThirdPlace &&
          placements.entries.some(
            (entry) => entry.place === 3 || entry.place === 4,
          )))) ||
    (value.stage !== "completed" &&
      (placements ||
        (value.completedAt !== undefined && value.completedAt !== null) ||
        (value.completedByUid !== undefined && value.completedByUid !== null)))
  ) {
    return null;
  }
  return {
    ...(value as unknown as GroupKnockoutRun),
    configSnapshot: config,
    draw,
    groups,
    matches,
    tieResolutions,
    qualification,
    seedResolutions,
    knockout,
    placements,
    currentMatchId:
      typeof value.currentMatchId === "string" ? value.currentMatchId : null,
    completedAt:
      typeof value.completedAt === "number" ? value.completedAt : null,
    completedByUid:
      typeof value.completedByUid === "string" ? value.completedByUid : null,
  };
}
