import { describe, expect, it } from "vitest";
import type { AllHandsConfig, PublishedCompetition } from "../domain/types";
import {
  completeAllHandsRun,
  createAllHandsRun,
  createAllHandsSession,
  deriveAllHandsCompetitionPointBreakdown,
  deriveAllHandsSessionAwards,
  deriveAllHandsStandings,
  numericPlacements,
  recordAllHandsResult,
  reopenAllHandsRun,
  requestAllHandsCompletionReview,
  resolveAllHandsTie,
  restoreAllHandsSession,
  reviewAllHandsActivation,
  voidAllHandsSession,
} from "./engine";
import { parseAllHandsRun } from "./runtime";
import type { AllHandsCompetitionRun, AllHandsTeam } from "./types";

const ids = ["p1", "p2", "p3", "p4", "p5", "p6"];

function competition(
  overrides: Partial<PublishedCompetition> = {},
): PublishedCompetition {
  return {
    id: "all-hands-test",
    title: "Table Test",
    gameName: "Configurable game",
    description: "",
    iconKey: "users",
    format: "all-hands",
    participantIds: ids.slice(0, 4),
    formatConfig: {
      kind: "all-hands",
      resultMode: "placement",
      sessionPlan: { kind: "open-ended" },
      allowTeams: true,
      primaryMetricLabel: "Score",
      primaryMetricDirection: "higher",
      secondaryMetricLabel: "Penalty",
      secondaryMetricDirection: "lower",
      allowNegativeScores: false,
      tieHandling: "shared-placement",
    },
    scoringConfig: {
      kind: "all-hands",
      winnerBonus: 2,
      participationPoints: 1,
      placementPoints: [
        { place: 1, points: 6 },
        { place: 2, points: 4 },
        { place: 3, points: 2 },
      ],
    },
    displayOrder: 0,
    createdAt: 1,
    updatedAt: 2,
    createdByUid: "admin",
    updatedByUid: "admin",
    revision: 2,
    schemaVersion: 1,
    status: "scheduled",
    publishedAt: 2,
    publishedByUid: "admin",
    ...overrides,
  };
}

function participants(active = true) {
  return ids.map((id) => ({
    id,
    displayName: id.toUpperCase(),
    status: active ? ("active" as const) : ("inactive" as const),
  }));
}

function runFor(source = competition()) {
  return createAllHandsRun(source, "admin", 10);
}

function allHandsConfig(source = competition()): AllHandsConfig {
  if (source.formatConfig.kind !== "all-hands") {
    throw new Error("Expected All Hands test configuration.");
  }
  return source.formatConfig;
}

function addSession(
  run: AllHandsCompetitionRun,
  options: {
    id?: string;
    participantIds?: string[];
    mode?: "individual" | "team";
    teams?: AllHandsTeam[];
  } = {},
) {
  return createAllHandsSession(run, {
    id: options.id ?? `s${run.sessionCount + 1}`,
    title: "",
    mode: options.mode ?? "individual",
    participantIds: options.participantIds ?? run.eligibleParticipantIds,
    teams: options.teams ?? [],
    startImmediately: true,
    organizerUid: "admin",
    now: 20 + run.sessionCount,
  });
}

