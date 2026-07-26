import type { CompetitionMatch, KnockoutRound, KnockoutRuntime } from "./types";

export function nextPowerOfTwo(value: number) {
  if (!Number.isInteger(value) || value < 2) {
    throw new Error("At least two qualifiers are required.");
  }
  let result = 2;
  while (result < value) result *= 2;
  return result;
}

export function seededPositions(bracketSize: number) {
  if (
    !Number.isInteger(bracketSize) ||
    bracketSize < 2 ||
    (bracketSize & (bracketSize - 1)) !== 0
  ) {
    throw new Error("Bracket size must be a power of two.");
  }
  let positions = [1, 2];
  while (positions.length < bracketSize) {
    const size = positions.length * 2;
    positions = positions.flatMap((seed) => [seed, size + 1 - seed]);
  }
  return positions;
}

function roundLabel(roundNumber: number, roundCount: number) {
  if (roundNumber === roundCount) return "Final";
  if (roundNumber === roundCount - 1) return "Semifinals";
  if (roundNumber === roundCount - 2) return "Quarterfinals";
  return `Knockout round ${roundNumber}`;
}

function winnerOf(match: CompetitionMatch) {
  if (match.result) return match.result.winnerId;
  if (match.isBye) return match.participantAId ?? match.participantBId;
  return null;
}

function loserOf(match: CompetitionMatch) {
  if (!match.result) return null;
  return match.result.winnerId === match.participantAId
    ? match.participantBId
    : match.participantAId;
}

export function resolveMatchSource(
  source: CompetitionMatch["sourceA"],
  matches: Record<string, CompetitionMatch>,
) {
  if (!source) return null;
  const match = matches[source.matchId];
  if (!match) return null;
  return source.outcome === "winner" ? winnerOf(match) : loserOf(match);
}

export function refreshKnockoutParticipants(
  matches: Record<string, CompetitionMatch>,
  previousMatches?: Record<string, CompetitionMatch>,
) {
  const next = structuredClone(matches);
  Object.values(next)
    .filter((match) => match.stage !== "round-robin")
    .sort(
      (a, b) =>
        (a.bracketRound ?? Number.MAX_SAFE_INTEGER) -
          (b.bracketRound ?? Number.MAX_SAFE_INTEGER) ||
        a.globalSequence - b.globalSequence,
    )
    .forEach((match) => {
      if (match.sourceA) {
        match.participantAId = resolveMatchSource(match.sourceA, next);
      }
      if (match.sourceB) {
        match.participantBId = resolveMatchSource(match.sourceB, next);
      }
      if (match.status !== "completed") {
        match.status =
          match.participantAId && match.participantBId ? "ready" : "pending";
      }
      const previous = previousMatches?.[match.id];
      if (
        previous &&
        (match.participantAId !== previous.participantAId ||
          match.participantBId !== previous.participantBId ||
          match.status !== previous.status)
      ) {
        match.revision = previous.revision + 1;
      }
    });
  return next;
}

