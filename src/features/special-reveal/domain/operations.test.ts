import { describe, expect, it } from "vitest";
import {
  buildCorrectRevealMutation,
  buildOpenRevealMutation,
  buildReconcilePredictionMutation,
  buildResolveRevealMutation,
} from "./operations";
import {
  buildPredictionResolution,
  predictionEntryId,
  predictionSourcesMatch,
} from "./resolution";
import type {
  PredictionOption,
  SpecialRevealPrediction,
  SpecialRevealPrivateConfig,
  SpecialRevealPublicState,
} from "./types";

const now = 1_800_000_000_000;

const config: SpecialRevealPrivateConfig = {
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
      body: "Selected presentation.",
      emojiKey: "star",
    },
    "option-b": {
      title: "Option B resolution",
      body: "Alternative presentation.",
      emojiKey: "castle",
    },
  },
  correctPredictionPoints: 4,
  createdAt: now - 1000,
  createdByUid: "reveal-admin",
  updatedAt: now - 1000,
  updatedByUid: "reveal-admin",
  revision: 1,
  schemaVersion: 1,
};

const lockedState: SpecialRevealPublicState = {
  eventId: config.eventId,
  status: "prediction-locked",
  openedAt: now - 500,
  lockedAt: now - 100,
  resolvedAt: null,
  openRevision: 1,
  resolutionRevision: 0,
  revision: 2,
  schemaVersion: 1,
};

function prediction(
  ownerUid: string,
  participantId: string,
  selection: PredictionOption,
  status: "submitted" | "withdrawn" = "submitted",
): SpecialRevealPrediction {
  return {
    ownerUid,
    participantId,
    predictionId: `${participantId}-prediction`,
    selection,
    status,
    createdAt: now - 400,
    updatedAt: now - 200,
    revision: status === "submitted" ? 1 : 2,
    schemaVersion: 1,
  };
}

const predictions = [
  prediction("owner-a", "participant-a", "option-a"),
  prediction("owner-b", "participant-b", "option-b"),
  prediction("owner-c", "participant-c", "option-a", "withdrawn"),
  prediction("owner-invalid", "participant-invalid", "option-a"),
];
const participants = {
  "participant-a": { ownerUid: "owner-a", status: "active" },
  "participant-b": { ownerUid: "owner-b", status: "active" },
  "participant-c": { ownerUid: "owner-c", status: "active" },
  "participant-invalid": { ownerUid: "different-owner", status: "active" },
};
const profiles = {
  "owner-a": { participantId: "participant-a" },
  "owner-b": { participantId: "participant-b" },
  "owner-c": { participantId: "participant-c" },
  "owner-invalid": { participantId: "participant-invalid" },
};

function derive(correctOption: PredictionOption) {
  return buildPredictionResolution({
    config,
    stateRevision: 3,
    resolutionRevision: 1,
    correctOption,
    predictions,
    participants,
    profiles,
    resolvedAt: now,
    generatedAt: now,
  });
}

describe("browser-first Special Reveal domain", () => {
  it("derives aggregates while excluding withdrawn and invalid predictions", () => {
    const result = derive("option-a");
    expect(result.publicResolution.aggregate).toEqual({
      optionA: 1,
      optionB: 1,
      total: 2,
    });
    expect(result.validPredictions).toHaveLength(2);
  });

  it("awards only correct predictors using configured points", () => {
    const result = derive("option-a");
    expect(Object.values(result.source.entries)).toEqual([
      expect.objectContaining({
        participantId: "participant-a",
        points: 4,
        sourceType: "prediction-correct",
      }),
    ]);
    expect(
      JSON.stringify({
        publicResolution: result.publicResolution,
        source: result.source,
      }),
    ).not.toContain("owner-a");
  });

  it("creates deterministic entry IDs and fingerprints", () => {
    expect(predictionEntryId(config.eventId, "participant-a")).toMatch(
      /^[0-9a-f]{32}$/,
    );
    expect(derive("option-a")).toEqual(derive("option-a"));
    expect(derive("option-a").source.meta.sourceFingerprint).not.toBe(
      derive("option-b").source.meta.sourceFingerprint,
    );
  });

  it("publishes an opening without either private resolution", () => {
    const mutation = buildOpenRevealMutation({
      config,
      state: null,
      expectedConfigRevision: 1,
      actorUid: "reveal-admin",
      auditId: "audit-open",
      now,
    });
    const published = JSON.stringify(mutation.updates);
    expect(published).toContain(config.opening.title);
    expect(published).not.toContain(config.resolutionPayloads["option-a"].body);
    expect(published).not.toContain(config.resolutionPayloads["option-b"].body);
    expect(published.match(/reveal-admin/g)).toHaveLength(1);
  });

  it("resolves with one full atomic source and is deterministic", () => {
    const mutation = buildResolveRevealMutation({
      config,
      state: lockedState,
      predictions,
      participants,
      profiles,
      correctOption: "option-a",
      expectedStateRevision: 2,
      expectedConfigRevision: 1,
      actorUid: "reveal-admin",
      auditId: "audit-resolve",
      now,
    });
    expect(Object.keys(mutation.updates ?? {})).toEqual(
      expect.arrayContaining([
        "specialReveal/publicResolution",
        "specialReveal/publicState",
        "championshipLedger/predictionSources/event-neutral",
        "audit/audit-resolve",
      ]),
    );
    expect(mutation.result).toEqual({
      applied: true,
      stateRevision: 3,
      resolutionRevision: 1,
    });
  });

  it("correction replaces the complete source and increments revisions", () => {
    const first = derive("option-a");
    const resolvedState: SpecialRevealPublicState = {
      ...lockedState,
      status: "resolved",
      resolvedAt: now,
      revision: 3,
      resolutionRevision: 1,
    };
    const correction = buildCorrectRevealMutation({
      config,
      state: resolvedState,
      currentResolution: first.publicResolution,
      predictions,
      participants,
      profiles,
      correctOption: "option-b",
      expectedStateRevision: 3,
      expectedResolutionRevision: 1,
      actorUid: "reveal-admin",
      auditId: "audit-correct",
      now: now + 100,
    });
    const replacement = correction.updates?.[
      "championshipLedger/predictionSources/event-neutral"
    ] as ReturnType<typeof derive>["source"];
    expect(correction.result).toEqual({
      applied: true,
      stateRevision: 4,
      resolutionRevision: 2,
    });
    expect(Object.values(replacement.entries)).toEqual([
      expect.objectContaining({ participantId: "participant-b" }),
    ]);
  });

  it("repairs a damaged source once and then reconciles idempotently", () => {
    const derived = derive("option-a");
    const resolvedState: SpecialRevealPublicState = {
      ...lockedState,
      status: "resolved",
      resolvedAt: now,
      revision: 3,
      resolutionRevision: 1,
    };
    const input = {
      config,
      state: resolvedState,
      resolution: derived.publicResolution,
      predictions,
      participants,
      profiles,
      expectedStateRevision: 3,
      actorUid: "reveal-admin",
      auditId: "audit-reconcile",
      now: now + 100,
    };
    const repair = buildReconcilePredictionMutation({
      ...input,
      currentSource: null,
    });
    const expected = repair.updates?.[
      "championshipLedger/predictionSources/event-neutral"
    ] as ReturnType<typeof derive>["source"];
    expect(repair.result.applied).toBe(true);
    expect(predictionSourcesMatch(expected, expected)).toBe(true);
    expect(
      buildReconcilePredictionMutation({
        ...input,
        currentSource: expected,
      }),
    ).toMatchObject({ result: { applied: false }, updates: null });
  });
});
