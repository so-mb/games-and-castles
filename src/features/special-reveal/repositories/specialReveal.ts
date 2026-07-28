import {
  get,
  onValue,
  push,
  ref,
  serverTimestamp,
  update,
  type Database,
  type Unsubscribe,
} from "firebase/database";
import type {
  PredictionOption,
  PredictionLedgerSnapshot,
  RevealOperationResult,
  SpecialRevealConfigInput,
  SpecialRevealPrediction,
  SpecialRevealPrivateConfig,
  SpecialRevealPublicResolution,
  SpecialRevealPublicState,
} from "../domain/types";
import {
  buildCorrectRevealMutation,
  buildOpenRevealMutation,
  buildPredictionStateMutation,
  buildReconcilePredictionMutation,
  buildResolveRevealMutation,
  type RevealUpdates,
} from "../domain/operations";
import {
  parsePrediction,
  parsePredictionLedgerSources,
  parsePredictionReceipts,
  parseSpecialRevealPrivateConfig,
  parseSpecialRevealPublicOpening,
  parseSpecialRevealPublicResolution,
  parseSpecialRevealPublicState,
  validateSpecialRevealConfig,
} from "../domain/validation";

function pushKey(database: Database, path: string) {
  const value = push(ref(database, path));
  if (!value.key) throw new Error("Firebase could not create an operation ID.");
  return value.key;
}

function subscribeParsed<T>(input: {
  database: Database;
  path: string;
  parse: (value: unknown) => T | null;
  onData: (value: T | null, malformed: boolean) => void;
  onError: (error: Error) => void;
}): Unsubscribe {
  return onValue(
    ref(input.database, input.path),
    (snapshot) => {
      const raw = snapshot.val();
      const parsed = input.parse(raw);
      input.onData(parsed, raw !== null && parsed === null);
    },
    input.onError,
  );
}

export function subscribeSpecialRevealPublicState(
  database: Database,
  onData: (
    value: ReturnType<typeof parseSpecialRevealPublicState>,
    malformed: boolean,
  ) => void,
  onError: (error: Error) => void,
) {
  return subscribeParsed({
    database,
    path: "specialReveal/publicState",
    parse: parseSpecialRevealPublicState,
    onData,
    onError,
  });
}

export function subscribeSpecialRevealPublicOpening(
  database: Database,
  onData: (
    value: ReturnType<typeof parseSpecialRevealPublicOpening>,
    malformed: boolean,
  ) => void,
  onError: (error: Error) => void,
) {
  return subscribeParsed({
    database,
    path: "specialReveal/publicOpening",
    parse: parseSpecialRevealPublicOpening,
    onData,
    onError,
  });
}

export function subscribeSpecialRevealPublicResolution(
  database: Database,
  onData: (
    value: ReturnType<typeof parseSpecialRevealPublicResolution>,
    malformed: boolean,
  ) => void,
  onError: (error: Error) => void,
) {
  return subscribeParsed({
    database,
    path: "specialReveal/publicResolution",
    parse: parseSpecialRevealPublicResolution,
    onData,
    onError,
  });
}

export function subscribeOwnPrediction(
  database: Database,
  uid: string,
  onData: (value: SpecialRevealPrediction | null, malformed: boolean) => void,
  onError: (error: Error) => void,
) {
  return subscribeParsed({
    database,
    path: `specialReveal/predictions/${uid}`,
    parse: parsePrediction,
    onData,
    onError,
  });
}

export function subscribePredictionReceipts(
  database: Database,
  onData: (value: ReturnType<typeof parsePredictionReceipts>) => void,
  onError: (error: Error) => void,
) {
  return onValue(
    ref(database, "specialReveal/predictionReceipts"),
    (snapshot) => onData(parsePredictionReceipts(snapshot.val())),
    onError,
  );
}

export function subscribeSpecialRevealPrivateConfig(
  database: Database,
  onData: (
    value: SpecialRevealPrivateConfig | null,
    malformed: boolean,
  ) => void,
  onError: (error: Error) => void,
) {
  return subscribeParsed({
    database,
    path: "specialReveal/privateConfig",
    parse: parseSpecialRevealPrivateConfig,
    onData,
    onError,
  });
}

export function subscribePredictionLedgerSources(
  database: Database,
  eventId: string,
  onData: (value: ReturnType<typeof parsePredictionLedgerSources>) => void,
  onError: (error: Error) => void,
) {
  return onValue(
    ref(database, `championshipLedger/predictionSources/${eventId}`),
    (snapshot) =>
      onData(
        parsePredictionLedgerSources(
          snapshot.exists() ? { [eventId]: snapshot.val() } : null,
        ),
      ),
    onError,
  );
}

