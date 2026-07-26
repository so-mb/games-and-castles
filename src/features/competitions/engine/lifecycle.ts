import { createMatchResult } from "./series";
import {
  descendantMatchIds,
  generateKnockout,
  refreshKnockoutParticipants,
} from "./knockout";
import {
  createTieResolution,
  deriveStandings,
  qualificationBlockingTies,
} from "./standings";
import type { CompetitionRun, Placement, TieResolution } from "./types";

export class MatchRevisionConflictError extends Error {
  constructor() {
    super(
      "This match changed on another device. Reload the latest result before editing.",
    );
    this.name = "MatchRevisionConflictError";
  }
}

export class MatchDependencyConflictError extends Error {
  affectedMatchIds: string[];

  constructor(affectedMatchIds: string[]) {
    super(
      "This correction affects later knockout matches. Confirm the cascading reset before continuing.",
    );
    this.name = "MatchDependencyConflictError";
    this.affectedMatchIds = affectedMatchIds;
  }
}

function cloneRun(run: CompetitionRun) {
  return structuredClone(run);
}

function advanceRevision(run: CompetitionRun, updatedAt: number) {
  run.updatedAt = updatedAt;
  run.revision += 1;
  run.resultCount = Object.values(run.matches).filter(
    (match) => match.result !== null,
  ).length;
}

function invalidateStaleTieResolutions(run: CompetitionRun) {
  const standings = deriveStandings(
    run.participantIds,
    Object.values(run.matches),
    run.configSnapshot.tableScoring,
  );
  run.tieResolutions = Object.fromEntries(
    Object.entries(run.tieResolutions).filter(
      ([, resolution]) =>
        resolution.resultFingerprint === standings.resultFingerprint,
    ),
  );
}

function updateRoundRobinStage(run: CompetitionRun) {
  const standings = deriveStandings(
    run.participantIds,
    Object.values(run.matches),
    run.configSnapshot.tableScoring,
    Object.values(run.tieResolutions),
  );
  run.stage = standings.roundRobinComplete
    ? "qualification-review"
    : "round-robin";
}

export function setMatchInProgress(
  source: CompetitionRun,
  matchId: string,
  expectedMatchRevision: number,
  updatedAt: number,
) {
  if (source.stage === "completed") {
    throw new Error(
      "Reopen the completed competition before changing matches.",
    );
  }
  const run = cloneRun(source);
  const match = run.matches[matchId];
  if (!match || match.revision !== expectedMatchRevision) {
    throw new MatchRevisionConflictError();
  }
  if (
    match.isBye ||
    match.result ||
    !match.participantAId ||
    !match.participantBId
  ) {
    throw new Error("This match is not ready to start.");
  }
  Object.values(run.matches).forEach((candidate) => {
    if (candidate.id !== matchId && candidate.status === "in-progress") {
      candidate.status =
        candidate.stage === "round-robin" ? "pending" : "ready";
      candidate.revision += 1;
    }
  });
  match.status = "in-progress";
  match.revision += 1;
  run.currentMatchId = matchId;
  advanceRevision(run, updatedAt);
  return run;
}

export function returnMatchToPending(
  source: CompetitionRun,
  matchId: string,
  expectedMatchRevision: number,
  updatedAt: number,
) {
  const run = cloneRun(source);
  const match = run.matches[matchId];
  if (
    !match ||
    match.revision !== expectedMatchRevision ||
    match.status !== "in-progress"
  ) {
    throw new MatchRevisionConflictError();
  }
  match.status = match.stage === "round-robin" ? "pending" : "ready";
  match.revision += 1;
  if (run.currentMatchId === matchId) run.currentMatchId = null;
  advanceRevision(run, updatedAt);
  return run;
}

function resetKnockout(run: CompetitionRun) {
  Object.keys(run.matches).forEach((id) => {
    if (run.matches[id]!.stage !== "round-robin") delete run.matches[id];
  });
  run.knockout = null;
  run.placements = null;
  run.completedAt = null;
  run.completedByUid = null;
  run.stage = "qualification-review";
  if (run.currentMatchId && !run.matches[run.currentMatchId]) {
    run.currentMatchId = null;
  }
}

