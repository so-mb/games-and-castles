import type {
  PredictionLedgerSnapshot,
  PredictionOption,
  SpecialRevealPrediction,
  SpecialRevealPrivateConfig,
  SpecialRevealPublicResolution,
} from "./types.ts";

type ObjectValue = Record<string, unknown>;

function object(value: unknown): ObjectValue | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as ObjectValue)
    : null;
}

export function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object") {
    const item = value as Record<string, unknown>;
    return `{${Object.keys(item)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonical(item[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

// A stable 128-bit content identifier, not an authentication primitive.
export function stableFingerprint(value: unknown) {
  const input = canonical(value);
  let h1 = 0xdeadbeef ^ input.length;
  let h2 = 0x41c6ce57 ^ input.length;
  let h3 = 0xc0decafe ^ input.length;
  let h4 = 0x9e3779b9 ^ input.length;
  for (let index = 0; index < input.length; index += 1) {
    const character = input.charCodeAt(index);
    h1 = Math.imul(h1 ^ character, 2654435761);
    h2 = Math.imul(h2 ^ character, 1597334677);
    h3 = Math.imul(h3 ^ character, 2246822507);
    h4 = Math.imul(h4 ^ character, 3266489909);
  }
  h1 =
    Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^
    Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 =
    Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^
    Math.imul(h3 ^ (h3 >>> 13), 3266489909);
  h3 =
    Math.imul(h3 ^ (h3 >>> 16), 2246822507) ^
    Math.imul(h4 ^ (h4 >>> 13), 3266489909);
  h4 =
    Math.imul(h4 ^ (h4 >>> 16), 2246822507) ^
    Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return [h1, h2, h3, h4]
    .map((hash) => (hash >>> 0).toString(16).padStart(8, "0"))
    .join("");
}

export function predictionEntryId(eventId: string, participantId: string) {
  return stableFingerprint(`prediction:${eventId}:${participantId}`);
}

export function buildPredictionResolution(input: {
  config: SpecialRevealPrivateConfig;
  stateRevision: number;
  resolutionRevision: number;
  correctOption: PredictionOption;
  predictions: SpecialRevealPrediction[];
  participants: Record<string, unknown>;
  profiles: Record<string, unknown>;
  resolvedAt: number;
  generatedAt: number;
}) {
  const valid = input.predictions.filter((prediction) => {
    if (prediction.status !== "submitted") return false;
    const participant = object(input.participants[prediction.participantId]);
    const profile = object(input.profiles[prediction.ownerUid]);
    return Boolean(
      participant &&
      profile &&
      participant.status === "active" &&
      participant.ownerUid === prediction.ownerUid &&
      profile.participantId === prediction.participantId,
    );
  });
  const aggregate = {
    optionA: valid.filter((prediction) => prediction.selection === "option-a")
      .length,
    optionB: valid.filter((prediction) => prediction.selection === "option-b")
      .length,
    total: valid.length,
  };
  const selected = input.config.resolutionPayloads[input.correctOption];
  const publicResolution: SpecialRevealPublicResolution = {
    eventId: input.config.eventId,
    correctOption: input.correctOption,
    correctOptionLabel: input.config.optionLabels[input.correctOption],
    title: selected.title,
    body: selected.body,
    emojiKey: selected.emojiKey,
    aggregate,
    correctPredictionPoints: input.config.correctPredictionPoints,
    resolvedAt: input.resolvedAt,
    resolutionRevision: input.resolutionRevision,
    schemaVersion: 1,
  };
  const entries = Object.fromEntries(
    valid
      .filter((prediction) => prediction.selection === input.correctOption)
      .sort((left, right) =>
        left.participantId.localeCompare(right.participantId),
      )
      .map((prediction) => {
        const id = predictionEntryId(
          input.config.eventId,
          prediction.participantId,
        );
        return [
          id,
          {
            id,
            participantId: prediction.participantId,
            sourceNamespace: "prediction" as const,
            sourceId: input.config.eventId,
            sourceEntityId: `prediction:${input.config.eventId}:${prediction.participantId}`,
            sourceType: "prediction-correct" as const,
            points: input.config.correctPredictionPoints,
            label: "Correct prediction",
            awardedAt: input.resolvedAt,
            sourceRevision: input.resolutionRevision,
            schemaVersion: 1 as const,
          },
        ];
      }),
  );
  const sourceFingerprint = stableFingerprint({
    eventId: input.config.eventId,
    stateRevision: input.stateRevision,
    resolutionRevision: input.resolutionRevision,
    correctOption: input.correctOption,
    entries,
  });
  const source: PredictionLedgerSnapshot = {
    meta: {
      eventId: input.config.eventId,
      status: "resolved",
      stateRevision: input.stateRevision,
      resolutionRevision: input.resolutionRevision,
      sourceFingerprint,
      generatedAt: input.generatedAt,
      entryCount: Object.keys(entries).length,
      schemaVersion: 1,
    },
    entries,
  };
  return { publicResolution, source, validPredictions: valid };
}

export function predictionSourcesMatch(
  current: PredictionLedgerSnapshot | null,
  expected: PredictionLedgerSnapshot,
) {
  return Boolean(
    current &&
    current.meta.eventId === expected.meta.eventId &&
    current.meta.status === expected.meta.status &&
    current.meta.stateRevision === expected.meta.stateRevision &&
    current.meta.resolutionRevision === expected.meta.resolutionRevision &&
    current.meta.sourceFingerprint === expected.meta.sourceFingerprint &&
    current.meta.entryCount === expected.meta.entryCount &&
    canonical(current.entries) === canonical(expected.entries),
  );
}