describe("All Hands activation and session validation", () => {
  it("reviews and freezes the complete backward-compatible configuration", () => {
    const source = competition();
    expect(
      reviewAllHandsActivation(source, participants(), false).canActivate,
    ).toBe(true);
    const run = runFor(source);
    expect(run.configSnapshot).toMatchObject({
      resultMode: "placement",
      sessionPlan: { kind: "open-ended" },
      teamAwardPolicy: "each-member",
      tieHandling: "shared-placement",
      metrics: {
        primaryDirection: "higher",
        secondaryDirection: "lower",
      },
    });
    expect(run.eligibleParticipantIds).toEqual(source.participantIds);
  });

  it("blocks the wrong format, duplicate runtime, and inactive references", () => {
    expect(
      reviewAllHandsActivation(
        competition({ format: "round-robin-knockout" }),
        participants(),
        false,
      ).canActivate,
    ).toBe(false);
    expect(
      reviewAllHandsActivation(competition(), participants(), true).canActivate,
    ).toBe(false);
    expect(
      reviewAllHandsActivation(competition(), participants(false), false)
        .canActivate,
    ).toBe(false);
  });

  it("supports participant subsets and rejects outsiders or duplicates", () => {
    const run = runFor();
    expect(
      addSession(run, { participantIds: ["p1", "p3"] }).sessions.s1
        ?.participantIds,
    ).toEqual(["p1", "p3"]);
    expect(() =>
      addSession(run, { participantIds: ["p1", "outsider"] }),
    ).toThrow(/eligible/);
    expect(() => addSession(run, { participantIds: ["p1", "p1"] })).toThrow(
      /only once/,
    );
  });

  it("supports uneven teams and rejects empty or overlapping teams", () => {
    const teams = [
      { id: "a", name: "Alpha", participantIds: ["p1", "p2", "p3"] },
      { id: "b", name: "Beta", participantIds: ["p4"] },
    ];
    const next = addSession(runFor(), { mode: "team", teams });
    expect(next.sessions.s1?.entityIds).toEqual(["a", "b"]);
    expect(() =>
      addSession(runFor(), {
        mode: "team",
        teams: [
          { id: "a", name: "Alpha", participantIds: ["p1", "p2"] },
          { id: "b", name: "Beta", participantIds: ["p2", "p3", "p4"] },
        ],
      }),
    ).toThrow(/only one team/);
    expect(() =>
      addSession(runFor(), {
        mode: "team",
        teams: [
          { id: "a", name: "Alpha", participantIds: [] },
          { id: "b", name: "Beta", participantIds: ids.slice(0, 4) },
        ],
      }),
    ).toThrow(/needs a participant/);
  });
});

