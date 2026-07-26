import { describe, expect, it } from "vitest";
import {
  bestOf,
  competitionFormats,
  createCompetitionFormValues,
  firstTo,
} from "./config";
import {
  balancedGroupSizes,
  groupMatchEstimate,
  knockoutMatchEstimate,
  recommendedGroupCount,
  roundRobinMatchCount,
  roundRobinRoundEstimate,
} from "./estimates";
import { parseCompetitionCollection, parseCompetitionRecord } from "./runtime";
import {
  createDraftRecord,
  duplicateCompetitionRecord,
  hasRevisionConflict,
  isScheduledCompetition,
  publishDraftRecord,
  sortCompetitions,
} from "./transforms";
import type {
  CompetitionFormValues,
  ParticipantReference,
  PublishedCompetition,
} from "./types";
import {
  normalizeCompetitionText,
  participantReferenceWarnings,
  validateCompetition,
  validateSeries,
} from "./validation";

const participantIds = Array.from(
  { length: 8 },
  (_, index) => `guest-${index + 1}`,
);

function validValues(): CompetitionFormValues {
  return {
    ...createCompetitionFormValues(),
    title: "Castle Cup",
    gameName: "Mario Kart",
    description: "A friendly opening championship.",
    participantIds,
  };
}

function scheduledRecord(
  id: string,
  displayOrder: number,
  publishedAt: number,
): PublishedCompetition {
  const draft = createDraftRecord(validValues(), {
    id,
    uid: "admin",
    now: 100,
  });
  return publishDraftRecord(draft, "admin", publishedAt, displayOrder);
}

