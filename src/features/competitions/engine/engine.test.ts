import { describe, expect, it, vi } from "vitest";
import { bestOf, createCompetitionFormValues, firstTo } from "../domain/config";
import { createDraftRecord, publishDraftRecord } from "../domain/transforms";
import type { PublishedCompetition } from "../domain/types";
import { createCompetitionRun, reviewActivation } from "./activation";
import {
  countConsecutiveAppearances,
  generateRoundRobinFixtures,
  secureRandomInteger,
  shuffleParticipantIds,
} from "./generation";
import {
  canCompleteCompetition,
  completeCompetitionRun,
  generateRunKnockout,
  MatchDependencyConflictError,
  MatchRevisionConflictError,
  recordMatchResult,
  reopenCompetitionRun,
  resolveRunTie,
  setMatchInProgress,
} from "./lifecycle";
import { generateKnockout, nextPowerOfTwo, seededPositions } from "./knockout";
import { deriveCompetitionPointBreakdown } from "./points";
import {
  appendRoundWinner,
  createMatchResult,
  deriveSeriesProgress,
  undoLastRound,
  validateMatchResult,
} from "./series";
import {
  createResultFingerprint,
  deriveStandings,
  qualificationBlockingTies,
} from "./standings";
import { parseCompetitionRun } from "./runtime";
import type { CompetitionRun, RandomIntegerSource } from "./types";

const ids = (count: number) =>
  Array.from({ length: count }, (_, index) => `player-${index + 1}`);

function scheduledCompetition(count = 6): PublishedCompetition {
  const values = createCompetitionFormValues();
  values.title = "Castle Cup";
  values.gameName = "Controller Duel";
  values.participantIds = ids(count);
  values.formatConfig = {
    kind: "round-robin-knockout",
    series: bestOf(3),
    allowDraws: false,
    qualificationCount: Math.min(4, count % 2 === 0 ? count : count - 1),
    includeThirdPlace: count >= 4,
  };
  const draft = createDraftRecord(values, {
    id: "castle-cup",
    uid: "admin",
    now: 10,
  });
  return publishDraftRecord(draft, "admin", 20, 100);
}

const zeroRandom: RandomIntegerSource = () => 0;

function runWithParticipants(count = 6) {
  return createCompetitionRun(
    scheduledCompetition(count),
    "admin",
    100,
    zeroRandom,
  );
}

function completeMatch(
  run: CompetitionRun,
  matchId: string,
  score: "2-0" | "2-1" = "2-0",
  now = 200,
) {
  const match = run.matches[matchId]!;
  const roundWinnerIds =
    score === "2-0"
      ? [match.participantAId!, match.participantAId!]
      : [match.participantAId!, match.participantBId!, match.participantAId!];
  return recordMatchResult(run, matchId, {
    expectedMatchRevision: match.revision,
    roundWinnerIds,
    organizerUid: "admin",
    now,
  });
}

function completeRoundRobin(run: CompetitionRun) {
  let next = run;
  Object.values(run.matches)
    .filter((match) => match.stage === "round-robin")
    .sort((a, b) => a.globalSequence - b.globalSequence)
    .forEach((match, index) => {
      next = completeMatch(
        next,
        match.id,
        index % 2 === 0 ? "2-1" : "2-0",
        300 + index,
      );
    });
  return next;
}

describe("secure participant draw", () => {
  it("uses deterministic injected randomness without losing or duplicating IDs", () => {
    expect(shuffleParticipantIds(["a", "b", "c", "d"], zeroRandom)).toEqual([
      "b",
      "c",
      "d",
      "a",
    ]);
    expect(new Set(shuffleParticipantIds(ids(16), zeroRandom))).toEqual(
      new Set(ids(16)),
    );
  });

  it("uses Web Crypto rather than Math.random in production", () => {
    const mathRandom = vi.spyOn(Math, "random").mockImplementation(() => {
      throw new Error("Math.random must not be called");
    });
    expect(secureRandomInteger(7)).toBeGreaterThanOrEqual(0);
    expect(secureRandomInteger(7)).toBeLessThan(7);
    expect(mathRandom).not.toHaveBeenCalled();
    mathRandom.mockRestore();
  });

  it("rejects duplicate IDs and invalid random sources", () => {
    expect(() => shuffleParticipantIds(["a", "a"], zeroRandom)).toThrow(
      /unique/,
    );
    expect(() => shuffleParticipantIds(["a", "b"], () => 2)).toThrow(
      /out-of-range/,
    );
  });
});

