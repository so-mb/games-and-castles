import { describe, expect, it } from "vitest";
import { bestOf, createCompetitionFormValues } from "../domain/config";
import { createDraftRecord, publishDraftRecord } from "../domain/transforms";
import type { PublishedCompetition } from "../domain/types";
import type { CompetitionMatch, RandomIntegerSource } from "../engine/types";
import {
  avoidSameGroupRematches,
  beginQualificationReview,
  completeGroupCompetition,
  generateGroupKnockout,
  GroupMatchDependencyConflictError,
  recordGroupMatchResult,
  resolveCrossGroupSeedTie,
  resolveGroupTie,
  reopenGroupCompetition,
} from "./engine";
import {
  assignBalancedGroups,
  createGroupDrawPreview,
  interleaveGroupFixtures,
  reviewGroupActivation,
} from "./generation";
import { deriveGroupPointBreakdown } from "./points";
import { parseGroupKnockoutRun } from "./runtime";
import {
  deriveCrossGroupSeeds,
  deriveGroupStandings,
  groupQualificationBlockingTies,
} from "./standings";
import type { GroupKnockoutRun } from "./types";

const ids = (count: number) =>
  Array.from({ length: count }, (_, index) => `player-${index + 1}`);

function competition(
  count = 8,
  options: {
    groupCountMode?: "automatic" | "manual";
    groupCount?: number;
    qualifiers?: number;
    legs?: 1 | 2;
    draws?: boolean;
    third?: boolean;
  } = {},
): PublishedCompetition {
  const values = createCompetitionFormValues("group-knockout");
  values.title = "Group Crown";
  values.gameName = "Castle Clash";
  values.participantIds = ids(count);
  values.formatConfig = {
    kind: "group-knockout",
    groupCountMode: options.groupCountMode ?? "automatic",
    groupCount: options.groupCount ?? 2,
    qualifiersPerGroup: options.qualifiers ?? 2,
    roundRobinLegs: options.legs ?? 1,
    series: bestOf(3),
    allowDraws: options.draws ?? false,
    includeThirdPlace: options.third ?? false,
  };
  const draft = createDraftRecord(values, {
    id: "group-crown",
    uid: "admin",
    now: 10,
  });
  return publishDraftRecord(draft, "admin", 20, 1);
}

const zeroRandom: RandomIntegerSource = () => 0;

function preview(count = 8, options = {}) {
  return createGroupDrawPreview(
    competition(count, options),
    "admin",
    100,
    zeroRandom,
  ).run;
}

function recordWinner(
  run: GroupKnockoutRun,
  matchId: string,
  winnerId: string,
  now: number,
) {
  const match = run.matches[matchId]!;
  return recordGroupMatchResult(run, matchId, {
    expectedMatchRevision: match.revision,
    roundWinnerIds: [winnerId, winnerId],
    organizerUid: "admin",
    now,
  });
}

function completeGroups(run: GroupKnockoutRun) {
  let next = run;
  Object.values(run.matches)
    .filter((match) => match.stage === "group-stage")
    .sort((left, right) => left.globalSequence - right.globalSequence)
    .forEach((match, index) => {
      const group = next.groups.find(
        (candidate) =>
          candidate.participantIds.includes(match.participantAId!) &&
          candidate.participantIds.includes(match.participantBId!),
      )!;
      const leftIndex = group.participantIds.indexOf(match.participantAId!);
      const rightIndex = group.participantIds.indexOf(match.participantBId!);
      next = recordWinner(
        next,
        match.id,
        leftIndex < rightIndex ? match.participantAId! : match.participantBId!,
        200 + index,
      );
    });
  return next;
}

function qualificationRun() {
  let run = completeGroups(preview());
  run = beginQualificationReview(run, "admin", 500);
  const initial = deriveCrossGroupSeeds(run.qualification!, []);
  initial.unresolvedTieGroups.forEach((tie, index) => {
    run = resolveCrossGroupSeedTie(
      run,
      tie.groupRank,
      tie.participantIds,
      tie.participantIds,
      "admin",
      510 + index,
      "Stable organizer order",
    );
  });
  return run;
}

