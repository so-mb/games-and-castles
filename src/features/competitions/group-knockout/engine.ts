import {
  descendantMatchIds,
  generateKnockout,
  nextPowerOfTwo,
  refreshKnockoutParticipants,
  seededPositions,
} from "../engine/knockout";
import { createMatchResult } from "../engine/series";
import type { CompetitionMatch, Placement } from "../engine/types";
import {
  createCrossGroupSeedResolution,
  createGroupTieResolution,
  createQualificationSnapshot,
  deriveCrossGroupSeeds,
  deriveGroupStandings,
} from "./standings";
import type {
  GroupCompetitionMatch,
  GroupKnockoutRun,
  GroupTieResolution,
} from "./types";

export class GroupRunRevisionConflictError extends Error {
  constructor() {
    super(
      "This Group Format changed on another device. Reload the latest state before editing.",
    );
    this.name = "GroupRunRevisionConflictError";
  }
}

export class GroupMatchDependencyConflictError extends Error {
  affectedMatchIds: string[];

  constructor(affectedMatchIds: string[]) {
    super(
      "This correction affects qualification or later knockout matches. Confirm the required reset before continuing.",
    );
    this.name = "GroupMatchDependencyConflictError";
    this.affectedMatchIds = affectedMatchIds;
  }
}

function cloneRun(run: GroupKnockoutRun) {
  return structuredClone(run);
}

function advanceRevision(run: GroupKnockoutRun, updatedAt: number) {
  run.updatedAt = updatedAt;
  run.revision += 1;
  run.resultCount = Object.values(run.matches).filter(
    (match) => match.result !== null,
  ).length;
}

function resetKnockoutState(run: GroupKnockoutRun) {
  Object.keys(run.matches).forEach((matchId) => {
    if (run.matches[matchId]!.stage !== "group-stage") {
      delete run.matches[matchId];
    }
  });
  run.knockout = null;
  run.placements = null;
  run.completedAt = null;
  run.completedByUid = null;
  run.currentMatchId =
    run.currentMatchId && run.matches[run.currentMatchId]
      ? run.currentMatchId
      : null;
}

function invalidateQualification(run: GroupKnockoutRun) {
  run.qualification = null;
  run.seedResolutions = {};
  run.stage = "group-stage";
}

function invalidateStaleGroupTies(run: GroupKnockoutRun) {
  const fingerprints = Object.fromEntries(
    run.groups.map((group) => [
      group.id,
      deriveGroupStandings(run, group.id).standingsFingerprint,
    ]),
  );
  run.tieResolutions = Object.fromEntries(
    Object.entries(run.tieResolutions).filter(
      ([, resolution]) =>
        fingerprints[resolution.groupId] === resolution.standingsFingerprint,
    ),
  );
}

function knockoutMatches(run: GroupKnockoutRun) {
  return Object.fromEntries(
    Object.entries(run.matches).filter(
      ([, match]) => match.stage !== "group-stage",
    ),
  ) as Record<string, CompetitionMatch>;
}

function refreshGroupKnockout(
  run: GroupKnockoutRun,
  previous: GroupKnockoutRun,
) {
  const refreshed = refreshKnockoutParticipants(
    knockoutMatches(run),
    knockoutMatches(previous),
  );
  Object.assign(run.matches, refreshed);
}

export function setGroupMatchInProgress(
  source: GroupKnockoutRun,
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
    throw new GroupRunRevisionConflictError();
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
    if (candidate.id !== match.id && candidate.status === "in-progress") {
      candidate.status =
        candidate.stage === "group-stage" ? "pending" : "ready";
      candidate.revision += 1;
    }
  });
  match.status = "in-progress";
  match.revision += 1;
  run.currentMatchId = match.id;
  advanceRevision(run, updatedAt);
  return run;
}

export function returnGroupMatchToPending(
  source: GroupKnockoutRun,
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
    throw new GroupRunRevisionConflictError();
  }
  match.status = match.stage === "group-stage" ? "pending" : "ready";
  match.revision += 1;
  if (run.currentMatchId === match.id) run.currentMatchId = null;
  advanceRevision(run, updatedAt);
  return run;
}

