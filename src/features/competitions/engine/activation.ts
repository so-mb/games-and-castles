import type {
  CompetitionFormValues,
  ParticipantReference,
  PublishedCompetition,
} from "../domain/types";
import {
  roundRobinMatchCount,
  roundRobinRoundEstimate,
} from "../domain/estimates";
import {
  participantReferenceWarnings,
  validateCompetition,
} from "../domain/validation";
import {
  generateRoundRobinFixtures,
  shuffleParticipantIds,
} from "./generation";
import { nextPowerOfTwo } from "./knockout";
import type {
  ActivationReview,
  CompetitionRun,
  RandomIntegerSource,
} from "./types";

export function reviewActivation(
  competition: PublishedCompetition,
  participants: ParticipantReference[],
  runtimeExists: boolean,
): ActivationReview {
  const errors: string[] = [];
  const warnings: string[] = [];
  if (competition.status !== "scheduled") {
    errors.push("Only a scheduled competition can be activated.");
  }
  if (competition.format !== "round-robin-knockout") {
    errors.push("This engine is available only for Merry-Go-Round.");
  }
  if (runtimeExists) errors.push("A competition run already exists.");
  const validation = validateCompetition(
    competition as CompetitionFormValues,
    "publish",
  );
  errors.push(
    ...validation
      .filter((issue) => issue.severity === "error")
      .map((issue) => issue.message),
  );
  warnings.push(
    ...validation
      .filter((issue) => issue.severity === "warning")
      .map((issue) => issue.message),
  );
  participantReferenceWarnings(
    competition.participantIds,
    participants,
  ).forEach((warning) => errors.push(warning.message));

  let qualificationCount = 0;
  let includeThirdPlace = false;
  if (competition.formatConfig.kind === "round-robin-knockout") {
    qualificationCount = competition.formatConfig.qualificationCount;
    includeThirdPlace = competition.formatConfig.includeThirdPlace;
    if (competition.formatConfig.allowDraws) {
      errors.push(
        "Draws cannot be activated until a terminal draw rule is configured.",
      );
    }
    if (includeThirdPlace && qualificationCount < 4) {
      errors.push("A third-place match requires at least four qualifiers.");
    }
  }
  if (competition.scoringConfig.kind !== "head-to-head") {
    errors.push("Head-to-head scoring is required.");
  }
  const participantCount = competition.participantIds.length;
  const estimate = roundRobinRoundEstimate(participantCount);
  const bracketSize =
    qualificationCount >= 2 ? nextPowerOfTwo(qualificationCount) : 0;
  const knockoutMatchCount =
    qualificationCount >= 2
      ? qualificationCount - 1 + (includeThirdPlace ? 1 : 0)
      : 0;
  return {
    canActivate: errors.length === 0,
    errors: [...new Set(errors)],
    warnings: [...new Set(warnings)],
    participantCount,
    expectedMatchCount: roundRobinMatchCount(participantCount),
    expectedFixtureRounds: estimate.rounds,
    bracketSize,
    knockoutMatchCount,
  };
}

export function createCompetitionRun(
  competition: PublishedCompetition,
  activatedByUid: string,
  activatedAt: number,
  randomInteger?: RandomIntegerSource,
): CompetitionRun {
  if (
    competition.status !== "scheduled" ||
    competition.format !== "round-robin-knockout" ||
    competition.formatConfig.kind !== "round-robin-knockout" ||
    competition.scoringConfig.kind !== "head-to-head" ||
    competition.formatConfig.allowDraws
  ) {
    throw new Error(
      "This competition is not ready for Merry-Go-Round activation.",
    );
  }
  const randomizedParticipantIds = shuffleParticipantIds(
    competition.participantIds,
    randomInteger,
  );
  const fixtures = generateRoundRobinFixtures(
    competition.id,
    randomizedParticipantIds,
  );
  const matches = Object.fromEntries(
    fixtures.matches.map((match) => [match.id, match]),
  );
  return {
    competitionId: competition.id,
    format: "round-robin-knockout",
    stage: "round-robin",
    competitionRevision: competition.revision,
    participantIds: [...competition.participantIds],
    participantIndex: Object.fromEntries(
      competition.participantIds.map((participantId) => [participantId, true]),
    ),
    randomizedParticipantIds,
    randomizedPositions: Object.fromEntries(
      randomizedParticipantIds.map((participantId, index) => [
        participantId,
        index,
      ]),
    ),
    configSnapshot: {
      format: "round-robin-knockout",
      series: structuredClone(competition.formatConfig.series),
      allowDraws: false,
      qualificationCount: competition.formatConfig.qualificationCount,
      includeThirdPlace: competition.formatConfig.includeThirdPlace,
      tableScoring: structuredClone(competition.scoringConfig.table),
      overallScoring: structuredClone(competition.scoringConfig.overall),
    },
    roundRobin: {
      fixtureRoundCount: fixtures.rounds.length,
      expectedMatchCount: fixtures.matches.length,
      rounds: fixtures.rounds,
    },
    matches,
    tieResolutions: {},
    knockout: null,
    placements: null,
    currentMatchId: null,
    resultCount: 0,
    generationVersion: 1,
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