export async function saveSpecialRevealConfig(input: {
  database: Database;
  uid: string;
  current: SpecialRevealPrivateConfig | null;
  value: SpecialRevealConfigInput;
}) {
  const validation = validateSpecialRevealConfig(input.value);
  if (!validation.valid) throw new Error(validation.errors[0]);
  const [configSnapshot, stateSnapshot] = await Promise.all([
    get(ref(input.database, "specialReveal/privateConfig")),
    get(ref(input.database, "specialReveal/publicState")),
  ]);
  const persisted = parseSpecialRevealPrivateConfig(configSnapshot.val());
  if (stateSnapshot.exists())
    throw new Error(
      "The protected event configuration is frozen after opening.",
    );
  if ((persisted?.revision ?? null) !== (input.current?.revision ?? null))
    throw new Error(
      "The configuration changed elsewhere. Reload before saving.",
    );
  const now = Date.now();
  const next: SpecialRevealPrivateConfig = {
    ...validation.value,
    createdAt: persisted?.createdAt ?? now,
    createdByUid: persisted?.createdByUid ?? input.uid,
    updatedAt: now,
    updatedByUid: input.uid,
    revision: (persisted?.revision ?? 0) + 1,
    schemaVersion: 1,
  };
  const auditId = pushKey(input.database, "audit");
  await update(ref(input.database), {
    "specialReveal/privateConfig": {
      ...next,
      createdAt: persisted?.createdAt ?? serverTimestamp(),
      updatedAt: serverTimestamp(),
    },
    [`audit/${auditId}`]: {
      id: auditId,
      action: persisted
        ? "special-reveal-config-updated"
        : "special-reveal-config-created",
      entityType: "special-reveal",
      entityId: next.eventId,
      actorUid: input.uid,
      ...(persisted ? { beforeRevision: persisted.revision } : {}),
      afterRevision: next.revision,
      occurredAt: serverTimestamp(),
      summary: persisted
        ? "Special reveal configuration updated before opening."
        : "Special reveal configuration created before opening.",
      schemaVersion: 1,
    },
  });
}

export async function savePrediction(input: {
  database: Database;
  uid: string;
  participantId: string;
  current: SpecialRevealPrediction | null;
  selection: PredictionOption;
}) {
  const persisted = parsePrediction(
    (
      await get(ref(input.database, `specialReveal/predictions/${input.uid}`))
    ).val(),
  );
  if ((persisted?.revision ?? null) !== (input.current?.revision ?? null))
    throw new Error("Your prediction changed elsewhere. Reload before saving.");
  const predictionId = persisted?.predictionId ?? crypto.randomUUID();
  const timestamp = serverTimestamp();
  await update(ref(input.database), {
    [`specialReveal/predictions/${input.uid}`]: {
      ownerUid: input.uid,
      participantId: persisted?.participantId ?? input.participantId,
      predictionId,
      selection: input.selection,
      status: "submitted",
      createdAt: persisted?.createdAt ?? timestamp,
      updatedAt: timestamp,
      revision: (persisted?.revision ?? 0) + 1,
      schemaVersion: 1,
    },
    [`specialReveal/predictionReceipts/${predictionId}`]: {
      predictionId,
      active: true,
      updatedAt: timestamp,
      schemaVersion: 1,
    },
  });
}

export async function withdrawPrediction(input: {
  database: Database;
  uid: string;
  current: SpecialRevealPrediction;
}) {
  const timestamp = serverTimestamp();
  await update(ref(input.database), {
    [`specialReveal/predictions/${input.uid}`]: {
      ...input.current,
      status: "withdrawn",
      updatedAt: timestamp,
      revision: input.current.revision + 1,
    },
    [`specialReveal/predictionReceipts/${input.current.predictionId}`]: {
      predictionId: input.current.predictionId,
      active: false,
      updatedAt: timestamp,
      schemaVersion: 1,
    },
  });
}

