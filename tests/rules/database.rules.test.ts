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

function competitionDraft(id: string, overrides: Record<string, unknown> = {}) {
  const now = Date.now();
  return {
    id,
    title: "Castle Cup",
    gameName: "Mario Kart",
    description: "A friendly opening championship.",
    iconKey: "trophy",
    format: "round-robin-knockout",
    participantIds: ["guest-1", "guest-2", "guest-3", "guest-4"],
    formatConfig: {
      kind: "round-robin-knockout",
      series: {
        kind: "best-of",
        winsRequired: 2,
        maximumRounds: 3,
      },
      allowDraws: false,
      qualificationCount: 4,
      includeThirdPlace: false,
    },
    scoringConfig: {
      kind: "head-to-head",
      table: {
        pointsForMatchWin: 3,
        pointsForDraw: 1,
        pointsForMatchLoss: 0,
      },
      overall: {
        matchWinBonus: 2,
        pointsPerRoundWon: 1,
        participationPoints: 0,
        qualificationBonus: 0,
        competitionWinnerBonus: 0,
        runnerUpBonus: 0,
        thirdPlaceBonus: 0,
      },
    },
    displayOrder: 0,
    createdAt: now,
    updatedAt: now,
    createdByUid: "admin",
    updatedByUid: "admin",
    revision: 1,
    schemaVersion: 1,
    status: "draft",
    ...overrides,
  };
}

function publishedCompetition(
  draft: ReturnType<typeof competitionDraft>,
  overrides: Record<string, unknown> = {},
) {
  const now = Date.now();
  return {
    ...draft,
    status: "scheduled",
    displayOrder: 100,
    updatedAt: now,
    updatedByUid: "admin",
    revision: Number(draft.revision) + 1,
    publishedAt: now,
    publishedByUid: "admin",
    ...overrides,
  };
}

