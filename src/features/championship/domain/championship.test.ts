import { describe, expect, it } from "vitest";
import type { PublishedCompetition } from "../../competitions/domain/types";
import { createCompetitionRun } from "../../competitions/engine/activation";
import { recordMatchResult } from "../../competitions/engine/lifecycle";
import {
  createAllHandsRun,
  createAllHandsSession,
  recordAllHandsResult,
  voidAllHandsSession,
} from "../../competitions/all-hands/engine";
import { createGroupDrawPreview } from "../../competitions/group-knockout/generation";
import { recordGroupMatchResult } from "../../competitions/group-knockout/engine";
import type { Participant } from "../../participants/types";
import { deriveChampionshipAchievements } from "../achievements/deriveAchievements";
import { createCompetitionLedgerEntryId, stableHash } from "../ledger/identity";
import {
  parseCompetitionLedgerCollection,
  parseCompetitionLedgerSource,
  parseManualBonusCollection,
} from "../ledger/runtime";
import { deriveCompetitionLedgerSnapshot } from "../ledger/snapshot";
import { deriveChampionshipLeaderboard } from "./leaderboard";
import { deriveReconciliationItems } from "./reconciliation";
import type {
  CompetitionLedgerSnapshot,
  ManualChampionshipBonus,
} from "./types";

const participantIds = ["player-1", "player-2", "player-3", "player-4"];

function competition(
  format: PublishedCompetition["format"],
): PublishedCompetition {
  const headToHead = {
    kind: "head-to-head" as const,
    table: {
      pointsForMatchWin: 3,
      pointsForDraw: 1,
      pointsForMatchLoss: 0,
    },
    overall: {
      matchWinBonus: 2,
      pointsPerRoundWon: 1,
      participationPoints: 1,
      qualificationBonus: 3,
      competitionWinnerBonus: 8,
      runnerUpBonus: 5,
      thirdPlaceBonus: 3,
    },
  };
  const base = {
    id: `${format}-cup`,
    title: `${format} Cup`,
    gameName: "Table Game",
    description: "A championship test.",
    iconKey: "trophy" as const,
    format,
    participantIds,
    displayOrder: 1,
    createdAt: 10,
    updatedAt: 20,
    createdByUid: "admin",
    updatedByUid: "admin",
    revision: 2,
    schemaVersion: 1 as const,
    status: "scheduled" as const,
    publishedAt: 20,
    publishedByUid: "admin",
  };
  if (format === "all-hands") {
    return {
      ...base,
      format,
      formatConfig: {
        kind: "all-hands",
        resultMode: "winner-only",
        sessionPlan: { kind: "open-ended" },
        allowTeams: true,
        primaryMetricLabel: null,
        primaryMetricDirection: "higher",
        secondaryMetricLabel: null,
        secondaryMetricDirection: null,
        allowNegativeScores: false,
        tieHandling: "shared-placement",
      },
      scoringConfig: {
        kind: "all-hands",
        winnerBonus: 4,
        participationPoints: 1,
        placementPoints: [
          { place: 1, points: 4 },
          { place: 2, points: 2 },
        ],
      },
    };
  }
  if (format === "group-knockout") {
    return {
      ...base,
      format,
      formatConfig: {
        kind: "group-knockout",
        groupCountMode: "manual",
        groupCount: 2,
        qualifiersPerGroup: 1,
        roundRobinLegs: 1,
        series: { kind: "single", winsRequired: 1, maximumRounds: 1 },
        allowDraws: false,
        includeThirdPlace: false,
      },
      scoringConfig: headToHead,
    };
  }
  return {
    ...base,
    format,
    formatConfig: {
      kind: "round-robin-knockout",
      series: { kind: "best-of", winsRequired: 2, maximumRounds: 3 },
      allowDraws: false,
      qualificationCount: 2,
      includeThirdPlace: true,
    },
    scoringConfig: headToHead,
  };
}

function active(source: PublishedCompetition): PublishedCompetition {
  return {
    ...source,
    status: "active",
    revision: source.revision + 1,
    updatedAt: 100,
  };
}

