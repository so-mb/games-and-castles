export const predictionOptions = ["option-a", "option-b"] as const;

export type PredictionOption = (typeof predictionOptions)[number];
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
  optionLabels: Record<PredictionOption, string>;
  resolutionPayloads: Record<PredictionOption, RevealPayloadInput>;
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
  optionLabels: Record<PredictionOption, string>;
  publishedAt: number;
  openRevision: number;
  schemaVersion: 1;
}

export interface PredictionAggregate {
  optionA: number;
  optionB: number;
  total: number;
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
