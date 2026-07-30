import { describe, expect, it } from "vitest";
import {
  applyDevRestore,
  buildDevRestorePlan,
  restoreConfirmationPhrase,
} from "./project-restore.mjs";

function backupUser({
  uid,
  email = null,
  providers = [],
  customClaims = {},
  disabled = false,
  emailVerified = false,
}) {
  return {
    uid,
    email,
    emailVerified,
    disabled,
    providerIds: providers,
    customClaims,
  };
}

function currentUser(user) {
  return {
    ...user,
    providerData: user.providerIds.map((providerId) => ({ providerId })),
  };
}

function backupPayload(authUsers) {
  return {
    metadata: { authUserCount: authUsers.length },
    database: { participants: { one: { ownerUid: "guest" } } },
    authUsers,
  };
}

class FakeAuth {
  constructor(users) {
    this.users = new Map(users.map((user) => [user.uid, user]));
  }

  async createUser(properties) {
    this.users.set(properties.uid, {
      uid: properties.uid,
      disabled: properties.disabled,
      providerData: [],
      customClaims: {},
    });
  }

  async updateUser(uid, properties) {
    Object.assign(this.users.get(uid), properties);
  }

  async setCustomUserClaims(uid, customClaims) {
    this.users.get(uid).customClaims = customClaims ?? {};
  }
}

class FakeDatabase {
  constructor(root = null) {
    this.root = root;
    this.setCalls = 0;
  }

  ref() {
    return {
      set: async (value) => {
        this.root = value;
        this.setCalls += 1;
      },
    };
  }
}

describe("development backup restore", () => {
  const guest = backupUser({ uid: "guest" });
  const organizer = backupUser({
    uid: "organizer",
    email: "organizer@example.test",
    emailVerified: true,
    providers: ["password"],
    customClaims: { admin: true, specialRevealAdmin: true },
  });

  it("builds a restore plan for an empty target with its organizer preserved", () => {
    const plan = buildDevRestorePlan({
      backup: backupPayload([guest, organizer]),
      currentDatabase: null,
      currentUsers: [currentUser(organizer)],
    });
    expect(plan).toMatchObject({
      databaseAlreadyRestored: false,
      anonymousUsersAlreadyRestored: 0,
      persistentUsers: 1,
      database: { topLevelBranches: 1, directRecords: 1 },
    });
    expect(plan.anonymousUsersToCreate).toEqual([guest]);
    expect(restoreConfirmationPhrase("games-and-castles-dev")).toBe(
      "RESTORE games-and-castles-dev",
    );
  });

  it("recreates anonymous UIDs and restores the database without changing persistent users", async () => {
    const backup = backupPayload([guest, organizer]);
    const currentOrganizer = currentUser(organizer);
    const auth = new FakeAuth([currentOrganizer]);
    const database = new FakeDatabase();
    const plan = buildDevRestorePlan({
      backup,
      currentDatabase: database.root,
      currentUsers: [currentOrganizer],
    });

    await expect(
      applyDevRestore({ database, auth, backup, plan }),
    ).resolves.toEqual({
      databaseRestored: true,
      anonymousUsersCreated: 1,
    });
    expect(database.root).toEqual(backup.database);
    expect(auth.users.get("guest")?.providerData).toEqual([]);
    expect(auth.users.get("organizer")).toBe(currentOrganizer);
  });

  it("accepts an already restored target as an idempotent no-op plan", () => {
    const backup = backupPayload([guest, organizer]);
    const plan = buildDevRestorePlan({
      backup,
      currentDatabase: structuredClone(backup.database),
      currentUsers: [currentUser(guest), currentUser(organizer)],
    });
    expect(plan.databaseAlreadyRestored).toBe(true);
    expect(plan.anonymousUsersToCreate).toEqual([]);
    expect(plan.anonymousUsersAlreadyRestored).toBe(1);
  });

  it("refuses divergent database or Auth state", () => {
    const backup = backupPayload([guest, organizer]);
    expect(() =>
      buildDevRestorePlan({
        backup,
        currentDatabase: { unexpected: true },
        currentUsers: [currentUser(organizer)],
      }),
    ).toThrow("neither empty nor identical");
    expect(() =>
      buildDevRestorePlan({
        backup,
        currentDatabase: null,
        currentUsers: [
          currentUser(organizer),
          currentUser(backupUser({ uid: "unexpected" })),
        ],
      }),
    ).toThrow("absent from the backup");
  });
});
