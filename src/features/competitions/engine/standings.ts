import type { HeadToHeadTableScoring } from "../domain/types";
import type {
  CompetitionMatch,
  StandingResult,
  StandingRow,
  TieResolution,
} from "./types";

function hashString(value: string) {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

export function createResultFingerprint(matches: CompetitionMatch[]) {
  const input = matches
    .filter((match) => match.stage === "round-robin")
    .sort((a, b) => a.id.localeCompare(b.id))
    .map((match) =>
      match.result
        ? `${match.id}:${match.revision}:${match.result.roundWinnerIds.join(",")}`
        : `${match.id}:${match.revision}:pending`,
    )
    .join("|");
  return `rr-${hashString(input)}`;
}

function baseRows(participantIds: string[]): StandingRow[] {
  return participantIds.map((participantId) => ({
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
    remainingMatches: Math.max(0, participantIds.length - 1),
  }));
}

function splitByMetric(
  cohort: StandingRow[],
  value: (row: StandingRow) => number,
) {
  const groups: StandingRow[][] = [];
  [...cohort]
    .sort((a, b) => value(b) - value(a))
    .forEach((row) => {
      const last = groups.at(-1);
      if (!last || value(last[0]!) !== value(row)) groups.push([row]);
      else last.push(row);
    });
  return groups;
}

function resolutionFor(
  participantIds: string[],
  resolutions: TieResolution[],
  fingerprint: string,
) {
  const expected = [...participantIds].sort().join("|");
  return resolutions.find(
    (resolution) =>
      resolution.resultFingerprint === fingerprint &&
      [...resolution.participantIds].sort().join("|") === expected &&
      new Set(resolution.orderedParticipantIds).size ===
        participantIds.length &&
      resolution.orderedParticipantIds.every((id) =>
        participantIds.includes(id),
      ),
  );
}

export function deriveStandings(
  participantIds: string[],
  matches: CompetitionMatch[],
  scoring: HeadToHeadTableScoring,
  tieResolutions: TieResolution[] = [],
): StandingResult {
  const rows = baseRows(participantIds);
  const byId = new Map(rows.map((row) => [row.participantId, row]));
  const roundRobinMatches = matches.filter(
    (match) => match.stage === "round-robin" && !match.isBye,
  );

  roundRobinMatches.forEach((match) => {
    if (!match.result || match.status !== "completed") return;
    const participantA = match.participantAId
      ? byId.get(match.participantAId)
      : undefined;
    const participantB = match.participantBId
      ? byId.get(match.participantBId)
      : undefined;
    if (!participantA || !participantB) return;
    participantA.played += 1;
    participantB.played += 1;
    participantA.remainingMatches -= 1;
    participantB.remainingMatches -= 1;
    participantA.roundsWon += match.result.participantAWins;
    participantA.roundsLost += match.result.participantBWins;
    participantB.roundsWon += match.result.participantBWins;
    participantB.roundsLost += match.result.participantAWins;
    if (match.result.isDraw) {
      participantA.matchDraws += 1;
      participantB.matchDraws += 1;
      participantA.tablePoints += scoring.pointsForDraw;
      participantB.tablePoints += scoring.pointsForDraw;
    } else if (match.result.winnerId === participantA.participantId) {
      participantA.matchWins += 1;
      participantB.matchLosses += 1;
      participantA.tablePoints += scoring.pointsForMatchWin;
      participantB.tablePoints += scoring.pointsForMatchLoss;
    } else {
      participantB.matchWins += 1;
      participantA.matchLosses += 1;
      participantB.tablePoints += scoring.pointsForMatchWin;
      participantA.tablePoints += scoring.pointsForMatchLoss;
    }
  });
  rows.forEach((row) => {
    row.roundDifferential = row.roundsWon - row.roundsLost;
  });

  const fingerprint = createResultFingerprint(roundRobinMatches);
  const tableGroups = splitByMetric(rows, (row) => row.tablePoints);
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
      const direct = roundRobinMatches.find(
        (match) =>
          match.result &&
          ((match.participantAId === left!.participantId &&
            match.participantBId === right!.participantId) ||
            (match.participantAId === right!.participantId &&
              match.participantBId === left!.participantId)),
      );
      if (direct?.result && !direct.result.isDraw) {
        const winner = cohort.find(
          (row) => row.participantId === direct.result!.winnerId,
        )!;
        const loser = cohort.find(
          (row) => row.participantId !== direct.result!.winnerId,
        )!;
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
        groups.forEach((group) => {
          if (group.length === 1)
            orderedGroups.push({ rows: group, decidedBy: metric.name });
          else refine(group, metricIndex + 1);
        });
        return;
      }
      refine(cohort, metricIndex + 1);
      return;
    }

    const resolution = resolutionFor(
      cohort.map((row) => row.participantId),
      tieResolutions,
      fingerprint,
    );
    if (resolution) {
      resolution.orderedParticipantIds.forEach((participantId) => {
        orderedGroups.push({
          rows: [byId.get(participantId)!],
          decidedBy: "organizer-decision",
        });
      });
    } else {
      orderedGroups.push({ rows: cohort, decidedBy: "unresolved" });
    }
  };

  tableGroups.forEach((group) => refine(group, 0));
  const ranked: StandingRow[] = [];
  const unresolvedTieGroups: string[][] = [];
  let position = 1;
  orderedGroups.forEach((group) => {
    const tied = group.rows.length > 1;
    if (tied) {
      unresolvedTieGroups.push(group.rows.map((row) => row.participantId));
    }
    group.rows.forEach((row) => {
      ranked.push({
        ...row,
        rank: position,
        tied,
        decidedBy: group.decidedBy,
      });
    });
    position += group.rows.length;
  });

  return {
    rows: ranked,
    unresolvedTieGroups,
    resultFingerprint: fingerprint,
    roundRobinComplete:
      roundRobinMatches.length > 0 &&
      roundRobinMatches.every(
        (match) => match.status === "completed" && match.result !== null,
      ),
  };
}

export function qualificationBlockingTies(
  standings: StandingResult,
  qualificationCount: number,
) {
  return standings.unresolvedTieGroups.filter((participantIds) => {
    const ranks = participantIds.map(
      (id) => standings.rows.find((row) => row.participantId === id)!.rank,
    );
    return Math.min(...ranks) <= qualificationCount;
  });
}

export function createTieResolution(
  participantIds: string[],
  orderedParticipantIds: string[],
  resultFingerprint: string,
  resolvedByUid: string,
  resolvedAt: number,
  reason = "",
): TieResolution {
  const expected = [...participantIds].sort().join("|");
  const actual = [...orderedParticipantIds].sort().join("|");
  if (
    participantIds.length < 2 ||
    expected !== actual ||
    new Set(orderedParticipantIds).size !== participantIds.length
  ) {
    throw new Error(
      "The tie resolution must order every tied participant once.",
    );
  }
  return {
    id: `tie-${hashString(`${expected}:${resultFingerprint}`)}`,
    participantIds: [...participantIds],
    orderedParticipantIds: [...orderedParticipantIds],
    reason: reason.trim().slice(0, 160),
    resultFingerprint,
    resolvedAt,
    resolvedByUid,
    schemaVersion: 1,
  };
}