describe("All Hands result modes and point derivation", () => {
  it("records an individual winner with participation and winner bonus", () => {
    const source = competition({
      formatConfig: {
        ...allHandsConfig(),
        kind: "all-hands",
        resultMode: "winner-only",
      },
    });
    let run = addSession(runFor(source));
    run = recordAllHandsResult(
      run,
      "s1",
      1,
      { kind: "winner-only", winnerEntityId: "p2" },
      "admin",
      30,
    );
    const awards = deriveAllHandsSessionAwards(
      run.sessions.s1!,
      run.configSnapshot,
    );
    expect(
      awards
        .filter((award) => award.participantId === "p2")
        .reduce((sum, award) => sum + award.points, 0),
    ).toBe(3);
    expect(
      awards.filter((award) => award.source === "participation"),
    ).toHaveLength(4);
    expect(() =>
      recordAllHandsResult(
        addSession(runFor(source)),
        "s1",
        1,
        { kind: "winner-only", winnerEntityId: "outside" },
        "admin",
        30,
      ),
    ).toThrow(/winner/);
  });

  it("expands a team winner award to every member", () => {
    const source = competition({
      formatConfig: {
        ...allHandsConfig(),
        kind: "all-hands",
        resultMode: "winner-only",
      },
    });
    let run = addSession(runFor(source), {
      mode: "team",
      teams: [
        { id: "a", name: "Alpha", participantIds: ["p1", "p2"] },
        { id: "b", name: "Beta", participantIds: ["p3", "p4"] },
      ],
    });
    run = recordAllHandsResult(
      run,
      "s1",
      1,
      { kind: "winner-only", winnerEntityId: "a" },
      "admin",
      30,
    );
    const awards = deriveAllHandsSessionAwards(
      run.sessions.s1!,
      run.configSnapshot,
    );
    for (const participantId of ["p1", "p2"]) {
      expect(
        awards
          .filter((award) => award.participantId === participantId)
          .reduce((sum, award) => sum + award.points, 0),
      ).toBe(3);
    }
  });

  it.each([2, 3, 6])(
    "records complete unique placement for %i entities",
    (count) => {
      const source = competition({ participantIds: ids.slice(0, count) });
      let run = addSession(runFor(source));
      run = recordAllHandsResult(
        run,
        "s1",
        1,
        {
          kind: "placement",
          entries: ids.slice(0, count).map((entityId, index) => ({
            entityId,
            placement: index + 1,
          })),
        },
        "admin",
        30,
      );
      expect(run.sessions.s1?.status).toBe("completed");
    },
  );

  it("accepts competition-ranking ties and rejects invalid sequences", () => {
    let run = addSession(runFor());
    run = recordAllHandsResult(
      run,
      "s1",
      1,
      {
        kind: "placement",
        entries: [
          { entityId: "p1", placement: 1 },
          { entityId: "p2", placement: 1 },
          { entityId: "p3", placement: 3 },
          { entityId: "p4", placement: 4 },
        ],
      },
      "admin",
      30,
    );
    expect(
      deriveAllHandsStandings(run).rows.filter((row) => row.sessionWins === 1),
    ).toHaveLength(2);
    expect(() =>
      recordAllHandsResult(
        addSession(runFor()),
        "s1",
        1,
        {
          kind: "placement",
          entries: [
            { entityId: "p1", placement: 1 },
            { entityId: "p2", placement: 1 },
            { entityId: "p3", placement: 2 },
            { entityId: "p4", placement: 4 },
          ],
        },
        "admin",
        30,
      ),
    ).toThrow(/competition ranking/);
  });

  it("requires unique placement under manual order", () => {
    const source = competition({
      formatConfig: {
        ...allHandsConfig(),
        kind: "all-hands",
        tieHandling: "manual-order",
      },
    });
    expect(() =>
      recordAllHandsResult(
        addSession(runFor(source)),
        "s1",
        1,
        {
          kind: "placement",
          entries: ids.slice(0, 4).map((entityId, index) => ({
            entityId,
            placement: index < 2 ? 1 : index + 1,
          })),
        },
        "admin",
        30,
      ),
    ).toThrow(/cannot contain tied/);
  });

  it("ranks highest and lowest decimals with opposite secondary direction", () => {
    const base = competition();
    const highest = runFor({
      ...base,
      formatConfig: {
        ...allHandsConfig(base),
        kind: "all-hands",
        resultMode: "highest-score",
      },
    });
    const entries = [
      { entityId: "p1", primaryScore: 4.5, secondaryScore: 3 },
      { entityId: "p2", primaryScore: 4.5, secondaryScore: 2 },
      { entityId: "p3", primaryScore: 3, secondaryScore: 0 },
      { entityId: "p4", primaryScore: 2, secondaryScore: 0 },
    ];
    expect(
      numericPlacements(
        { entries, manualOrderEntityIds: null },
        highest.configSnapshot,
      )[0],
    ).toEqual({ entityId: "p2", placement: 1 });
    const lowest = {
      ...highest,
      configSnapshot: {
        ...highest.configSnapshot,
        resultMode: "lowest-score" as const,
        metrics: {
          ...highest.configSnapshot.metrics,
          primaryDirection: "lower" as const,
        },
      },
    };
    expect(
      numericPlacements(
        { entries, manualOrderEntityIds: null },
        lowest.configSnapshot,
      )[0]?.entityId,
    ).toBe("p4");
  });

  it("preserves shared numeric ties and supports explicit manual order", () => {
    const shared = runFor({
      ...competition(),
      formatConfig: {
        ...allHandsConfig(),
        kind: "all-hands",
        resultMode: "highest-score",
        secondaryMetricLabel: null,
        secondaryMetricDirection: null,
      },
    });
    const entries = ids.slice(0, 4).map((entityId, index) => ({
      entityId,
      primaryScore: index < 2 ? 10 : 5 - index,
      secondaryScore: null,
    }));
    expect(
      numericPlacements(
        { entries, manualOrderEntityIds: null },
        shared.configSnapshot,
      ).slice(0, 2),
    ).toEqual([
      { entityId: "p1", placement: 1 },
      { entityId: "p2", placement: 1 },
    ]);
    const manual = {
      ...shared,
      configSnapshot: {
        ...shared.configSnapshot,
        tieHandling: "manual-order" as const,
      },
    };
    expect(
      numericPlacements(
        { entries, manualOrderEntityIds: ["p2", "p1", "p3", "p4"] },
        manual.configSnapshot,
      )[0]?.entityId,
    ).toBe("p2");
  });

  it("allows configured negative scores and rejects non-finite input", () => {
    const source = competition({
      formatConfig: {
        ...allHandsConfig(),
        kind: "all-hands",
        resultMode: "lowest-score",
        primaryMetricDirection: "lower",
        secondaryMetricLabel: null,
        secondaryMetricDirection: null,
        allowNegativeScores: true,
      },
    });
    const entries = ids.slice(0, 4).map((entityId, index) => ({
      entityId,
      primaryScore: index - 2,
      secondaryScore: null,
    }));
    expect(() =>
      recordAllHandsResult(
        addSession(runFor(source)),
        "s1",
        1,
        {
          kind: "numeric",
          mode: "lowest-score",
          entries,
          manualOrderEntityIds: null,
        },
        "admin",
        30,
      ),
    ).not.toThrow();
    entries[0]!.primaryScore = Number.NaN;
    expect(() =>
      recordAllHandsResult(
        addSession(runFor(source)),
        "s1",
        1,
        {
          kind: "numeric",
          mode: "lowest-score",
          entries,
          manualOrderEntityIds: null,
        },
        "admin",
        30,
      ),
    ).toThrow(/finite/);
  });

  it("validates bounded custom points and expands team custom awards", () => {
    const source = competition({
      formatConfig: {
        ...allHandsConfig(),
        kind: "all-hands",
        resultMode: "custom",
      },
    });
    let run = addSession(runFor(source), {
      mode: "team",
      teams: [
        { id: "a", name: "Alpha", participantIds: ["p1", "p2"] },
        { id: "b", name: "Beta", participantIds: ["p3", "p4"] },
      ],
    });
    run = recordAllHandsResult(
      run,
      "s1",
      1,
      {
        kind: "custom",
        entries: [
          { entityId: "a", points: 7, note: "Shared objective" },
          { entityId: "b", points: 3, note: null },
        ],
      },
      "admin",
      30,
    );
    const awards = deriveAllHandsSessionAwards(
      run.sessions.s1!,
      run.configSnapshot,
    );
    expect(
      awards.find(
        (award) => award.participantId === "p1" && award.points === 7,
      ),
    ).toBeTruthy();
    expect(
      awards.find(
        (award) => award.participantId === "p2" && award.points === 7,
      ),
    ).toBeTruthy();
    expect(() =>
      recordAllHandsResult(
        addSession(runFor(source)),
        "s1",
        1,
        {
          kind: "custom",
          entries: ids
            .slice(0, 4)
            .map((entityId) => ({ entityId, points: -1, note: null })),
        },
        "admin",
        30,
      ),
    ).toThrow(/0 to 100/);
  });
});