function clearDescendants(
  run: CompetitionRun,
  matchId: string,
  requireConfirmation: boolean,
) {
  const descendantIds = descendantMatchIds(run.matches, matchId);
  const affected = descendantIds.filter((id) => {
    const match = run.matches[id]!;
    return match.result !== null || match.status === "in-progress";
  });
  if (affected.length > 0 && !requireConfirmation) {
    throw new MatchDependencyConflictError(affected);
  }
  descendantIds.forEach((id) => {
    const match = run.matches[id]!;
    match.result = null;
    match.status = "pending";
    match.revision += 1;
    if (run.currentMatchId === id) run.currentMatchId = null;
  });
}

export interface RecordResultOptions {
  expectedMatchRevision: number;
  roundWinnerIds: string[];
  organizerUid: string;
  now: number;
  resetKnockout?: boolean;
  cascade?: boolean;
}

export function recordMatchResult(
  source: CompetitionRun,
  matchId: string,
  options: RecordResultOptions,
) {
  if (source.stage === "completed") {
    throw new Error(
      "Reopen the completed competition before changing results.",
    );
  }
  const run = cloneRun(source);
  const match = run.matches[matchId];
  if (!match || match.revision !== options.expectedMatchRevision) {
    throw new MatchRevisionConflictError();
  }
  if (match.isBye || !match.participantAId || !match.participantBId) {
    throw new Error("A result cannot be entered for this match.");
  }
  const correcting = match.result !== null;

  if (correcting && match.stage === "round-robin" && run.knockout) {
    if (!options.resetKnockout) {
      throw new MatchDependencyConflictError(
        Object.keys(run.matches).filter(
          (id) => run.matches[id]!.stage !== "round-robin",
        ),
      );
    }
    resetKnockout(run);
  } else if (correcting && match.stage !== "round-robin") {
    clearDescendants(run, matchId, Boolean(options.cascade));
  }

  match.result = createMatchResult(
    match,
    run.configSnapshot.series,
    options.roundWinnerIds,
    options.organizerUid,
    options.now,
    (match.result?.resultRevision ?? 0) + 1,
  );
  match.status = "completed";
  match.revision += 1;
  if (run.currentMatchId === matchId) run.currentMatchId = null;

  if (match.stage === "round-robin") {
    invalidateStaleTieResolutions(run);
    updateRoundRobinStage(run);
  } else {
    run.matches = refreshKnockoutParticipants(run.matches, source.matches);
  }
  advanceRevision(run, options.now);
  return run;
}

export function resolveRunTie(
  source: CompetitionRun,
  participantIds: string[],
  orderedParticipantIds: string[],
  organizerUid: string,
  now: number,
  reason = "",
) {
  const run = cloneRun(source);
  const standings = deriveStandings(
    run.participantIds,
    Object.values(run.matches),
    run.configSnapshot.tableScoring,
    Object.values(run.tieResolutions),
  );
  if (!standings.roundRobinComplete) {
    throw new Error("Complete every round-robin match before resolving a tie.");
  }
  const expected = [...participantIds].sort().join("|");
  if (
    !standings.unresolvedTieGroups.some(
      (group) => [...group].sort().join("|") === expected,
    )
  ) {
    throw new Error("This tie is no longer unresolved.");
  }
  const resolution = createTieResolution(
    participantIds,
    orderedParticipantIds,
    standings.resultFingerprint,
    organizerUid,
    now,
    reason,
  );
  run.tieResolutions[resolution.id] = resolution;
  advanceRevision(run, now);
  return run;
}

