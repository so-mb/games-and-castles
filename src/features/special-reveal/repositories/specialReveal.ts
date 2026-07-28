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
import { httpsCallable, type Functions } from "firebase/functions";
import type {
  PredictionOption,
  RevealCallableResult,
  SpecialRevealConfigInput,
  SpecialRevealPrediction,
  SpecialRevealPrivateConfig,
  SpecialRevealPublicState,
} from "../domain/types";
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

function callable<TRequest>(functions: Functions, name: string) {
  return httpsCallable<TRequest, RevealCallableResult>(functions, name);
}

export async function openSpecialReveal(
  functions: Functions,
  input: {
    code: string;
    expectedConfigRevision: number;
    expectedStateRevision: null;
  },
) {
  return (await callable<typeof input>(functions, "openSpecialReveal")(input))
    .data;
}

export async function lockPredictionEvent(
  functions: Functions,
  state: SpecialRevealPublicState,
) {
  return (
    await callable<{ expectedStateRevision: number }>(
      functions,
      "lockPredictionEvent",
    )({
      expectedStateRevision: state.revision,
    })
  ).data;
}

export async function reopenPredictionEvent(
  functions: Functions,
  state: SpecialRevealPublicState,
) {
  return (
    await callable<{ expectedStateRevision: number }>(
      functions,
      "reopenPredictionEvent",
    )({
      expectedStateRevision: state.revision,
    })
  ).data;
}

export async function resolveSpecialReveal(
  functions: Functions,
  input: {
    code: string;
    correctOption: PredictionOption;
    expectedStateRevision: number;
    expectedConfigRevision: number;
  },
) {
  return (
    await callable<typeof input>(functions, "resolveSpecialReveal")(input)
  ).data;
}

export async function correctSpecialRevealResolution(
  functions: Functions,
  input: {
    code: string;
    confirmation: "CORRECT RESULT";
    correctOption: PredictionOption;
    expectedStateRevision: number;
    expectedResolutionRevision: number;
  },
) {
  return (
    await callable<typeof input>(
      functions,
      "correctSpecialRevealResolution",
    )(input)
  ).data;
}

export async function reconcilePredictionLedger(
  functions: Functions,
  state: SpecialRevealPublicState,
) {
  return (
    await callable<{ expectedStateRevision: number }>(
      functions,
      "reconcilePredictionLedger",
    )({
      expectedStateRevision: state.revision,
    })
  ).data;
}
