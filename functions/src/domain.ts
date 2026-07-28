import { createHash, randomBytes, scrypt, timingSafeEqual } from "node:crypto";

function deriveScrypt(
  code: string,
  salt: Buffer,
  length: number,
  options: { N: number; r: number; p: number; maxmem: number },
) {
  return new Promise<Buffer>((resolve, reject) => {
    scrypt(code, salt, length, options, (error, derived) =>
      error ? reject(error) : resolve(derived),
    );
  });
}

export const predictionOptions = ["option-a", "option-b"] as const;
export type PredictionOption = (typeof predictionOptions)[number];

export interface RevealPayload {
  title: string;
  body: string;
  emojiKey: "sparkles" | "star" | "crown" | "castle" | "confetti";
}

export interface PrivateConfig {
  eventId: string;
  opening: RevealPayload;
  predictionPrompt: string;
  optionLabels: Record<PredictionOption, string>;
  resolutionPayloads: Record<PredictionOption, RevealPayload>;
  correctPredictionPoints: number;
  createdAt: number;
  createdByUid: string;
  updatedAt: number;
  updatedByUid: string;
  revision: number;
  schemaVersion: 1;
}

export interface PublicState {
  eventId: string;
  status: "prediction-open" | "prediction-locked" | "resolved";
  openedAt: number;
  lockedAt?: number;
  resolvedAt?: number;
  openRevision: number;
  resolutionRevision: number;
  revision: number;
  schemaVersion: 1;
}

export interface Prediction {
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

type ObjectValue = Record<string, unknown>;

function object(value: unknown): ObjectValue | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as ObjectValue)
    : null;
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

function payload(value: unknown): value is RevealPayload {
  const item = object(value);
  return Boolean(
    item &&
    string(item.title, 1, 100) &&
    plain(item.title as string) &&
    string(item.body, 1, 1500) &&
    plain(item.body as string) &&
    ["sparkles", "star", "crown", "castle", "confetti"].includes(
      item.emojiKey as string,
    ),
  );
}

export function parsePrivateConfig(value: unknown): PrivateConfig | null {
  const item = object(value);
  const labels = object(item?.optionLabels);
  const resolutions = object(item?.resolutionPayloads);
  if (
    !item ||
    !labels ||
    !resolutions ||
    !string(item.eventId, 1, 80) ||
    !/^[A-Za-z0-9_-]+$/.test(item.eventId as string) ||
    !payload(item.opening) ||
    !string(item.predictionPrompt, 1, 180) ||
    !plain(item.predictionPrompt as string) ||
    !string(labels["option-a"], 1, 50) ||
    !plain(labels["option-a"] as string) ||
    !string(labels["option-b"], 1, 50) ||
    !plain(labels["option-b"] as string) ||
    !payload(resolutions["option-a"]) ||
    !payload(resolutions["option-b"]) ||
    !integer(item.correctPredictionPoints, 1, 100) ||
    !integer(item.createdAt) ||
    !string(item.createdByUid, 1, 128) ||
    !integer(item.updatedAt) ||
    !string(item.updatedByUid, 1, 128) ||
    !integer(item.revision, 1) ||
    item.schemaVersion !== 1
  )
    return null;
  return item as unknown as PrivateConfig;
}

export function parsePublicState(value: unknown): PublicState | null {
  const item = object(value);
  if (
    !item ||
    !string(item.eventId, 1, 80) ||
    !["prediction-open", "prediction-locked", "resolved"].includes(
      item.status as string,
    ) ||
    !integer(item.openedAt) ||
    !(item.lockedAt === undefined || integer(item.lockedAt)) ||
    !(item.resolvedAt === undefined || integer(item.resolvedAt)) ||
    !integer(item.openRevision, 1) ||
    !integer(item.resolutionRevision) ||
    !integer(item.revision, 1) ||
    item.schemaVersion !== 1
  )
    return null;
  return item as unknown as PublicState;
}