describe("Group Format activation and draw", () => {
  it("applies the approved automatic group count from 4 through 16 players", () => {
    (
      [
        [4, 1],
        [5, 1],
        [6, 2],
        [8, 2],
        [9, 3],
        [12, 3],
        [13, 4],
        [16, 4],
      ] as const
    ).forEach(([participantCount, groupCount]) => {
      expect(
        reviewGroupActivation(competition(participantCount), false)
          .resolvedGroupCount,
      ).toBe(groupCount);
    });
  });

  it("blocks automatic activation outside 4–16 and accepts a valid manual policy", () => {
    expect(reviewGroupActivation(competition(17), false).canActivate).toBe(
      false,
    );
    expect(
      reviewGroupActivation(
        competition(17, { groupCountMode: "manual", groupCount: 4 }),
        false,
      ).canActivate,
    ).toBe(true);
  });

  it("blocks draw-enabled activation until a terminal draw rule exists", () => {
    expect(
      reviewGroupActivation(competition(8, { draws: true }), false).errors,
    ).toContain(
      "Draws cannot be activated until a terminal draw rule is configured.",
    );
  });

  it("uses deterministic Fisher–Yates injection and balanced round-robin assignment", () => {
    const run = preview(10, { groupCountMode: "manual", groupCount: 3 });
    expect(run.draw.shuffledParticipantIds).toEqual([
      "player-2",
      "player-3",
      "player-4",
      "player-5",
      "player-6",
      "player-7",
      "player-8",
      "player-9",
      "player-10",
      "player-1",
    ]);
    expect(run.groups.map((group) => group.participantIds.length)).toEqual([
      4, 3, 3,
    ]);
    expect(
      new Set(run.groups.flatMap((group) => group.participantIds)),
    ).toEqual(new Set(ids(10)));
  });

  it("rejects invalid assignment inputs", () => {
    expect(() => assignBalancedGroups(["a", "a", "b"], 2)).toThrow();
    expect(() => assignBalancedGroups(["a", "b"], 3)).toThrow();
  });

  it("generates each group pair once or twice with reversed second-leg sides", () => {
    const single = preview(8);
    const double = preview(8, { legs: 2 });
    expect(Object.keys(single.matches)).toHaveLength(12);
    expect(Object.keys(double.matches)).toHaveLength(24);
    const first = Object.values(double.matches).find(
      (match) => match.stage === "group-stage" && match.leg === 1,
    )!;
    const reverse = Object.values(double.matches).find(
      (match) =>
        match.stage === "group-stage" &&
        match.leg === 2 &&
        match.participantAId === first.participantBId &&
        match.participantBId === first.participantAId,
    );
    expect(reverse).toBeDefined();
  });

  it("generates complete single and double round robins for group sizes 2–6", () => {
    ([2, 3, 4, 5, 6] as const).forEach((size) => {
      ([1, 2] as const).forEach((legs) => {
        const matches = interleaveGroupFixtures(
          "group-size-cup",
          [{ id: "group-a", label: "Group A", participantIds: ids(size) }],
          legs,
        );
        expect(matches).toHaveLength(((size * (size - 1)) / 2) * legs);
        const firstLegPairs = matches
          .filter((match) => match.leg === 1)
          .map((match) =>
            [match.participantAId, match.participantBId].sort().join("|"),
          );
        expect(new Set(firstLegPairs)).toHaveLength((size * (size - 1)) / 2);
        expect(Math.max(...matches.map((match) => match.fixtureRound!))).toBe(
          (size % 2 === 0 ? size - 1 : size) * legs,
        );
      });
    });
  });

  it("interleaves groups into a stable unique global sequence", () => {
    const groups = assignBalancedGroups(ids(8), 2);
    const matches = interleaveGroupFixtures("cup", groups, 1);
    expect(matches.map((match) => match.globalSequence)).toEqual(
      Array.from({ length: 12 }, (_, index) => index + 1),
    );
    expect(new Set(matches.map((match) => match.id))).toHaveLength(12);
    expect(matches.slice(0, 4).map((match) => match.groupId)).toEqual([
      "group-a",
      "group-b",
      "group-a",
      "group-b",
    ]);
  });
});