function participant(
  id: string,
  status: Participant["status"] = "active",
): Participant {
  return {
    id,
    ownerUid: null,
    displayName: id.replace("player-", "Player "),
    avatar: { icon: "castle", tone: "cyan" },
    status,
    createdAt: 1,
    createdByUid: "admin",
    updatedAt: 1,
    updatedByUid: "admin",
    schemaVersion: 1,
  };
}

function bonus(
  participantId: string,
  points: number,
  status: ManualChampionshipBonus["status"] = "active",
): ManualChampionshipBonus {
  return {
    id: `bonus-${participantId}-${points}`,
    participantId,
    points,
    label: "Bonus challenge",
    note: null,
    status,
    createdAt: 500,
    createdByUid: "admin",
    updatedAt: 500,
    updatedByUid: "admin",
    revokedAt: status === "revoked" ? 500 : null,
    revokedByUid: status === "revoked" ? "admin" : null,
    revision: status === "revoked" ? 2 : 1,
    schemaVersion: 1,
  };
}

function merrySnapshot() {
  const source = competition("round-robin-knockout");
  let run = createCompetitionRun(source, "admin", 100, () => 0);
  const match = Object.values(run.matches)[0]!;
  run = recordMatchResult(run, match.id, {
    expectedMatchRevision: match.revision,
    roundWinnerIds: [
      match.participantAId!,
      match.participantBId!,
      match.participantAId!,
    ],
    organizerUid: "admin",
    now: 200,
  });
  return {
    competition: active(source),
    run,
    snapshot: deriveCompetitionLedgerSnapshot({
      competition: active(source),
      run,
      generatedAt: 200,
    }),
  };
}