export function parsePrediction(value: unknown): Prediction | null {
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
  return item as unknown as Prediction;
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

export function fingerprint(value: unknown) {
  return createHash("sha256")
    .update(canonical(value))
    .digest("hex")
    .slice(0, 32);
}

export function predictionEntryId(eventId: string, participantId: string) {
  return createHash("sha256")
    .update(`prediction:${eventId}:${participantId}`)
    .digest("hex")
    .slice(0, 32);
}

export function buildPredictionResolution(input: {
  config: PrivateConfig;
  stateRevision: number;
  resolutionRevision: number;
  correctOption: PredictionOption;
  predictions: Prediction[];
  participants: Record<string, unknown>;
  profiles: Record<string, unknown>;
  resolvedAt: number;
  generatedAt: number;
  actorUid: string;
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
  const publicResolution = {
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
    schemaVersion: 1 as const,
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
            sourceNamespace: "prediction",
            sourceId: input.config.eventId,
            sourceEntityId: `prediction:${input.config.eventId}:${prediction.participantId}`,
            sourceType: "prediction-correct",
            points: input.config.correctPredictionPoints,
            label: "Correct prediction",
            awardedAt: input.resolvedAt,
            sourceRevision: input.resolutionRevision,
            schemaVersion: 1,
          },
        ];
      }),
  );
  const sourceFingerprint = fingerprint({
    eventId: input.config.eventId,
    stateRevision: input.stateRevision,
    resolutionRevision: input.resolutionRevision,
    correctOption: input.correctOption,
    entries,
  });
  return {
    publicResolution,
    source: {
      meta: {
        eventId: input.config.eventId,
        status: "resolved",
        stateRevision: input.stateRevision,
        resolutionRevision: input.resolutionRevision,
        sourceFingerprint,
        generatedAt: input.generatedAt,
        generatedByUid: input.actorUid,
        entryCount: Object.keys(entries).length,
        schemaVersion: 1,
      },
      entries,
    },
  };
}

export interface ScryptVerifier {
  cost: number;
  blockSize: number;
  parallelization: number;
  salt: Buffer;
  derived: Buffer;
}

export function parseScryptVerifier(value: string): ScryptVerifier | null {
  const [algorithm, version, parameters, salt, derived] = value.split("$");
  if (
    algorithm !== "scrypt" ||
    version !== "v1" ||
    !parameters ||
    !salt ||
    !derived
  )
    return null;
  const match = /^N=(\d+),r=(\d+),p=(\d+)$/.exec(parameters);
  if (!match) return null;
  const cost = Number(match[1]);
  const blockSize = Number(match[2]);
  const parallelization = Number(match[3]);
  if (
    !Number.isInteger(cost) ||
    cost < 16384 ||
    (cost & (cost - 1)) !== 0 ||
    !Number.isInteger(blockSize) ||
    blockSize < 1 ||
    blockSize > 32 ||
    !Number.isInteger(parallelization) ||
    parallelization < 1 ||
    parallelization > 16
  )
    return null;
  try {
    const parsed = {
      cost,
      blockSize,
      parallelization,
      salt: Buffer.from(salt, "base64url"),
      derived: Buffer.from(derived, "base64url"),
    };
    return parsed.salt.length >= 16 && parsed.derived.length >= 32
      ? parsed
      : null;
  } catch {
    return null;
  }
}

export async function verifyProtectedCode(code: string, verifierValue: string) {
  const verifier = parseScryptVerifier(verifierValue);
  if (
    !verifier ||
    typeof code !== "string" ||
    code.length < 1 ||
    code.length > 256
  )
    return false;
  const derived = await deriveScrypt(
    code,
    verifier.salt,
    verifier.derived.length,
    {
      N: verifier.cost,
      r: verifier.blockSize,
      p: verifier.parallelization,
      maxmem: Math.max(
        64 * 1024 * 1024,
        256 * verifier.cost * verifier.blockSize,
      ),
    },
  );
  return timingSafeEqual(derived, verifier.derived);
}

export async function createScryptVerifier(code: string) {
  const cost = 16384;
  const blockSize = 8;
  const parallelization = 1;
  const salt = randomBytes(24);
  const derived = await deriveScrypt(code, salt, 32, {
    N: cost,
    r: blockSize,
    p: parallelization,
    maxmem: 64 * 1024 * 1024,
  });
  return `scrypt$v1$N=${cost},r=${blockSize},p=${parallelization}$${salt.toString("base64url")}$${derived.toString("base64url")}`;
}

export function isPredictionOption(value: unknown): value is PredictionOption {
  return option(value);
}

export function exactRequest(value: unknown, keys: string[]) {
  const item = object(value);
  return item &&
    Object.keys(item).length === keys.length &&
    keys.every((key) => Object.hasOwn(item, key))
    ? item
    : null;
}