describe("All Hands standings, correction, and lifecycle", () => {
  function completedTwoSessions() {
    let run = addSession(runFor(), { id: "s1" });
    run = recordAllHandsResult(
      run,
      "s1",
      1,
      {
        kind: "placement",
        entries: ids
          .slice(0, 4)
          .map((entityId, index) => ({ entityId, placement: index + 1 })),
      },
      "admin",
      30,
    );
    run = addSession(run, { id: "s2", participantIds: ["p2", "p3", "p4"] });
    return recordAllHandsResult(
      run,
      "s2",
      1,
      {
        kind: "placement",
        entries: [
          { entityId: "p2", placement: 1 },
          { entityId: "p3", placement: 2 },
          { entityId: "p4", placement: 3 },
        ],
      },
      "admin",
      40,
    );
  }

  it("aggregates multiple subset sessions and itemized projected points", () => {
    const run = completedTwoSessions();
    const standings = deriveAllHandsStandings(run);
    expect(
      standings.rows.find((row) => row.participantId === "p1")?.sessionsPlayed,
    ).toBe(1);
    expect(
      standings.rows.find((row) => row.participantId === "p2")?.sessionsPlayed,
    ).toBe(2);
    const breakdown = deriveAllHandsCompetitionPointBreakdown(run);
    expect(
      breakdown.every(
        (entry) =>
          entry.total ===
          entry.items.reduce((sum, item) => sum + item.points, 0),
      ),
    ).toBe(true);
  });

  it("correction replaces awards and invalidates prior ties", () => {
    let run = completedTwoSessions();
    const before = deriveAllHandsStandings(run);
    run = {
      ...run,
      tieResolutions: {
        old: {
          id: "old",
          participantIds: ["p3", "p4"],
          orderedParticipantIds: ["p3", "p4"],
          reason: null,
          standingsFingerprint: before.standingsFingerprint,
          resolvedAt: 41,
          resolvedByUid: "admin",
          schemaVersion: 1,
        },
      },
    };
    run = recordAllHandsResult(
      run,
      "s1",
      2,
      {
        kind: "placement",
        entries: [
          { entityId: "p4", placement: 1 },
          { entityId: "p3", placement: 2 },
          { entityId: "p2", placement: 3 },
          { entityId: "p1", placement: 4 },
        ],
      },
      "admin",
      50,
    );
    expect(run.sessions.s1?.result?.resultRevision).toBe(2);
    expect(run.tieResolutions).toEqual({});
    expect(deriveAllHandsStandings(run)).not.toEqual(before);
  });

  it("excludes voided sessions and includes them after restoration", () => {
    let run = completedTwoSessions();
    const before = deriveAllHandsStandings(run).rows.find(
      (row) => row.participantId === "p2",
    )?.sessionsPlayed;
    run = voidAllHandsSession(run, "s2", 2, "admin", 50, "Duplicate play");
    expect(
      deriveAllHandsStandings(run).rows.find(
        (row) => row.participantId === "p2",
      )?.sessionsPlayed,
    ).toBe((before ?? 1) - 1);
    run = restoreAllHandsSession(run, "s2", 3, 60);
    expect(
      deriveAllHandsStandings(run).rows.find(
        (row) => row.participantId === "p2",
      )?.sessionsPlayed,
    ).toBe(before);
  });

  it("enforces fixed and open-ended completion policies", () => {
    const fixedSource = competition({
      formatConfig: {
        ...allHandsConfig(),
        kind: "all-hands",
        sessionPlan: { kind: "planned", sessionCount: 2 },
      },
    });
    let fixed = addSession(runFor(fixedSource));
    fixed = recordAllHandsResult(
      fixed,
      "s1",
      1,
      {
        kind: "placement",
        entries: ids
          .slice(0, 4)
          .map((entityId, index) => ({ entityId, placement: index + 1 })),
      },
      "admin",
      30,
    );
    expect(() => requestAllHandsCompletionReview(fixed, 40)).toThrow(
      /more completed session/,
    );
    expect(() => requestAllHandsCompletionReview(runFor(), 40)).toThrow(
      /at least one/,
    );
    expect(() =>
      requestAllHandsCompletionReview(completedTwoSessions(), 50),
    ).not.toThrow();
  });

  it("blocks a final podium tie, persists organizer order, completes, and reopens", () => {
    const source = competition({
      formatConfig: {
        ...allHandsConfig(),
        kind: "all-hands",
        resultMode: "custom",
      },
      scoringConfig: {
        kind: "all-hands",
        winnerBonus: 0,
        participationPoints: 0,
        placementPoints: [],
      },
    });
    let run = addSession(runFor(source));
    run = recordAllHandsResult(
      run,
      "s1",
      1,
      {
        kind: "custom",
        entries: ids
          .slice(0, 4)
          .map((entityId) => ({ entityId, points: 2, note: null })),
      },
      "admin",
      30,
    );
    run = requestAllHandsCompletionReview(run, 40);
    expect(() => completeAllHandsRun(run, "admin", 50)).toThrow(/podium/);
    const tie = deriveAllHandsStandings(run).unresolvedTieGroups[0]!;
    run = resolveAllHandsTie(
      run,
      tie,
      ["p2", "p1", "p3", "p4"],
      "Final challenge",
      "admin",
      50,
    );
    run = completeAllHandsRun(run, "admin", 60);
    expect(run.stage).toBe("completed");
    expect(run.placements?.entries[0]?.participantId).toBe("p2");
    run = reopenAllHandsRun(run, 70);
    expect(run.stage).toBe("sessions");
    expect(run.sessions.s1?.result).toBeTruthy();
    expect(run.tieResolutions).toEqual({});
  });

  it("round-trips Realtime Database omitted nulls and quarantines malformed data", () => {
    const run = completedTwoSessions();
    const serialized = JSON.parse(JSON.stringify(run)) as Record<
      string,
      unknown
    >;
    expect(parseAllHandsRun(serialized)).toMatchObject({
      format: "all-hands",
      sessionCount: 2,
    });
    const malformed = structuredClone(serialized) as {
      sessions: Record<string, { participantIds: string[] }>;
    };
    malformed.sessions.s1!.participantIds.push("outside");
    expect(parseAllHandsRun(malformed)).toBeNull();
  });
});
