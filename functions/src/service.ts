import type { Database } from "firebase-admin/database";
import {
  buildPredictionResolution,
  canonical,
  parsePrediction,
  parsePrivateConfig,
  parsePublicState,
  verifyProtectedCode,
  type PredictionOption,
  type PublicState,
} from "./domain.js";

type Root = Record<string, unknown>;

export class OperationError extends Error {
  constructor(
    readonly kind:
      | "failed-precondition"
      | "permission-denied"
      | "resource-exhausted"
      | "aborted"
      | "internal",
    message: string,
  ) {
    super(message);
  }
}

function object(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function read(root: Root, path: string[]) {
  let current: unknown = root;
  for (const segment of path) current = object(current)[segment];
  return current;
}

function write(root: Root, path: string[], value: unknown) {
  let current = root;
  path.slice(0, -1).forEach((segment) => {
    const child = object(current[segment]);
    current[segment] = child;
    current = child;
  });
  const key = path.at(-1)!;
  if (value === undefined || value === null) delete current[key];
  else current[key] = value;
}

function audit(input: {
  id: string;
  uid: string;
  action: string;
  eventId: string;
  beforeRevision?: number;
  afterRevision?: number;
  summary: string;
  now: number;
}) {
  return {
    id: input.id,
    action: input.action,
    entityType: "special-reveal",
    entityId: input.eventId,
    actorUid: input.uid,
    ...(input.beforeRevision === undefined
      ? {}
      : { beforeRevision: input.beforeRevision }),
    ...(input.afterRevision === undefined
      ? {}
      : { afterRevision: input.afterRevision }),
    occurredAt: input.now,
    summary: input.summary,
    schemaVersion: 1,
  };
}

function auditKey(database: Database) {
  const key = database.ref("audit").push().key;
  if (!key)
    throw new OperationError(
      "internal",
      "The operation could not be prepared.",
    );
  return key;
}

async function transactRoot<T>(
  database: Database,
  mutate: (root: Root) => { root: Root; result: T },
) {
  const reference = database.ref();
  const authoritative = object((await reference.get()).val());
  let usedInitialFallback = false;
  let result: T | undefined;
  const transaction = await reference.transaction(
    (current) => {
      const local = object(current);
      const useFallback =
        !usedInitialFallback &&
        Object.keys(local).length === 0 &&
        Object.keys(authoritative).length > 0;
      usedInitialFallback = true;
      const root = structuredClone(useFallback ? authoritative : local);
      const mutation = mutate(root);
      result = mutation.result;
      return mutation.root;
    },
    undefined,
    false,
  );
  if (!transaction.committed || result === undefined)
    throw new OperationError(
      "aborted",
      "The event changed. Reload and review the latest state.",
    );
  return result;
}

const attemptWindowMs = 15 * 60 * 1000;
const lockDurationMs = 15 * 60 * 1000;
const maximumFailures = 5;

async function checkAttemptLock(database: Database, uid: string, now: number) {
  const snapshot = await database
    .ref(`specialReveal/privateSecurity/attempts/${uid}`)
    .get();
  const value = object(snapshot.val());
  if (typeof value.lockUntil === "number" && value.lockUntil > now)
    throw new OperationError(
      "resource-exhausted",
      "The protected operation is temporarily unavailable.",
    );
}

async function recordFailedAttempt(
  database: Database,
  uid: string,
  now: number,
) {
  let locked = false;
  await database
    .ref(`specialReveal/privateSecurity/attempts/${uid}`)
    .transaction((current) => {
      const value = object(current);
      const windowStartedAt =
        typeof value.windowStartedAt === "number" &&
        now - value.windowStartedAt < attemptWindowMs
          ? value.windowStartedAt
          : now;
      const previous =
        windowStartedAt === value.windowStartedAt &&
        typeof value.failedCount === "number"
          ? value.failedCount
          : 0;
      const failedCount = previous + 1;
      locked = failedCount >= maximumFailures;
      return {
        failedCount,
        windowStartedAt,
        lastFailedAt: now,
        ...(locked ? { lockUntil: now + lockDurationMs } : {}),
        schemaVersion: 1,
      };
    });
  if (locked) {
    const id = auditKey(database);
    await database.ref(`audit/${id}`).set({
      id,
      action: "special-reveal-rate-locked",
      entityType: "special-reveal",
      entityId: "protected-operation",
      actorUid: uid,
      occurredAt: now,
      summary: "Protected special reveal operations temporarily rate limited.",
      schemaVersion: 1,
    });
  }
}

async function authorizeCode(
  database: Database,
  uid: string,
  code: string,
  verifier: string,
  now: number,
) {
  await checkAttemptLock(database, uid, now);
  if (!(await verifyProtectedCode(code, verifier))) {
    await recordFailedAttempt(database, uid, now);
    throw new OperationError(
      "permission-denied",
      "The protected operation could not be authorized.",
    );
  }
  await database.ref(`specialReveal/privateSecurity/attempts/${uid}`).remove();
}

function requireState(root: Root) {
  const state = parsePublicState(read(root, ["specialReveal", "publicState"]));
  if (!state)
    throw new OperationError(
      "failed-precondition",
      "The event state is not ready.",
    );
  return state;
}

function requireConfig(root: Root) {
  const config = parsePrivateConfig(
    read(root, ["specialReveal", "privateConfig"]),
  );
  if (!config)
    throw new OperationError(
      "failed-precondition",
      "The protected configuration is not ready.",
    );
  return config;
}

function requireRevision(actual: number, expected: number) {
  if (actual !== expected)
    throw new OperationError(
      "aborted",
      "The event changed. Reload and review the latest state.",
    );
}

export async function openEvent(input: {
  database: Database;
  uid: string;
  code: string;
  verifier: string;
  expectedConfigRevision: number;
  now?: number;
}) {
  const now = input.now ?? Date.now();
  await authorizeCode(
    input.database,
    input.uid,
    input.code,
    input.verifier,
    now,
  );
  const id = auditKey(input.database);
  return transactRoot(input.database, (root) => {
    const existing = parsePublicState(
      read(root, ["specialReveal", "publicState"]),
    );
    if (existing)
      return {
        root,
        result: { applied: false, stateRevision: existing.revision },
      };
    const config = requireConfig(root);
    requireRevision(config.revision, input.expectedConfigRevision);
    const state: PublicState = {
      eventId: config.eventId,
      status: "prediction-open",
      openedAt: now,
      openRevision: 1,
      resolutionRevision: 0,
      revision: 1,
      schemaVersion: 1,
    };
    write(root, ["specialReveal", "publicOpening"], {
      eventId: config.eventId,
      title: config.opening.title,
      body: config.opening.body,
      emojiKey: config.opening.emojiKey,
      predictionPrompt: config.predictionPrompt,
      optionLabels: config.optionLabels,
      publishedAt: now,
      openRevision: 1,
      schemaVersion: 1,
    });
    write(root, ["specialReveal", "publicState"], state);
    write(
      root,
      ["audit", id],
      audit({
        id,
        uid: input.uid,
        action: "special-reveal-opened",
        eventId: config.eventId,
        afterRevision: 1,
        summary: "Special reveal opening published and predictions opened.",
        now,
      }),
    );
    return { root, result: { applied: true, stateRevision: 1 } };
  });
}

async function transition(input: {
  database: Database;
  uid: string;
  expectedRevision: number;
  from: "prediction-open" | "prediction-locked";
  to: "prediction-open" | "prediction-locked";
  now?: number;
}) {
  const now = input.now ?? Date.now();
  const id = auditKey(input.database);
  return transactRoot(input.database, (root) => {
    const state = requireState(root);
    if (state.status === input.to)
      return {
        root,
        result: { applied: false, stateRevision: state.revision },
      };
    requireRevision(state.revision, input.expectedRevision);
    if (state.status !== input.from)
      throw new OperationError(
        "failed-precondition",
        "That lifecycle transition is not available.",
      );
    const next: PublicState = {
      ...state,
      status: input.to,
      ...(input.to === "prediction-locked" ? { lockedAt: now } : {}),
      revision: state.revision + 1,
    };
    if (input.to === "prediction-open") delete next.lockedAt;
    write(root, ["specialReveal", "publicState"], next);
    write(
      root,
      ["audit", id],
      audit({
        id,
        uid: input.uid,
        action:
          input.to === "prediction-locked"
            ? "prediction-event-locked"
            : "prediction-event-reopened",
        eventId: state.eventId,
        beforeRevision: state.revision,
        afterRevision: next.revision,
        summary:
          input.to === "prediction-locked"
            ? "Prediction event locked."
            : "Prediction event reopened.",
        now,
      }),
    );
    return { root, result: { applied: true, stateRevision: next.revision } };
  });
}

export function lockEvent(input: {
  database: Database;
  uid: string;
  expectedRevision: number;
  now?: number;
}) {
  return transition({
    ...input,
    from: "prediction-open",
    to: "prediction-locked",
  });
}

export function reopenEvent(input: {
  database: Database;
  uid: string;
  expectedRevision: number;
  now?: number;
}) {
  return transition({
    ...input,
    from: "prediction-locked",
    to: "prediction-open",
  });
}

function predictions(root: Root) {
  return Object.values(object(read(root, ["specialReveal", "predictions"])))
    .map(parsePrediction)
    .filter((value) => value !== null);
}

export async function resolveEvent(input: {
  database: Database;
  uid: string;
  code: string;
  verifier: string;
  correctOption: PredictionOption;
  expectedStateRevision: number;
  expectedConfigRevision: number;
  now?: number;
}) {
  const now = input.now ?? Date.now();
  await authorizeCode(
    input.database,
    input.uid,
    input.code,
    input.verifier,
    now,
  );
  const id = auditKey(input.database);
  return transactRoot(input.database, (root) => {
    const state = requireState(root);
    if (state.status === "resolved") {
      const resolution = object(
        read(root, ["specialReveal", "publicResolution"]),
      );
      if (resolution.correctOption === input.correctOption)
        return {
          root,
          result: {
            applied: false,
            stateRevision: state.revision,
            resolutionRevision: state.resolutionRevision,
          },
        };
      throw new OperationError(
        "failed-precondition",
        "Use the correction workflow for a resolved event.",
      );
    }
    requireRevision(state.revision, input.expectedStateRevision);
    if (state.status !== "prediction-locked")
      throw new OperationError(
        "failed-precondition",
        "Lock predictions before resolution.",
      );
    const config = requireConfig(root);
    requireRevision(config.revision, input.expectedConfigRevision);
    const nextRevision = state.revision + 1;
    const resolutionRevision = 1;
    const derived = buildPredictionResolution({
      config,
      stateRevision: nextRevision,
      resolutionRevision,
      correctOption: input.correctOption,
      predictions: predictions(root),
      participants: object(root.participants),
      profiles: object(root.userProfiles),
      resolvedAt: now,
      generatedAt: now,
      actorUid: input.uid,
    });
    const next: PublicState = {
      ...state,
      status: "resolved",
      resolvedAt: now,
      resolutionRevision,
      revision: nextRevision,
    };
    write(
      root,
      ["specialReveal", "publicResolution"],
      derived.publicResolution,
    );
    write(root, ["specialReveal", "publicState"], next);
    write(
      root,
      ["championshipLedger", "predictionSources", config.eventId],
      derived.source,
    );
    write(
      root,
      ["audit", id],
      audit({
        id,
        uid: input.uid,
        action: "special-reveal-resolved",
        eventId: config.eventId,
        beforeRevision: state.revision,
        afterRevision: nextRevision,
        summary:
          "Special reveal resolved and prediction ledger source replaced.",
        now,
      }),
    );
    return {
      root,
      result: {
        applied: true,
        stateRevision: nextRevision,
        resolutionRevision,
      },
    };
  });
}

export async function correctEvent(input: {
  database: Database;
  uid: string;
  code: string;
  verifier: string;
  correctOption: PredictionOption;
  expectedStateRevision: number;
  expectedResolutionRevision: number;
  now?: number;
}) {
  const now = input.now ?? Date.now();
  await authorizeCode(
    input.database,
    input.uid,
    input.code,
    input.verifier,
    now,
  );
  const id = auditKey(input.database);
  return transactRoot(input.database, (root) => {
    const state = requireState(root);
    if (state.status !== "resolved")
      throw new OperationError(
        "failed-precondition",
        "Only a resolved event can be corrected.",
      );
    requireRevision(state.revision, input.expectedStateRevision);
    requireRevision(state.resolutionRevision, input.expectedResolutionRevision);
    const current = object(read(root, ["specialReveal", "publicResolution"]));
    if (current.correctOption === input.correctOption)
      return {
        root,
        result: {
          applied: false,
          stateRevision: state.revision,
          resolutionRevision: state.resolutionRevision,
        },
      };
    const config = requireConfig(root);
    const nextRevision = state.revision + 1;
    const resolutionRevision = state.resolutionRevision + 1;
    const derived = buildPredictionResolution({
      config,
      stateRevision: nextRevision,
      resolutionRevision,
      correctOption: input.correctOption,
      predictions: predictions(root),
      participants: object(root.participants),
      profiles: object(root.userProfiles),
      resolvedAt: now,
      generatedAt: now,
      actorUid: input.uid,
    });
    const next = {
      ...state,
      resolvedAt: now,
      revision: nextRevision,
      resolutionRevision,
    };
    write(
      root,
      ["specialReveal", "publicResolution"],
      derived.publicResolution,
    );
    write(root, ["specialReveal", "publicState"], next);
    write(
      root,
      ["championshipLedger", "predictionSources", config.eventId],
      derived.source,
    );
    write(
      root,
      ["audit", id],
      audit({
        id,
        uid: input.uid,
        action: "special-reveal-corrected",
        eventId: config.eventId,
        beforeRevision: state.revision,
        afterRevision: nextRevision,
        summary: "Published special reveal resolution corrected and rescored.",
        now,
      }),
    );
    return {
      root,
      result: {
        applied: true,
        stateRevision: nextRevision,
        resolutionRevision,
      },
    };
  });
}

export async function reconcileLedger(input: {
  database: Database;
  uid: string;
  expectedStateRevision: number;
  now?: number;
}) {
  const now = input.now ?? Date.now();
  const id = auditKey(input.database);
  return transactRoot(input.database, (root) => {
    const state = requireState(root);
    requireRevision(state.revision, input.expectedStateRevision);
    if (state.status !== "resolved")
      throw new OperationError(
        "failed-precondition",
        "Resolve the event before reconciling its ledger.",
      );
    const config = requireConfig(root);
    const resolution = object(
      read(root, ["specialReveal", "publicResolution"]),
    );
    const correctOption = resolution.correctOption;
    if (correctOption !== "option-a" && correctOption !== "option-b")
      throw new OperationError(
        "failed-precondition",
        "The published resolution is not valid.",
      );
    const resolvedAt = resolution.resolvedAt;
    if (!Number.isInteger(resolvedAt) || Number(resolvedAt) < 0)
      throw new OperationError(
        "failed-precondition",
        "The published resolution timestamp is not valid.",
      );
    const derived = buildPredictionResolution({
      config,
      stateRevision: state.revision,
      resolutionRevision: state.resolutionRevision,
      correctOption,
      predictions: predictions(root),
      participants: object(root.participants),
      profiles: object(root.userProfiles),
      resolvedAt: Number(resolvedAt),
      generatedAt: now,
      actorUid: input.uid,
    });
    const current = object(
      read(root, ["championshipLedger", "predictionSources", config.eventId]),
    );
    const meta = object(current.meta);
    const sourceMatches =
      meta.sourceFingerprint === derived.source.meta.sourceFingerprint &&
      meta.eventId === derived.source.meta.eventId &&
      meta.status === derived.source.meta.status &&
      meta.stateRevision === derived.source.meta.stateRevision &&
      meta.resolutionRevision === derived.source.meta.resolutionRevision &&
      meta.entryCount === derived.source.meta.entryCount &&
      canonical(current.entries ?? {}) === canonical(derived.source.entries);
    if (sourceMatches)
      return {
        root,
        result: {
          applied: false,
          stateRevision: state.revision,
          resolutionRevision: state.resolutionRevision,
        },
      };
    write(
      root,
      ["championshipLedger", "predictionSources", config.eventId],
      derived.source,
    );
    write(
      root,
      ["audit", id],
      audit({
        id,
        uid: input.uid,
        action: "prediction-ledger-reconciled",
        eventId: config.eventId,
        beforeRevision: state.revision,
        afterRevision: state.revision,
        summary:
          "Prediction ledger source rebuilt from authoritative resolved data.",
        now,
      }),
    );
    return {
      root,
      result: {
        applied: true,
        stateRevision: state.revision,
        resolutionRevision: state.resolutionRevision,
      },
    };
  });
}
