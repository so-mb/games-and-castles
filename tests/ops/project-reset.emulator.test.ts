import { deleteApp, initializeApp, type App } from "firebase-admin/app";
import { getAuth, type Auth } from "firebase-admin/auth";
import { getDatabase, type Database } from "firebase-admin/database";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  buildProjectResetPreview,
  listAllAuthUsers,
  resetProjectData,
} from "../../scripts/lib/project-reset.mjs";

const projectId = "demo-games-and-castles";
let app: App;
let auth: Auth;
let database: Database;

async function clearAuth() {
  const users = await listAllAuthUsers(auth);
  if (users.length > 0) await auth.deleteUsers(users.map((user) => user.uid));
}

beforeAll(() => {
  if (
    process.env.FIREBASE_AUTH_EMULATOR_HOST !== "127.0.0.1:9099" ||
    process.env.FIREBASE_DATABASE_EMULATOR_HOST !== "127.0.0.1:9000"
  )
    throw new Error(
      "Run this suite only through npm run test:ops:reset-emulator.",
    );
  app = initializeApp(
    { projectId, databaseURL: `http://127.0.0.1:9000?ns=${projectId}` },
    "project-reset-emulator-test",
  );
  auth = getAuth(app);
  database = getDatabase(app);
});

beforeEach(async () => {
  await Promise.all([database.ref().remove(), clearAuth()]);
});

afterAll(async () => {
  await Promise.all([database.ref().remove(), clearAuth()]);
  await deleteApp(app);
});

describe("project reset against Firebase emulators", () => {
  it("deletes application data and anonymous users while preserving persistent accounts", async () => {
    await database.ref().set({
      participants: { guest: { displayName: "Synthetic guest" } },
      competitions: { test: { title: "Synthetic competition" } },
    });
    await auth.createUser({ uid: "anonymous-test-user" });
    await auth.createUser({
      uid: "organizer-test-user",
      email: "organizer@example.test",
      password: "emulator-organizer-password",
    });
    const organizerClaims = {
      admin: true,
      specialRevealAdmin: true,
      retained: "organizer-claim",
    };
    await auth.setCustomUserClaims("organizer-test-user", organizerClaims);
    await auth.createUser({
      uid: "other-test-user",
      email: "other@example.test",
      password: "emulator-other-password",
    });
    const otherClaims = { retained: "other-claim" };
    await auth.setCustomUserClaims("other-test-user", otherClaims);

    const preview = buildProjectResetPreview(
      (await database.ref().get()).val(),
      await listAllAuthUsers(auth),
    );
    expect(preview).toMatchObject({
      database: { topLevelBranches: 2 },
      auth: { anonymous: 1, organizers: 1, other: 1 },
    });

    await expect(resetProjectData({ database, auth })).resolves.toEqual({
      databaseCleared: true,
      anonymousUsersDeleted: 1,
    });
    expect((await database.ref().get()).val()).toBeNull();
    await expect(auth.getUser("anonymous-test-user")).rejects.toMatchObject({
      code: "auth/user-not-found",
    });
    await expect(auth.getUser("organizer-test-user")).resolves.toMatchObject({
      customClaims: organizerClaims,
    });
    await expect(auth.getUser("other-test-user")).resolves.toMatchObject({
      customClaims: otherClaims,
    });

    await expect(resetProjectData({ database, auth })).resolves.toEqual({
      databaseCleared: true,
      anonymousUsersDeleted: 0,
    });
  });
});