function clearKnockoutDescendants(
  run: GroupKnockoutRun,
  matchId: string,
  requireConfirmation: boolean,
) {
  const matches = knockoutMatches(run);
  const descendants = descendantMatchIds(matches, matchId);
  const affected = descendants.filter((id) => {
    const match = run.matches[id]!;
    return match.result !== null || match.status === "in-progress";
  });
  if (affected.length > 0 && !requireConfirmation) {
    throw new GroupMatchDependencyConflictError(affected);
  }
  descendants.forEach((id) => {
    const match = run.matches[id]!;
    match.result = null;
    match.status = "pending";
    match.revision += 1;
    if (run.currentMatchId === id) run.currentMatchId = null;
  });
}

export interface GroupRecordResultOptions {
  expectedMatchRevision: number;
  roundWinnerIds: string[];
  organizerUid: string;
  now: number;
  resetKnockout?: boolean;
  cascade?: boolean;
}

export function recordGroupMatchResult(
  source: GroupKnockoutRun,
  matchId: string,
  options: GroupRecordResultOptions,
) {
  if (source.stage === "completed") {
    throw new Error(
      "Reopen the completed competition before changing results.",
    );
  }
  const run = cloneRun(source);
  const match = run.matches[matchId];
  if (!match || match.revision !== options.expectedMatchRevision) {
    throw new GroupRunRevisionConflictError();
  }
  if (match.isBye || !match.participantAId || !match.participantBId) {
    throw new Error("A result cannot be entered for this match.");
  }
  const correcting = match.result !== null;
  if (correcting && match.stage === "group-stage" && run.knockout) {
    if (!options.resetKnockout) {
      throw new GroupMatchDependencyConflictError(
        Object.keys(run.matches).filter(
          (id) => run.matches[id]!.stage !== "group-stage",
        ),
      );
    }
    resetKnockoutState(run);
  } else if (correcting && match.stage !== "group-stage") {
    clearKnockoutDescendants(run, matchId, Boolean(options.cascade));
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
  if (run.currentMatchId === match.id) run.currentMatchId = null;
  if (match.stage === "group-stage") {
    invalidateQualification(run);
    invalidateStaleGroupTies(run);
  } else refreshGroupKnockout(run, source);
  advanceRevision(run, options.now);
  return run;
}

export function resolveGroupTie(
  source: GroupKnockoutRun,
  groupId: string,
  participantIds: string[],
  orderedParticipantIds: string[],
  organizerUid: string,
  now: number,
  reason: string,
) {
  if (source.qualification || source.knockout) {
    throw new Error(
      "Reset the qualification state before changing group ties.",
    );
  }
  const run = cloneRun(source);
  const standings = deriveGroupStandings(run, groupId);
  if (!standings.complete) {
    throw new Error(
      "Complete every match in this group before resolving a tie.",
    );
  }
  const expected = [...participantIds].sort().join("|");
  if (
    !standings.unresolvedTieGroups.some(
      (group) => [...group].sort().join("|") === expected,
    )
  ) {
    throw new Error("This group tie is no longer unresolved.");
  }
  const resolution = createGroupTieResolution(
    groupId,
    participantIds,
    orderedParticipantIds,
    standings.standingsFingerprint,
    organizerUid,
    now,
    reason,
  );
  run.tieResolutions[resolution.id] = resolution;
  advanceRevision(run, now);
  return run;
}

export function beginQualificationReview(
  source: GroupKnockoutRun,
  organizerUid: string,
  now: number,
) {
  if (source.stage !== "group-stage" || source.knockout) {
    throw new Error("Qualification review is not available in this stage.");
  }
  const run = cloneRun(source);
  run.qualification = createQualificationSnapshot(run, organizerUid, now);
  run.seedResolutions = {};
  run.stage = "qualification-review";
  advanceRevision(run, now);
  if (run.qualification) run.qualification.runtimeRevision = run.revision;
  return run;
}

export function resolveCrossGroupSeedTie(
  source: GroupKnockoutRun,
  groupRank: number,
  participantIds: string[],
  orderedParticipantIds: string[],
  organizerUid: string,
  now: number,
  reason: string,
) {
  if (source.stage !== "qualification-review" || !source.qualification) {
    throw new Error("Open qualification review before resolving seed ties.");
  }
  const run = cloneRun(source);
  const qualification = run.qualification;
  if (!qualification)
    throw new Error("The qualification snapshot is unavailable.");
  const resolution = createCrossGroupSeedResolution(
    qualification,
    groupRank,
    participantIds,
    orderedParticipantIds,
    organizerUid,
    now,
    reason,
  );
  run.seedResolutions[resolution.id] = resolution;
  advanceRevision(run, now);
  return run;
}

function sameGroupWarning(
  run: GroupKnockoutRun,
  matches: Record<string, CompetitionMatch>,
) {
  const groupByParticipant = new Map(
    run.groups.flatMap((group) =>
      group.participantIds.map(
        (participantId) => [participantId, group.id] as const,
      ),
    ),
  );
  const firstPlayed = Object.values(matches)
    .filter(
      (match) =>
        match.stage === "knockout" &&
        match.bracketRound === 1 &&
        !match.isBye &&
        match.participantAId &&
        match.participantBId,
    )
    .filter(
      (match) =>
        groupByParticipant.get(match.participantAId!) ===
        groupByParticipant.get(match.participantBId!),
    );
  return firstPlayed.length > 0
    ? "A same-group rematch could not be avoided without changing rank tiers or earned seed advantages."
    : null;
}

export function avoidSameGroupRematches(
  run: GroupKnockoutRun,
  sourceSeedOrder: string[],
) {
  if (!run.qualification) return [...sourceSeedOrder];
  const seedOrder = [...sourceSeedOrder];
  const positions = seededPositions(nextPowerOfTwo(seedOrder.length));
  const groupByParticipant = new Map(
    run.groups.flatMap((group) =>
      group.participantIds.map(
        (participantId) => [participantId, group.id] as const,
      ),
    ),
  );
  const rankByParticipant = new Map(
    run.qualification.entries.map(
      (entry) => [entry.participantId, entry.groupRank] as const,
    ),
  );
  const lowerSlotsByTier = new Map<
    number,
    Array<{ seedIndex: number; opponentGroupId: string }>
  >();

  for (let index = 0; index < positions.length; index += 2) {
    const firstSeed = positions[index]!;
    const secondSeed = positions[index + 1]!;
    const higherSeed = Math.min(firstSeed, secondSeed);
    const lowerSeed = Math.max(firstSeed, secondSeed);
    const higherParticipant = seedOrder[higherSeed - 1];
    const lowerParticipant = seedOrder[lowerSeed - 1];
    if (!higherParticipant || !lowerParticipant) continue;
    const tier = rankByParticipant.get(lowerParticipant);
    const opponentGroupId = groupByParticipant.get(higherParticipant);
    if (!tier || !opponentGroupId) continue;
    const slots = lowerSlotsByTier.get(tier) ?? [];
    slots.push({ seedIndex: lowerSeed - 1, opponentGroupId });
    lowerSlotsByTier.set(tier, slots);
  }

  lowerSlotsByTier.forEach((slots) => {
    if (slots.length < 2) return;
    const candidates = slots.map((slot) => seedOrder[slot.seedIndex]!);
    let best: string[] | null = null;
    let bestConflicts = Number.POSITIVE_INFINITY;
    let bestDisplacement = Number.POSITIVE_INFINITY;

    const visit = (
      slotIndex: number,
      remaining: Array<{ participantId: string; originalIndex: number }>,
      chosen: string[],
      conflicts: number,
      displacement: number,
    ) => {
      if (conflicts > bestConflicts) return;
      if (slotIndex === slots.length) {
        if (
          conflicts < bestConflicts ||
          (conflicts === bestConflicts && displacement < bestDisplacement)
        ) {
          best = chosen;
          bestConflicts = conflicts;
          bestDisplacement = displacement;
        }
        return;
      }
      remaining.forEach((candidate, remainingIndex) => {
        const slot = slots[slotIndex]!;
        visit(
          slotIndex + 1,
          remaining.filter((_, index) => index !== remainingIndex),
          [...chosen, candidate.participantId],
          conflicts +
            Number(
              groupByParticipant.get(candidate.participantId) ===
                slot.opponentGroupId,
            ),
          displacement + Math.abs(candidate.originalIndex - slotIndex),
        );
      });
    };

    visit(
      0,
      candidates.map((participantId, originalIndex) => ({
        participantId,
        originalIndex,
      })),
      [],
      0,
      0,
    );
    const selected = best as string[] | null;
    selected?.forEach((participantId, index) => {
      seedOrder[slots[index]!.seedIndex] = participantId;
    });
  });
  return seedOrder;
}

export function generateGroupKnockout(
  source: GroupKnockoutRun,
  organizerUid: string,
  now: number,
) {
  if (
    source.stage !== "qualification-review" ||
    !source.qualification ||
    source.knockout
  ) {
    throw new Error("Confirm qualification before generating the knockout.");
  }
  const seeds = deriveCrossGroupSeeds(
    source.qualification,
    Object.values(source.seedResolutions),
  );
  if (seeds.unresolvedTieGroups.length > 0) {
    throw new Error(
      "Resolve cross-group seed ties before generating the bracket.",
    );
  }
  const bracketSeedOrder = avoidSameGroupRematches(source, seeds.seedOrder);
  const run = cloneRun(source);
  const qualification = run.qualification;
  if (!qualification)
    throw new Error("The qualification snapshot is unavailable.");
  const nextSequence =
    Math.max(
      0,
      ...Object.values(run.matches).map((match) => match.globalSequence),
    ) + 1;
  const generated = generateKnockout(
    run.competitionId,
    bracketSeedOrder,
    run.configSnapshot.includeThirdPlace,
    qualification.qualificationFingerprint,
    organizerUid,
    now,
    nextSequence,
  );
  const warning = sameGroupWarning(run, generated.matches);
  run.knockout = {
    ...generated.knockout,
    qualificationFingerprint: qualification.qualificationFingerprint,
    sameGroupRematchWarning: warning,
  };
  Object.assign(
    run.matches,
    generated.matches as Record<string, GroupCompetitionMatch>,
  );
  run.stage = "knockout";
  advanceRevision(run, now);
  return run;
}

export function resetGroupKnockout(source: GroupKnockoutRun, now: number) {
  if (!source.knockout)
    throw new Error("There is no knockout bracket to reset.");
  const run = cloneRun(source);
  resetKnockoutState(run);
  run.stage = "qualification-review";
  advanceRevision(run, now);
  return run;
}

function finalMatch(run: GroupKnockoutRun) {
  const finalId = run.knockout?.rounds.at(-1)?.matchIds[0];
  return finalId ? run.matches[finalId] : undefined;
}

export function canCompleteGroupCompetition(run: GroupKnockoutRun) {
  const final = finalMatch(run);
  if (!final?.result || final.status !== "completed") return false;
  if (!run.knockout?.thirdPlaceMatchId) return true;
  const thirdPlace = run.matches[run.knockout.thirdPlaceMatchId];
  return Boolean(thirdPlace?.result && thirdPlace.status === "completed");
}

function derivePlacements(run: GroupKnockoutRun): Placement[] {
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
    const thirdPlace = run.matches[run.knockout.thirdPlaceMatchId]!;
    if (!thirdPlace.result)
      throw new Error("The third-place result is incomplete.");
    const thirdId = thirdPlace.result.winnerId;
    const fourthId =
      thirdId === thirdPlace.participantAId
        ? thirdPlace.participantBId!
        : thirdPlace.participantAId!;
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
  const placed = new Set(
    placements.map((placement) => placement.participantId),
  );
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

export function completeGroupCompetition(
  source: GroupKnockoutRun,
  organizerUid: string,
  now: number,
) {
  if (!canCompleteGroupCompetition(source)) {
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

export function reopenGroupCompetition(source: GroupKnockoutRun, now: number) {
  if (source.stage !== "completed" || !source.knockout) {
    throw new Error("Only a completed Group Format can be reopened.");
  }
  const run = cloneRun(source);
  run.stage = "knockout";
  run.completedAt = null;
  run.completedByUid = null;
  run.placements = null;
  advanceRevision(run, now);
  return run;
}

export function validGroupTieResolutions(run: GroupKnockoutRun) {
  const fingerprints = Object.fromEntries(
    run.groups.map((group) => [
      group.id,
      deriveGroupStandings(run, group.id).standingsFingerprint,
    ]),
  );
  return Object.values(run.tieResolutions).filter(
    (resolution: GroupTieResolution) =>
      resolution.standingsFingerprint === fingerprints[resolution.groupId],
  );
}
