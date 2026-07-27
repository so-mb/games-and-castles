import { balancedGroupSizes, recommendedGroupCount } from "../domain/estimates";
import type { PublishedCompetition } from "../domain/types";
import {
  generateRoundRobinFixtures,
  shuffleParticipantIds,
} from "../engine/generation";
import type { RandomIntegerSource } from "../engine/types";
import type {
  CompetitionGroup,
  GroupActivationReview,
  GroupCompetitionMatch,
  GroupDrawPreview,
  GroupKnockoutRun,
  GroupStageMatch,
} from "./types";

function resolvedGroupCount(competition: PublishedCompetition) {
  if (competition.formatConfig.kind !== "group-knockout") return 0;
  if (competition.formatConfig.groupCountMode === "manual") {
    return competition.formatConfig.groupCount;
  }
  return recommendedGroupCount(competition.participantIds.length) ?? 0;
}

export function reviewGroupActivation(
  competition: PublishedCompetition,
  runtimeExists: boolean,
): GroupActivationReview {
  const errors: string[] = [];
  const warnings: string[] = [];
  if (competition.status !== "scheduled") {
    errors.push("Only a scheduled competition can be activated.");
  }
  if (
    competition.format !== "group-knockout" ||
    competition.formatConfig.kind !== "group-knockout"
  ) {
    errors.push("This activation flow is available only for Group Format.");
  }
  if (runtimeExists) errors.push("A competition run already exists.");

  const participantCount = competition.participantIds.length;
  const groupCount = resolvedGroupCount(competition);
  const groupSizes = balancedGroupSizes(participantCount, groupCount);
  let qualifiersPerGroup = 0;
  let includeThirdPlace = false;
  let legs: 1 | 2 = 1;
  if (competition.formatConfig.kind === "group-knockout") {
    qualifiersPerGroup = competition.formatConfig.qualifiersPerGroup;
    includeThirdPlace = competition.formatConfig.includeThirdPlace;
    legs = competition.formatConfig.roundRobinLegs;
    if (
      competition.formatConfig.groupCountMode === "automatic" &&
      recommendedGroupCount(participantCount) === null
    ) {
      errors.push(
        "Automatic group count supports 4–16 players. Choose a valid manual group count outside that range.",
      );
    }
    if (competition.formatConfig.allowDraws) {
      errors.push(
        "Draws cannot be activated until a terminal draw rule is configured.",
      );
    }
  }
  if (
    groupCount < 1 ||
    groupCount > participantCount ||
    groupSizes.length !== groupCount ||
    groupSizes.some((size) => size < 2)
  ) {
    errors.push(
      "Choose a group count that leaves at least two players in every group.",
    );
  }
  const smallestGroup = groupSizes.length ? Math.min(...groupSizes) : 0;
  if (
    !Number.isInteger(qualifiersPerGroup) ||
    qualifiersPerGroup < 1 ||
    qualifiersPerGroup >= smallestGroup
  ) {
    errors.push(
      "Qualifiers per group must leave at least one non-qualifier in every group.",
    );
  }
  const qualifierCount = groupCount * qualifiersPerGroup;
  if (qualifierCount < 2) {
    errors.push("The knockout needs at least two total qualifiers.");
  }
  if (includeThirdPlace && qualifierCount < 4) {
    errors.push("A third-place match requires at least four qualifiers.");
  }
  if (new Set(competition.participantIds).size !== participantCount) {
    errors.push("Participant IDs must be unique before the draw.");
  }
  if (groupSizes.length > 1 && new Set(groupSizes).size > 1) {
    warnings.push(
      "Groups differ in size by one; cross-group seeding uses normalized metrics within each rank tier.",
    );
  }
  const expectedGroupMatchCount =
    groupSizes.reduce((total, size) => total + (size * (size - 1)) / 2, 0) *
    legs;
  let bracketSize = 0;
  if (qualifierCount >= 2) {
    bracketSize = 2;
    while (bracketSize < qualifierCount) bracketSize *= 2;
  }
  return {
    canActivate: errors.length === 0,
    errors: [...new Set(errors)],
    warnings: [...new Set(warnings)],
    resolvedGroupCount: groupCount,
    groupSizes,
    expectedGroupMatchCount,
    qualifierCount,
    bracketSize,
  };
}