function auditEntry(
  id: string,
  entityId: string,
  overrides: Record<string, unknown> = {},
) {
  return {
    id,
    action: "draft-created",
    entityType: "competition",
    entityId,
    actorUid: "admin",
    afterRevision: 1,
    occurredAt: Date.now(),
    summary: "Competition draft created.",
    schemaVersion: 1,
    ...overrides,
  };
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

  it("denies unauthenticated competition reads", async () => {
    const database = environment.unauthenticatedContext().database();
    await assertFails(get(ref(database, "competitions")));
    await assertFails(get(ref(database, "competitionDrafts")));
  });

  it("allows an authenticated guest to read published competitions only", async () => {
    const draft = competitionDraft("castle-cup");
    await seed({
      competitionDrafts: { "castle-cup": draft },
      competitions: { "castle-cup": publishedCompetition(draft) },
    });
    const database = environment.authenticatedContext("guest").database();
    await assertSucceeds(get(ref(database, "competitions")));
    await assertFails(get(ref(database, "competitionDrafts")));
    await assertFails(get(ref(database, "audit")));
  });

  it("allows an admin to read draft and audit collections", async () => {
    const database = environment
      .authenticatedContext("admin", { admin: true })
      .database();
    await assertSucceeds(get(ref(database, "competitionDrafts")));
    await assertSucceeds(get(ref(database, "audit")));
  });

  it("denies guest writes to all competition-owned paths", async () => {
    const database = environment.authenticatedContext("guest").database();
    const draft = competitionDraft("castle-cup");
    await assertFails(
      set(ref(database, "competitionDrafts/castle-cup"), draft),
    );
    await assertFails(
      set(
        ref(database, "competitions/castle-cup"),
        publishedCompetition(draft),
      ),
    );
    await assertFails(
      set(
        ref(database, "audit/guest-audit"),
        auditEntry("guest-audit", "castle-cup", { actorUid: "guest" }),
      ),
    );
  });

  it("allows an admin to create, revise and delete a private draft", async () => {
    const database = environment
      .authenticatedContext("admin", { admin: true })
      .database();
    const draft = competitionDraft("castle-cup");
    await assertSucceeds(
      set(ref(database, "competitionDrafts/castle-cup"), draft),
    );
    await assertSucceeds(
      update(ref(database, "competitionDrafts/castle-cup"), {
        title: "Castle Cup Revised",
        revision: 2,
        updatedAt: Date.now(),
        updatedByUid: "admin",
      }),
    );
    await assertSucceeds(remove(ref(database, "competitionDrafts/castle-cup")));
  });

  it("allows an incomplete private draft with an omitted empty participant list", async () => {
    const database = environment
      .authenticatedContext("admin", { admin: true })
      .database();
    const draft = competitionDraft("empty-draft", {
      title: "",
      gameName: "",
    });
    delete (draft as Record<string, unknown>).participantIds;
    await assertSucceeds(
      set(ref(database, "competitionDrafts/empty-draft"), draft),
    );
  });

  it("rejects stale draft revisions and immutable-field changes", async () => {
    const draft = competitionDraft("castle-cup");
    await seed({ competitionDrafts: { "castle-cup": draft } });
    const database = environment
      .authenticatedContext("admin", { admin: true })
      .database();
    await assertFails(
      update(ref(database, "competitionDrafts/castle-cup"), {
        revision: 3,
        updatedAt: Date.now(),
        updatedByUid: "admin",
      }),
    );
    await assertFails(
      update(ref(database, "competitionDrafts/castle-cup"), {
        createdByUid: "other-admin",
        revision: 2,
        updatedAt: Date.now(),
        updatedByUid: "admin",
      }),
    );
  });

  it("publishes atomically by creating the scheduled record and removing its draft", async () => {
    const draft = competitionDraft("castle-cup");
    await seed({ competitionDrafts: { "castle-cup": draft } });
    const database = environment
      .authenticatedContext("admin", { admin: true })
      .database();
    await assertSucceeds(
      update(ref(database), {
        "competitionDrafts/castle-cup": null,
        "competitions/castle-cup": publishedCompetition(draft),
        "audit/publish-castle-cup": auditEntry(
          "publish-castle-cup",
          "castle-cup",
          {
            action: "competition-published",
            beforeRevision: 1,
            afterRevision: 2,
          },
        ),
      }),
    );
    await assertSucceeds(get(ref(database, "competitions/castle-cup")));
  });

  it("rejects publishing a record that does not match its draft", async () => {
    const draft = competitionDraft("castle-cup");
    await seed({ competitionDrafts: { "castle-cup": draft } });
    const database = environment
      .authenticatedContext("admin", { admin: true })
      .database();
    await assertFails(
      update(ref(database), {
        "competitionDrafts/castle-cup": null,
        "competitions/castle-cup": publishedCompetition(draft, {
          title: "Substituted title",
        }),
      }),
    );
  });

  it("allows scheduled edits, archive and restore only with the next revision", async () => {
    const draft = competitionDraft("castle-cup");
    const scheduled = publishedCompetition(draft);
    await seed({ competitions: { "castle-cup": scheduled } });
    const database = environment
      .authenticatedContext("admin", { admin: true })
      .database();
    await assertSucceeds(
      update(ref(database, "competitions/castle-cup"), {
        title: "Castle Cup Updated",
        revision: 3,
        updatedAt: Date.now(),
        updatedByUid: "admin",
      }),
    );
    await assertSucceeds(
      update(ref(database, "competitions/castle-cup"), {
        status: "archived",
        revision: 4,
        updatedAt: Date.now(),
        updatedByUid: "admin",
      }),
    );
    await assertSucceeds(
      update(ref(database, "competitions/castle-cup"), {
        status: "scheduled",
        revision: 5,
        updatedAt: Date.now(),
        updatedByUid: "admin",
      }),
    );
  });

  it("rejects stale, invalid-status and delete operations on published competitions", async () => {
    const draft = competitionDraft("castle-cup");
    await seed({
      competitions: { "castle-cup": publishedCompetition(draft) },
    });
    const database = environment
      .authenticatedContext("admin", { admin: true })
      .database();
    await assertFails(
      update(ref(database, "competitions/castle-cup"), {
        revision: 4,
        updatedAt: Date.now(),
        updatedByUid: "admin",
      }),
    );
    await assertFails(
      update(ref(database, "competitions/castle-cup"), {
        status: "live",
        revision: 3,
        updatedAt: Date.now(),
        updatedByUid: "admin",
      }),
    );
    await assertFails(remove(ref(database, "competitions/castle-cup")));
  });

  it("allows an atomic reorder only when every affected revision advances", async () => {
    const firstDraft = competitionDraft("first");
    const secondDraft = competitionDraft("second");
    await seed({
      competitions: {
        first: publishedCompetition(firstDraft, { displayOrder: 100 }),
        second: publishedCompetition(secondDraft, { displayOrder: 200 }),
      },
    });
    const database = environment
      .authenticatedContext("admin", { admin: true })
      .database();
    await assertSucceeds(
      update(ref(database), {
        "competitions/first/displayOrder": 200,
        "competitions/first/revision": 3,
        "competitions/first/updatedAt": Date.now(),
        "competitions/first/updatedByUid": "admin",
        "competitions/second/displayOrder": 100,
        "competitions/second/revision": 3,
        "competitions/second/updatedAt": Date.now(),
        "competitions/second/updatedByUid": "admin",
      }),
    );
    await assertFails(
      update(ref(database), {
        "competitions/first/displayOrder": 300,
        "competitions/first/updatedAt": Date.now(),
        "competitions/first/updatedByUid": "admin",
      }),
    );
  });

  it("rejects malformed enums, scoring bounds, references and schemas", async () => {
    const database = environment
      .authenticatedContext("admin", { admin: true })
      .database();
    await assertFails(
      set(
        ref(database, "competitionDrafts/bad-format"),
        competitionDraft("bad-format", { format: "knockout" }),
      ),
    );
    const badScoring = competitionDraft("bad-scoring");
    const scoring = badScoring.scoringConfig as {
      overall: { matchWinBonus: number };
    };
    scoring.overall.matchWinBonus = -1;
    await assertFails(
      set(ref(database, "competitionDrafts/bad-scoring"), badScoring),
    );
    const excessiveScoring = competitionDraft("excessive-scoring");
    (
      excessiveScoring.scoringConfig as {
        overall: { matchWinBonus: number };
      }
    ).overall.matchWinBonus = 101;
    await assertFails(
      set(
        ref(database, "competitionDrafts/excessive-scoring"),
        excessiveScoring,
      ),
    );
    await assertFails(
      set(
        ref(database, "competitionDrafts/bad-participant"),
        competitionDraft("bad-participant", {
          participantIds: ["guest-1", ""],
        }),
      ),
    );
    await assertFails(
      set(
        ref(database, "competitionDrafts/bad-schema"),
        competitionDraft("bad-schema", { schemaVersion: 2 }),
      ),
    );
    await assertFails(
      set(
        ref(database, "competitionDrafts/extra"),
        competitionDraft("extra", { fixtureIds: ["future-fixture"] }),
      ),
    );
  });

  it("rejects changing the stable competition ID", async () => {
    const draft = competitionDraft("castle-cup");
    await seed({ competitionDrafts: { "castle-cup": draft } });
    const database = environment
      .authenticatedContext("admin", { admin: true })
      .database();
    await assertFails(
      update(ref(database, "competitionDrafts/castle-cup"), {
        id: "different-id",
        revision: 2,
        updatedAt: Date.now(),
        updatedByUid: "admin",
      }),
    );
  });

  it("denies competition reordering by a guest", async () => {
    const draft = competitionDraft("castle-cup");
    await seed({ competitions: { "castle-cup": publishedCompetition(draft) } });
    const database = environment.authenticatedContext("guest").database();
    await assertFails(
      update(ref(database, "competitions/castle-cup"), {
        displayOrder: 200,
        revision: 3,
        updatedAt: Date.now(),
        updatedByUid: "guest",
      }),
    );
  });

  it("keeps the audit log append-only and organizer-only", async () => {
    const database = environment
      .authenticatedContext("admin", { admin: true })
      .database();
    await assertSucceeds(
      set(
        ref(database, "audit/create-castle-cup"),
        auditEntry("create-castle-cup", "castle-cup"),
      ),
    );
    await assertFails(
      update(ref(database, "audit/create-castle-cup"), {
        summary: "Rewritten history.",
      }),
    );
    await assertFails(remove(ref(database, "audit/create-castle-cup")));
  });

  it("denies unplanned future competition paths by default", async () => {
    const admin = environment
      .authenticatedContext("admin", { admin: true })
      .database();
    const guest = environment.authenticatedContext("guest").database();
    await assertFails(
      set(ref(admin, "fixtures/example"), { status: "pending" }),
    );
    await assertFails(
      set(ref(admin, "matches/example"), { status: "pending" }),
    );
    await assertFails(
      set(ref(admin, "groups/example"), { participantIds: [] }),
    );
    await assertFails(
      set(ref(admin, "sessions/example"), { status: "pending" }),
    );
    await assertFails(
      set(ref(admin, "results/example"), { winner: "guest-1" }),
    );
    await assertFails(set(ref(admin, "scoreLedger/example"), { points: 10 }));
    await assertFails(
      set(ref(admin, "birthdayMessages/example"), { message: "private" }),
    );
    await assertFails(
      set(ref(admin, "predictions/example"), { choice: "private" }),
    );
    await assertFails(
      set(ref(admin, "reveals/example"), { payload: "private" }),
    );
    await assertFails(get(ref(guest, "fixtures")));
  });
});
