import type {
  CompetitionMatch,
  FixtureGeneration,
  RandomIntegerSource,
  RoundRobinRound,
} from "./types";

const bye = Symbol("round-robin-bye");
type Slot = string | typeof bye;

export function secureRandomInteger(maximumExclusive: number) {
  if (!Number.isSafeInteger(maximumExclusive) || maximumExclusive <= 0) {
    throw new Error("The random range must be a positive safe integer.");
  }
  const range = 0x1_0000_0000;
  const limit = range - (range % maximumExclusive);
  const sample = new Uint32Array(1);
  let value: number;
  do {
    crypto.getRandomValues(sample);
    value = sample[0]!;
  } while (value >= limit);
  return value % maximumExclusive;
}

export function shuffleParticipantIds(
  participantIds: string[],
  randomInteger: RandomIntegerSource = secureRandomInteger,
) {
  if (new Set(participantIds).size !== participantIds.length) {
    throw new Error("Participant IDs must be unique before the draw.");
  }
  const shuffled = [...participantIds];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = randomInteger(index + 1);
    if (!Number.isInteger(swapIndex) || swapIndex < 0 || swapIndex > index) {
      throw new Error("The random source returned an out-of-range value.");
    }
    [shuffled[index], shuffled[swapIndex]] = [
      shuffled[swapIndex]!,
      shuffled[index]!,
    ];
  }
  return shuffled;
}

interface Pairing {
  participantAId: string;
  participantBId: string;
  originalIndex: number;
}

function orderRound(
  pairings: Pairing[],
  lastPlayed: Map<string, number>,
  previousParticipants: Set<string>,
  globalSequence: number,
) {
  const remaining = [...pairings];
  const output: Pairing[] = [];
  let previous = new Set(previousParticipants);

  while (remaining.length > 0) {
    remaining.sort((left, right) => {
      const leftConsecutive =
        Number(previous.has(left.participantAId)) +
        Number(previous.has(left.participantBId));
      const rightConsecutive =
        Number(previous.has(right.participantAId)) +
        Number(previous.has(right.participantBId));
      if (leftConsecutive !== rightConsecutive) {
        return leftConsecutive - rightConsecutive;
      }
      const leftRest = Math.min(
        globalSequence - (lastPlayed.get(left.participantAId) ?? -1),
        globalSequence - (lastPlayed.get(left.participantBId) ?? -1),
      );
      const rightRest = Math.min(
        globalSequence - (lastPlayed.get(right.participantAId) ?? -1),
        globalSequence - (lastPlayed.get(right.participantBId) ?? -1),
      );
      return rightRest - leftRest || left.originalIndex - right.originalIndex;
    });
    const next = remaining.shift()!;
    output.push(next);
    previous = new Set([next.participantAId, next.participantBId]);
    lastPlayed.set(next.participantAId, globalSequence);
    lastPlayed.set(next.participantBId, globalSequence);
    globalSequence += 1;
  }
  return output;
}

export function generateRoundRobinFixtures(
  competitionId: string,
  randomizedParticipantIds: string[],
): FixtureGeneration {
  if (randomizedParticipantIds.length < 2) {
    throw new Error("At least two participants are required.");
  }
  if (
    new Set(randomizedParticipantIds).size !== randomizedParticipantIds.length
  ) {
    throw new Error("Participant IDs must be unique.");
  }

  const slots: Slot[] =
    randomizedParticipantIds.length % 2 === 1
      ? [...randomizedParticipantIds, bye]
      : [...randomizedParticipantIds];
  const anchor = slots[0]!;
  let rotating = slots.slice(1);
  const rawRounds: Array<{
    pairings: Pairing[];
    byeParticipantId: string | null;
  }> = [];

  for (let roundIndex = 0; roundIndex < slots.length - 1; roundIndex += 1) {
    const row = [anchor, ...rotating];
    const pairings: Pairing[] = [];
    let byeParticipantId: string | null = null;
    for (let index = 0; index < row.length / 2; index += 1) {
      const participantAId = row[index]!;
      const participantBId = row[row.length - 1 - index]!;
      if (participantAId === bye || participantBId === bye) {
        byeParticipantId =
          participantAId === bye
            ? (participantBId as string)
            : (participantAId as string);
      } else if (
        typeof participantAId === "string" &&
        typeof participantBId === "string"
      ) {
        pairings.push({
          participantAId,
          participantBId,
          originalIndex: index,
        });
      } else throw new Error("The fixture row contains an invalid slot.");
    }
    rawRounds.push({ pairings, byeParticipantId });
    rotating = [rotating.at(-1)!, ...rotating.slice(0, -1)];
  }

  const matches: CompetitionMatch[] = [];
  const rounds: RoundRobinRound[] = [];
  const lastPlayed = new Map<string, number>();
  let previousParticipants = new Set<string>();
  let globalSequence = 1;

  rawRounds.forEach((round, roundIndex) => {
    const ordered = orderRound(
      round.pairings,
      lastPlayed,
      previousParticipants,
      globalSequence,
    );
    const matchIds: string[] = [];
    ordered.forEach((pairing, sequenceIndex) => {
      const id = `rr-r${roundIndex + 1}-m${sequenceIndex + 1}`;
      matchIds.push(id);
      matches.push({
        id,
        competitionId,
        stage: "round-robin",
        fixtureRound: roundIndex + 1,
        sequenceInRound: sequenceIndex + 1,
        bracketRound: null,
        bracketSlot: null,
        globalSequence,
        participantAId: pairing.participantAId,
        participantBId: pairing.participantBId,
        isBye: false,
        status: "pending",
        result: null,
        revision: 1,
        schemaVersion: 1,
      });
      previousParticipants = new Set([
        pairing.participantAId,
        pairing.participantBId,
      ]);
      globalSequence += 1;
    });
    rounds.push({
      number: roundIndex + 1,
      matchIds,
      byeParticipantId: round.byeParticipantId,
    });
  });

  const canonicalPairs = new Set(
    matches.map((match) =>
      [match.participantAId!, match.participantBId!].sort().join(":"),
    ),
  );
  const expected =
    (randomizedParticipantIds.length * (randomizedParticipantIds.length - 1)) /
    2;
  if (matches.length !== expected || canonicalPairs.size !== expected) {
    throw new Error("Round-robin fixture generation failed its invariants.");
  }
  return { rounds, matches };
}

export function countConsecutiveAppearances(matches: CompetitionMatch[]) {
  let count = 0;
  for (let index = 1; index < matches.length; index += 1) {
    const previous = matches[index - 1]!;
    const current = matches[index]!;
    if (
      current.participantAId === previous.participantAId ||
      current.participantAId === previous.participantBId ||
      current.participantBId === previous.participantAId ||
      current.participantBId === previous.participantBId
    ) {
      count += 1;
    }
  }
  return count;
}
