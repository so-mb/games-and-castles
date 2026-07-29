export const predictionOptions = [
  "option-a",
  "option-b",
  "option-c",
  "option-d",
  "option-e",
  "option-f",
  "option-g",
  "option-h",
] as const;

export type PredictionOption = (typeof predictionOptions)[number];
export type PredictionOptionLabels = Partial<Record<PredictionOption, string>>;
export type PredictionResolutionPayloads = Partial<
  Record<PredictionOption, RevealPayloadInput>
>;
export const minimumPredictionOptionCount = 2;
export const maximumPredictionOptionCount = predictionOptions.length;

export const predictionAggregateKeys = {
  "option-a": "optionA",
  "option-b": "optionB",
  "option-c": "optionC",
  "option-d": "optionD",
  "option-e": "optionE",
  "option-f": "optionF",
  "option-g": "optionG",
  "option-h": "optionH",
} as const satisfies Record<PredictionOption, string>;

export function configuredPredictionOptions(labels: PredictionOptionLabels) {
  return predictionOptions.filter((option) => Object.hasOwn(labels, option));
}

export function predictionOptionName(option: PredictionOption) {
  return `Option ${option.slice(-1).toUpperCase()}`;
}
export type PredictionEventStatus =
  "prediction-open" | "prediction-locked" | "resolved";

export const revealEmojiKeys = [
  "sparkles",
  "star",
  "crown",
  "castle",
  "confetti",
] as const;

export type RevealEmojiKey = (typeof revealEmojiKeys)[number];

export interface RevealPayloadInput {
  title: string;
  body: string;
  emojiKey: RevealEmojiKey;
}

export interface SpecialRevealConfigInput {
  eventId: string;
  opening: RevealPayloadInput;
  predictionPrompt: string;
  optionLabels: PredictionOptionLabels;
  resolutionPayloads: PredictionResolutionPayloads;
  correctPredictionPoints: number;
}

export interface SpecialRevealPrivateConfig extends SpecialRevealConfigInput {
  createdAt: number;
  createdByUid: string;
  updatedAt: number;
  updatedByUid: string;
  revision: number;
  schemaVersion: 1;
}

export interface SpecialRevealPublicState {
  eventId: string;
  status: PredictionEventStatus;
  openedAt: number;
  lockedAt: number | null;
  resolvedAt: number | null;
  openRevision: number;
  resolutionRevision: number;
  revision: number;
  schemaVersion: 1;
}

export interface SpecialRevealPublicOpening {
  eventId: string;
  title: string;
  body: string;
  emojiKey: RevealEmojiKey;
  predictionPrompt: string;
  optionLabels: PredictionOptionLabels;
  publishedAt: number;
  openRevision: number;
  schemaVersion: 1;
}

export interface PredictionAggregate {
  optionA: number;
  optionB: number;
  optionC?: number;
  optionD?: number;
  optionE?: number;
  optionF?: number;
  optionG?: number;
  optionH?: number;
  total: number;
}

export function predictionAggregateCount(
  aggregate: PredictionAggregate,
  option: PredictionOption,
) {
  return aggregate[predictionAggregateKeys[option]] ?? 0;
}

export interface SpecialRevealPublicResolution {
  eventId: string;
  correctOption: PredictionOption;
  correctOptionLabel: string;
  title: string;
  body: string;
  emojiKey: RevealEmojiKey;
  aggregate: PredictionAggregate;
  correctPredictionPoints: number;
  resolvedAt: number;
  resolutionRevision: number;
  schemaVersion: 1;
}

export interface SpecialRevealPrediction {
  ownerUid: string;
  participantId: string;
  predictionId: string;
  selection: PredictionOption;
  status: "submitted" | "withdrawn";
  createdAt: number;
  updatedAt: number;
  revision: number;
  schemaVersion: 1;
}

export interface PredictionReceipt {
  predictionId: string;
  active: boolean;
  updatedAt: number;
  schemaVersion: 1;
}

export interface PredictionLedgerEntry {
  id: string;
  participantId: string;
  sourceNamespace: "prediction";
  sourceId: string;
  sourceEntityId: string;
  sourceType: "prediction-correct";
  points: number;
  label: string;
  awardedAt: number;
  sourceRevision: number;
  schemaVersion: 1;
}

export interface PredictionLedgerSnapshot {
  meta: {
    eventId: string;
    status: "resolved";
    stateRevision: number;
    resolutionRevision: number;
    sourceFingerprint: string;
    generatedAt: number;
    entryCount: number;
    schemaVersion: 1;
  };
  entries: Record<string, PredictionLedgerEntry>;
}

export interface RevealOperationResult {
  applied: boolean;
  stateRevision: number;
  resolutionRevision?: number;
}