describe("Group standings, qualification, and seeding", () => {
  it("ranks a completed group without falling back to names or draw order", () => {
    const run = completeGroups(preview());
    const result = deriveGroupStandings(run, "group-a");
    expect(result.complete).toBe(true);
    expect(result.rows.map((row) => row.participantId)).toEqual(
      run.groups[0]!.participantIds,
    );
    expect(result.unresolvedTieGroups).toEqual([]);
  });

  it("aggregates both direct legs for an exact-two head-to-head tie", () => {
    let run = preview(4, { legs: 2, qualifiers: 2 });
    const [first, second] = run.groups[0]!.participantIds;
    const direct = Object.values(run.matches).filter(
      (match) =>
        match.stage === "group-stage" &&
        [match.participantAId, match.participantBId].includes(first!) &&
        [match.participantAId, match.participantBId].includes(second!),
    );
    direct.forEach((match, index) => {
      run = recordWinner(
        run,
        match.id,
        index === 0 ? first! : second!,
        300 + index,
      );
    });
    expect(direct).toHaveLength(2);
  });

  it("persists an explicit group tie against the standings fingerprint", () => {
    const source = preview(4);
    let run = source;
    Object.values(source.matches).forEach((match, index) => {
      run = recordWinner(run, match.id, match.participantAId!, 400 + index);
    });
    const standings = deriveGroupStandings(run, "group-a");
    const tie = standings.unresolvedTieGroups[0];
    if (tie) {
      run = resolveGroupTie(
        run,
        "group-a",
        tie,
        [...tie].reverse(),
        "admin",
        500,
        "Playoff result",
      );
      expect(Object.values(run.tieResolutions)[0]!.standingsFingerprint).toBe(
        standings.standingsFingerprint,
      );
    }
    expect(
      groupQualificationBlockingTies(deriveGroupStandings(run, "group-a"), 2),
    ).toEqual([]);
  });

  it("freezes qualification only after every critical group tie is resolved", () => {
    const run = completeGroups(preview());
    const reviewed = beginQualificationReview(run, "admin", 600);
    expect(reviewed.stage).toBe("qualification-review");
    expect(reviewed.qualification?.entries).toHaveLength(4);
    expect(reviewed.qualification?.byGroup["group-a"]).toHaveLength(2);
  });

  it("keeps every higher group-rank tier ahead of lower tiers", () => {
    const run = qualificationRun();
    const seeds = deriveCrossGroupSeeds(
      run.qualification!,
      Object.values(run.seedResolutions),
    );
    const rankById = new Map(
      run.qualification!.entries.map((entry) => [
        entry.participantId,
        entry.groupRank,
      ]),
    );
    expect(
      seeds.seedOrder.slice(0, 2).every((id) => rankById.get(id) === 1),
    ).toBe(true);
    expect(seeds.seedOrder.slice(2).every((id) => rankById.get(id) === 2)).toBe(
      true,
    );
  });

  it("produces the golden A1–B2 and B1–A2 first round for two groups", () => {
    const qualified = qualificationRun();
    const run = generateGroupKnockout(qualified, "admin", 700);
    const firstRound = run.knockout!.rounds[0]!.matchIds.map(
      (matchId) => run.matches[matchId]!,
    );
    const byGroup = run.qualification!.byGroup;
    expect(
      firstRound.map((match) => [match.participantAId, match.participantBId]),
    ).toEqual([
      [byGroup["group-a"]![0], byGroup["group-b"]![1]],
      [byGroup["group-b"]![0], byGroup["group-a"]![1]],
    ]);
    expect(run.knockout!.sameGroupRematchWarning).toBeNull();
  });

  it("deterministically permutes only the lower rank tier to avoid rematches", () => {
    let run = beginQualificationReview(completeGroups(preview()), "admin", 650);
    const byGroup = run.qualification!.byGroup;
    const proposed = deriveCrossGroupSeeds(run.qualification!, []);
    proposed.unresolvedTieGroups.forEach((tie, index) => {
      const orderedParticipantIds =
        tie.groupRank === 1
          ? [byGroup["group-a"]![0]!, byGroup["group-b"]![0]!]
          : [byGroup["group-b"]![1]!, byGroup["group-a"]![1]!];
      run = resolveCrossGroupSeedTie(
        run,
        tie.groupRank,
        tie.participantIds,
        orderedParticipantIds,
        "admin",
        660 + index,
        "Explicit normalized order",
      );
    });
    const normalized = deriveCrossGroupSeeds(
      run.qualification!,
      Object.values(run.seedResolutions),
    ).seedOrder;
    expect(normalized).toEqual([
      byGroup["group-a"]![0],
      byGroup["group-b"]![0],
      byGroup["group-b"]![1],
      byGroup["group-a"]![1],
    ]);
    expect(avoidSameGroupRematches(run, normalized)).toEqual([
      byGroup["group-a"]![0],
      byGroup["group-b"]![0],
      byGroup["group-a"]![1],
      byGroup["group-b"]![1],
    ]);
    const bracket = generateGroupKnockout(run, "admin", 700);
    expect(bracket.knockout!.sameGroupRematchWarning).toBeNull();
  });

  it("creates highest-seed byes for a non-power-of-two qualifier field", () => {
    let run = completeGroups(
      preview(9, {
        groupCountMode: "manual",
        groupCount: 3,
        qualifiers: 2,
      }),
    );
    run = beginQualificationReview(run, "admin", 800);
    deriveCrossGroupSeeds(run.qualification!, []).unresolvedTieGroups.forEach(
      (tie, index) => {
        run = resolveCrossGroupSeedTie(
          run,
          tie.groupRank,
          tie.participantIds,
          tie.participantIds,
          "admin",
          810 + index,
          "Confirmed order",
        );
      },
    );
    run = generateGroupKnockout(run, "admin", 900);
    expect(run.knockout?.bracketSize).toBe(8);
    expect(
      Object.values(run.matches).filter(
        (match) => match.stage === "knockout" && match.isBye,
      ),
    ).toHaveLength(2);
  });
});