export function assignBalancedGroups(
  shuffledParticipantIds: string[],
  groupCount: number,
): CompetitionGroup[] {
  if (
    !Number.isInteger(groupCount) ||
    groupCount < 1 ||
    groupCount > shuffledParticipantIds.length ||
    new Set(shuffledParticipantIds).size !== shuffledParticipantIds.length
  ) {
    throw new Error(
      "The group draw needs unique participants and a valid group count.",
    );
  }
  const groups = Array.from({ length: groupCount }, (_, index) => ({
    id: `group-${String.fromCharCode(97 + index)}`,
    label: `Group ${String.fromCharCode(65 + index)}`,
    participantIds: [] as string[],
  }));
  shuffledParticipantIds.forEach((participantId, index) => {
    groups[index % groupCount]!.participantIds.push(participantId);
  });
  const sizes = groups.map((group) => group.participantIds.length);
  if (Math.max(...sizes) - Math.min(...sizes) > 1) {
    throw new Error("The group assignment is not balanced.");
  }
  return groups;
}

function generateGroupMatches(
  competitionId: string,
  groups: CompetitionGroup[],
  legs: 1 | 2,
) {
  const byGroup = new Map<string, GroupStageMatch[]>();
  groups.forEach((group) => {
    const firstLeg = generateRoundRobinFixtures(
      `${competitionId}-${group.id}`,
      group.participantIds,
    );
    const baseRoundCount = firstLeg.rounds.length;
    const matches = firstLeg.matches.map<GroupStageMatch>((match) => ({
      ...match,
      id: `${group.id}-l1-r${match.fixtureRound}-m${match.sequenceInRound}`,
      competitionId,
      stage: "group-stage",
      groupId: group.id,
      leg: 1,
      globalSequence: 0,
    }));
    if (legs === 2) {
      matches.push(
        ...firstLeg.matches.map<GroupStageMatch>((match) => ({
          ...match,
          id: `${group.id}-l2-r${match.fixtureRound}-m${match.sequenceInRound}`,
          competitionId,
          stage: "group-stage",
          groupId: group.id,
          leg: 2,
          fixtureRound: (match.fixtureRound ?? 0) + baseRoundCount,
          participantAId: match.participantBId,
          participantBId: match.participantAId,
          globalSequence: 0,
        })),
      );
    }
    byGroup.set(group.id, matches);
  });
  return byGroup;
}

function hasParticipant(
  match: GroupStageMatch,
  previous: GroupStageMatch | undefined,
) {
  if (!previous) return false;
  return [match.participantAId, match.participantBId].some(
    (participantId) =>
      participantId === previous.participantAId ||
      participantId === previous.participantBId,
  );
}

export function interleaveGroupFixtures(
  competitionId: string,
  groups: CompetitionGroup[],
  legs: 1 | 2,
) {
  const queues = generateGroupMatches(competitionId, groups, legs);
  const ordered: GroupStageMatch[] = [];
  let lastGroupId: string | null = null;
  while ([...queues.values()].some((queue) => queue.length > 0)) {
    const candidates = groups.flatMap((group, groupIndex) => {
      const match = queues.get(group.id)?.[0];
      return match ? [{ match, groupIndex }] : [];
    });
    candidates.sort((left, right) => {
      const previous = ordered.at(-1);
      const leftRepeat = Number(hasParticipant(left.match, previous));
      const rightRepeat = Number(hasParticipant(right.match, previous));
      const leftGroupRepeat = Number(left.match.groupId === lastGroupId);
      const rightGroupRepeat = Number(right.match.groupId === lastGroupId);
      return (
        leftRepeat - rightRepeat ||
        leftGroupRepeat - rightGroupRepeat ||
        left.match.leg - right.match.leg ||
        (left.match.fixtureRound ?? 0) - (right.match.fixtureRound ?? 0) ||
        left.groupIndex - right.groupIndex
      );
    });
    const selected = candidates[0]?.match;
    if (!selected) throw new Error("The group fixture queue became invalid.");
    queues.get(selected.groupId)!.shift();
    selected.globalSequence = ordered.length + 1;
    ordered.push(selected);
    lastGroupId = selected.groupId;
  }
  return ordered;
}