export function generateKnockout(
  competitionId: string,
  seedOrder: string[],
  includeThirdPlace: boolean,
  sourceResultFingerprint: string,
  generatedByUid: string,
  generatedAt: number,
  startingGlobalSequence: number,
) {
  if (seedOrder.length < 2 || new Set(seedOrder).size !== seedOrder.length) {
    throw new Error("Knockout seeds must contain unique qualifiers.");
  }
  const bracketSize = nextPowerOfTwo(seedOrder.length);
  const positions = seededPositions(bracketSize);
  const slotParticipants = positions.map((seed) => seedOrder[seed - 1] ?? null);
  const roundCount = Math.log2(bracketSize);
  const rounds: KnockoutRound[] = [];
  const matches: Record<string, CompetitionMatch> = {};
  let globalSequence = startingGlobalSequence;

  for (let roundNumber = 1; roundNumber <= roundCount; roundNumber += 1) {
    const matchCount = bracketSize / 2 ** roundNumber;
    const matchIds: string[] = [];
    for (let slot = 1; slot <= matchCount; slot += 1) {
      const id = `ko-r${roundNumber}-m${slot}`;
      const previousA = `ko-r${roundNumber - 1}-m${slot * 2 - 1}`;
      const previousB = `ko-r${roundNumber - 1}-m${slot * 2}`;
      const participantAId =
        roundNumber === 1 ? slotParticipants[(slot - 1) * 2]! : null;
      const participantBId =
        roundNumber === 1 ? slotParticipants[(slot - 1) * 2 + 1]! : null;
      const seedA = roundNumber === 1 ? positions[(slot - 1) * 2] : undefined;
      const seedB =
        roundNumber === 1 ? positions[(slot - 1) * 2 + 1] : undefined;
      const isBye =
        roundNumber === 1 &&
        Boolean(participantAId || participantBId) &&
        !(participantAId && participantBId);
      matches[id] = {
        id,
        competitionId,
        stage: "knockout",
        fixtureRound: null,
        sequenceInRound: slot,
        bracketRound: roundNumber,
        bracketSlot: slot,
        globalSequence,
        participantAId,
        participantBId,
        ...(roundNumber === 1
          ? { seedA, seedB }
          : {
              sourceA: { matchId: previousA, outcome: "winner" },
              sourceB: { matchId: previousB, outcome: "winner" },
            }),
        isBye,
        status: isBye
          ? "completed"
          : participantAId && participantBId
            ? "ready"
            : "pending",
        result: null,
        revision: 1,
        schemaVersion: 1,
      };
      matchIds.push(id);
      globalSequence += 1;
    }
    rounds.push({
      number: roundNumber,
      label: roundLabel(roundNumber, roundCount),
      matchIds,
    });
  }

  let refreshed = refreshKnockoutParticipants(matches);
  let thirdPlaceMatchId: string | null = null;
  if (includeThirdPlace) {
    if (roundCount < 2) {
      throw new Error(
        "A third-place match requires at least four bracket slots.",
      );
    }
    const semifinalRound = rounds[rounds.length - 2]!;
    thirdPlaceMatchId = "ko-third-place";
    refreshed[thirdPlaceMatchId] = {
      id: thirdPlaceMatchId,
      competitionId,
      stage: "third-place",
      fixtureRound: null,
      sequenceInRound: 1,
      bracketRound: roundCount,
      bracketSlot: 2,
      globalSequence,
      participantAId: null,
      participantBId: null,
      sourceA: { matchId: semifinalRound.matchIds[0]!, outcome: "loser" },
      sourceB: { matchId: semifinalRound.matchIds[1]!, outcome: "loser" },
      isBye: false,
      status: "pending",
      result: null,
      revision: 1,
      schemaVersion: 1,
    };
    refreshed = refreshKnockoutParticipants(refreshed);
  }

  const knockout: KnockoutRuntime = {
    qualificationParticipantIds: [...seedOrder],
    seedOrder: [...seedOrder],
    bracketSize,
    rounds,
    thirdPlaceMatchId,
    sourceResultFingerprint,
    generatedAt,
    generatedByUid,
    generationVersion: 1,
  };
  return { knockout, matches: refreshed };
}

export function descendantMatchIds(
  matches: Record<string, CompetitionMatch>,
  sourceMatchId: string,
) {
  const descendants = new Set<string>();
  let changed = true;
  while (changed) {
    changed = false;
    Object.values(matches).forEach((match) => {
      if (descendants.has(match.id)) return;
      const sourceIds = [match.sourceA?.matchId, match.sourceB?.matchId].filter(
        Boolean,
      ) as string[];
      if (
        sourceIds.includes(sourceMatchId) ||
        sourceIds.some((id) => descendants.has(id))
      ) {
        descendants.add(match.id);
        changed = true;
      }
    });
  }
  return [...descendants];
}
