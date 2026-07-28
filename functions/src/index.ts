import { getApps, initializeApp } from "firebase-admin/app";
import { getDatabase } from "firebase-admin/database";
import {
  HttpsError,
  onCall,
  type CallableRequest,
} from "firebase-functions/v2/https";
import { defineSecret } from "firebase-functions/params";
import { setGlobalOptions } from "firebase-functions/v2/options";
import { exactRequest, isPredictionOption } from "./domain.js";
import {
  correctEvent,
  lockEvent,
  openEvent,
  OperationError,
  reconcileLedger,
  reopenEvent,
  resolveEvent,
} from "./service.js";

export const functionsRegion = "europe-west1";
export const protectedCodeVerifier = defineSecret(
  "SPECIAL_REVEAL_CODE_VERIFIER",
);

setGlobalOptions({ region: functionsRegion, maxInstances: 5 });
if (getApps().length === 0) initializeApp();

function requireOrganizer(request: CallableRequest<unknown>) {
  if (!request.auth)
    throw new HttpsError(
      "unauthenticated",
      "Organizer authentication is required.",
    );
  if (request.auth.token.admin !== true)
    throw new HttpsError("permission-denied", "Organizer access is required.");
  return request.auth.uid;
}

function number(value: unknown, min = 0) {
  return Number.isInteger(value) && Number(value) >= min;
}

function code(value: unknown): value is string {
  return typeof value === "string" && value.length >= 1 && value.length <= 256;
}

function translate(error: unknown): never {
  if (error instanceof HttpsError) throw error;
  if (error instanceof OperationError)
    throw new HttpsError(error.kind, error.message);
  throw new HttpsError(
    "internal",
    "The protected operation could not be completed.",
  );
}

const protectedOptions = {
  secrets: [protectedCodeVerifier],
  enforceAppCheck: false,
};

export const openSpecialReveal = onCall(protectedOptions, async (request) => {
  try {
    const uid = requireOrganizer(request);
    const data = exactRequest(request.data, [
      "code",
      "expectedConfigRevision",
      "expectedStateRevision",
    ]);
    if (
      !data ||
      !code(data.code) ||
      !number(data.expectedConfigRevision, 1) ||
      data.expectedStateRevision !== null
    )
      throw new HttpsError("invalid-argument", "The request is not valid.");
    return await openEvent({
      database: getDatabase(),
      uid,
      code: data.code,
      verifier: protectedCodeVerifier.value(),
      expectedConfigRevision: data.expectedConfigRevision as number,
    });
  } catch (error) {
    translate(error);
  }
});

export const lockPredictionEvent = onCall(async (request) => {
  try {
    const uid = requireOrganizer(request);
    const data = exactRequest(request.data, ["expectedStateRevision"]);
    if (!data || !number(data.expectedStateRevision, 1))
      throw new HttpsError("invalid-argument", "The request is not valid.");
    return await lockEvent({
      database: getDatabase(),
      uid,
      expectedRevision: data.expectedStateRevision as number,
    });
  } catch (error) {
    translate(error);
  }
});

export const reopenPredictionEvent = onCall(async (request) => {
  try {
    const uid = requireOrganizer(request);
    const data = exactRequest(request.data, ["expectedStateRevision"]);
    if (!data || !number(data.expectedStateRevision, 1))
      throw new HttpsError("invalid-argument", "The request is not valid.");
    return await reopenEvent({
      database: getDatabase(),
      uid,
      expectedRevision: data.expectedStateRevision as number,
    });
  } catch (error) {
    translate(error);
  }
});

export const resolveSpecialReveal = onCall(
  protectedOptions,
  async (request) => {
    try {
      const uid = requireOrganizer(request);
      const data = exactRequest(request.data, [
        "code",
        "correctOption",
        "expectedStateRevision",
        "expectedConfigRevision",
      ]);
      if (
        !data ||
        !code(data.code) ||
        !isPredictionOption(data.correctOption) ||
        !number(data.expectedStateRevision, 1) ||
        !number(data.expectedConfigRevision, 1)
      )
        throw new HttpsError("invalid-argument", "The request is not valid.");
      return await resolveEvent({
        database: getDatabase(),
        uid,
        code: data.code,
        verifier: protectedCodeVerifier.value(),
        correctOption: data.correctOption,
        expectedStateRevision: data.expectedStateRevision as number,
        expectedConfigRevision: data.expectedConfigRevision as number,
      });
    } catch (error) {
      translate(error);
    }
  },
);

export const correctSpecialRevealResolution = onCall(
  protectedOptions,
  async (request) => {
    try {
      const uid = requireOrganizer(request);
      const data = exactRequest(request.data, [
        "code",
        "confirmation",
        "correctOption",
        "expectedStateRevision",
        "expectedResolutionRevision",
      ]);
      if (
        !data ||
        !code(data.code) ||
        data.confirmation !== "CORRECT RESULT" ||
        !isPredictionOption(data.correctOption) ||
        !number(data.expectedStateRevision, 1) ||
        !number(data.expectedResolutionRevision, 1)
      )
        throw new HttpsError("invalid-argument", "The request is not valid.");
      return await correctEvent({
        database: getDatabase(),
        uid,
        code: data.code,
        verifier: protectedCodeVerifier.value(),
        correctOption: data.correctOption,
        expectedStateRevision: data.expectedStateRevision as number,
        expectedResolutionRevision: data.expectedResolutionRevision as number,
      });
    } catch (error) {
      translate(error);
    }
  },
);

export const reconcilePredictionLedger = onCall(async (request) => {
  try {
    const uid = requireOrganizer(request);
    const data = exactRequest(request.data, ["expectedStateRevision"]);
    if (!data || !number(data.expectedStateRevision, 1))
      throw new HttpsError("invalid-argument", "The request is not valid.");
    return await reconcileLedger({
      database: getDatabase(),
      uid,
      expectedStateRevision: data.expectedStateRevision as number,
    });
  } catch (error) {
    translate(error);
  }
});
