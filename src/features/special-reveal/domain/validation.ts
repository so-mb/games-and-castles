import {
  predictionOptions,
  revealEmojiKeys,
  type PredictionLedgerSnapshot,
  type PredictionOption,
  type PredictionReceipt,
  type RevealPayloadInput,
  type SpecialRevealConfigInput,
  type SpecialRevealPrediction,
  type SpecialRevealPrivateConfig,
  type SpecialRevealPublicOpening,
  type SpecialRevealPublicResolution,
  type SpecialRevealPublicState,
} from "./types";

type ObjectValue = Record<string, unknown>;

function object(value: unknown): ObjectValue | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as ObjectValue)
    : null;
}

function exactKeys(
  value: ObjectValue,
  required: string[],
  optional: string[] = [],
) {
  const allowed = new Set([...required, ...optional]);
  return (
    required.every((key) => Object.hasOwn(value, key)) &&
    Object.keys(value).every((key) => allowed.has(key))
  );
}

function string(value: unknown, min: number, max: number) {
  return (
    typeof value === "string" && value.length >= min && value.length <= max
  );
}

function integer(value: unknown, min = 0, max = Number.MAX_SAFE_INTEGER) {
  return (
    Number.isInteger(value) && Number(value) >= min && Number(value) <= max
  );
}

function plain(value: string) {
  return (
    !/[<>]/.test(value) &&
    ![...value].some((character) => {
      const code = character.charCodeAt(0);
      return code < 32 || code === 127;
    })
  );
}

function option(value: unknown): value is PredictionOption {
  return predictionOptions.includes(value as PredictionOption);
}

function emoji(value: unknown) {
  return revealEmojiKeys.includes(value as (typeof revealEmojiKeys)[number]);
}

function parsePayload(value: unknown): RevealPayloadInput | null {
  const item = object(value);
  if (
    !item ||
    !exactKeys(item, ["title", "body", "emojiKey"]) ||
    !string(item.title, 1, 100) ||
    !plain(item.title as string) ||
    !string(item.body, 1, 1500) ||
    !plain(item.body as string) ||
    !emoji(item.emojiKey)
  ) {
    return null;
  }
  return item as unknown as RevealPayloadInput;
}

export function validateSpecialRevealConfig(input: SpecialRevealConfigInput) {
  const normalized: SpecialRevealConfigInput = {
    eventId: input.eventId.trim(),
    opening: {
      title: input.opening.title.trim(),
      body: input.opening.body.trim(),
      emojiKey: input.opening.emojiKey,
    },
    predictionPrompt: input.predictionPrompt.trim(),
    optionLabels: {
      "option-a": input.optionLabels["option-a"].trim(),
      "option-b": input.optionLabels["option-b"].trim(),
    },
    resolutionPayloads: {
      "option-a": {
        ...input.resolutionPayloads["option-a"],
        title: input.resolutionPayloads["option-a"].title.trim(),
        body: input.resolutionPayloads["option-a"].body.trim(),
      },
      "option-b": {
        ...input.resolutionPayloads["option-b"],
        title: input.resolutionPayloads["option-b"].title.trim(),
        body: input.resolutionPayloads["option-b"].body.trim(),
      },
    },
    correctPredictionPoints: input.correctPredictionPoints,
  };
  const errors: string[] = [];
  if (!/^[A-Za-z0-9_-]{1,80}$/.test(normalized.eventId))
    errors.push(
      "Use an opaque event ID with letters, numbers, dashes, or underscores.",
    );
  if (!parsePayload(normalized.opening))
    errors.push("Check the opening title and body.");
  if (
    !string(normalized.predictionPrompt, 1, 180) ||
    !plain(normalized.predictionPrompt)
  )
    errors.push("Enter a plain-text prediction prompt of 1–180 characters.");
  predictionOptions.forEach((key) => {
    if (
      !string(normalized.optionLabels[key], 1, 50) ||
      !plain(normalized.optionLabels[key])
    )
      errors.push(`${key} needs a plain-text label of 1–50 characters.`);
    if (!parsePayload(normalized.resolutionPayloads[key]))
      errors.push(`${key} needs a valid resolution presentation.`);
  });
  if (!integer(normalized.correctPredictionPoints, 1, 100))
    errors.push("Prediction points must be a whole number from 1–100.");
  return { valid: errors.length === 0, errors, value: normalized };
}

export function parseSpecialRevealPrivateConfig(
  value: unknown,
): SpecialRevealPrivateConfig | null {
  const item = object(value);
  if (!item) return null;
  const opening = parsePayload(item.opening);
  const resolutions = object(item.resolutionPayloads);
  const labels = object(item.optionLabels);
  if (!opening || !resolutions || !labels) return null;
  const optionAResolution = parsePayload(resolutions["option-a"]);
  const optionBResolution = parsePayload(resolutions["option-b"]);
  if (!optionAResolution || !optionBResolution) return null;
  const candidate = {
    eventId: item.eventId,
    opening,
    predictionPrompt: item.predictionPrompt,
    optionLabels: labels,
    resolutionPayloads: {
      "option-a": optionAResolution,
      "option-b": optionBResolution,
    },
    correctPredictionPoints: item.correctPredictionPoints,
  } as unknown as SpecialRevealConfigInput;
  const result = validateSpecialRevealConfig(candidate);
  if (
    !result.valid ||
    !integer(item.createdAt) ||
    !string(item.createdByUid, 1, 128) ||
    !integer(item.updatedAt) ||
    !string(item.updatedByUid, 1, 128) ||
    !integer(item.revision, 1) ||
    item.schemaVersion !== 1
  )
    return null;
  return item as unknown as SpecialRevealPrivateConfig;
}

