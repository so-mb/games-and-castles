import { deleteApp, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getDatabase } from "firebase-admin/database";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const projectId = "demo-games-and-castles";
const callableBase = `http://127.0.0.1:5001/${projectId}/europe-west1`;
const testCode = process.env.PHASE9_TEST_CODE;

if (!testCode) throw new Error("The synthetic emulator code was not provided.");

process.env.FIREBASE_AUTH_EMULATOR_HOST = "127.0.0.1:9099";
process.env.FIREBASE_DATABASE_EMULATOR_HOST = "127.0.0.1:9000";

const app = initializeApp(
  { projectId, databaseURL: `http://127.0.0.1:9000?ns=${projectId}` },
  "phase9-functions-test",
);
const auth = getAuth(app);
const database = getDatabase(app);
let adminToken = "";
let nonAdminToken = "";
let rateAdminToken = "";

async function token(email: string, password: string) {
  const response = await fetch(
    `http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=fake-api-key`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, password, returnSecureToken: true }),
    },
  );
  const result = (await response.json()) as { idToken?: string };
  if (!result.idToken)
    throw new Error("The Auth emulator did not issue a token.");
  return result.idToken;
}

async function call(
  name: string,
  data: Record<string, unknown>,
  authorization: string | null = adminToken,
) {
  const headers: Record<string, string> = {
    "content-type": "application/json",
  };
  if (authorization) headers.authorization = `Bearer ${authorization}`;

  const response = await fetch(`${callableBase}/${name}`, {
    method: "POST",
    headers,
    body: JSON.stringify({ data }),
  });
  const body = (await response.json()) as {
    result?: {
      applied: boolean;
      stateRevision: number;
      resolutionRevision?: number;
    };
    error?: { status: string; message: string };
  };
  return { response, body };
}

function privateConfig() {
  const now = Date.now();
  return {
    eventId: "event-neutral",
    opening: {
      title: "A special announcement is ready.",
      body: "Make one private prediction.",
      emojiKey: "sparkles",
    },
    predictionPrompt: "Which option do you predict?",
    optionLabels: { "option-a": "Option A", "option-b": "Option B" },
    resolutionPayloads: {
      "option-a": {
        title: "Option A resolution",
        body: "Selected presentation.",
        emojiKey: "star",
      },
      "option-b": {
        title: "Option B resolution",
        body: "Selected presentation.",
        emojiKey: "star",
      },
    },
    correctPredictionPoints: 3,
    createdAt: now,
    createdByUid: "admin-uid",
    updatedAt: now,
    updatedByUid: "admin-uid",
    revision: 1,
    schemaVersion: 1,
  };
}

beforeAll(async () => {
  await database.ref().set(null);
  const admin = await auth.createUser({
    email: "admin@example.test",
    password: "Valid-password-1",
  });
  await auth.createUser({
    email: "guest@example.test",
    password: "Valid-password-2",
  });
  const rateAdmin = await auth.createUser({
    email: "rate-admin@example.test",
    password: "Valid-password-3",
  });
  await auth.setCustomUserClaims(admin.uid, { admin: true });
  await auth.setCustomUserClaims(rateAdmin.uid, { admin: true });
  adminToken = await token("admin@example.test", "Valid-password-1");
  nonAdminToken = await token("guest@example.test", "Valid-password-2");
  rateAdminToken = await token("rate-admin@example.test", "Valid-password-3");
  await database.ref().update({
    "specialReveal/privateConfig": privateConfig(),
    "participants/participant-a": { ownerUid: "owner-a", status: "active" },
    "participants/participant-b": { ownerUid: "owner-b", status: "active" },
    "userProfiles/owner-a": { participantId: "participant-a" },
    "userProfiles/owner-b": { participantId: "participant-b" },
  });
});

afterAll(async () => {
  await deleteApp(app);
});

