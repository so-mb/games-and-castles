import { describe, expect, it } from "vitest";
import {
  parsePredictionLedgerSources,
  parseSpecialRevealPublicResolution,
  validateSpecialRevealConfig,
} from "./validation";

const config = {
  eventId: "event-neutral",
  opening: {
    title: "A special announcement is ready.",
    body: "Make one private prediction.",
    emojiKey: "sparkles" as const,
  },
  predictionPrompt: "Which option do you predict?",
  optionLabels: { "option-a": "Option A", "option-b": "Option B" },
  resolutionPayloads: {
    "option-a": {
      title: "Option A resolution",
      body: "Selected presentation.",
      emojiKey: "star" as const,
    },
    "option-b": {
      title: "Option B resolution",
      body: "Selected presentation.",
      emojiKey: "star" as const,
    },
  },
  correctPredictionPoints: 3,
};

describe("special reveal runtime validation", () => {
  it("accepts bounded neutral configuration and rejects unsafe markup", () => {
    expect(validateSpecialRevealConfig(config).valid).toBe(true);
    expect(
      validateSpecialRevealConfig({
        ...config,
        opening: { ...config.opening, body: "<script>unsafe</script>" },
      }).valid,
    ).toBe(false);
  });

  it("quarantines malformed public resolution aggregates", () => {
    expect(
      parseSpecialRevealPublicResolution({
        eventId: "event-neutral",
        correctOption: "option-a",
        correctOptionLabel: "Option A",
        title: "Option A resolution",
        body: "Selected presentation.",
        emojiKey: "star",
        aggregate: { optionA: 2, optionB: 1, total: 9 },
        correctPredictionPoints: 3,
        resolvedAt: 10,
        resolutionRevision: 1,
        schemaVersion: 1,
      }),
    ).toBeNull();
  });

  it("accepts deterministic prediction ledger sources and rejects count drift", () => {
    const source = {
      meta: {
        eventId: "event-neutral",
        status: "resolved",
        stateRevision: 3,
        resolutionRevision: 1,
        sourceFingerprint: "0123456789abcdef0123456789abcdef",
        generatedAt: 10,
        generatedByUid: "admin",
        entryCount: 1,
        schemaVersion: 1,
      },
      entries: {
        entry: {
          id: "entry",
          participantId: "participant-a",
          sourceNamespace: "prediction",
          sourceId: "event-neutral",
          sourceEntityId: "prediction:event-neutral:participant-a",
          sourceType: "prediction-correct",
          points: 3,
          label: "Correct prediction",
          awardedAt: 10,
          sourceRevision: 1,
          schemaVersion: 1,
        },
      },
    };
    expect(
      parsePredictionLedgerSources({ "event-neutral": source }).sources,
    ).toHaveLength(1);
    expect(
      parsePredictionLedgerSources({
        "event-neutral": { ...source, meta: { ...source.meta, entryCount: 2 } },
      }).invalidIds,
    ).toEqual(["event-neutral"]);
  });
});