describe("competition ledger identity and normalization", () => {
  it("creates stable Firebase-safe IDs and separates logical awards", () => {
    const input = {
      competitionId: "cup.1",
      participantId: "player/1",
      awardType: "match-win",
      sourceEntityId: "match#1",
    };
    expect(createCompetitionLedgerEntryId(input)).toBe(
      createCompetitionLedgerEntryId(input),
    );
    expect(createCompetitionLedgerEntryId(input)).toMatch(
      /^match-win-[a-f0-9]{16}$/,
    );
    expect(
      createCompetitionLedgerEntryId({ ...input, participantId: "player-2" }),
    ).not.toBe(createCompetitionLedgerEntryId(input));
    expect(
      createCompetitionLedgerEntryId({ ...input, awardType: "round-win" }),
    ).not.toBe(createCompetitionLedgerEntryId(input));
    expect(
      createCompetitionLedgerEntryId({ ...input, sourceEntityId: "match-2" }),
    ).not.toBe(createCompetitionLedgerEntryId(input));
  });

  it("normalizes Merry-Go-Round points including losing round awards", () => {
    const { snapshot, run } = merrySnapshot();
    const match = Object.values(run.matches)[0]!;
    const entries = Object.values(snapshot.entries);
    expect(entries.some((entry) => entry.sourceType === "match-win")).toBe(
      true,
    );
    expect(
      entries.filter((entry) => entry.sourceType === "match-participation"),
    ).toHaveLength(2);
    expect(entries.some((entry) => entry.sourceType === "round-win")).toBe(
      true,
    );
    expect(
      entries.some(
        (entry) =>
          entry.sourceType === "round-win" &&
          entry.participantId === match.participantBId,
      ),
    ).toBe(true);
    expect(entries.every((entry) => entry.sourceEntityId === match.id)).toBe(
      true,
    );
  });

  it("normalizes All Hands awards and drops a voided session", () => {
    const source = competition("all-hands");
    let run = createAllHandsRun(source, "admin", 100);
    run = createAllHandsSession(run, {
      id: "session-1",
      title: "Opening table",
      mode: "individual",
      participantIds: ["player-1", "player-2"],
      teams: [],
      startImmediately: true,
      organizerUid: "admin",
      now: 110,
    });
    run = recordAllHandsResult(
      run,
      "session-1",
      1,
      { kind: "winner-only", winnerEntityId: "player-2" },
      "admin",
      120,
    );
    const scored = deriveCompetitionLedgerSnapshot({
      competition: active(source),
      run,
    });
    expect(
      Object.values(scored.entries).filter(
        (entry) => entry.sourceType === "session-participation",
      ),
    ).toHaveLength(2);
    expect(
      Object.values(scored.entries).find(
        (entry) => entry.sourceType === "session-win",
      )?.participantId,
    ).toBe("player-2");
    const voided = voidAllHandsSession(
      run,
      "session-1",
      2,
      "admin",
      130,
      "Result withdrawn",
    );
    expect(
      deriveCompetitionLedgerSnapshot({
        competition: active(source),
        run: voided,
      }).meta.entryCount,
    ).toBe(0);
  });

  it("normalizes Group Format match awards", () => {
    const source = competition("group-knockout");
    let run = createGroupDrawPreview(source, "admin", 100, () => 0).run;
    const match = Object.values(run.matches)[0]!;
    run = recordGroupMatchResult(run, match.id, {
      expectedMatchRevision: match.revision,
      roundWinnerIds: [match.participantAId!],
      organizerUid: "admin",
      now: 130,
    });
    const snapshot = deriveCompetitionLedgerSnapshot({
      competition: active(source),
      run,
    });
    expect(
      Object.values(snapshot.entries).map((entry) => entry.sourceType),
    ).toEqual(
      expect.arrayContaining(["match-win", "round-win", "match-participation"]),
    );
  });

  it("keeps fingerprints deterministic and sensitive to scoring state", () => {
    const first = merrySnapshot();
    const repeat = deriveCompetitionLedgerSnapshot({
      competition: first.competition,
      run: first.run,
      generatedAt: 999,
    });
    expect(repeat.meta.sourceFingerprint).toBe(
      first.snapshot.meta.sourceFingerprint,
    );
    const presentationChange = deriveCompetitionLedgerSnapshot({
      competition: { ...first.competition, title: "Renamed for display" },
      run: first.run,
    });
    expect(presentationChange.meta.sourceFingerprint).toBe(
      first.snapshot.meta.sourceFingerprint,
    );
    const revisionChange = deriveCompetitionLedgerSnapshot({
      competition: first.competition,
      run: { ...first.run, revision: first.run.revision + 1 },
    });
    expect(revisionChange.meta.sourceFingerprint).not.toBe(
      first.snapshot.meta.sourceFingerprint,
    );
    expect(stableHash({ b: 2, a: 1 })).toBe(stableHash({ a: 1, b: 2 }));
    expect(stableHash({ ...first.run.configSnapshot, changed: true })).not.toBe(
      stableHash(first.run.configSnapshot),
    );
  });
});