describe("round-robin fixture generation", () => {
  it.each([2, 3, 4, 5, 6, 7, 8, 10, 16])(
    "generates the complete invariant set for %i players",
    (count) => {
      const participants = ids(count);
      const generated = generateRoundRobinFixtures("cup", participants);
      expect(generated.matches).toHaveLength((count * (count - 1)) / 2);
      expect(generated.rounds).toHaveLength(
        count % 2 === 0 ? count - 1 : count,
      );
      const pairs = generated.matches.map((match) =>
        [match.participantAId, match.participantBId].sort().join(":"),
      );
      expect(new Set(pairs).size).toBe(pairs.length);
      generated.matches.forEach((match) => {
        expect(match.participantAId).not.toBe(match.participantBId);
        expect(participants).toContain(match.participantAId);
        expect(participants).toContain(match.participantBId);
      });
      generated.rounds.forEach((round) => {
        const appearances = round.matchIds.flatMap((id) => [
          generated.matches.find((match) => match.id === id)!.participantAId,
          generated.matches.find((match) => match.id === id)!.participantBId,
        ]);
        expect(new Set(appearances).size).toBe(appearances.length);
      });
      const byes = generated.rounds
        .map((round) => round.byeParticipantId)
        .filter(Boolean);
      expect(byes).toHaveLength(count % 2 === 1 ? count : 0);
      expect(new Set(byes).size).toBe(byes.length);
    },
  );

  it("is deterministic and keeps the recommended order stable", () => {
    const first = generateRoundRobinFixtures("cup", ids(6));
    const second = generateRoundRobinFixtures("cup", ids(6));
    expect(second).toEqual(first);
    expect(first.matches.map((match) => match.globalSequence)).toEqual(
      Array.from({ length: 15 }, (_, index) => index + 1),
    );
    expect(countConsecutiveAppearances(first.matches)).toBeLessThan(5);
  });
});

describe("series result model", () => {
  const match = {
    participantAId: "a",
    participantBId: "b",
  };

  it.each([
    [{ kind: "single", winsRequired: 1, maximumRounds: 1 } as const, ["a"]],
    [bestOf(3), ["a", "a"]],
    [bestOf(3), ["a", "b", "a"]],
    [bestOf(5), ["a", "a", "a"]],
    [bestOf(5), ["a", "b", "a", "b", "a"]],
    [bestOf(7), ["a", "b", "a", "b", "a", "b", "a"]],
    [firstTo(4), ["a", "b", "a", "a", "b", "a"]],
  ])("accepts a valid terminal sequence", (series, winners) => {
    expect(deriveSeriesProgress(match, series, winners).complete).toBe(true);
  });

  it("supports append and undo while rejecting extra or foreign rounds", () => {
    expect(appendRoundWinner(match, bestOf(3), ["a"], "b")).toEqual(["a", "b"]);
    expect(undoLastRound(["a", "b"])).toEqual(["a"]);
    expect(() =>
      deriveSeriesProgress(match, bestOf(3), ["a", "a", "b"]),
    ).toThrow(/after the series/);
    expect(() => deriveSeriesProgress(match, bestOf(3), ["other"])).toThrow(
      /participant/,
    );
  });

  it("derives totals from the sequence and rejects contradictory results", () => {
    const result = createMatchResult(
      match,
      bestOf(3),
      ["a", "b", "a"],
      "admin",
      1,
      1,
    );
    expect(result).toEqual(
      expect.objectContaining({
        participantAWins: 2,
        participantBWins: 1,
        winnerId: "a",
      }),
    );
    expect(validateMatchResult(match, bestOf(3), result)).toBe(true);
    expect(
      validateMatchResult(match, bestOf(3), { ...result, participantAWins: 3 }),
    ).toBe(false);
    expect(() =>
      createMatchResult(match, bestOf(3), ["a"], "admin", 1, 1),
    ).toThrow(/Complete the series/);
  });
});