export function createGroupDrawPreview(
  competition: PublishedCompetition,
  activatedByUid: string,
  generatedAt: number,
  randomInteger?: RandomIntegerSource,
): GroupDrawPreview {
  const review = reviewGroupActivation(competition, false);
  if (
    !review.canActivate ||
    competition.format !== "group-knockout" ||
    competition.formatConfig.kind !== "group-knockout" ||
    competition.scoringConfig.kind !== "head-to-head"
  ) {
    throw new Error(
      review.errors[0] ?? "This Group Format is not ready to activate.",
    );
  }
  const shuffledParticipantIds = shuffleParticipantIds(
    competition.participantIds,
    randomInteger,
  );
  const groups = assignBalancedGroups(
    shuffledParticipantIds,
    review.resolvedGroupCount,
  );
  const generatedMatches = interleaveGroupFixtures(
    competition.id,
    groups,
    competition.formatConfig.roundRobinLegs,
  );
  const assignments = groups.flatMap((group) =>
    group.participantIds.map((participantId, positionInGroup) => ({
      participantId,
      shuffledPosition: shuffledParticipantIds.indexOf(participantId),
      groupId: group.id,
      positionInGroup,
    })),
  );
  const matches: Record<string, GroupCompetitionMatch> = Object.fromEntries(
    generatedMatches.map((match) => [match.id, match]),
  );
  const run: GroupKnockoutRun = {
    competitionId: competition.id,
    format: "group-knockout",
    stage: "group-stage",
    competitionRevision: competition.revision,
    participantIds: [...competition.participantIds],
    participantIndex: Object.fromEntries(
      competition.participantIds.map((participantId) => [participantId, true]),
    ),
    configSnapshot: {
      format: "group-knockout",
      groupCountMode: competition.formatConfig.groupCountMode,
      resolvedGroupCount: review.resolvedGroupCount,
      qualifiersPerGroup: competition.formatConfig.qualifiersPerGroup,
      roundRobinLegs: competition.formatConfig.roundRobinLegs,
      series: structuredClone(competition.formatConfig.series),
      allowDraws: false,
      includeThirdPlace: competition.formatConfig.includeThirdPlace,
      tableScoring: structuredClone(competition.scoringConfig.table),
      overallScoring: structuredClone(competition.scoringConfig.overall),
      expectedGroupMatchCount: review.expectedGroupMatchCount,
      drawVersion: 1,
      fixtureGenerationVersion: 1,
      seedingVersion: 1,
    },
    draw: {
      shuffledParticipantIds,
      shuffledPositions: Object.fromEntries(
        shuffledParticipantIds.map((participantId, index) => [
          participantId,
          index,
        ]),
      ),
      assignments,
      generatedAt,
      drawVersion: 1,
    },
    groups,
    matches,
    tieResolutions: {},
    qualification: null,
    seedResolutions: {},
    knockout: null,
    placements: null,
    currentMatchId: null,
    resultCount: 0,
    generationVersion: 1,
    createdAt: generatedAt,
    updatedAt: generatedAt,
    activatedAt: generatedAt,
    activatedByUid,
    completedAt: null,
    completedByUid: null,
    revision: 1,
    schemaVersion: 1,
  };
  return { run, review };
}