describe("ledger validation, reconciliation, and leaderboard", () => {
  it("strictly parses valid sources and quarantines malformed records", () => {
    const { competition, snapshot } = merrySnapshot();
    expect(
      parseCompetitionLedgerSource(competition.id, snapshot),
    ).not.toBeNull();
    const result = parseCompetitionLedgerCollection({
      [competition.id]: snapshot,
      malformed: { meta: { schemaVersion: 99 } },
    });
    expect(result.sources).toHaveLength(1);
    expect(result.invalidIds).toEqual(["malformed"]);
  });

  it("strictly validates manual bonus collections", () => {
    const valid = bonus("player-1", 5);
    const result = parseManualBonusCollection({
      [valid.id]: valid,
      invalid: { ...valid, id: "invalid", points: -1 },
    });
    expect(result.bonuses).toEqual([valid]);
    expect(result.invalidIds).toEqual(["invalid"]);
  });

  it("classifies missing, stale, in-sync, orphaned, and no-source states", () => {
    const { competition: source, run, snapshot } = merrySnapshot();
    const missing = deriveReconciliationItems({
      competitions: [source],
      runs: [run],
      sources: [],
    });
    expect(missing[0]?.status).toBe("missing");
    const synced = deriveReconciliationItems({
      competitions: [source],
      runs: [run],
      sources: [snapshot],
    });
    expect(synced[0]?.status).toBe("in-sync");
    const stale = deriveReconciliationItems({
      competitions: [source],
      runs: [run],
      sources: [
        {
          ...snapshot,
          meta: { ...snapshot.meta, sourceFingerprint: "0000000000000000" },
        },
      ],
    });
    expect(stale[0]?.status).toBe("stale");
    expect(
      deriveReconciliationItems({
        competitions: [],
        runs: [],
        sources: [snapshot],
      })[0]?.status,
    ).toBe("orphaned");
    expect(
      deriveReconciliationItems({
        competitions: [{ ...source, status: "scheduled" }],
        runs: [],
        sources: [],
      })[0]?.status,
    ).toBe("not-expected");
  });

  it("derives totals, shared competition ranks, zero scores, and bonus policy", () => {
    const { snapshot } = merrySnapshot();
    const entries = Object.values(snapshot.entries);
    const winner = entries.find(
      (entry) => entry.sourceType === "match-win",
    )!.participantId;
    const other = participantIds.find((id) => id !== winner)!;
    const rows = deriveChampionshipLeaderboard({
      sources: [snapshot],
      bonuses: [bonus(other, 2), bonus(winner, 50, "revoked")],
      participants: participantIds.map((id) => participant(id)),
    });
    expect(rows).toHaveLength(4);
    expect(rows.find((row) => row.participantId === winner)?.bonusPoints).toBe(
      0,
    );
    expect(rows.find((row) => row.participantId === other)?.bonusPoints).toBe(
      2,
    );
    expect(
      rows.filter((row) => row.totalPoints === 0).every((row) => row.tied),
    ).toBe(true);
    expect(rows.find((row) => row.totalPoints === 0)?.rank).toBeGreaterThan(1);
    expect(
      rows.every(
        (row) => row.totalPoints === row.competitionPoints + row.bonusPoints,
      ),
    ).toBe(true);
  });

  it("retains inactive and unavailable historical participants", () => {
    const { snapshot } = merrySnapshot();
    const scoredId = Object.values(snapshot.entries)[0]!.participantId;
    const rows = deriveChampionshipLeaderboard({
      sources: [snapshot],
      bonuses: [],
      participants: [participant(scoredId, "inactive")],
    });
    expect(
      rows.find((row) => row.participantId === scoredId)?.participant?.status,
    ).toBe("inactive");
    expect(rows.some((row) => row.isMissingParticipant)).toBe(true);
  });

  it("derives score-neutral achievements and tied holders", () => {
    const { snapshot } = merrySnapshot();
    const standings = deriveChampionshipLeaderboard({
      sources: [snapshot],
      bonuses: [bonus("player-3", 5), bonus("player-4", 5)],
      participants: participantIds.map((id) => participant(id)),
    });
    const achievements = deriveChampionshipAchievements(standings);
    expect(achievements.some((item) => item.title === "Round Warrior")).toBe(
      true,
    );
    expect(
      achievements.find((item) => item.title === "Bonus Hunter")
        ?.participantIds,
    ).toEqual(["player-3", "player-4"]);
    expect(
      deriveChampionshipAchievements(
        standings.map((row) => ({
          ...row,
          byAwardType: {},
          competitionsScored: 0,
          bonusPoints: 0,
        })),
      ),
    ).toEqual([]);
  });

  it("does not persist totals or ranks in source snapshots", () => {
    const { snapshot } = merrySnapshot();
    const serialized = JSON.stringify(snapshot);
    expect(serialized).not.toContain("totalPoints");
    expect(serialized).not.toContain('"rank"');
  });

  it("full source replacement removes obsolete entry IDs", () => {
    const { snapshot } = merrySnapshot();
    const replacement: CompetitionLedgerSnapshot = {
      ...snapshot,
      meta: { ...snapshot.meta, entryCount: 0 },
      entries: {},
    };
    expect(Object.keys(replacement.entries)).toHaveLength(0);
    expect(Object.keys(snapshot.entries).length).toBeGreaterThan(0);
  });
});