describe("Phase 9 callable emulator lifecycle", () => {
  it("rejects an unauthenticated caller without mutation", async () => {
    const { body } = await call(
      "openSpecialReveal",
      {
        code: testCode,
        expectedConfigRevision: 1,
        expectedStateRevision: null,
      },
      null,
    );
    expect(body.error?.status).toBe("UNAUTHENTICATED");
    expect(
      (await database.ref("specialReveal/publicState").get()).exists(),
    ).toBe(false);
  });

  it("rejects a non-admin without mutation", async () => {
    const { body } = await call(
      "openSpecialReveal",
      {
        code: testCode,
        expectedConfigRevision: 1,
        expectedStateRevision: null,
      },
      nonAdminToken,
    );
    expect(body.error?.status).toBe("PERMISSION_DENIED");
    expect(
      (await database.ref("specialReveal/publicState").get()).exists(),
    ).toBe(false);
  });

  it("opens with sanitized public data", async () => {
    const { body } = await call("openSpecialReveal", {
      code: testCode,
      expectedConfigRevision: 1,
      expectedStateRevision: null,
    });
    expect(body.error).toBeUndefined();
    expect(body.result).toEqual({ applied: true, stateRevision: 1 });
    const opening = (
      await database.ref("specialReveal/publicOpening").get()
    ).val();
    expect(opening.optionLabels).toEqual({
      "option-a": "Option A",
      "option-b": "Option B",
    });
    expect(JSON.stringify(opening)).not.toContain("Option B resolution");
  });

  it("treats a repeated open as idempotent", async () => {
    const { body } = await call("openSpecialReveal", {
      code: testCode,
      expectedConfigRevision: 1,
      expectedStateRevision: null,
    });
    expect(body.result?.applied).toBe(false);
  });

  it("rejects an invalid protected code with a generic error", async () => {
    const { body } = await call("openSpecialReveal", {
      code: `${testCode}-invalid`,
      expectedConfigRevision: 1,
      expectedStateRevision: null,
    });
    expect(body.error).toMatchObject({
      status: "PERMISSION_DENIED",
      message: "The protected operation could not be authorized.",
    });
  });

  it("locks, reopens, and locks predictions with revisions", async () => {
    const stale = await call("lockPredictionEvent", {
      expectedStateRevision: 99,
    });
    expect(stale.body.error?.status).toBe("ABORTED");
    const first = await call("lockPredictionEvent", {
      expectedStateRevision: 1,
    });
    expect(first.body.error).toBeUndefined();
    expect(first.body.result?.stateRevision).toBe(2);
    expect(
      (await call("reopenPredictionEvent", { expectedStateRevision: 2 })).body
        .result?.stateRevision,
    ).toBe(3);
    const unlockedResolution = await call("resolveSpecialReveal", {
      code: testCode,
      correctOption: "option-a",
      expectedStateRevision: 3,
      expectedConfigRevision: 1,
    });
    expect(unlockedResolution.body.error?.status).toBe("FAILED_PRECONDITION");
    expect(
      (await call("lockPredictionEvent", { expectedStateRevision: 3 })).body
        .result?.stateRevision,
    ).toBe(4);
  });

  it("resolves, publishes one payload, and creates deterministic awards", async () => {
    await database.ref("specialReveal/predictions").set({
      "owner-a": {
        ownerUid: "owner-a",
        participantId: "participant-a",
        predictionId: "prediction-a",
        selection: "option-a",
        status: "submitted",
        createdAt: 1,
        updatedAt: 1,
        revision: 1,
        schemaVersion: 1,
      },
      "owner-b": {
        ownerUid: "owner-b",
        participantId: "participant-b",
        predictionId: "prediction-b",
        selection: "option-b",
        status: "submitted",
        createdAt: 1,
        updatedAt: 1,
        revision: 1,
        schemaVersion: 1,
      },
    });
    const { body } = await call("resolveSpecialReveal", {
      code: testCode,
      correctOption: "option-a",
      expectedStateRevision: 4,
      expectedConfigRevision: 1,
    });
    expect(body.result).toMatchObject({
      applied: true,
      stateRevision: 5,
      resolutionRevision: 1,
    });
    const source = (
      await database
        .ref("championshipLedger/predictionSources/event-neutral")
        .get()
    ).val();
    expect(source.meta.entryCount).toBe(1);
    expect(Object.values(source.entries)[0]).toMatchObject({
      participantId: "participant-a",
      sourceType: "prediction-correct",
      points: 3,
    });
    const publicJson = JSON.stringify(
      (await database.ref("specialReveal/publicResolution").get()).val(),
    );
    expect(publicJson).not.toContain("owner-a");
    expect(publicJson).not.toContain("prediction-a");
  });

  it("does not duplicate awards on an idempotent retry", async () => {
    const before = (
      await database
        .ref("championshipLedger/predictionSources/event-neutral")
        .get()
    ).val();
    const { body } = await call("resolveSpecialReveal", {
      code: testCode,
      correctOption: "option-a",
      expectedStateRevision: 5,
      expectedConfigRevision: 1,
    });
    expect(body.result?.applied).toBe(false);
    const after = (
      await database
        .ref("championshipLedger/predictionSources/event-neutral")
        .get()
    ).val();
    expect(after).toEqual(before);
  });

  it("corrects the selected payload and fully replaces scoring", async () => {
    const { body } = await call("correctSpecialRevealResolution", {
      code: testCode,
      confirmation: "CORRECT RESULT",
      correctOption: "option-b",
      expectedStateRevision: 5,
      expectedResolutionRevision: 1,
    });
    expect(body.result).toMatchObject({
      applied: true,
      stateRevision: 6,
      resolutionRevision: 2,
    });
    const source = (
      await database
        .ref("championshipLedger/predictionSources/event-neutral")
        .get()
    ).val();
    expect(Object.values(source.entries)[0]).toMatchObject({
      participantId: "participant-b",
    });
  });

  it("requires the exact strong correction confirmation", async () => {
    const { body } = await call("correctSpecialRevealResolution", {
      code: testCode,
      confirmation: "CONFIRM",
      correctOption: "option-a",
      expectedStateRevision: 6,
      expectedResolutionRevision: 2,
    });
    expect(body.error?.status).toBe("INVALID_ARGUMENT");
  });

  it("treats a same-outcome correction as idempotent", async () => {
    const { body } = await call("correctSpecialRevealResolution", {
      code: testCode,
      confirmation: "CORRECT RESULT",
      correctOption: "option-b",
      expectedStateRevision: 6,
      expectedResolutionRevision: 2,
    });
    expect(body.result).toMatchObject({ applied: false, stateRevision: 6 });
  });

  it("reconciles a damaged ledger without changing the public resolution", async () => {
    const resolution = (
      await database.ref("specialReveal/publicResolution").get()
    ).val();
    await database
      .ref("championshipLedger/predictionSources/event-neutral/entries")
      .set(null);
    const { body } = await call("reconcilePredictionLedger", {
      expectedStateRevision: 6,
    });
    expect(body.result?.applied).toBe(true);
    expect(
      (await database.ref("specialReveal/publicResolution").get()).val(),
    ).toEqual(resolution);
    const source = (
      await database
        .ref("championshipLedger/predictionSources/event-neutral")
        .get()
    ).val();
    expect(source.meta.entryCount).toBe(1);
  });

  it("makes a repeated reconciliation a no-op", async () => {
    const { body } = await call("reconcilePredictionLedger", {
      expectedStateRevision: 6,
    });
    expect(body.result?.applied).toBe(false);
  });

  it("persists five failed attempts and enforces the lock window", async () => {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const { body } = await call(
        "openSpecialReveal",
        {
          code: `${testCode}-invalid-${attempt}`,
          expectedConfigRevision: 1,
          expectedStateRevision: null,
        },
        rateAdminToken,
      );
      expect(body.error?.status).toBe("PERMISSION_DENIED");
    }
    const { body } = await call(
      "openSpecialReveal",
      {
        code: testCode,
        expectedConfigRevision: 1,
        expectedStateRevision: null,
      },
      rateAdminToken,
    );
    expect(body.error?.status).toBe("RESOURCE_EXHAUSTED");
    const attempts = (
      await database.ref("specialReveal/privateSecurity/attempts").get()
    ).val();
    expect(Object.values(attempts)[0]).toMatchObject({ failedCount: 5 });
    expect(JSON.stringify(attempts)).not.toContain(testCode);
  });
});