function object(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

async function applyRevealMutation(
  database: Database,
  mutation: { result: RevealOperationResult; updates: RevealUpdates | null },
) {
  if (mutation.updates) await update(ref(database), mutation.updates);
  return mutation.result;
}

function parsePredictions(value: unknown) {
  return Object.values(object(value))
    .map(parsePrediction)
    .filter((prediction) => prediction !== null);
}

async function loadResolutionInputs(database: Database, eventId: string) {
  const [
    configSnapshot,
    stateSnapshot,
    predictionsSnapshot,
    participantsSnapshot,
    profilesSnapshot,
    resolutionSnapshot,
    sourceSnapshot,
  ] = await Promise.all([
    get(ref(database, "specialReveal/privateConfig")),
    get(ref(database, "specialReveal/publicState")),
    get(ref(database, "specialReveal/predictions")),
    get(ref(database, "participants")),
    get(ref(database, "userProfiles")),
    get(ref(database, "specialReveal/publicResolution")),
    get(ref(database, `championshipLedger/predictionSources/${eventId}`)),
  ]);
  const config = parseSpecialRevealPrivateConfig(configSnapshot.val());
  const state = parseSpecialRevealPublicState(stateSnapshot.val());
  if (!config || !state)
    throw new Error("The protected reveal data is incomplete or malformed.");
  const resolution = parseSpecialRevealPublicResolution(
    resolutionSnapshot.val(),
  );
  const parsedSources = parsePredictionLedgerSources(
    sourceSnapshot.exists() ? { [eventId]: sourceSnapshot.val() } : null,
  );
  return {
    config,
    state,
    predictions: parsePredictions(predictionsSnapshot.val()),
    participants: object(participantsSnapshot.val()),
    profiles: object(profilesSnapshot.val()),
    resolution,
    currentSource:
      (parsedSources.sources[0] as PredictionLedgerSnapshot | undefined) ??
      null,
  };
}

export async function openSpecialRevealInBrowser(input: {
  database: Database;
  uid: string;
  expectedConfigRevision: number;
}) {
  const [configSnapshot, stateSnapshot] = await Promise.all([
    get(ref(input.database, "specialReveal/privateConfig")),
    get(ref(input.database, "specialReveal/publicState")),
  ]);
  const config = parseSpecialRevealPrivateConfig(configSnapshot.val());
  const state = parseSpecialRevealPublicState(stateSnapshot.val());
  if (!config)
    throw new Error("Save a valid protected configuration before opening.");
  return applyRevealMutation(
    input.database,
    buildOpenRevealMutation({
      config,
      state,
      expectedConfigRevision: input.expectedConfigRevision,
      actorUid: input.uid,
      auditId: pushKey(input.database, "audit"),
      now: Date.now(),
    }),
  );
}

export async function changePredictionStateInBrowser(input: {
  database: Database;
  uid: string;
  state: SpecialRevealPublicState;
  action: "lock" | "reopen";
}) {
  return applyRevealMutation(
    input.database,
    buildPredictionStateMutation({
      state: input.state,
      expectedStateRevision: input.state.revision,
      action: input.action,
      actorUid: input.uid,
      auditId: pushKey(input.database, "audit"),
      now: Date.now(),
    }),
  );
}

export async function resolveSpecialRevealInBrowser(input: {
  database: Database;
  uid: string;
  state: SpecialRevealPublicState;
  config: SpecialRevealPrivateConfig;
  correctOption: PredictionOption;
}) {
  const source = await loadResolutionInputs(
    input.database,
    input.config.eventId,
  );
  return applyRevealMutation(
    input.database,
    buildResolveRevealMutation({
      ...source,
      correctOption: input.correctOption,
      expectedStateRevision: input.state.revision,
      expectedConfigRevision: input.config.revision,
      actorUid: input.uid,
      auditId: pushKey(input.database, "audit"),
      now: Date.now(),
    }),
  );
}

export async function correctSpecialRevealInBrowser(input: {
  database: Database;
  uid: string;
  state: SpecialRevealPublicState;
  config: SpecialRevealPrivateConfig;
  resolution: SpecialRevealPublicResolution;
  correctOption: PredictionOption;
}) {
  const source = await loadResolutionInputs(
    input.database,
    input.config.eventId,
  );
  if (!source.resolution)
    throw new Error("The published resolution is unavailable.");
  return applyRevealMutation(
    input.database,
    buildCorrectRevealMutation({
      ...source,
      currentResolution: source.resolution,
      correctOption: input.correctOption,
      expectedStateRevision: input.state.revision,
      expectedResolutionRevision: input.resolution.resolutionRevision,
      actorUid: input.uid,
      auditId: pushKey(input.database, "audit"),
      now: Date.now(),
    }),
  );
}

export async function reconcilePredictionLedgerInBrowser(input: {
  database: Database;
  uid: string;
  state: SpecialRevealPublicState;
  config: SpecialRevealPrivateConfig;
  resolution: SpecialRevealPublicResolution;
}) {
  const source = await loadResolutionInputs(
    input.database,
    input.config.eventId,
  );
  if (!source.resolution)
    throw new Error("The published resolution is unavailable.");
  return applyRevealMutation(
    input.database,
    buildReconcilePredictionMutation({
      ...source,
      resolution: source.resolution,
      expectedStateRevision: input.state.revision,
      actorUid: input.uid,
      auditId: pushKey(input.database, "audit"),
      now: Date.now(),
    }),
  );
}
