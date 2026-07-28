import type {
  PredictionLedgerSnapshot,
  PredictionOption,
  RevealOperationResult,
  SpecialRevealPrediction,
  SpecialRevealPrivateConfig,
  SpecialRevealPublicResolution,
  SpecialRevealPublicState,
} from "./types.ts";
import {
  buildPredictionResolution,
  predictionSourcesMatch,
} from "./resolution.ts";

export type RevealUpdates = Record<string, unknown>;

interface Mutation<T extends RevealOperationResult = RevealOperationResult> {
  result: T;
  updates: RevealUpdates | null;
}

interface AuditInput {
  id: string;
  actorUid: string;
  action: string;
  eventId: string;
  summary: string;
  now: number;
  beforeRevision?: number;
  afterRevision?: number;
}

function audit(input: AuditInput) {
  return {
    id: input.id,
    action: input.action,
    entityType: "special-reveal",
    entityId: input.eventId,
    actorUid: input.actorUid,
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

function requireRevision(actual: number, expected: number) {
  if (actual !== expected)
    throw new Error("The event changed elsewhere. Reload before continuing.");
}

export function buildOpenRevealMutation(input: {
  config: SpecialRevealPrivateConfig;
  state: SpecialRevealPublicState | null;
  expectedConfigRevision: number;
  actorUid: string;
  auditId: string;
  now: number;
}): Mutation {
  if (input.state) {
    if (input.state.eventId !== input.config.eventId)
      throw new Error("A different reveal event is already open.");
    return {
      result: { applied: false, stateRevision: input.state.revision },
      updates: null,
    };
  }
  requireRevision(input.config.revision, input.expectedConfigRevision);
  const state: SpecialRevealPublicState = {
    eventId: input.config.eventId,
    status: "prediction-open",
    openedAt: input.now,
    lockedAt: null,
    resolvedAt: null,
    openRevision: 1,
    resolutionRevision: 0,
    revision: 1,
    schemaVersion: 1,
  };
  return {
    result: { applied: true, stateRevision: 1 },
    updates: {
      "specialReveal/publicOpening": {
        eventId: input.config.eventId,
        title: input.config.opening.title,
        body: input.config.opening.body,
        emojiKey: input.config.opening.emojiKey,
        predictionPrompt: input.config.predictionPrompt,
        optionLabels: input.config.optionLabels,
        publishedAt: input.now,
        openRevision: 1,
        schemaVersion: 1,
      },
      "specialReveal/publicState": state,
      [`audit/${input.auditId}`]: audit({
        id: input.auditId,
        actorUid: input.actorUid,
        action: "special-reveal-opened",
        eventId: input.config.eventId,
        afterRevision: 1,
        summary: "Special reveal opening published and predictions opened.",
        now: input.now,
      }),
    },
  };
}

export function buildPredictionStateMutation(input: {
  state: SpecialRevealPublicState;
  expectedStateRevision: number;
  action: "lock" | "reopen";
  actorUid: string;
  auditId: string;
  now: number;
}): Mutation {
  const target =
    input.action === "lock" ? "prediction-locked" : "prediction-open";
  if (input.state.status === target)
    return {
      result: { applied: false, stateRevision: input.state.revision },
      updates: null,
    };
  requireRevision(input.state.revision, input.expectedStateRevision);
  const required =
    input.action === "lock" ? "prediction-open" : "prediction-locked";
  if (input.state.status !== required)
    throw new Error("That lifecycle transition is not available.");
  const next: SpecialRevealPublicState = {
    ...input.state,
    status: target,
    lockedAt: input.action === "lock" ? input.now : null,
    revision: input.state.revision + 1,
  };
  return {
    result: { applied: true, stateRevision: next.revision },
    updates: {
      "specialReveal/publicState": next,
      [`audit/${input.auditId}`]: audit({
        id: input.auditId,
        actorUid: input.actorUid,
        action:
          input.action === "lock"
            ? "prediction-event-locked"
            : "prediction-event-reopened",
        eventId: input.state.eventId,
        beforeRevision: input.state.revision,
        afterRevision: next.revision,
        summary:
          input.action === "lock"
            ? "Prediction event locked."
            : "Prediction event reopened.",
        now: input.now,
      }),
    },
  };
}

interface ResolutionInput {
  config: SpecialRevealPrivateConfig;
  state: SpecialRevealPublicState;
  predictions: SpecialRevealPrediction[];
  participants: Record<string, unknown>;
  profiles: Record<string, unknown>;
  correctOption: PredictionOption;
  expectedStateRevision: number;
  actorUid: string;
  auditId: string;
  now: number;
}

export function buildResolveRevealMutation(
  input: ResolutionInput & { expectedConfigRevision: number },
): Mutation {
  if (input.state.status === "resolved")
    throw new Error("Use the correction workflow for a resolved event.");
  requireRevision(input.state.revision, input.expectedStateRevision);
  requireRevision(input.config.revision, input.expectedConfigRevision);
  if (input.state.status !== "prediction-locked")
    throw new Error("Lock predictions before resolving the event.");
  if (input.config.eventId !== input.state.eventId)
    throw new Error("The private configuration does not match this event.");
  const nextStateRevision = input.state.revision + 1;
  const resolutionRevision = 1;
  const derived = buildPredictionResolution({
    ...input,
    stateRevision: nextStateRevision,
    resolutionRevision,
    resolvedAt: input.now,
    generatedAt: input.now,
  });
  const nextState: SpecialRevealPublicState = {
    ...input.state,
    status: "resolved",
    resolvedAt: input.now,
    resolutionRevision,
    revision: nextStateRevision,
  };
  return {
    result: {
      applied: true,
      stateRevision: nextStateRevision,
      resolutionRevision,
    },
    updates: {
      "specialReveal/publicResolution": derived.publicResolution,
      "specialReveal/publicState": nextState,
      [`championshipLedger/predictionSources/${input.config.eventId}`]:
        derived.source,
      [`audit/${input.auditId}`]: audit({
        id: input.auditId,
        actorUid: input.actorUid,
        action: "special-reveal-resolved",
        eventId: input.config.eventId,
        beforeRevision: input.state.revision,
        afterRevision: nextStateRevision,
        summary: "Special reveal resolved and prediction ledger replaced.",
        now: input.now,
      }),
    },
  };
}

export function buildCorrectRevealMutation(
  input: ResolutionInput & {
    currentResolution: SpecialRevealPublicResolution;
    expectedResolutionRevision: number;
  },
): Mutation {
  if (input.state.status !== "resolved")
    throw new Error("Only a resolved event can be corrected.");
  requireRevision(input.state.revision, input.expectedStateRevision);
  requireRevision(
    input.state.resolutionRevision,
    input.expectedResolutionRevision,
  );
  if (
    input.currentResolution.resolutionRevision !==
    input.expectedResolutionRevision
  )
    throw new Error("The published resolution changed elsewhere.");
  if (input.currentResolution.correctOption === input.correctOption)
    return {
      result: {
        applied: false,
        stateRevision: input.state.revision,
        resolutionRevision: input.state.resolutionRevision,
      },
      updates: null,
    };
  const nextStateRevision = input.state.revision + 1;
  const resolutionRevision = input.state.resolutionRevision + 1;
  const derived = buildPredictionResolution({
    ...input,
    stateRevision: nextStateRevision,
    resolutionRevision,
    resolvedAt: input.now,
    generatedAt: input.now,
  });
  const nextState: SpecialRevealPublicState = {
    ...input.state,
    resolvedAt: input.now,
    revision: nextStateRevision,
    resolutionRevision,
  };
  return {
    result: {
      applied: true,
      stateRevision: nextStateRevision,
      resolutionRevision,
    },
    updates: {
      "specialReveal/publicResolution": derived.publicResolution,
      "specialReveal/publicState": nextState,
      [`championshipLedger/predictionSources/${input.config.eventId}`]:
        derived.source,
      [`audit/${input.auditId}`]: audit({
        id: input.auditId,
        actorUid: input.actorUid,
        action: "special-reveal-corrected",
        eventId: input.config.eventId,
        beforeRevision: input.state.revision,
        afterRevision: nextStateRevision,
        summary: "Published special reveal resolution corrected and rescored.",
        now: input.now,
      }),
    },
  };
}

export function buildReconcilePredictionMutation(input: {
  config: SpecialRevealPrivateConfig;
  state: SpecialRevealPublicState;
  resolution: SpecialRevealPublicResolution;
  predictions: SpecialRevealPrediction[];
  participants: Record<string, unknown>;
  profiles: Record<string, unknown>;
  currentSource: PredictionLedgerSnapshot | null;
  expectedStateRevision: number;
  actorUid: string;
  auditId: string;
  now: number;
}): Mutation {
  requireRevision(input.state.revision, input.expectedStateRevision);
  if (input.state.status !== "resolved")
    throw new Error("Resolve the event before reconciling its ledger.");
  if (
    input.resolution.eventId !== input.state.eventId ||
    input.resolution.resolutionRevision !== input.state.resolutionRevision
  )
    throw new Error("The published resolution is inconsistent.");
  const derived = buildPredictionResolution({
    ...input,
    correctOption: input.resolution.correctOption,
    stateRevision: input.state.revision,
    resolutionRevision: input.state.resolutionRevision,
    resolvedAt: input.resolution.resolvedAt,
    generatedAt: input.now,
  });
  if (predictionSourcesMatch(input.currentSource, derived.source))
    return {
      result: {
        applied: false,
        stateRevision: input.state.revision,
        resolutionRevision: input.state.resolutionRevision,
      },
      updates: null,
    };
  return {
    result: {
      applied: true,
      stateRevision: input.state.revision,
      resolutionRevision: input.state.resolutionRevision,
    },
    updates: {
      [`championshipLedger/predictionSources/${input.config.eventId}`]:
        derived.source,
      [`audit/${input.auditId}`]: audit({
        id: input.auditId,
        actorUid: input.actorUid,
        action: "prediction-ledger-reconciled",
        eventId: input.config.eventId,
        beforeRevision: input.state.revision,
        afterRevision: input.state.revision,
        summary: "Prediction ledger rebuilt from resolved authoritative data.",
        now: input.now,
      }),
    },
  };
}