export function generateRunKnockout(
  source: CompetitionRun,
  organizerUid: string,
  now: number,
) {
  if (source.knockout) throw new Error("The knockout bracket already exists.");
  const run = cloneRun(source);
  const standings = deriveStandings(
    run.participantIds,
    Object.values(run.matches),
    run.configSnapshot.tableScoring,
    Object.values(run.tieResolutions),
  );
  if (!standings.roundRobinComplete) {
    throw new Error("Complete every round-robin match first.");
  }
  if (
    qualificationBlockingTies(standings, run.configSnapshot.qualificationCount)
      .length > 0
  ) {
    throw new Error("Resolve qualification and seeding ties first.");
  }
  const seedOrder = standings.rows
    .slice(0, run.configSnapshot.qualificationCount)
    .map((row) => row.participantId);
  const nextSequence =
    Math.max(
      0,
      ...Object.values(run.matches).map((match) => match.globalSequence),
    ) + 1;
  const generated = generateKnockout(
    run.competitionId,
    seedOrder,
    run.configSnapshot.includeThirdPlace,
    standings.resultFingerprint,
    organizerUid,
    now,
    nextSequence,
  );
  run.knockout = generated.knockout;
  Object.assign(run.matches, generated.matches);
  run.stage = "knockout";
  advanceRevision(run, now);
  return run;
}

function finalMatch(run: CompetitionRun) {
  const finalId = run.knockout?.rounds.at(-1)?.matchIds[0];
  return finalId ? run.matches[finalId] : undefined;
}

export function canCompleteCompetition(run: CompetitionRun) {
  const final = finalMatch(run);
  if (!final?.result || final.status !== "completed") return false;
  if (!run.knockout?.thirdPlaceMatchId) return true;
  const third = run.matches[run.knockout.thirdPlaceMatchId];
  return Boolean(third?.result && third.status === "completed");
}

function derivePlacements(run: CompetitionRun): Placement[] {
  const final = finalMatch(run);
  if (!final?.result) throw new Error("The final result is incomplete.");
  const championId = final.result.winnerId;
  const runnerUpId =
    championId === final.participantAId
      ? final.participantBId!
      : final.participantAId!;
  const placements: Placement[] = [
    {
      participantId: championId,
      place: 1,
      placementBand: "Champion",
      eliminationStage: "winner",
    },
    {
      participantId: runnerUpId,
      place: 2,
      placementBand: "Runner-up",
      eliminationStage: "final",
    },
  ];
  if (run.knockout?.thirdPlaceMatchId) {
    const third = run.matches[run.knockout.thirdPlaceMatchId]!;
    if (!third.result) throw new Error("The third-place result is incomplete.");
    const thirdId = third.result.winnerId;
    const fourthId =
      thirdId === third.participantAId
        ? third.participantBId!
        : third.participantAId!;
    placements.push(
      {
        participantId: thirdId,
        place: 3,
        placementBand: "Third place",
        eliminationStage: "third-place",
      },
      {
        participantId: fourthId,
        place: 4,
        placementBand: "Fourth place",
        eliminationStage: "third-place",
      },
    );
  }
  const placed = new Set(placements.map((entry) => entry.participantId));
  run.knockout?.seedOrder.forEach((participantId) => {
    if (!placed.has(participantId)) {
      placements.push({
        participantId,
        place: null,
        placementBand: "Knockout qualifier",
        eliminationStage: "knockout",
      });
    }
  });
  return placements;
}

export function completeCompetitionRun(
  source: CompetitionRun,
  organizerUid: string,
  now: number,
) {
  if (!canCompleteCompetition(source)) {
    throw new Error("Complete the final and required third-place match first.");
  }
  const run = cloneRun(source);
  run.stage = "completed";
  run.completedAt = now;
  run.completedByUid = organizerUid;
  run.currentMatchId = null;
  run.placements = {
    entries: derivePlacements(run),
    completedAt: now,
    completedByUid: organizerUid,
    runtimeRevision: run.revision + 1,
    schemaVersion: 1,
  };
  advanceRevision(run, now);
  return run;
}

export function reopenCompetitionRun(source: CompetitionRun, now: number) {
  if (source.stage !== "completed" || !source.knockout) {
    throw new Error("Only a completed competition can be reopened.");
  }
  const run = cloneRun(source);
  run.stage = "knockout";
  run.completedAt = null;
  run.completedByUid = null;
  run.placements = null;
  advanceRevision(run, now);
  return run;
}

export function validTieResolutions(run: CompetitionRun): TieResolution[] {
  const fingerprint = deriveStandings(
    run.participantIds,
    Object.values(run.matches),
    run.configSnapshot.tableScoring,
  ).resultFingerprint;
  return Object.values(run.tieResolutions).filter(
    (resolution) => resolution.resultFingerprint === fingerprint,
  );
}
