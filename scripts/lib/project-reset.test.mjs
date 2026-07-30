import { describe, expect, it } from "vitest";
import {
  buildProjectResetPreview,
  classifyAuthUser,
  resetConfirmationPhrase,
  resetProjectData,
} from "./project-reset.mjs";

function authUser({ uid, email, providers = [], customClaims = {} }) {
  return {
    uid,
    email,
    providerData: providers.map((providerId) => ({ providerId })),
    customClaims,
  };
}

class FakeAuth {
  constructor(users) {
    this.users = new Map(users.map((user) => [user.uid, user]));
    this.deletedBatches = [];
  }

  async listUsers(limit, pageToken) {
    const users = [...this.users.values()];
    const start = Number(pageToken ?? 0);
    const page = users.slice(start, start + limit);
    const next = start + page.length;
    return {
      users: page,
      pageToken: next < users.length ? String(next) : undefined,
    };
  }

  async deleteUsers(uids) {
    this.deletedBatches.push([...uids]);
    let successCount = 0;
    for (const uid of uids) {
      if (this.users.delete(uid)) successCount += 1;
    }
    return { successCount, failureCount: 0, errors: [] };
  }
}

class FakeDatabase {
  constructor(root) {
    this.root = root;
    this.removeCalls = 0;
  }

  ref() {
    return {
      remove: async () => {
        this.root = null;
        this.removeCalls += 1;
      },
    };
  }
}

describe("pre-participant project reset", () => {
  const anonymous = authUser({ uid: "anonymous" });
  const organizer = authUser({
    uid: "organizer",
    email: "organizer@example.test",
    providers: ["password"],
    customClaims: { admin: true, specialRevealAdmin: true, retained: "yes" },
  });
  const other = authUser({
    uid: "other",
    email: "other@example.test",
    providers: ["password"],
    customClaims: { retained: "also" },
  });

  it("classifies only providerless accounts as anonymous and requires the organizer claim", () => {
    expect(classifyAuthUser(anonymous)).toBe("anonymous");
    expect(classifyAuthUser(organizer)).toBe("organizer");
    expect(classifyAuthUser(other)).toBe("other");
    expect(resetConfirmationPhrase("example-project")).toBe(
      "RESET example-project",
    );
  });

  it("builds a sanitized count report and lists only other persistent accounts", () => {
    const preview = buildProjectResetPreview(
      {
        participants: { one: {}, two: {} },
        audit: { entry: {} },
      },
      [anonymous, organizer, other],
    );
    expect(preview).toMatchObject({
      database: { topLevelBranches: 2, directRecords: 3 },
      auth: { total: 3, anonymous: 1, organizers: 1, other: 1 },
    });
    expect(preview.auth.otherAccounts).toEqual([
      {
        uid: "other",
        email: "other@example.test",
        providerIds: ["password"],
      },
    ]);
    expect(JSON.stringify(preview)).not.toContain("specialRevealAdmin");
    expect(JSON.stringify(preview)).not.toContain("retained");
  });

  it("clears the database, deletes anonymous users, and preserves persistent users and claims", async () => {
    const database = new FakeDatabase({ participants: { one: {} } });
    const auth = new FakeAuth([anonymous, organizer, other]);
    const organizerClaims = structuredClone(organizer.customClaims);
    const otherClaims = structuredClone(other.customClaims);

    await expect(resetProjectData({ database, auth })).resolves.toEqual({
      databaseCleared: true,
      anonymousUsersDeleted: 1,
    });
    expect(database.root).toBeNull();
    expect(auth.users.has("anonymous")).toBe(false);
    expect(auth.users.get("organizer")?.customClaims).toEqual(organizerClaims);
    expect(auth.users.get("other")?.customClaims).toEqual(otherClaims);

    await expect(resetProjectData({ database, auth })).resolves.toEqual({
      databaseCleared: true,
      anonymousUsersDeleted: 0,
    });
    expect(database.removeCalls).toBe(2);
    expect(auth.users.has("organizer")).toBe(true);
    expect(auth.users.has("other")).toBe(true);
  });

  it("deletes anonymous users in Firebase-sized batches", async () => {
    const anonymousUsers = Array.from({ length: 1001 }, (_, index) =>
      authUser({ uid: `anonymous-${index}` }),
    );
    const auth = new FakeAuth([...anonymousUsers, organizer]);
    await resetProjectData({ database: new FakeDatabase({}), auth });
    expect(auth.deletedBatches.map((batch) => batch.length)).toEqual([1000, 1]);
    expect(auth.users.has("organizer")).toBe(true);
  });
});
