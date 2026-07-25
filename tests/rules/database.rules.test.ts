import { readFile } from "node:fs/promises";
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import {
  get,
  orderByChild,
  equalTo,
  query,
  ref,
  remove,
  set,
  update,
} from "firebase/database";
import { afterAll, afterEach, beforeAll, describe, it } from "vitest";

const projectId = "demo-games-and-castles";
let environment: RulesTestEnvironment;

function participant(
  id: string,
  ownerUid: string | null,
  overrides: Record<string, unknown> = {},
) {
  const value: Record<string, unknown> = {
    id,
    displayName: "Castle Guest",
    avatar: { icon: "castle", tone: "cyan" },
    status: "active",
    createdAt: Date.now(),
    createdByUid: ownerUid ?? "admin",
    updatedAt: Date.now(),
    updatedByUid: ownerUid ?? "admin",
    schemaVersion: 1,
    ...overrides,
  };
  if (ownerUid) value.ownerUid = ownerUid;
  return value;
}

async function seed(data: Record<string, unknown>) {
  await environment.withSecurityRulesDisabled(async (context) => {
    await set(ref(context.database()), data);
  });
}

describe("Realtime Database security rules", () => {
  beforeAll(async () => {
    environment = await initializeTestEnvironment({
      projectId,
      database: {
        rules: await readFile("database.rules.json", "utf8"),
        host: "127.0.0.1",
        port: 9000,
      },
    });
  });

  afterEach(async () => environment.clearDatabase());
  afterAll(async () => environment.cleanup());

  it("denies an unauthenticated participant collection read", async () => {
    await assertFails(
      get(ref(environment.unauthenticatedContext().database(), "participants")),
    );
  });

  it("allows an authenticated active-roster query", async () => {
    await seed({ participants: { active: participant("active", "owner-a") } });
    const database = environment.authenticatedContext("guest").database();
    await assertSucceeds(
      get(
        query(
          ref(database, "participants"),
          orderByChild("status"),
          equalTo("active"),
        ),
      ),
    );
  });

  it("denies an unfiltered participant collection read to a guest", async () => {
    const database = environment.authenticatedContext("guest").database();
    await assertFails(get(ref(database, "participants")));
  });

  it("denies an inactive-roster query to a guest", async () => {
    const database = environment.authenticatedContext("guest").database();
    await assertFails(
      get(
        query(
          ref(database, "participants"),
          orderByChild("status"),
          equalTo("inactive"),
        ),
      ),
    );
  });

  it("allows an authenticated guest to read an active participant", async () => {
    await seed({ participants: { active: participant("active", "owner-a") } });
    const database = environment.authenticatedContext("guest").database();
    await assertSucceeds(get(ref(database, "participants/active")));
  });

  it("denies a non-owner from reading an inactive participant", async () => {
    await seed({
      participants: {
        hidden: participant("hidden", "owner-a", { status: "inactive" }),
      },
    });
    const database = environment.authenticatedContext("guest").database();
    await assertFails(get(ref(database, "participants/hidden")));
  });

  it("allows an owner to read their inactive participant", async () => {
    await seed({
      participants: {
        owner: participant("owner", "owner", { status: "inactive" }),
      },
    });
    const database = environment.authenticatedContext("owner").database();
    await assertSucceeds(get(ref(database, "participants/owner")));
  });

  it("allows an admin to read all participants", async () => {
    const database = environment
      .authenticatedContext("admin", { admin: true })
      .database();
    await assertSucceeds(get(ref(database, "participants")));
  });

  it("allows a guest to create their own active participant", async () => {
    const database = environment.authenticatedContext("guest-a").database();
    await assertSucceeds(
      set(
        ref(database, "participants/guest-a"),
        participant("guest-a", "guest-a"),
      ),
    );
  });

  it("denies guest creation under another ID", async () => {
    const database = environment.authenticatedContext("guest-a").database();
    await assertFails(
      set(ref(database, "participants/other"), participant("other", "guest-a")),
    );
  });

  it("denies a guest-created inactive participant", async () => {
    const database = environment.authenticatedContext("guest-a").database();
    await assertFails(
      set(
        ref(database, "participants/guest-a"),
        participant("guest-a", "guest-a", { status: "inactive" }),
      ),
    );
  });

  it("denies a too-short display name", async () => {
    const database = environment.authenticatedContext("guest-a").database();
    await assertFails(
      set(
        ref(database, "participants/guest-a"),
        participant("guest-a", "guest-a", { displayName: "A" }),
      ),
    );
  });

  it("denies an unapproved avatar", async () => {
    const database = environment.authenticatedContext("guest-a").database();
    await assertFails(
      set(
        ref(database, "participants/guest-a"),
        participant("guest-a", "guest-a", {
          avatar: { icon: "dragon", tone: "cyan" },
        }),
      ),
    );
  });

  it("denies unknown participant fields", async () => {
    const database = environment.authenticatedContext("guest-a").database();
    await assertFails(
      set(
        ref(database, "participants/guest-a"),
        participant("guest-a", "guest-a", { secret: "nope" }),
      ),
    );
  });

  it("allows an owner to update display fields", async () => {
    await seed({ participants: { owner: participant("owner", "owner") } });
    const database = environment.authenticatedContext("owner").database();
    await assertSucceeds(
      update(ref(database, "participants/owner"), {
        displayName: "Updated Guest",
        avatar: { icon: "dice", tone: "gold" },
        updatedAt: Date.now(),
        updatedByUid: "owner",
      }),
    );
  });

  it("denies an owner changing status", async () => {
    await seed({ participants: { owner: participant("owner", "owner") } });
    const database = environment.authenticatedContext("owner").database();
    await assertFails(
      update(ref(database, "participants/owner"), {
        status: "inactive",
        updatedAt: Date.now(),
        updatedByUid: "owner",
      }),
    );
  });

  it("denies an owner changing immutable creation data", async () => {
    await seed({ participants: { owner: participant("owner", "owner") } });
    const database = environment.authenticatedContext("owner").database();
    await assertFails(
      update(ref(database, "participants/owner"), {
        createdByUid: "someone-else",
        updatedAt: Date.now(),
        updatedByUid: "owner",
      }),
    );
  });

  it("denies participant deletion", async () => {
    await seed({ participants: { owner: participant("owner", "owner") } });
    const database = environment.authenticatedContext("owner").database();
    await assertFails(remove(ref(database, "participants/owner")));
  });

  it("denies a guest updating another participant", async () => {
    await seed({ participants: { owner: participant("owner", "owner") } });
    const database = environment.authenticatedContext("guest").database();
    await assertFails(
      update(ref(database, "participants/owner"), {
        displayName: "Hijacked",
        updatedAt: Date.now(),
        updatedByUid: "guest",
      }),
    );
  });

  it("allows an admin to create an organizer-managed participant", async () => {
    const database = environment
      .authenticatedContext("admin", { admin: true })
      .database();
    await assertSucceeds(
      set(
        ref(database, "participants/generated-id"),
        participant("generated-id", null),
      ),
    );
  });

  it("denies an admin assigning ownership on creation", async () => {
    const database = environment
      .authenticatedContext("admin", { admin: true })
      .database();
    await assertFails(
      set(
        ref(database, "participants/generated-id"),
        participant("generated-id", "guest"),
      ),
    );
  });

  it("allows an admin to edit and deactivate a participant", async () => {
    await seed({ participants: { owner: participant("owner", "owner") } });
    const database = environment
      .authenticatedContext("admin", { admin: true })
      .database();
    await assertSucceeds(
      update(ref(database, "participants/owner"), {
        displayName: "Managed Guest",
        status: "inactive",
        updatedAt: Date.now(),
        updatedByUid: "admin",
      }),
    );
  });

  it("denies an admin deleting a participant", async () => {
    await seed({ participants: { generated: participant("generated", null) } });
    const database = environment
      .authenticatedContext("admin", { admin: true })
      .database();
    await assertFails(remove(ref(database, "participants/generated")));
  });

  it("allows a guest to create and read their own profile", async () => {
    const now = Date.now();
    const database = environment.authenticatedContext("guest-a").database();
    await assertSucceeds(
      set(ref(database, "userProfiles/guest-a"), {
        uid: "guest-a",
        participantId: "guest-a",
        createdAt: now,
        updatedAt: now,
        schemaVersion: 1,
      }),
    );
    await assertSucceeds(get(ref(database, "userProfiles/guest-a")));
  });

  it("denies a guest reading another profile", async () => {
    const database = environment.authenticatedContext("guest-a").database();
    await assertFails(get(ref(database, "userProfiles/guest-b")));
  });

  it("denies a guest writing another profile", async () => {
    const now = Date.now();
    const database = environment.authenticatedContext("guest-a").database();
    await assertFails(
      set(ref(database, "userProfiles/guest-b"), {
        uid: "guest-b",
        participantId: "guest-b",
        createdAt: now,
        updatedAt: now,
        schemaVersion: 1,
      }),
    );
  });

  it("allows an admin to read a guest profile", async () => {
    const database = environment
      .authenticatedContext("admin", { admin: true })
      .database();
    await assertSucceeds(get(ref(database, "userProfiles/guest-a")));
  });
});