describe("standings and ties", () => {
  it("ranks by table points, two-way head-to-head, and published metrics", () => {
    const run = completeRoundRobin(runWithParticipants(4));
    const standings = deriveStandings(
      run.participantIds,
      Object.values(run.matches),
      run.configSnapshot.tableScoring,
    );
    expect(standings.roundRobinComplete).toBe(true);
    expect(standings.rows).toHaveLength(4);
    expect(standings.rows[0]!.played).toBe(3);
    expect(standings.rows[0]!.remainingMatches).toBe(0);
    expect(standings.rows.map((row) => row.tablePoints)).toEqual(
      [...standings.rows.map((row) => row.tablePoints)].sort((a, b) => b - a),
    );
  });

  it("keeps a circular multi-player tie unresolved and blocks seeding", () => {
    const run = runWithParticipants(3);
    const matches = Object.values(run.matches).sort(
      (a, b) => a.globalSequence - b.globalSequence,
    );
    const winnerByMatch = [
      matches[0]!.participantAId!,
      matches[1]!.participantAId!,
      matches[2]!.participantAId!,
    ];
    let next = run;
    matches.forEach((match, index) => {
      const latest = next.matches[match.id]!;
      const winner = winnerByMatch[index]!;
      next = recordMatchResult(next, match.id, {
        expectedMatchRevision: latest.revision,
        roundWinnerIds: [winner, winner],
        organizerUid: "admin",
        now: 10 + index,
      });
    });
    const standings = deriveStandings(
      next.participantIds,
      Object.values(next.matches),
      next.configSnapshot.tableScoring,
    );
    if (standings.unresolvedTieGroups.length > 0) {
      expect(qualificationBlockingTies(standings, 2).length).toBeGreaterThan(0);
      expect(standings.rows.filter((row) => row.tied).length).toBeGreaterThan(
        1,
      );
    }
  });

  it("persists a valid manual order and invalidates it after a result correction", () => {
    let run = runWithParticipants(3);
    const cycleWinners: Record<string, string> = {
      "player-1:player-2": "player-1",
      "player-1:player-3": "player-3",
      "player-2:player-3": "player-2",
    };
    Object.values(run.matches).forEach((match, index) => {
      const pair = [match.participantAId!, match.participantBId!]
        .sort()
        .join(":");
      const winnerId = cycleWinners[pair]!;
      run = recordMatchResult(run, match.id, {
        expectedMatchRevision: run.matches[match.id]!.revision,
        roundWinnerIds: [winnerId, winnerId],
        organizerUid: "admin",
        now: 20 + index,
      });
    });
    const tied = deriveStandings(
      run.participantIds,
      Object.values(run.matches),
      run.configSnapshot.tableScoring,
    );
    expect(tied.unresolvedTieGroups).toHaveLength(1);
    const group = tied.unresolvedTieGroups[0]!;
    run = resolveRunTie(
      run,
      group,
      [...group].reverse(),
      "admin",
      30,
      "Table decision",
    );
    expect(Object.values(run.tieResolutions)).toEqual([
      expect.objectContaining({
        orderedParticipantIds: [...group].reverse(),
        resultFingerprint: tied.resultFingerprint,
      }),
    ]);

    const correctedMatch = Object.values(run.matches)[0]!;
    const correctedWinner =
      correctedMatch.result!.winnerId === correctedMatch.participantAId
        ? correctedMatch.participantBId!
        : correctedMatch.participantAId!;
    run = recordMatchResult(run, correctedMatch.id, {
      expectedMatchRevision: correctedMatch.revision,
      roundWinnerIds: [correctedWinner, correctedWinner],
      organizerUid: "admin",
      now: 31,
    });
    expect(run.tieResolutions).toEqual({});
  });

  it("blocks tie decisions until every round-robin result exists", () => {
    const run = runWithParticipants(2);
    expect(createResultFingerprint(Object.values(run.matches))).toMatch(/^rr-/);
    expect(() =>
      resolveRunTie(
        run,
        run.participantIds,
        [...run.participantIds].reverse(),
        "admin",
        20,
      ),
    ).toThrow(/Complete every round-robin match/i);
  });
});