export function parseSpecialRevealPublicState(
  value: unknown,
): SpecialRevealPublicState | null {
  const item = object(value);
  if (!item) return null;
  if (
    !string(item.eventId, 1, 80) ||
    !["prediction-open", "prediction-locked", "resolved"].includes(
      item.status as string,
    ) ||
    !integer(item.openedAt) ||
    !(item.lockedAt == null || integer(item.lockedAt)) ||
    !(item.resolvedAt == null || integer(item.resolvedAt)) ||
    !integer(item.openRevision, 1) ||
    !integer(item.resolutionRevision, 0) ||
    !integer(item.revision, 1) ||
    item.schemaVersion !== 1
  )
    return null;
  return {
    ...(item as unknown as SpecialRevealPublicState),
    lockedAt: (item.lockedAt as number | null | undefined) ?? null,
    resolvedAt: (item.resolvedAt as number | null | undefined) ?? null,
  };
}

export function parseSpecialRevealPublicOpening(
  value: unknown,
): SpecialRevealPublicOpening | null {
  const item = object(value);
  const labels = object(item?.optionLabels);
  if (
    !item ||
    !labels ||
    !string(item.eventId, 1, 80) ||
    !string(item.title, 1, 100) ||
    !string(item.body, 1, 1500) ||
    !emoji(item.emojiKey) ||
    !string(item.predictionPrompt, 1, 180) ||
    !string(labels["option-a"], 1, 50) ||
    !string(labels["option-b"], 1, 50) ||
    !integer(item.publishedAt) ||
    !integer(item.openRevision, 1) ||
    item.schemaVersion !== 1
  )
    return null;
  return item as unknown as SpecialRevealPublicOpening;
}

export function parsePrediction(
  value: unknown,
): SpecialRevealPrediction | null {
  const item = object(value);
  if (
    !item ||
    !string(item.ownerUid, 1, 128) ||
    !string(item.participantId, 1, 128) ||
    !string(item.predictionId, 1, 80) ||
    !option(item.selection) ||
    !["submitted", "withdrawn"].includes(item.status as string) ||
    !integer(item.createdAt) ||
    !integer(item.updatedAt) ||
    !integer(item.revision, 1) ||
    item.schemaVersion !== 1
  )
    return null;
  return item as unknown as SpecialRevealPrediction;
}

export function parsePredictionReceipts(value: unknown) {
  const source = object(value) ?? {};
  const receipts: PredictionReceipt[] = [];
  const invalidIds: string[] = [];
  Object.entries(source).forEach(([id, raw]) => {
    const item = object(raw);
    if (
      item &&
      item.predictionId === id &&
      typeof item.active === "boolean" &&
      integer(item.updatedAt) &&
      item.schemaVersion === 1
    )
      receipts.push(item as unknown as PredictionReceipt);
    else invalidIds.push(id);
  });
  return { receipts, invalidIds };
}

export function parseSpecialRevealPublicResolution(
  value: unknown,
): SpecialRevealPublicResolution | null {
  const item = object(value);
  const aggregate = object(item?.aggregate);
  if (
    !item ||
    !aggregate ||
    !string(item.eventId, 1, 80) ||
    !option(item.correctOption) ||
    !string(item.correctOptionLabel, 1, 50) ||
    !string(item.title, 1, 100) ||
    !string(item.body, 1, 1500) ||
    !emoji(item.emojiKey) ||
    !integer(aggregate.optionA) ||
    !integer(aggregate.optionB) ||
    !integer(aggregate.total) ||
    Number(aggregate.total) !==
      Number(aggregate.optionA) + Number(aggregate.optionB) ||
    !integer(item.correctPredictionPoints, 1, 100) ||
    !integer(item.resolvedAt) ||
    !integer(item.resolutionRevision, 1) ||
    item.schemaVersion !== 1
  )
    return null;
  return item as unknown as SpecialRevealPublicResolution;
}

export function parsePredictionLedgerSources(value: unknown) {
  const source = object(value) ?? {};
  const sources: PredictionLedgerSnapshot[] = [];
  const invalidIds: string[] = [];
  Object.entries(source).forEach(([eventId, raw]) => {
    const item = object(raw);
    const meta = object(item?.meta);
    const entries = object(item?.entries) ?? {};
    const entriesValid = Object.entries(entries).every(([id, entryRaw]) => {
      const entry = object(entryRaw);
      return Boolean(
        entry &&
        entry.id === id &&
        string(entry.participantId, 1, 128) &&
        entry.sourceNamespace === "prediction" &&
        entry.sourceId === eventId &&
        string(entry.sourceEntityId, 1, 160) &&
        entry.sourceType === "prediction-correct" &&
        integer(entry.points, 1, 100) &&
        string(entry.label, 1, 120) &&
        integer(entry.awardedAt) &&
        integer(entry.sourceRevision, 1) &&
        entry.schemaVersion === 1,
      );
    });
    if (
      item &&
      meta &&
      entriesValid &&
      meta.eventId === eventId &&
      meta.status === "resolved" &&
      integer(meta.stateRevision, 1) &&
      integer(meta.resolutionRevision, 1) &&
      string(meta.sourceFingerprint, 16, 64) &&
      integer(meta.generatedAt) &&
      string(meta.generatedByUid, 1, 128) &&
      integer(meta.entryCount) &&
      Number(meta.entryCount) === Object.keys(entries).length &&
      meta.schemaVersion === 1
    )
      sources.push(item as unknown as PredictionLedgerSnapshot);
    else invalidIds.push(eventId);
  });
  return { sources, invalidIds };
}