describe("competition domain", () => {
  it("uses the three exact persisted format identifiers", () => {
    expect(competitionFormats).toEqual([
      "round-robin-knockout",
      "all-hands",
      "group-knockout",
    ]);
  });

  it("constructs and validates supported series presets", () => {
    expect(bestOf(3)).toEqual({
      kind: "best-of",
      maximumRounds: 3,
      winsRequired: 2,
    });
    expect(bestOf(5).winsRequired).toBe(3);
    expect(bestOf(7).winsRequired).toBe(4);
    expect(firstTo(4)).toEqual({
      kind: "first-to",
      winsRequired: 4,
      maximumRounds: 7,
    });
    expect(
      validateSeries({ kind: "single", winsRequired: 1, maximumRounds: 1 }),
    ).toEqual([]);
    expect(validateSeries(firstTo(11))).toHaveLength(1);
  });

  it.each([
    [2, 1],
    [3, 3],
    [5, 10],
    [6, 15],
    [7, 21],
    [8, 28],
    [10, 45],
    [16, 120],
  ])(
    "estimates %i round-robin participants as %i matches",
    (players, matches) => {
      expect(roundRobinMatchCount(players)).toBe(matches);
    },
  );

  it("reports odd-field byes and the expected number of rounds", () => {
    expect(roundRobinRoundEstimate(7)).toEqual({
      rounds: 7,
      matchesPerRound: 3,
      hasByes: true,
    });
    expect(roundRobinRoundEstimate(8)).toEqual({
      rounds: 7,
      matchesPerRound: 4,
      hasByes: false,
    });
  });

  it("estimates knockout and group-stage workload without creating fixtures", () => {
    expect(knockoutMatchEstimate(8, false)).toBe(7);
    expect(knockoutMatchEstimate(8, true)).toBe(8);
    expect(recommendedGroupCount(4)).toBe(1);
    expect(recommendedGroupCount(8)).toBe(2);
    expect(recommendedGroupCount(12)).toBe(3);
    expect(recommendedGroupCount(16)).toBe(4);
    expect(recommendedGroupCount(17)).toBeNull();
    expect(balancedGroupSizes(10, 3)).toEqual([4, 3, 3]);
    expect(groupMatchEstimate([4, 3, 3], 1)).toBe(12);
    expect(groupMatchEstimate([4, 3, 3], 2)).toBe(24);
  });

  it("separates blocking validation errors from explainable warnings", () => {
    const values = validValues();
    values.formatConfig = {
      kind: "round-robin-knockout",
      series: bestOf(3),
      allowDraws: false,
      qualificationCount: 6,
      includeThirdPlace: false,
    };
    const issues = validateCompetition(values);
    expect(issues.some((entry) => entry.severity === "error")).toBe(false);
    expect(issues).toContainEqual(
      expect.objectContaining({
        field: "formatConfig.qualificationCount",
        severity: "warning",
      }),
    );
  });

  it("limits All Hands placement awards to the selected field on publish", () => {
    const values = createCompetitionFormValues("all-hands");
    values.title = "Table Cup";
    values.gameName = "Cards";
    values.participantIds = ["guest-1", "guest-2"];

    expect(validateCompetition(values).map((entry) => entry.field)).toContain(
      "scoringConfig.placementPoints",
    );
    expect(
      validateCompetition(values, "draft").some(
        (entry) => entry.field === "scoringConfig.placementPoints",
      ),
    ).toBe(false);
  });

  it("rejects duplicate participants and unsafe text", () => {
    const values = validValues();
    values.title = "<Castle Cup>";
    values.participantIds = ["guest-1", "guest-1"];
    const issues = validateCompetition(values);
    expect(issues.map((entry) => entry.field)).toEqual(
      expect.arrayContaining(["title", "participantIds"]),
    );
  });

  it("normalizes text and removes duplicate participant IDs before persistence", () => {
    const values = validValues();
    values.title = "  Castle   Cup ";
    values.participantIds = ["guest-1", "guest-1", "guest-2"];
    expect(normalizeCompetitionText(values)).toEqual(
      expect.objectContaining({
        title: "Castle Cup",
        participantIds: ["guest-1", "guest-2"],
      }),
    );
  });

  it("uses the deduplicated field when persisting an automatic group count", () => {
    const values = createCompetitionFormValues("group-knockout");
    values.participantIds = [
      "guest-1",
      "guest-1",
      "guest-2",
      "guest-3",
      "guest-4",
      "guest-5",
      "guest-6",
    ];
    expect(normalizeCompetitionText(values).formatConfig).toEqual(
      expect.objectContaining({ groupCount: 2 }),
    );
  });

  it("persists the automatic group recommendation for the selected field", () => {
    const values = createCompetitionFormValues("group-knockout");
    values.participantIds = Array.from(
      { length: 10 },
      (_, index) => `guest-${index + 1}`,
    );
    expect(normalizeCompetitionText(values).formatConfig).toEqual(
      expect.objectContaining({
        kind: "group-knockout",
        groupCountMode: "automatic",
        groupCount: 3,
      }),
    );
  });

  it("flags inactive and missing participant references", () => {
    const participants: ParticipantReference[] = [
      { id: "guest-1", displayName: "Ada", status: "active" },
      { id: "guest-2", displayName: "Bo", status: "inactive" },
    ];
    expect(
      participantReferenceWarnings(
        ["guest-1", "guest-2", "missing"],
        participants,
      ).map((entry) => entry.kind),
    ).toEqual(["inactive", "missing"]);
  });

  it("publishes a draft with a revision increment and duplicates to a clean draft", () => {
    const draft = createDraftRecord(validValues(), {
      id: "castle-cup",
      uid: "admin",
      now: 100,
    });
    const published = publishDraftRecord(draft, "admin", 200, 300);
    const duplicate = duplicateCompetitionRecord(
      published,
      { id: "castle-cup-copy", uid: "admin", now: 300 },
      ["Castle Cup Copy"],
    );
    expect(published).toEqual(
      expect.objectContaining({
        status: "scheduled",
        revision: 2,
        displayOrder: 300,
      }),
    );
    expect(duplicate).toEqual(
      expect.objectContaining({
        id: "castle-cup-copy",
        title: "Castle Cup Copy 2",
        status: "draft",
        revision: 1,
      }),
    );
  });

  it("sorts scheduled competitions deterministically", () => {
    const records = [
      scheduledRecord("later", 200, 100),
      scheduledRecord("zeta", 100, 200),
      scheduledRecord("alpha", 100, 200),
    ];
    expect(sortCompetitions(records).map((entry) => entry.id)).toEqual([
      "alpha",
      "zeta",
      "later",
    ]);
  });

  it("keeps archived competitions out of the public scheduled selector", () => {
    const scheduled = scheduledRecord("scheduled", 100, 200);
    const archived = {
      ...scheduledRecord("archived", 200, 300),
      status: "archived" as const,
    };
    expect([scheduled, archived].filter(isScheduledCompetition)).toEqual([
      scheduled,
    ]);
  });

  it("detects stale revisions without consulting Firebase", () => {
    expect(hasRevisionConflict(4, 5)).toBe(true);
    expect(hasRevisionConflict(5, 5)).toBe(false);
  });

  it("accepts valid records and rejects malformed or unexpected data", () => {
    const valid = scheduledRecord("castle-cup", 100, 200);
    expect(parseCompetitionRecord(valid)).toEqual(valid);
    expect(parseCompetitionRecord({ ...valid, status: "live" })).toBeNull();
    expect(parseCompetitionRecord({ ...valid, extra: "field" })).toBeNull();
    expect(
      parseCompetitionRecord({
        ...valid,
        participantIds: ["guest-1", "guest-1"],
      }),
    ).toBeNull();
    expect(parseCompetitionRecord({ ...valid, schemaVersion: 2 })).toBeNull();
    expect(
      parseCompetitionRecord({ ...valid, displayOrder: Number.NaN }),
    ).toBeNull();
    expect(parseCompetitionRecord({ ...valid, publishedByUid: "" })).toBeNull();
    expect(parseCompetitionRecord({ ...valid, revision: 1 })).toBeNull();
  });

  it("rejects an automatic group record that does not persist its recommendation", () => {
    const values = createCompetitionFormValues("group-knockout");
    values.title = "Group Cup";
    values.gameName = "Cards";
    values.participantIds = participantIds;
    const draft = createDraftRecord(values, {
      id: "group-cup",
      uid: "admin",
      now: 100,
    });
    expect(parseCompetitionRecord(draft)).toEqual(draft);
    expect(
      parseCompetitionRecord({
        ...draft,
        formatConfig: { ...draft.formatConfig, groupCount: 3 },
      }),
    ).toBeNull();
  });

  it("normalizes omitted empty draft collections from Realtime Database", () => {
    const draft = createDraftRecord(createCompetitionFormValues(), {
      id: "empty-draft",
      uid: "admin",
      now: 100,
    });
    const raw = { ...draft } as Partial<typeof draft>;
    delete raw.participantIds;
    expect(parseCompetitionRecord(raw)).toEqual(draft);

    const allHands = createCompetitionFormValues("all-hands");
    allHands.title = "Table Cup";
    allHands.gameName = "Cards";
    const allHandsDraft = createDraftRecord(allHands, {
      id: "all-hands-draft",
      uid: "admin",
      now: 100,
    });
    const rawAllHands = structuredClone(allHandsDraft) as unknown as Record<
      string,
      unknown
    >;
    const format = rawAllHands.formatConfig as Record<string, unknown>;
    delete format.primaryMetricLabel;
    delete format.secondaryMetricLabel;
    const scoring = rawAllHands.scoringConfig as Record<string, unknown>;
    delete scoring.placementPoints;
    expect(parseCompetitionRecord(rawAllHands)).toEqual({
      ...allHandsDraft,
      scoringConfig: { ...allHandsDraft.scoringConfig, placementPoints: [] },
    });
  });

  it("reports malformed collection members without dropping valid records", () => {
    const valid = scheduledRecord("castle-cup", 100, 200);
    expect(
      parseCompetitionCollection({
        "castle-cup": valid,
        broken: { id: "broken" },
      }),
    ).toEqual({ records: [valid], invalidIds: ["broken"] });
  });
});