describe("seeded knockout", () => {
  it.each([
    [2, 2],
    [4, 4],
    [6, 8],
    [8, 8],
  ])("builds a deterministic bracket for %i qualifiers", (qualifiers, size) => {
    const seedOrder = ids(qualifiers);
    const generated = generateKnockout(
      "cup",
      seedOrder,
      qualifiers >= 4,
      "fingerprint",
      "admin",
      10,
      100,
    );
    expect(generated.knockout.bracketSize).toBe(size);
    expect(generated.knockout.seedOrder).toEqual(seedOrder);
    const final =
      generated.matches[generated.knockout.rounds.at(-1)!.matchIds[0]!]!;
    if (qualifiers === 2) {
      expect([final.participantAId, final.participantBId]).toEqual(seedOrder);
    } else {
      expect(final.sourceA).toBeDefined();
    }
    if (qualifiers === 6) {
      const byes = Object.values(generated.matches).filter(
        (match) => match.isBye,
      );
      expect(byes).toHaveLength(2);
      expect(
        byes.map((match) => match.participantAId ?? match.participantBId),
      ).toEqual(expect.arrayContaining(["player-1", "player-2"]));
    }
    if (qualifiers === 2) {
      const realtimeDatabaseShape = JSON.parse(
        JSON.stringify(generated, (_key, value) =>
          value === null ? undefined : value,
        ),
      );
      expect(realtimeDatabaseShape.knockout.thirdPlaceMatchId).toBeUndefined();
    }
  });

  it("separates top seeds and uses standard deterministic positions", () => {
    expect(nextPowerOfTwo(6)).toBe(8);
    expect(seededPositions(4)).toEqual([1, 4, 2, 3]);
    expect(seededPositions(8)).toEqual([1, 8, 4, 5, 2, 7, 3, 6]);
  });
});