describe("Group lifecycle, points, and parser safety", () => {
  it("completes and reopens a knockout while preserving its results", () => {
    let run = generateGroupKnockout(qualificationRun(), "admin", 1000);
    expect(parseGroupKnockoutRun(run)).not.toBeNull();
    let ready = Object.values(run.matches).find(
      (match) => match.stage !== "group-stage" && match.status === "ready",
    );
    while (ready) {
      run = recordWinner(
        run,
        ready.id,
        ready.participantAId!,
        run.updatedAt + 1,
      );
      ready = Object.values(run.matches).find(
        (match) => match.stage !== "group-stage" && match.status === "ready",
      );
    }
    const completed = completeGroupCompetition(run, "admin", run.updatedAt + 1);
    expect(parseGroupKnockoutRun(completed)).not.toBeNull();
    expect(completed.stage).toBe("completed");
    expect(
      completed.placements?.entries.slice(0, 2).map((entry) => entry.place),
    ).toEqual([1, 2]);
    const resultCount = completed.resultCount;
    const reopened = reopenGroupCompetition(completed, completed.updatedAt + 1);
    expect(parseGroupKnockoutRun(reopened)).not.toBeNull();
    expect(reopened.stage).toBe("knockout");
    expect(reopened.placements).toBeNull();
    expect(reopened.resultCount).toBe(resultCount);
  });

  it("requires an explicit whole-knockout reset for a group-stage correction", () => {
    const source = generateGroupKnockout(qualificationRun(), "admin", 1000);
    const match = Object.values(source.matches).find(
      (candidate) => candidate.stage === "group-stage",
    )!;
    expect(() =>
      recordGroupMatchResult(source, match.id, {
        expectedMatchRevision: match.revision,
        roundWinnerIds: [match.participantBId!, match.participantBId!],
        organizerUid: "admin",
        now: 1010,
      }),
    ).toThrow(GroupMatchDependencyConflictError);
    const corrected = recordGroupMatchResult(source, match.id, {
      expectedMatchRevision: match.revision,
      roundWinnerIds: [match.participantBId!, match.participantBId!],
      organizerUid: "admin",
      now: 1010,
      resetKnockout: true,
    });
    expect(corrected.stage).toBe("group-stage");
    expect(corrected.knockout).toBeNull();
    expect(corrected.qualification).toBeNull();
  });

  it("derives itemized group-stage points without a global ledger", () => {
    const run = completeGroups(preview());
    const points = deriveGroupPointBreakdown(run);
    expect(points).toHaveLength(8);
    expect(
      points
        .flatMap((entry) => entry.items)
        .some((item) => item.reason === "match-win"),
    ).toBe(true);
    expect(run).not.toHaveProperty("globalLedger");
  });

  it("strictly parses a valid run and quarantines unknown or malformed fields", () => {
    const run = preview();
    expect(parseGroupKnockoutRun(run)).not.toBeNull();
    expect(parseGroupKnockoutRun({ ...run, secret: "leak" })).toBeNull();
    expect(
      parseGroupKnockoutRun({
        ...run,
        draw: { ...run.draw, shuffledParticipantIds: ["intruder"] },
      }),
    ).toBeNull();
    const first = Object.values(run.matches)[0] as CompetitionMatch;
    expect(
      parseGroupKnockoutRun({
        ...run,
        matches: {
          ...run.matches,
          [first.id]: { ...first, participantAId: "intruder" },
        },
      }),
    ).toBeNull();

    const duplicateGroup = structuredClone(run);
    duplicateGroup.groups[0]!.label = "Group B";
    expect(parseGroupKnockoutRun(duplicateGroup)).toBeNull();

    const duplicateFixture = structuredClone(run);
    const groupMatches = Object.values(duplicateFixture.matches).filter(
      (match) => match.stage === "group-stage",
    );
    groupMatches[1]!.participantAId = groupMatches[0]!.participantAId;
    groupMatches[1]!.participantBId = groupMatches[0]!.participantBId;
    expect(parseGroupKnockoutRun(duplicateFixture)).toBeNull();

    const reviewed = beginQualificationReview(
      completeGroups(run),
      "admin",
      900,
    );
    const malformedQualification = structuredClone(reviewed);
    malformedQualification.qualification!.byGroup["group-a"] = [
      malformedQualification.qualification!.byGroup["group-b"]![0]!,
      malformedQualification.qualification!.byGroup["group-a"]![1]!,
    ];
    expect(parseGroupKnockoutRun(malformedQualification)).toBeNull();
  });
});
