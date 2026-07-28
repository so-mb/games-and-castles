import { randomBytes } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  buildPredictionResolution,
  createScryptVerifier,
  parsePrivateConfig,
  predictionEntryId,
  verifyProtectedCode,
  type PrivateConfig,
} from "./domain.js";

const config: PrivateConfig = {
  eventId: "event-neutral",
  opening: {
    title: "A special announcement is ready.",
    body: "Make one private prediction.",
    emojiKey: "sparkles",
  },
  predictionPrompt: "Which option do you predict?",
  optionLabels: { "option-a": "Option A", "option-b": "Option B" },
  resolutionPayloads: {
    "option-a": {
      title: "Option A resolution",
      body: "Selected payload.",
      emojiKey: "star",
    },
    "option-b": {
      title: "Option B resolution",
      body: "Selected payload.",
      emojiKey: "star",
    },
  },
  correctPredictionPoints: 3,
  createdAt: 1,
  createdByUid: "admin",
  updatedAt: 1,
  updatedByUid: "admin",
  revision: 1,
  schemaVersion: 1,
};

describe("special reveal protected domain", () => {
  it("validates neutral private configuration", () => {
    expect(parsePrivateConfig(config)).toEqual(config);
    expect(
      parsePrivateConfig({ ...config, correctPredictionPoints: 101 }),
    ).toBeNull();
  });

  it("verifies a versioned scrypt value with a timing-safe derived comparison", async () => {
    const candidate = randomBytes(18).toString("base64url");
    const verifier = await createScryptVerifier(candidate);
    expect(verifier.startsWith("scrypt$v1$")).toBe(true);
    await expect(verifyProtectedCode(candidate, verifier)).resolves.toBe(true);
    await expect(
      verifyProtectedCode(`${candidate}-invalid`, verifier),
    ).resolves.toBe(false);
  });

  it("publishes only the selected resolution and deterministic correct awards", () => {
    const result = buildPredictionResolution({
      config,
      stateRevision: 3,
      resolutionRevision: 1,
      correctOption: "option-a",
      predictions: [
        {
          ownerUid: "uid-a",
          participantId: "participant-a",
          predictionId: "prediction-a",
          selection: "option-a",
          status: "submitted",
          createdAt: 1,
          updatedAt: 1,
          revision: 1,
          schemaVersion: 1,
        },
        {
          ownerUid: "uid-b",
          participantId: "participant-b",
          predictionId: "prediction-b",
          selection: "option-b",
          status: "submitted",
          createdAt: 1,
          updatedAt: 1,
          revision: 1,
          schemaVersion: 1,
        },
      ],
      participants: {
        "participant-a": { ownerUid: "uid-a", status: "active" },
        "participant-b": { ownerUid: "uid-b", status: "active" },
      },
      profiles: {
        "uid-a": { participantId: "participant-a" },
        "uid-b": { participantId: "participant-b" },
      },
      resolvedAt: 100,
      generatedAt: 100,
      actorUid: "admin",
    });
    expect(result.publicResolution).toMatchObject({
      correctOption: "option-a",
      title: "Option A resolution",
      aggregate: { optionA: 1, optionB: 1, total: 2 },
    });
    expect(JSON.stringify(result.publicResolution)).not.toContain(
      "Option B resolution",
    );
    expect(Object.keys(result.source.entries)).toEqual([
      predictionEntryId("event-neutral", "participant-a"),
    ]);
  });

  it("excludes withdrawn, inactive, and unlinked submissions", () => {
    const result = buildPredictionResolution({
      config,
      stateRevision: 4,
      resolutionRevision: 2,
      correctOption: "option-b",
      predictions: [
        {
          ownerUid: "uid-a",
          participantId: "participant-a",
          predictionId: "prediction-a",
          selection: "option-b",
          status: "withdrawn",
          createdAt: 1,
          updatedAt: 2,
          revision: 2,
          schemaVersion: 1,
        },
      ],
      participants: {
        "participant-a": { ownerUid: "uid-a", status: "inactive" },
      },
      profiles: { "uid-a": { participantId: "participant-a" } },
      resolvedAt: 200,
      generatedAt: 200,
      actorUid: "admin",
    });
    expect(result.publicResolution.aggregate.total).toBe(0);
    expect(result.source.entries).toEqual({});
  });
});