describe("competition lifecycle and points", () => {
  it("reviews and freezes activation data, including odd-player byes", () => {
    const competition = scheduledCompetition(5);
    const participants = competition.participantIds.map((id) => ({
      id,
      displayName: id,
      status: "active" as const,
    }));
    expect(reviewActivation(competition, participants, false)).toEqual(
      expect.objectContaining({
        canActivate: true,
        participantCount: 5,
        expectedMatchCount: 10,
        expectedFixtureRounds: 5,
      }),
    );
    const run = createCompetitionRun(competition, "admin", 100, zeroRandom);
    expect(run.randomizedParticipantIds).not.toEqual(run.participantIds);
    expect(
      run.roundRobin.rounds.filter((round) => round.byeParticipantId),
    ).toHaveLength(5);
    expect(parseCompetitionRun(run)).toEqual(run);
    expect(parseCompetitionRun(JSON.parse(JSON.stringify(run)))).toEqual(run);
    expect(
      parseCompetitionRun({ ...run, randomizedParticipantIds: ids(5) }),
    ).toBeNull();
    expect(
      parseCompetitionRun({ ...run, privilegedOverride: true }),
    ).toBeNull();

    const missingRoundRobinParticipant = structuredClone(run);
    const firstMatch = Object.values(missingRoundRobinParticipant.matches)[0]!;
    firstMatch.participantAId = null;
    expect(parseCompetitionRun(missingRoundRobinParticipant)).toBeNull();

    const duplicateRoundReference = structuredClone(run);
    duplicateRoundReference.roundRobin.rounds[0]!.matchIds[1] =
      duplicateRoundReference.roundRobin.rounds[0]!.matchIds[0]!;
    expect(parseCompetitionRun(duplicateRoundReference)).toBeNull();
  });

  it("blocks activation for other engines, draws, inactive people, and existing runtime", () => {
    const competition = scheduledCompetition(4);
    if (competition.formatConfig.kind !== "round-robin-knockout") {
      throw new Error("Expected Merry-Go-Round configuration.");
    }
    competition.formatConfig = {
      ...competition.formatConfig,
      allowDraws: true,
    };
    const review = reviewActivation(
      competition,
      competition.participantIds.map((id, index) => ({
        id,
        displayName: id,
        status: index === 0 ? "inactive" : "active",
      })),
      true,
    );
    expect(review.canActivate).toBe(false);
    expect(review.errors.join(" ")).toMatch(/Draws|inactive|already exists/);
  });

  it("starts exactly one match and detects stale revisions", () => {
    const run = runWithParticipants(4);
    const [first, second] = Object.values(run.matches);
    const started = setMatchInProgress(run, first!.id, first!.revision, 200);
    const switched = setMatchInProgress(
      started,
      second!.id,
      started.matches[second!.id]!.revision,
      201,
    );
    expect(switched.currentMatchId).toBe(second!.id);
    expect(switched.matches[first!.id]!.status).toBe("pending");
    expect(() => setMatchInProgress(switched, second!.id, 1, 202)).toThrow(
      MatchRevisionConflictError,
    );
  });

  it("awards losing-round points and recalculates after correction", () => {
    const run = runWithParticipants(2);
    const match = Object.values(run.matches)[0]!;
    const completed = completeMatch(run, match.id, "2-1");
    const loserId = completed.matches[match.id]!.participantBId!;
    const firstBreakdown = deriveCompetitionPointBreakdown(completed);
    expect(
      firstBreakdown.find((entry) => entry.participantId === loserId)!.total,
    ).toBe(1);
    const corrected = recordMatchResult(completed, match.id, {
      expectedMatchRevision: completed.matches[match.id]!.revision,
      roundWinnerIds: [match.participantAId!, match.participantAId!],
      organizerUid: "admin",
      now: 300,
    });
    expect(
      deriveCompetitionPointBreakdown(corrected).find(
        (entry) => entry.participantId === loserId,
      )!.total,
    ).toBe(0);
  });

  it("generates knockout only after qualification review and completes/reopens", () => {
    let run = completeRoundRobin(runWithParticipants(4));
    const standings = deriveStandings(
      run.participantIds,
      Object.values(run.matches),
      run.configSnapshot.tableScoring,
      Object.values(run.tieResolutions),
    );
    standings.unresolvedTieGroups.forEach((group, index) => {
      run = resolveRunTie(run, group, group, "admin", 500 + index, "Reviewed");
    });
    run = generateRunKnockout(run, "admin", 600);
    expect(run.stage).toBe("knockout");
    const realtimeDatabaseShape = JSON.parse(
      JSON.stringify(run, (_key, value) =>
        value === null ? undefined : value,
      ),
    );
    expect(parseCompetitionRun(realtimeDatabaseShape)).not.toBeNull();
    const playable = () =>
      Object.values(run.matches)
        .filter(
          (match) =>
            match.stage !== "round-robin" &&
            !match.isBye &&
            match.status === "ready",
        )
        .sort((a, b) => a.globalSequence - b.globalSequence);
    while (playable().length > 0) {
      const match = playable()[0]!;
      run = completeMatch(run, match.id, "2-0", 700 + run.revision);
    }
    expect(canCompleteCompetition(run)).toBe(true);
    const completed = completeCompetitionRun(run, "admin", 900);
    expect(completed.stage).toBe("completed");
    expect(completed.placements?.entries[0]?.place).toBe(1);
    expect(reopenCompetitionRun(completed, 901)).toEqual(
      expect.objectContaining({ stage: "knockout", placements: null }),
    );
  });

  it("normalizes omitted optional fields in a two-player Firebase bracket", () => {
    const run = generateRunKnockout(
      completeRoundRobin(runWithParticipants(2)),
      "admin",
      600,
    );
    const realtimeDatabaseShape = JSON.parse(
      JSON.stringify(run, (_key, value) =>
        value === null ? undefined : value,
      ),
    );

    expect(realtimeDatabaseShape.knockout.thirdPlaceMatchId).toBeUndefined();
    expect(parseCompetitionRun(realtimeDatabaseShape)).not.toBeNull();
  });

  it("advances winners and semifinal losers, requires third place, and cascades corrections", () => {
    let run = completeRoundRobin(runWithParticipants(4));
    const standings = deriveStandings(
      run.participantIds,
      Object.values(run.matches),
      run.configSnapshot.tableScoring,
    );
    standings.unresolvedTieGroups.forEach((group, index) => {
      run = resolveRunTie(run, group, group, "admin", 500 + index);
    });
    run = generateRunKnockout(run, "admin", 600);
    const semifinals = Object.values(run.matches)
      .filter(
        (match) =>
          match.stage === "knockout" &&
          match.bracketRound === 1 &&
          !match.isBye,
      )
      .sort((left, right) => left.globalSequence - right.globalSequence);
    run = completeMatch(run, semifinals[0]!.id, "2-0", 700);
    run = completeMatch(run, semifinals[1]!.id, "2-1", 701);
    const finalId = run.knockout!.rounds.at(-1)!.matchIds[0]!;
    const thirdPlaceId = run.knockout!.thirdPlaceMatchId!;
    expect(run.matches[finalId]).toEqual(
      expect.objectContaining({ status: "ready" }),
    );
    expect(run.matches[thirdPlaceId]).toEqual(
      expect.objectContaining({ status: "ready" }),
    );

    run = completeMatch(run, finalId, "2-0", 702);
    expect(canCompleteCompetition(run)).toBe(false);
    run = completeMatch(run, thirdPlaceId, "2-1", 703);
    expect(canCompleteCompetition(run)).toBe(true);
    const completed = completeCompetitionRun(run, "admin", 704);
    expect(completed.placements?.entries.map((entry) => entry.place)).toEqual(
      expect.arrayContaining([1, 2, 3, 4]),
    );
    const pointTotals = deriveCompetitionPointBreakdown(completed);
    expect(
      pointTotals.every(
        (entry) =>
          entry.total ===
          entry.items.reduce((total, item) => total + item.points, 0),
      ),
    ).toBe(true);

    const reopened = reopenCompetitionRun(completed, 705);
    const semifinal = reopened.matches[semifinals[0]!.id]!;
    const changedWinner =
      semifinal.result!.winnerId === semifinal.participantAId
        ? semifinal.participantBId!
        : semifinal.participantAId!;
    expect(() =>
      recordMatchResult(reopened, semifinal.id, {
        expectedMatchRevision: semifinal.revision,
        roundWinnerIds: [changedWinner, changedWinner],
        organizerUid: "admin",
        now: 706,
      }),
    ).toThrow(MatchDependencyConflictError);
    const cascaded = recordMatchResult(reopened, semifinal.id, {
      expectedMatchRevision: semifinal.revision,
      roundWinnerIds: [changedWinner, changedWinner],
      organizerUid: "admin",
      now: 706,
      cascade: true,
    });
    expect(cascaded.matches[finalId]!.result).toBeNull();
    expect(cascaded.matches[thirdPlaceId]!.result).toBeNull();
    expect(cascaded.matches[semifinals[1]!.id]!.result).not.toBeNull();
  });

  it("requires knockout reset for a corrected round robin and cascade for dependent knockout results", () => {
    let run = completeRoundRobin(runWithParticipants(4));
    const standings = deriveStandings(
      run.participantIds,
      Object.values(run.matches),
      run.configSnapshot.tableScoring,
    );
    standings.unresolvedTieGroups.forEach((group, index) => {
      run = resolveRunTie(run, group, group, "admin", 500 + index);
    });
    run = generateRunKnockout(run, "admin", 600);
    const roundRobin = Object.values(run.matches).find(
      (match) => match.stage === "round-robin",
    )!;
    expect(() =>
      recordMatchResult(run, roundRobin.id, {
        expectedMatchRevision: roundRobin.revision,
        roundWinnerIds: [
          roundRobin.participantBId!,
          roundRobin.participantBId!,
        ],
        organizerUid: "admin",
        now: 700,
      }),
    ).toThrow(MatchDependencyConflictError);
    const reset = recordMatchResult(run, roundRobin.id, {
      expectedMatchRevision: roundRobin.revision,
      roundWinnerIds: [roundRobin.participantBId!, roundRobin.participantBId!],
      organizerUid: "admin",
      now: 701,
      resetKnockout: true,
    });
    expect(reset.knockout).toBeNull();
    expect(
      Object.values(reset.matches).every(
        (match) => match.stage === "round-robin",
      ),
    ).toBe(true);
  });
});
