import type { HeadToHeadTableScoring } from "../domain/types";
import type { StandingRow } from "../engine/types";
import type {
  CrossGroupSeedResolution,
  CrossGroupSeedResult,
  GroupKnockoutRun,
  GroupStandingResult,
  GroupTieResolution,
  QualificationSnapshot,
  QualifiedParticipantSnapshot,
} from "./types";

function hashString(value: string) {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

function splitByMetric(
  cohort: StandingRow[],
  value: (row: StandingRow) => number,
) {
  const groups: StandingRow[][] = [];
  [...cohort]
    .sort((left, right) => value(right) - value(left))
    .forEach((row) => {
      const previous = groups.at(-1);
      if (!previous || value(previous[0]!) !== value(row)) groups.push([row]);
      else previous.push(row);
    });
  return groups;
}

function groupFingerprint(run: GroupKnockoutRun, groupId: string) {
  const input = Object.values(run.matches)
    .filter(
      (match) => match.stage === "group-stage" && match.groupId === groupId,
    )
    .sort((left, right) => left.id.localeCompare(right.id))
    .map((match) =>
      match.result
        ? `${match.id}:${match.revision}:${match.result.roundWinnerIds.join(",")}`
        : `${match.id}:${match.revision}:pending`,
    )
    .join("|");
  return `group-${hashString(input)}`;
}

function tieResolutionFor(
  participantIds: string[],
  fingerprint: string,
  resolutions: GroupTieResolution[],
) {
  const expected = [...participantIds].sort().join("|");
  return resolutions.find(
    (resolution) =>
      resolution.standingsFingerprint === fingerprint &&
      [...resolution.participantIds].sort().join("|") === expected,
  );
}

export function deriveGroupStandings(
  run: GroupKnockoutRun,
  groupId: string,
): GroupStandingResult {
  const group = run.groups.find((candidate) => candidate.id === groupId);
  if (!group) throw new Error("The requested group does not exist.");
  const expectedMatchesPerPlayer =
    (group.participantIds.length - 1) * run.configSnapshot.roundRobinLegs;
  const rows = group.participantIds.map<StandingRow>((participantId) => ({
    participantId,
    rank: 1,
    tied: false,
    decidedBy: "table-points",
    played: 0,
    matchWins: 0,
    matchDraws: 0,
    matchLosses: 0,
    tablePoints: 0,
    roundsWon: 0,
    roundsLost: 0,
    roundDifferential: 0,
    remainingMatches: expectedMatchesPerPlayer,
  }));
  const byId = new Map(rows.map((row) => [row.participantId, row]));
  const matches = Object.values(run.matches).filter(
    (match) => match.stage === "group-stage" && match.groupId === groupId,
  );
  const scoring: HeadToHeadTableScoring = run.configSnapshot.tableScoring;
  matches.forEach((match) => {
    if (!match.result || match.status !== "completed") return;
    const left = match.participantAId
      ? byId.get(match.participantAId)
      : undefined;
    const right = match.participantBId
      ? byId.get(match.participantBId)
      : undefined;
    if (!left || !right) return;
    left.played += 1;
    right.played += 1;
    left.remainingMatches -= 1;
    right.remainingMatches -= 1;
    left.roundsWon += match.result.participantAWins;
    left.roundsLost += match.result.participantBWins;
    right.roundsWon += match.result.participantBWins;
    right.roundsLost += match.result.participantAWins;
    if (match.result.winnerId === left.participantId) {
      left.matchWins += 1;
      right.matchLosses += 1;
      left.tablePoints += scoring.pointsForMatchWin;
      right.tablePoints += scoring.pointsForMatchLoss;
    } else {
      right.matchWins += 1;
      left.matchLosses += 1;
      right.tablePoints += scoring.pointsForMatchWin;
      left.tablePoints += scoring.pointsForMatchLoss;
    }
  });
  rows.forEach((row) => {
    row.roundDifferential = row.roundsWon - row.roundsLost;
  });

  const fingerprint = groupFingerprint(run, groupId);
  const resolutions = Object.values(run.tieResolutions).filter(
    (resolution) => resolution.groupId === groupId,
  );
  const orderedGroups: Array<{
    rows: StandingRow[];
    decidedBy: StandingRow["decidedBy"];
  }> = [];
  const refine = (cohort: StandingRow[], metricIndex: number): void => {
    if (cohort.length <= 1) {
      orderedGroups.push({ rows: cohort, decidedBy: "table-points" });
      return;
    }
    if (metricIndex === 0 && cohort.length === 2) {
      const [left, right] = cohort;
      const directMatches = matches.filter(
        (match) =>
          match.result &&
          ((match.participantAId === left!.participantId &&
            match.participantBId === right!.participantId) ||
            (match.participantAId === right!.participantId &&
              match.participantBId === left!.participantId)),
      );
      const directPoints = new Map([
        [left!.participantId, 0],
        [right!.participantId, 0],
      ]);
      directMatches.forEach((match) => {
        directPoints.set(
          match.result!.winnerId,
          (directPoints.get(match.result!.winnerId) ?? 0) +
            scoring.pointsForMatchWin,
        );
        const loserId =
          match.result!.winnerId === match.participantAId
            ? match.participantBId!
            : match.participantAId!;
        directPoints.set(
          loserId,
          (directPoints.get(loserId) ?? 0) + scoring.pointsForMatchLoss,
        );
      });
      const leftPoints = directPoints.get(left!.participantId) ?? 0;
      const rightPoints = directPoints.get(right!.participantId) ?? 0;
      if (
        directMatches.length === run.configSnapshot.roundRobinLegs &&
        leftPoints !== rightPoints
      ) {
        const winner = leftPoints > rightPoints ? left! : right!;
        const loser = winner === left ? right! : left!;
        orderedGroups.push(
          { rows: [winner], decidedBy: "head-to-head" },
          { rows: [loser], decidedBy: "head-to-head" },
        );
        return;
      }
    }
    const metrics: Array<{
      name: StandingRow["decidedBy"];
      value: (row: StandingRow) => number;
    }> = [
      { name: "round-differential", value: (row) => row.roundDifferential },
      { name: "rounds-won", value: (row) => row.roundsWon },
      { name: "match-wins", value: (row) => row.matchWins },
    ];
    const metric = metrics[metricIndex];
    if (metric) {
      const groups = splitByMetric(cohort, metric.value);
      if (groups.length > 1) {
        groups.forEach((metricGroup) => {
          if (metricGroup.length === 1) {
            orderedGroups.push({ rows: metricGroup, decidedBy: metric.name });
          } else refine(metricGroup, metricIndex + 1);
        });
      } else refine(cohort, metricIndex + 1);
      return;
    }
    const resolution = tieResolutionFor(
      cohort.map((row) => row.participantId),
      fingerprint,
      resolutions,
    );
    if (resolution) {
      resolution.orderedParticipantIds.forEach((participantId) => {
        orderedGroups.push({
          rows: [byId.get(participantId)!],
          decidedBy: "organizer-decision",
        });
      });
    } else orderedGroups.push({ rows: cohort, decidedBy: "unresolved" });
  };
  splitByMetric(rows, (row) => row.tablePoints).forEach((cohort) =>
    refine(cohort, 0),
  );

  const ranked: StandingRow[] = [];
  const unresolvedTieGroups: string[][] = [];
  let rank = 1;
  orderedGroups.forEach((cohort) => {
    if (cohort.rows.length > 1) {
      unresolvedTieGroups.push(cohort.rows.map((row) => row.participantId));
    }
    cohort.rows.forEach((row) => {
      ranked.push({
        ...row,
        rank,
        tied: cohort.rows.length > 1,
        decidedBy: cohort.decidedBy,
      });
    });
    rank += cohort.rows.length;
  });
  return {
    groupId,
    rows: ranked,
    unresolvedTieGroups,
    standingsFingerprint: fingerprint,
    complete:
      matches.length > 0 &&
      matches.every(
        (match) => match.status === "completed" && match.result !== null,
      ),
  };
}

export function groupQualificationBlockingTies(
  standings: GroupStandingResult,
  qualifiersPerGroup: number,
) {
  return standings.unresolvedTieGroups.filter((participantIds) =>
    participantIds.some(
      (participantId) =>
        standings.rows.find((row) => row.participantId === participantId)!
          .rank <= qualifiersPerGroup,
    ),
  );
}

function validateExplicitOrder(
  participantIds: string[],
  orderedParticipantIds: string[],
) {
  return (
    participantIds.length >= 2 &&
    new Set(orderedParticipantIds).size === participantIds.length &&
    [...participantIds].sort().join("|") ===
      [...orderedParticipantIds].sort().join("|")
  );
}

export function createGroupTieResolution(
  groupId: string,
  participantIds: string[],
  orderedParticipantIds: string[],
  standingsFingerprint: string,
  resolvedByUid: string,
  resolvedAt: number,
  reason: string,
): GroupTieResolution {
  if (!validateExplicitOrder(participantIds, orderedParticipantIds)) {
    throw new Error(
      "The tie decision must order every tied player exactly once.",
    );
  }
  const key = [...participantIds].sort().join("|");
  return {
    id: `group-tie-${hashString(`${groupId}:${key}:${standingsFingerprint}`)}`,
    groupId,
    participantIds: [...participantIds],
    orderedParticipantIds: [...orderedParticipantIds],
    reason: reason.trim().slice(0, 160),
    standingsFingerprint,
    resolvedAt,
    resolvedByUid,
    schemaVersion: 1,
  };
}

export function createQualificationSnapshot(
  run: GroupKnockoutRun,
  confirmedByUid: string,
  confirmedAt: number,
): QualificationSnapshot {
  const standings = run.groups.map((group) =>
    deriveGroupStandings(run, group.id),
  );
  if (standings.some((result) => !result.complete)) {
    throw new Error("Complete every group-stage match first.");
  }
  if (
    standings.some(
      (result) =>
        groupQualificationBlockingTies(
          result,
          run.configSnapshot.qualifiersPerGroup,
        ).length > 0,
    )
  ) {
    throw new Error("Resolve every qualification or rank-tier tie first.");
  }
  const entries = standings.flatMap<QualifiedParticipantSnapshot>((result) =>
    result.rows.slice(0, run.configSnapshot.qualifiersPerGroup).map((row) => ({
      participantId: row.participantId,
      groupId: result.groupId,
      groupRank: row.rank,
      played: row.played,
      matchWins: row.matchWins,
      tablePoints: row.tablePoints,
      roundsWon: row.roundsWon,
      roundsLost: row.roundsLost,
      roundDifferential: row.roundDifferential,
    })),
  );
  const standingsFingerprints = Object.fromEntries(
    standings.map((result) => [result.groupId, result.standingsFingerprint]),
  );
  const qualificationFingerprint = `qualification-${hashString(
    entries
      .map(
        (entry) =>
          `${entry.groupId}:${entry.groupRank}:${entry.participantId}:${entry.played}:${entry.tablePoints}:${entry.matchWins}:${entry.roundDifferential}:${entry.roundsWon}`,
      )
      .sort()
      .join("|"),
  )}`;
  return {
    entries,
    byGroup: Object.fromEntries(
      run.groups.map((group) => [
        group.id,
        entries
          .filter((entry) => entry.groupId === group.id)
          .sort((left, right) => left.groupRank - right.groupRank)
          .map((entry) => entry.participantId),
      ]),
    ),
    standingsFingerprints,
    qualificationFingerprint,
    confirmedAt,
    confirmedByUid,
    runtimeRevision: run.revision + 1,
    schemaVersion: 1,
  };
}

function compareRatio(
  leftNumerator: number,
  leftDenominator: number,
  rightNumerator: number,
  rightDenominator: number,
) {
  return rightNumerator * leftDenominator - leftNumerator * rightDenominator;
}

function compareNormalized(
  left: QualifiedParticipantSnapshot,
  right: QualifiedParticipantSnapshot,
) {
  return (
    compareRatio(
      left.tablePoints,
      left.played,
      right.tablePoints,
      right.played,
    ) ||
    compareRatio(left.matchWins, left.played, right.matchWins, right.played) ||
    compareRatio(
      left.roundDifferential,
      left.played,
      right.roundDifferential,
      right.played,
    ) ||
    compareRatio(left.roundsWon, left.played, right.roundsWon, right.played)
  );
}

function sameNormalized(
  left: QualifiedParticipantSnapshot,
  right: QualifiedParticipantSnapshot,
) {
  return compareNormalized(left, right) === 0;
}

export function deriveCrossGroupSeeds(
  qualification: QualificationSnapshot,
  resolutions: CrossGroupSeedResolution[],
): CrossGroupSeedResult {
  const seedOrder: string[] = [];
  const unresolvedTieGroups: CrossGroupSeedResult["unresolvedTieGroups"] = [];
  const ranks = [
    ...new Set(qualification.entries.map((entry) => entry.groupRank)),
  ].sort((left, right) => left - right);
  ranks.forEach((groupRank) => {
    const tier = qualification.entries
      .filter((entry) => entry.groupRank === groupRank)
      .sort(compareNormalized);
    const cohorts: QualifiedParticipantSnapshot[][] = [];
    tier.forEach((entry) => {
      const previous = cohorts.at(-1);
      if (!previous || !sameNormalized(previous[0]!, entry))
        cohorts.push([entry]);
      else previous.push(entry);
    });
    cohorts.forEach((cohort) => {
      if (cohort.length === 1) {
        seedOrder.push(cohort[0]!.participantId);
        return;
      }
      const expected = cohort
        .map((entry) => entry.participantId)
        .sort()
        .join("|");
      const resolution = resolutions.find(
        (candidate) =>
          candidate.groupRank === groupRank &&
          candidate.qualificationFingerprint ===
            qualification.qualificationFingerprint &&
          [...candidate.participantIds].sort().join("|") === expected,
      );
      if (resolution) seedOrder.push(...resolution.orderedParticipantIds);
      else {
        unresolvedTieGroups.push({
          groupRank,
          participantIds: cohort.map((entry) => entry.participantId),
        });
      }
    });
  });
  return { seedOrder, unresolvedTieGroups };
}

export function createCrossGroupSeedResolution(
  qualification: QualificationSnapshot,
  groupRank: number,
  participantIds: string[],
  orderedParticipantIds: string[],
  resolvedByUid: string,
  resolvedAt: number,
  reason: string,
): CrossGroupSeedResolution {
  const unresolved = deriveCrossGroupSeeds(
    qualification,
    [],
  ).unresolvedTieGroups;
  const expected = [...participantIds].sort().join("|");
  if (
    !unresolved.some(
      (group) =>
        group.groupRank === groupRank &&
        [...group.participantIds].sort().join("|") === expected,
    ) ||
    !validateExplicitOrder(participantIds, orderedParticipantIds)
  ) {
    throw new Error("This cross-group seed tie is no longer unresolved.");
  }
  return {
    id: `seed-tie-${hashString(
      `${groupRank}:${expected}:${qualification.qualificationFingerprint}`,
    )}`,
    groupRank,
    participantIds: [...participantIds],
    orderedParticipantIds: [...orderedParticipantIds],
    reason: reason.trim().slice(0, 160),
    qualificationFingerprint: qualification.qualificationFingerprint,
    resolvedAt,
    resolvedByUid,
    schemaVersion: 1,
  };
}
