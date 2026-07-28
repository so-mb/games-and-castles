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
  type Database,
} from "firebase/database";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { createCompetitionRun } from "../../src/features/competitions/engine/activation";
import {
  completeCompetitionRun,
  generateRunKnockout,
  recordMatchResult,
  reopenCompetitionRun,
  resolveRunTie,
  setMatchInProgress,
} from "../../src/features/competitions/engine/lifecycle";
import {
  deriveStandings,
  qualificationBlockingTies,
} from "../../src/features/competitions/engine/standings";
import type { CompetitionRun } from "../../src/features/competitions/engine/types";
import type { PublishedCompetition } from "../../src/features/competitions/domain/types";
import {
  completeAllHandsRun,
  createAllHandsRun,
  createAllHandsSession,
  recordAllHandsResult,
  reopenAllHandsRun,
  requestAllHandsCompletionReview,
  restoreAllHandsSession,
  voidAllHandsSession,
} from "../../src/features/competitions/all-hands/engine";
import type {
  AllHandsCompetitionRun,
  AllHandsResultInput,
} from "../../src/features/competitions/all-hands/types";
import { createGroupDrawPreview } from "../../src/features/competitions/group-knockout/generation";
import {
  beginQualificationReview,
  completeGroupCompetition,
  generateGroupKnockout,
  recordGroupMatchResult,
  reopenGroupCompetition,
  resolveCrossGroupSeedTie,
} from "../../src/features/competitions/group-knockout/engine";
import { deriveCrossGroupSeeds } from "../../src/features/competitions/group-knockout/standings";
import type { GroupKnockoutRun } from "../../src/features/competitions/group-knockout/types";
import { deriveCompetitionLedgerSnapshot } from "../../src/features/championship/ledger/snapshot";
import type { ManualChampionshipBonus } from "../../src/features/championship/domain/types";
import {
  buildCorrectRevealMutation,
  buildOpenRevealMutation,
  buildPredictionStateMutation,
  buildReconcilePredictionMutation,
  buildResolveRevealMutation,
} from "../../src/features/special-reveal/domain/operations";
import type {
  PredictionLedgerSnapshot,
  SpecialRevealPrediction,
  SpecialRevealPrivateConfig,
  SpecialRevealPublicResolution,
  SpecialRevealPublicState,
} from "../../src/features/special-reveal/domain/types";

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

async function seedAt(path: string, data: unknown) {
  await environment.withSecurityRulesDisabled(async (context) => {
    await set(ref(context.database(), path), data);
  });
}

function phaseFourFixture(
  id = "merry-runtime",
  competitionOverrides: Record<string, unknown> = {},
) {
  const competition = publishedCompetition(competitionDraft(id), {
    ...competitionOverrides,
  }) as PublishedCompetition;
  const run = createCompetitionRun(competition, "admin", Date.now(), () => 0);
  return { competition, run };
}

function activeCompetition(competition: PublishedCompetition) {
  return {
    ...competition,
    status: "active" as const,
    revision: competition.revision + 1,
    updatedAt: Date.now(),
  };
}

function phaseSevenSource(
  competition: PublishedCompetition,
  run: CompetitionRun | AllHandsCompetitionRun | GroupKnockoutRun,
) {
  return deriveCompetitionLedgerSnapshot({
    competition,
    run,
    generatedAt: Date.now(),
  });
}

function manualBonus(id = "bonus-1"): ManualChampionshipBonus {
  const now = Date.now();
  return {
    id,
    participantId: "guest-1",
    points: 5,
    label: "Brilliant bonus challenge",
    note: null,
    status: "active",
    createdAt: now,
    createdByUid: "admin",
    updatedAt: now,
    updatedByUid: "admin",
    revokedAt: null,
    revokedByUid: null,
    revision: 1,
    schemaVersion: 1,
  };
}

function publicManualBonus(bonus: ManualChampionshipBonus) {
  return {
    id: bonus.id,
    participantId: bonus.participantId,
    points: bonus.points,
    label: bonus.label,
    status: "active",
    createdAt: bonus.createdAt,
    updatedAt: bonus.updatedAt,
    revision: bonus.revision,
    schemaVersion: 1,
  };
}

const birthdayPublicationId = "00000000-0000-4000-8000-000000000001";
const secondBirthdayPublicationId = "00000000-0000-4000-8000-000000000002";

function birthdayState(
  status: "collecting" | "closed" | "revealed" = "collecting",
  overrides: Record<string, unknown> = {},
) {
  const now = Date.now();
  const value: Record<string, unknown> = {
    status,
    openedAt: now,
    openedByUid: "admin",
    revealRevision: status === "revealed" ? 1 : 0,
    updatedAt: now,
    updatedByUid: "admin",
    revision: status === "collecting" ? 1 : status === "closed" ? 2 : 3,
    schemaVersion: 1,
  };
  if (status !== "collecting") {
    value.closedAt = now;
    value.closedByUid = "admin";
  }
  if (status === "revealed") {
    value.revealedAt = now;
    value.revealedByUid = "admin";
  }
  return { ...value, ...overrides };
}

function birthdayMessage(overrides: Record<string, unknown> = {}) {
  const now = Date.now();
  return {
    ownerUid: "guest-1",
    participantId: "guest-1",
    publicationId: birthdayPublicationId,
    title: "For the road",
    message: "A thoughtful birthday note.",
    emojiKey: "sparkles",
    displayMode: "named",
    status: "submitted",
    createdAt: now,
    updatedAt: now,
    revision: 1,
    schemaVersion: 1,
    ...overrides,
  };
}

function birthdayReceipt(overrides: Record<string, unknown> = {}) {
  return {
    publicationId: birthdayPublicationId,
    active: true,
    updatedAt: Date.now(),
    schemaVersion: 1,
    ...overrides,
  };
}

function birthdayModeration(overrides: Record<string, unknown> = {}) {
  return {
    ownerUid: "guest-1",
    messageRevision: 1,
    status: "approved",
    displayOrder: 0,
    note: "Ready for the reveal.",
    updatedAt: Date.now(),
    updatedByUid: "admin",
    revision: 1,
    schemaVersion: 1,
    ...overrides,
  };
}

function publishedBirthdayMessage(overrides: Record<string, unknown> = {}) {
  return {
    id: birthdayPublicationId,
    title: "For the road",
    message: "A thoughtful birthday note.",
    emojiKey: "sparkles",
    author: {
      mode: "named",
      participantId: "guest-1",
      displayName: "Castle Guest",
      avatarIcon: "castle",
      avatarTone: "cyan",
    },
    displayOrder: 0,
    sourceMessageRevision: 1,
    publishedAt: Date.now(),
    revealRevision: 1,
    schemaVersion: 1,
    ...overrides,
  };
}

function allHandsCompetition(
  id = "all-hands-runtime",
  overrides: Record<string, unknown> = {},
) {
  return publishedCompetition(competitionDraft(id), {
    format: "all-hands",
    formatConfig: {
      kind: "all-hands",
      resultMode: "winner-only",
      sessionPlan: { kind: "open-ended" },
      allowTeams: true,
      primaryMetricLabel: null,
      primaryMetricDirection: "higher",
      secondaryMetricLabel: null,
      secondaryMetricDirection: null,
      allowNegativeScores: false,
      tieHandling: "shared-placement",
    },
    scoringConfig: {
      kind: "all-hands",
      winnerBonus: 3,
      participationPoints: 1,
      placementPoints: [
        { place: 1, points: 3 },
        { place: 2, points: 2 },
        { place: 3, points: 1 },
      ],
    },
    ...overrides,
  }) as PublishedCompetition;
}

function phaseFiveFixture(
  id = "all-hands-runtime",
  overrides: Record<string, unknown> = {},
) {
  const competition = allHandsCompetition(id, overrides);
  return {
    competition,
    run: createAllHandsRun(competition, "admin", Date.now()),
  };
}

function groupCompetition(
  id = "group-runtime",
  overrides: Record<string, unknown> = {},
) {
  return publishedCompetition(competitionDraft(id), {
    format: "group-knockout",
    formatConfig: {
      kind: "group-knockout",
      groupCountMode: "manual",
      groupCount: 1,
      qualifiersPerGroup: 2,
      roundRobinLegs: 1,
      series: {
        kind: "best-of",
        winsRequired: 2,
        maximumRounds: 3,
      },
      allowDraws: false,
      includeThirdPlace: false,
    },
    ...overrides,
  }) as PublishedCompetition;
}

function phaseSixFixture(
  id = "group-runtime",
  overrides: Record<string, unknown> = {},
) {
  const competition = groupCompetition(id, overrides);
  return {
    competition,
    run: createGroupDrawPreview(competition, "admin", Date.now(), () => 0).run,
  };
}

function finishGroupStage(source: GroupKnockoutRun) {
  let run = source;
  Object.values(source.matches)
    .filter((match) => match.stage === "group-stage")
    .sort((left, right) => left.globalSequence - right.globalSequence)
    .forEach((match) => {
      const group = run.groups.find(
        (candidate) =>
          candidate.participantIds.includes(match.participantAId!) &&
          candidate.participantIds.includes(match.participantBId!),
      )!;
      const left = group.participantIds.indexOf(match.participantAId!);
      const right = group.participantIds.indexOf(match.participantBId!);
      const winner =
        left < right ? match.participantAId! : match.participantBId!;
      run = recordGroupMatchResult(run, match.id, {
        expectedMatchRevision: run.matches[match.id]!.revision,
        roundWinnerIds: [winner, winner],
        organizerUid: "admin",
        now: Date.now(),
      });
    });
  return run;
}

function confirmGroupSeeds(source: GroupKnockoutRun) {
  let run = source;
  const seeds = deriveCrossGroupSeeds(run.qualification!, []);
  seeds.unresolvedTieGroups.forEach((tie) => {
    run = resolveCrossGroupSeedTie(
      run,
      tie.groupRank,
      tie.participantIds,
      tie.participantIds,
      "admin",
      Date.now(),
      "Rules fixture",
    );
  });
  return run;
}

function finishGroupKnockout(source: GroupKnockoutRun) {
  let run = source.knockout
    ? source
    : generateGroupKnockout(source, "admin", Date.now());
  while (true) {
    const match = Object.values(run.matches)
      .filter(
        (candidate) =>
          candidate.stage !== "group-stage" &&
          !candidate.isBye &&
          !candidate.result &&
          candidate.participantAId &&
          candidate.participantBId,
      )
      .sort((left, right) => left.globalSequence - right.globalSequence)[0];
    if (!match) break;
    run = recordGroupMatchResult(run, match.id, {
      expectedMatchRevision: match.revision,
      roundWinnerIds: [match.participantAId!, match.participantAId!],
      organizerUid: "admin",
      now: Date.now(),
    });
  }
  return completeGroupCompetition(run, "admin", Date.now());
}

function withAllHandsSession(
  run: AllHandsCompetitionRun,
  options: {
    id?: string;
    mode?: "individual" | "team";
    startImmediately?: boolean;
  } = {},
) {
  const mode = options.mode ?? "individual";
  return createAllHandsSession(run, {
    id: options.id ?? "session-1",
    title: "Opening table",
    mode,
    participantIds: run.eligibleParticipantIds,
    teams:
      mode === "team"
        ? [
            {
              id: "team-castle",
              name: "Team Castle",
              participantIds: ["guest-1", "guest-2"],
            },
            {
              id: "team-dice",
              name: "Team Dice",
              participantIds: ["guest-3", "guest-4"],
            },
          ]
        : [],
    startImmediately: options.startImmediately ?? true,
    organizerUid: "admin",
    now: Date.now(),
  });
}

function allHandsResultInput(run: AllHandsCompetitionRun): AllHandsResultInput {
  const session = Object.values(run.sessions)[0]!;
  switch (run.configSnapshot.resultMode) {
    case "winner-only":
      return { kind: "winner-only", winnerEntityId: session.entityIds[0]! };
    case "placement":
      return {
        kind: "placement",
        entries: session.entityIds.map((entityId, index) => ({
          entityId,
          placement: index + 1,
        })),
      };
    case "highest-score":
    case "lowest-score":
      return {
        kind: "numeric",
        mode: run.configSnapshot.resultMode,
        entries: session.entityIds.map((entityId, index) => ({
          entityId,
          primaryScore: index + 1,
          secondaryScore: null,
        })),
        manualOrderEntityIds: null,
      };
    case "custom":
      return {
        kind: "custom",
        entries: session.entityIds.map((entityId, index) => ({
          entityId,
          points: index + 1,
          note: null,
        })),
      };
  }
}

function finishRoundRobin(source: CompetitionRun) {
  let run = source;
  Object.values(run.matches)
    .filter((match) => match.stage === "round-robin")
    .sort((left, right) => left.globalSequence - right.globalSequence)
    .forEach((match) => {
      run = recordMatchResult(run, match.id, {
        expectedMatchRevision: run.matches[match.id]!.revision,
        roundWinnerIds: [match.participantAId!, match.participantAId!],
        organizerUid: "admin",
        now: Date.now(),
      });
    });
  const standings = deriveStandings(
    run.participantIds,
    Object.values(run.matches),
    run.configSnapshot.tableScoring,
    Object.values(run.tieResolutions),
  );
  for (const tied of qualificationBlockingTies(
    standings,
    run.configSnapshot.qualificationCount,
  )) {
    run = resolveRunTie(
      run,
      tied,
      [...tied].sort(),
      "admin",
      Date.now(),
      "Rules fixture",
    );
  }
  return run;
}

function finishCompetition(source: CompetitionRun) {
  let run = source.knockout
    ? source
    : generateRunKnockout(source, "admin", Date.now());
  while (true) {
    const match = Object.values(run.matches)
      .filter(
        (candidate) =>
          candidate.stage !== "round-robin" &&
          !candidate.isBye &&
          !candidate.result &&
          candidate.participantAId &&
          candidate.participantBId,
      )
      .sort((left, right) => left.globalSequence - right.globalSequence)[0];
    if (!match) break;
    run = recordMatchResult(run, match.id, {
      expectedMatchRevision: match.revision,
      roundWinnerIds: [match.participantAId!, match.participantAId!],
      organizerUid: "admin",
      now: Date.now(),
    });
  }
  return completeCompetitionRun(run, "admin", Date.now());
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

  it("allows an authenticated guest to read the championship participant roster", async () => {
    const database = environment.authenticatedContext("guest").database();
    await assertSucceeds(get(ref(database, "participants")));
  });

  it("allows an inactive-roster query for historical championship attribution", async () => {
    const database = environment.authenticatedContext("guest").database();
    await assertSucceeds(
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

  it("allows a guest to read an inactive participant for historical standings", async () => {
    await seed({
      participants: {
        hidden: participant("hidden", "owner-a", { status: "inactive" }),
      },
    });
    const database = environment.authenticatedContext("guest").database();
    await assertSucceeds(get(ref(database, "participants/hidden")));
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

  it("allows authenticated runtime reads and denies unauthenticated reads", async () => {
    const { competition, run } = phaseFourFixture();
    await seed({
      competitions: { [competition.id]: activeCompetition(competition) },
      competitionRuns: { [competition.id]: run },
    });
    await assertFails(
      get(
        ref(
          environment.unauthenticatedContext().database(),
          `competitionRuns/${competition.id}`,
        ),
      ),
    );
    await assertSucceeds(
      get(
        ref(
          environment.authenticatedContext("guest").database(),
          `competitionRuns/${competition.id}`,
        ),
      ),
    );
  });

  it("allows only an admin to atomically activate a scheduled Merry-Go-Round", async () => {
    const { competition, run } = phaseFourFixture();
    await seed({ competitions: { [competition.id]: competition } });
    const activated = activeCompetition(competition);
    const rootUpdate = {
      [`competitions/${competition.id}`]: activated,
      [`competitionRuns/${competition.id}`]: run,
    };
    await assertFails(
      update(
        ref(environment.authenticatedContext("guest").database()),
        rootUpdate,
      ),
    );
    await assertSucceeds(
      update(
        ref(
          environment.authenticatedContext("admin", { admin: true }).database(),
        ),
        rootUpdate,
      ),
    );
  });

  it("rejects detached, duplicate, archived, and future-format runtime activation", async () => {
    const admin = environment
      .authenticatedContext("admin", { admin: true })
      .database();
    const { competition, run } = phaseFourFixture();
    await seed({ competitions: { [competition.id]: competition } });
    await assertFails(
      set(ref(admin, `competitionRuns/${competition.id}`), run),
    );

    await seed({
      competitions: { [competition.id]: activeCompetition(competition) },
      competitionRuns: { [competition.id]: run },
    });
    await assertFails(
      set(ref(admin, `competitionRuns/${competition.id}`), run),
    );

    for (const status of ["archived", "completed"] as const) {
      await seed({
        competitions: {
          [competition.id]: { ...competition, status },
        },
      });
      await assertFails(
        update(ref(admin), {
          [`competitions/${competition.id}`]: activeCompetition(competition),
          [`competitionRuns/${competition.id}`]: run,
        }),
      );
    }

    for (const format of ["all-hands", "group-knockout"] as const) {
      await seed({
        competitions: {
          [competition.id]: { ...competition, format },
        },
      });
      await assertFails(
        update(ref(admin), {
          [`competitions/${competition.id}`]: activeCompetition(competition),
          [`competitionRuns/${competition.id}`]: run,
        }),
      );
    }
  });

  it("rejects malformed runtime participant snapshots and randomized orders", async () => {
    const admin = environment
      .authenticatedContext("admin", { admin: true })
      .database();
    const { competition, run } = phaseFourFixture();
    await seed({ competitions: { [competition.id]: competition } });
    const activated = activeCompetition(competition);
    const invalidSnapshots = [
      { ...run, participantIndex: { ...run.participantIndex, intruder: true } },
      {
        ...run,
        randomizedParticipantIds: [
          ...run.randomizedParticipantIds.slice(0, -1),
          "intruder",
        ],
      },
      { ...run, privilegedOverride: true },
    ];
    for (const invalidRun of invalidSnapshots) {
      await assertFails(
        update(ref(admin), {
          [`competitions/${competition.id}`]: activated,
          [`competitionRuns/${competition.id}`]: invalidRun,
        }),
      );
    }
  });

  it("rejects invalid match identity, participant, status, stage, and extra fields", async () => {
    const admin = environment
      .authenticatedContext("admin", { admin: true })
      .database();
    const { competition, run } = phaseFourFixture();
    const active = activeCompetition(competition);
    await seed({
      participants: Object.fromEntries(
        competition.participantIds.map((id) => [id, participant(id, id)]),
      ),
      competitions: { [competition.id]: active },
      competitionRuns: { [competition.id]: run },
    });
    const match = Object.values(run.matches)[0]!;
    const mutations = [
      { participantBId: match.participantAId },
      { participantAId: "intruder" },
      { status: "secret" },
      { stage: "all-hands" },
      { privilegedOverride: true },
    ];
    for (const mutation of mutations) {
      await assertFails(
        update(ref(admin, `competitionRuns/${competition.id}`), {
          revision: run.revision + 1,
          updatedAt: Date.now(),
          [`matches/${match.id}`]: {
            ...match,
            ...mutation,
            revision: match.revision + 1,
          },
        }),
      );
    }
  });

  it("allows a valid result and correction while rejecting stale and invalid results", async () => {
    const admin = environment
      .authenticatedContext("admin", { admin: true })
      .database();
    const { competition, run } = phaseFourFixture();
    await seed({
      competitions: { [competition.id]: activeCompetition(competition) },
      competitionRuns: { [competition.id]: run },
    });
    const match = Object.values(run.matches)[0]!;
    const result = recordMatchResult(run, match.id, {
      expectedMatchRevision: match.revision,
      roundWinnerIds: [match.participantAId!, match.participantAId!],
      organizerUid: "admin",
      now: Date.now(),
    });
    await assertSucceeds(
      set(ref(admin, `competitionRuns/${competition.id}`), result),
    );
    await assertFails(
      set(ref(admin, `competitionRuns/${competition.id}`), result),
    );

    const corrected = recordMatchResult(result, match.id, {
      expectedMatchRevision: result.matches[match.id]!.revision,
      roundWinnerIds: [match.participantBId!, match.participantBId!],
      organizerUid: "admin",
      now: Date.now(),
    });
    await assertSucceeds(
      set(ref(admin, `competitionRuns/${competition.id}`), corrected),
    );

    const invalidResults = [
      {
        ...corrected,
        revision: corrected.revision + 1,
        updatedAt: Date.now(),
        matches: {
          ...corrected.matches,
          [match.id]: {
            ...corrected.matches[match.id],
            revision: corrected.matches[match.id]!.revision + 1,
            result: {
              ...corrected.matches[match.id]!.result!,
              winnerId: "intruder",
              resultRevision:
                corrected.matches[match.id]!.result!.resultRevision + 1,
              completedAt: Date.now(),
            },
          },
        },
      },
      {
        ...corrected,
        revision: corrected.revision + 1,
        updatedAt: Date.now(),
        matches: {
          ...corrected.matches,
          [match.id]: {
            ...corrected.matches[match.id],
            revision: corrected.matches[match.id]!.revision + 1,
            result: {
              ...corrected.matches[match.id]!.result!,
              participantAWins: -1,
              resultRevision:
                corrected.matches[match.id]!.result!.resultRevision + 1,
              completedAt: Date.now(),
            },
          },
        },
      },
    ];
    for (const invalid of invalidResults) {
      await assertFails(
        set(ref(admin, `competitionRuns/${competition.id}`), invalid),
      );
    }
  });

  it("enforces match and runtime revisions and frozen activation metadata", async () => {
    const admin = environment
      .authenticatedContext("admin", { admin: true })
      .database();
    const { competition, run } = phaseFourFixture();
    await seed({
      competitions: { [competition.id]: activeCompetition(competition) },
      competitionRuns: { [competition.id]: run },
    });
    const match = Object.values(run.matches)[0]!;
    const staleRun = setMatchInProgress(
      run,
      match.id,
      match.revision,
      Date.now(),
    );
    staleRun.revision = run.revision;
    await assertFails(
      set(ref(admin, `competitionRuns/${competition.id}`), staleRun),
    );
    const staleMatch = setMatchInProgress(
      run,
      match.id,
      match.revision,
      Date.now(),
    );
    staleMatch.matches[match.id]!.revision = match.revision;
    await assertFails(
      set(ref(admin, `competitionRuns/${competition.id}`), staleMatch),
    );
    await assertFails(
      set(ref(admin, `competitionRuns/${competition.id}`), {
        ...setMatchInProgress(run, match.id, match.revision, Date.now()),
        activatedByUid: "someone-else",
      }),
    );
    await assertFails(
      set(ref(admin, `competitionRuns/${competition.id}`), {
        ...setMatchInProgress(run, match.id, match.revision, Date.now()),
        participantIds: [...run.participantIds].reverse(),
      }),
    );
  });

  it("keeps published participants and scoring configuration frozen", async () => {
    const admin = environment
      .authenticatedContext("admin", { admin: true })
      .database();
    const { competition, run } = phaseFourFixture();
    const active = activeCompetition(competition);
    const completedRun = finishCompetition(
      generateRunKnockout(finishRoundRobin(run), "admin", Date.now()),
    );
    await seed({
      competitions: { [competition.id]: active },
      competitionRuns: { [competition.id]: run },
    });

    const completedCompetition = {
      ...active,
      status: "completed" as const,
      revision: active.revision + 1,
      updatedAt: Date.now(),
    };
    await assertFails(
      update(ref(admin), {
        [`competitions/${competition.id}`]: {
          ...completedCompetition,
          participantIds: [...competition.participantIds].reverse(),
        },
        [`competitionRuns/${competition.id}`]: completedRun,
      }),
    );
    await assertFails(
      update(ref(admin), {
        [`competitions/${competition.id}`]: {
          ...completedCompetition,
          scoringConfig: {
            ...competition.scoringConfig,
            table: {
              ...competition.scoringConfig.table,
              pointsForMatchWin:
                competition.scoringConfig.table.pointsForMatchWin + 1,
            },
          },
        },
        [`competitionRuns/${competition.id}`]: completedRun,
      }),
    );
  });

  it("allows admin tie decisions and denies guest tie and match writes", async () => {
    const { competition, run } = phaseFourFixture();
    const admin = environment
      .authenticatedContext("admin", { admin: true })
      .database();
    await seed({
      competitions: { [competition.id]: activeCompetition(competition) },
      competitionRuns: { [competition.id]: run },
    });
    await assertFails(
      update(ref(admin, `competitionRuns/${competition.id}`), {
        revision: run.revision + 1,
        updatedAt: Date.now(),
        "tieResolutions/too-early": {
          id: "too-early",
          participantIds: run.participantIds.slice(0, 2),
          orderedParticipantIds: run.participantIds.slice(0, 2),
          reason: "Not finished",
          resultFingerprint: "unfinished",
          resolvedAt: Date.now(),
          resolvedByUid: "admin",
          schemaVersion: 1,
        },
      }),
    );
    const tiedRun = finishRoundRobin(run);
    await seed({
      competitions: { [competition.id]: activeCompetition(competition) },
      competitionRuns: { [competition.id]: tiedRun },
    });
    const guest = environment.authenticatedContext("guest").database();
    const match = Object.values(tiedRun.matches)[0]!;
    await assertFails(
      update(ref(guest, `competitionRuns/${competition.id}`), {
        currentMatchId: match.id,
      }),
    );
    await assertFails(
      set(ref(guest, `competitionRuns/${competition.id}/tieResolutions/test`), {
        id: "test",
      }),
    );
    const resolution = {
      id: "manual-order",
      participantIds: tiedRun.participantIds.slice(0, 2),
      orderedParticipantIds: tiedRun.participantIds.slice(0, 2).reverse(),
      reason: "Organizer decision",
      resultFingerprint: "fixture-fingerprint",
      resolvedAt: Date.now(),
      resolvedByUid: "admin",
      schemaVersion: 1,
    };
    await assertSucceeds(
      update(ref(admin, `competitionRuns/${competition.id}`), {
        revision: tiedRun.revision + 1,
        updatedAt: Date.now(),
        [`tieResolutions/${resolution.id}`]: resolution,
      }),
    );
  });

  it("allows an atomic pre-result reset and rejects reset after a result", async () => {
    const admin = environment
      .authenticatedContext("admin", { admin: true })
      .database();
    const { competition, run } = phaseFourFixture();
    const active = activeCompetition(competition);
    await seed({
      competitions: { [competition.id]: active },
      competitionRuns: { [competition.id]: run },
    });
    await assertSucceeds(
      update(ref(admin), {
        [`competitions/${competition.id}`]: {
          ...active,
          status: "scheduled",
          revision: active.revision + 1,
          updatedAt: Date.now(),
        },
        [`competitionRuns/${competition.id}`]: null,
      }),
    );

    const first = Object.values(run.matches)[0]!;
    const started = recordMatchResult(run, first.id, {
      expectedMatchRevision: first.revision,
      roundWinnerIds: [first.participantAId!, first.participantAId!],
      organizerUid: "admin",
      now: Date.now(),
    });
    await seed({
      competitions: { [competition.id]: active },
      competitionRuns: { [competition.id]: started },
    });
    await assertFails(
      update(ref(admin), {
        [`competitions/${competition.id}`]: {
          ...active,
          status: "scheduled",
          revision: active.revision + 1,
          updatedAt: Date.now(),
        },
        [`competitionRuns/${competition.id}`]: null,
      }),
    );
  });

  it("allows a valid knockout, rejects invalid seeds, and denies guest bracket writes", async () => {
    const admin = environment
      .authenticatedContext("admin", { admin: true })
      .database();
    const guest = environment.authenticatedContext("guest").database();
    const { competition, run } = phaseFourFixture();
    const qualificationRun = finishRoundRobin(run);
    const knockoutRun = generateRunKnockout(
      qualificationRun,
      "admin",
      Date.now(),
    );
    await seed({
      competitions: { [competition.id]: activeCompetition(competition) },
      competitionRuns: { [competition.id]: qualificationRun },
    });
    await assertSucceeds(
      set(ref(admin, `competitionRuns/${competition.id}`), knockoutRun),
    );
    await assertFails(
      update(ref(guest, `competitionRuns/${competition.id}`), {
        knockout: knockoutRun.knockout,
      }),
    );
    const invalidSeed = structuredClone(knockoutRun);
    invalidSeed.revision += 1;
    invalidSeed.updatedAt = Date.now();
    invalidSeed.knockout!.seedOrder[0] = "intruder";
    await assertFails(
      set(ref(admin, `competitionRuns/${competition.id}`), invalidSeed),
    );
  });

  it("requires atomic valid completion and admin-only strong reopen", async () => {
    const admin = environment
      .authenticatedContext("admin", { admin: true })
      .database();
    const guest = environment.authenticatedContext("guest").database();
    const { competition, run } = phaseFourFixture();
    const active = activeCompetition(competition);
    const knockout = generateRunKnockout(
      finishRoundRobin(run),
      "admin",
      Date.now(),
    );
    const initiallyCompletedRun = finishCompetition(knockout);
    const readyToCompleteRun = reopenCompetitionRun(
      initiallyCompletedRun,
      Date.now(),
    );
    const completedRun = completeCompetitionRun(
      readyToCompleteRun,
      "admin",
      Date.now(),
    );
    await seed({
      competitions: { [competition.id]: active },
      competitionRuns: { [competition.id]: readyToCompleteRun },
    });
    const completedCompetition = {
      ...active,
      status: "completed" as const,
      revision: active.revision + 1,
      updatedAt: Date.now(),
    };
    await assertFails(
      set(ref(admin, `competitionRuns/${competition.id}`), completedRun),
    );
    await assertFails(
      update(ref(admin), {
        [`competitions/${competition.id}`]: completedCompetition,
        [`competitionRuns/${competition.id}`]: {
          ...completedRun,
          placements: {
            ...completedRun.placements!,
            entries: [
              {
                participantId: "intruder",
                place: 1,
                placementBand: "Champion",
                eliminationStage: "winner",
              },
            ],
          },
        },
      }),
    );
    await assertSucceeds(
      update(ref(admin), {
        [`competitions/${competition.id}`]: completedCompetition,
        [`competitionRuns/${competition.id}`]: completedRun,
      }),
    );
    const reopenedRun = reopenCompetitionRun(completedRun, Date.now());
    const reopenedCompetition = {
      ...completedCompetition,
      status: "active" as const,
      revision: completedCompetition.revision + 1,
      updatedAt: Date.now(),
    };
    await assertFails(
      update(ref(guest), {
        [`competitions/${competition.id}`]: reopenedCompetition,
        [`competitionRuns/${competition.id}`]: reopenedRun,
      }),
    );
    await assertSucceeds(
      update(ref(admin), {
        [`competitions/${competition.id}`]: reopenedCompetition,
        [`competitionRuns/${competition.id}`]: reopenedRun,
      }),
    );
  });

  it("keeps completed runs read-only until reopened", async () => {
    const admin = environment
      .authenticatedContext("admin", { admin: true })
      .database();
    const { competition, run } = phaseFourFixture();
    const active = activeCompetition(competition);
    const completedRun = finishCompetition(
      generateRunKnockout(finishRoundRobin(run), "admin", Date.now()),
    );
    await seed({
      competitions: {
        [competition.id]: {
          ...active,
          status: "completed",
          revision: active.revision + 1,
        },
      },
      competitionRuns: { [competition.id]: completedRun },
    });
    const first = Object.values(completedRun.matches)[0]!;
    await assertFails(
      update(ref(admin, `competitionRuns/${competition.id}`), {
        revision: completedRun.revision + 1,
        updatedAt: Date.now(),
        [`matches/${first.id}/status`]: "in-progress",
      }),
    );
  });

  it("accepts Phase 4 audit actions but keeps them organizer-authored and append-only", async () => {
    const admin = environment
      .authenticatedContext("admin", { admin: true })
      .database();
    const guest = environment.authenticatedContext("guest").database();
    const entry = auditEntry("phase-four-event", "merry-runtime", {
      action: "match-result-recorded",
      beforeRevision: 2,
      afterRevision: 3,
    });
    await assertFails(set(ref(guest, "audit/phase-four-event"), entry));
    await assertSucceeds(set(ref(admin, "audit/phase-four-event"), entry));
    await assertFails(
      update(ref(admin, "audit/phase-four-event"), {
        summary: "Changed history",
      }),
    );
  });

  it("enforces authenticated reads and admin-only atomic All Hands activation", async () => {
    const { competition, run } = phaseFiveFixture();
    await seed({
      participants: Object.fromEntries(
        competition.participantIds.map((id) => [id, participant(id, id)]),
      ),
      competitions: { [competition.id]: competition },
    });
    const rootUpdate = {
      [`competitions/${competition.id}`]: activeCompetition(competition),
      [`competitionRuns/${competition.id}`]: run,
    };
    await assertFails(
      get(
        ref(
          environment.unauthenticatedContext().database(),
          `competitionRuns/${competition.id}`,
        ),
      ),
    );
    await assertFails(
      update(
        ref(environment.authenticatedContext("guest").database()),
        rootUpdate,
      ),
    );
    const admin = environment
      .authenticatedContext("admin", { admin: true })
      .database();
    await assertSucceeds(update(ref(admin), rootUpdate));
    await assertSucceeds(
      get(
        ref(
          environment.authenticatedContext("guest").database(),
          `competitionRuns/${competition.id}`,
        ),
      ),
    );
    await assertFails(
      set(ref(admin, `competitionRuns/${competition.id}`), run),
    );
  });

  it("rejects invalid All Hands activation sources and frozen snapshots", async () => {
    const admin = environment
      .authenticatedContext("admin", { admin: true })
      .database();
    const { competition, run } = phaseFiveFixture();
    const participants = Object.fromEntries(
      competition.participantIds.map((id) => [id, participant(id, id)]),
    );
    for (const source of [
      { ...competition, status: "archived" },
      { ...competition, status: "completed" },
      { ...competition, format: "round-robin-knockout" },
      { ...competition, format: "group-knockout" },
    ]) {
      await seed({ participants, competitions: { [competition.id]: source } });
      await assertFails(
        update(ref(admin), {
          [`competitions/${competition.id}`]: activeCompetition(competition),
          [`competitionRuns/${competition.id}`]: run,
        }),
      );
    }
    await seed({
      participants,
      competitions: { [competition.id]: competition },
    });
    await assertFails(
      update(ref(admin), {
        [`competitions/${competition.id}`]: activeCompetition(competition),
        [`competitionRuns/${competition.id}`]: {
          ...run,
          eligibleParticipantIds: ["guest-1", "intruder"],
          eligibleParticipantIndex: { "guest-1": true, intruder: true },
        },
      }),
    );
    await assertFails(
      update(ref(admin), {
        [`competitions/${competition.id}`]: activeCompetition(competition),
        [`competitionRuns/${competition.id}`]: {
          ...run,
          configSnapshot: {
            ...run.configSnapshot,
            resultMode: "not-a-mode",
          },
        },
      }),
    );
  });

  it("allows valid All Hands sessions while denying guests and malformed membership", async () => {
    const admin = environment
      .authenticatedContext("admin", { admin: true })
      .database();
    const guest = environment.authenticatedContext("guest").database();
    const { competition, run } = phaseFiveFixture();
    const active = activeCompetition(competition);
    await seed({
      participants: Object.fromEntries(
        competition.participantIds.map((id) => [id, participant(id, id)]),
      ),
      competitions: { [competition.id]: active },
      competitionRuns: { [competition.id]: run },
    });
    const pending = withAllHandsSession(run, { startImmediately: false });
    await assertFails(
      set(ref(guest, `competitionRuns/${competition.id}`), pending),
    );
    await assertSucceeds(
      set(ref(admin, `competitionRuns/${competition.id}`), pending),
    );

    await seed({
      competitions: { [competition.id]: active },
      competitionRuns: { [competition.id]: run },
    });
    const invalidSession = pending.sessions["session-1"]!;
    for (const changed of [
      {
        ...invalidSession,
        participantIds: ["guest-1", "intruder"],
        participantIndex: { "guest-1": true, intruder: true },
        entityIds: ["guest-1", "intruder"],
        entityIndex: { "guest-1": true, intruder: true },
      },
      {
        ...invalidSession,
        participantIds: ["guest-1", "guest-1"],
        participantIndex: { "guest-1": true },
        entityIds: ["guest-1", "guest-1"],
        entityIndex: { "guest-1": true },
      },
      { ...invalidSession, status: "secret" },
    ]) {
      await assertFails(
        set(ref(admin, `competitionRuns/${competition.id}`), {
          ...pending,
          sessions: { "session-1": changed },
        }),
      );
    }
  });

  it("allows valid All Hands teams and rejects empty or overlapping membership", async () => {
    const admin = environment
      .authenticatedContext("admin", { admin: true })
      .database();
    const { competition, run } = phaseFiveFixture();
    const active = activeCompetition(competition);
    await seed({
      participants: Object.fromEntries(
        competition.participantIds.map((id) => [id, participant(id, id)]),
      ),
      competitions: { [competition.id]: active },
      competitionRuns: { [competition.id]: run },
    });
    const teamRun = withAllHandsSession(run, {
      mode: "team",
      startImmediately: false,
    });
    await assertSucceeds(
      set(ref(admin, `competitionRuns/${competition.id}`), teamRun),
    );
    const session = teamRun.sessions["session-1"]!;
    for (const teams of [
      {
        ...session.teams,
        "team-castle": {
          ...session.teams["team-castle"]!,
          participantIds: [],
        },
      },
      {
        ...session.teams,
        "team-dice": {
          ...session.teams["team-dice"]!,
          participantIds: ["guest-2", "guest-4"],
        },
      },
    ]) {
      await seed({
        participants: Object.fromEntries(
          competition.participantIds.map((id) => [id, participant(id, id)]),
        ),
        competitions: { [competition.id]: active },
        competitionRuns: { [competition.id]: run },
      });
      await assertFails(
        set(ref(admin, `competitionRuns/${competition.id}`), {
          ...teamRun,
          sessions: {
            "session-1": { ...session, teams },
          },
        }),
      );
    }
  });

  it("allows every All Hands result mode, correction, void, and restore for admins only", async () => {
    const admin = environment
      .authenticatedContext("admin", { admin: true })
      .database();
    const guest = environment.authenticatedContext("guest").database();
    for (const resultMode of [
      "winner-only",
      "placement",
      "highest-score",
      "lowest-score",
      "custom",
    ] as const) {
      const id = `all-hands-${resultMode}`;
      const baseConfig = allHandsCompetition().formatConfig;
      const { competition, run } = phaseFiveFixture(id, {
        formatConfig: {
          ...baseConfig,
          resultMode,
          primaryMetricLabel:
            resultMode === "highest-score" || resultMode === "lowest-score"
              ? "Score"
              : null,
        },
      });
      const active = activeCompetition(competition);
      const started = withAllHandsSession(run);
      let changed = started;
      const session = started.sessions["session-1"]!;
      changed = recordAllHandsResult(
        changed,
        session.id,
        session.revision,
        allHandsResultInput(changed),
        "admin",
        Date.now(),
      );
      await seed({
        participants: Object.fromEntries(
          competition.participantIds.map((participantId) => [
            participantId,
            participant(participantId, participantId),
          ]),
        ),
        competitions: { [id]: active },
        competitionRuns: { [id]: started },
      });
      await assertFails(set(ref(guest, `competitionRuns/${id}`), changed));
      await assertSucceeds(set(ref(admin, `competitionRuns/${id}`), changed));
      await assertFails(set(ref(admin, `competitionRuns/${id}`), changed));

      const completedSession = changed.sessions["session-1"]!;
      const corrected = recordAllHandsResult(
        changed,
        completedSession.id,
        completedSession.revision,
        allHandsResultInput(changed),
        "admin",
        Date.now(),
      );
      await assertSucceeds(set(ref(admin, `competitionRuns/${id}`), corrected));
      const voided = voidAllHandsSession(
        corrected,
        completedSession.id,
        corrected.sessions[completedSession.id]!.revision,
        "admin",
        Date.now(),
        "Duplicate table",
      );
      await assertFails(set(ref(guest, `competitionRuns/${id}`), voided));
      await assertSucceeds(set(ref(admin, `competitionRuns/${id}`), voided));
      const restored = restoreAllHandsSession(
        voided,
        completedSession.id,
        voided.sessions[completedSession.id]!.revision,
        Date.now(),
      );
      await assertSucceeds(set(ref(admin, `competitionRuns/${id}`), restored));
    }
  });

  it("rejects incomplete, duplicate, malformed, negative, and excessive All Hands results", async () => {
    const admin = environment
      .authenticatedContext("admin", { admin: true })
      .database();
    const scenarios: Array<{
      mode:
        | "winner-only"
        | "placement"
        | "highest-score"
        | "lowest-score"
        | "custom";
      mutate: (result: Record<string, unknown>) => Record<string, unknown>;
    }> = [
      {
        mode: "winner-only",
        mutate: (result) => ({ ...result, winnerEntityId: "intruder" }),
      },
      {
        mode: "placement",
        mutate: (result) => ({
          ...result,
          entries: [{ entityId: "guest-1", placement: 1 }],
        }),
      },
      {
        mode: "placement",
        mutate: (result) => ({
          ...result,
          entries: [
            { entityId: "guest-1", placement: 1 },
            { entityId: "guest-1", placement: 1 },
            { entityId: "guest-3", placement: 2 },
            { entityId: "guest-4", placement: 4 },
          ],
        }),
      },
      {
        mode: "placement",
        mutate: (result) => ({
          ...result,
          entries: [
            { entityId: "guest-1", placement: 0 },
            { entityId: "guest-2", placement: 1 },
            { entityId: "guest-3", placement: 3 },
            { entityId: "guest-4", placement: 4 },
          ],
        }),
      },
      {
        mode: "highest-score",
        mutate: (result) => ({
          ...result,
          entries: [
            { entityId: "guest-1", primaryScore: "many" },
            { entityId: "guest-2", primaryScore: 2 },
            { entityId: "guest-3", primaryScore: 3 },
            { entityId: "guest-4", primaryScore: 4 },
          ],
        }),
      },
      {
        mode: "lowest-score",
        mutate: (result) => ({
          ...result,
          entries: [
            { entityId: "guest-1", primaryScore: -1 },
            { entityId: "guest-2", primaryScore: 2 },
            { entityId: "guest-3", primaryScore: 3 },
            { entityId: "guest-4", primaryScore: 4 },
          ],
        }),
      },
      {
        mode: "custom",
        mutate: (result) => ({
          ...result,
          entries: [
            { entityId: "guest-1", points: -1 },
            { entityId: "guest-2", points: 2 },
            { entityId: "guest-3", points: 3 },
            { entityId: "guest-4", points: 4 },
          ],
        }),
      },
      {
        mode: "custom",
        mutate: (result) => ({
          ...result,
          entries: [
            { entityId: "guest-1", points: 101 },
            { entityId: "guest-2", points: 2 },
            { entityId: "guest-3", points: 3 },
            { entityId: "guest-4", points: 4 },
          ],
        }),
      },
    ];
    for (const [index, scenario] of scenarios.entries()) {
      const id = `invalid-all-hands-${index}`;
      const baseConfig = allHandsCompetition().formatConfig;
      const { competition, run } = phaseFiveFixture(id, {
        formatConfig: {
          ...baseConfig,
          resultMode: scenario.mode,
          primaryMetricLabel:
            scenario.mode === "highest-score" ||
            scenario.mode === "lowest-score"
              ? "Score"
              : null,
        },
      });
      const started = withAllHandsSession(run);
      const session = started.sessions["session-1"]!;
      const valid = recordAllHandsResult(
        started,
        session.id,
        session.revision,
        allHandsResultInput(started),
        "admin",
        Date.now(),
      );
      const result = valid.sessions[session.id]!.result as unknown as Record<
        string,
        unknown
      >;
      await seed({
        participants: Object.fromEntries(
          competition.participantIds.map((participantId) => [
            participantId,
            participant(participantId, participantId),
          ]),
        ),
        competitions: { [id]: activeCompetition(competition) },
        competitionRuns: { [id]: started },
      });
      await assertFails(
        set(ref(admin, `competitionRuns/${id}`), {
          ...valid,
          sessions: {
            [session.id]: {
              ...valid.sessions[session.id],
              result: scenario.mutate(result),
            },
          },
        }),
      );
    }
  });

  it("requires atomic admin All Hands completion and explicit reopen", async () => {
    const admin = environment
      .authenticatedContext("admin", { admin: true })
      .database();
    const guest = environment.authenticatedContext("guest").database();
    const baseConfig = allHandsCompetition().formatConfig;
    const { competition, run } = phaseFiveFixture("all-hands-completion", {
      formatConfig: { ...baseConfig, resultMode: "custom" },
    });
    const active = activeCompetition(competition);
    const started = withAllHandsSession(run);
    const session = started.sessions["session-1"]!;
    const completedSession = recordAllHandsResult(
      started,
      session.id,
      session.revision,
      allHandsResultInput(started),
      "admin",
      Date.now(),
    );
    const review = requestAllHandsCompletionReview(
      completedSession,
      Date.now(),
    );
    const completedRun = completeAllHandsRun(review, "admin", Date.now());
    const completedCompetition = {
      ...active,
      status: "completed" as const,
      revision: active.revision + 1,
      updatedAt: Date.now(),
    };
    await seed({
      participants: Object.fromEntries(
        competition.participantIds.map((participantId) => [
          participantId,
          participant(participantId, participantId),
        ]),
      ),
      competitions: { [competition.id]: active },
      competitionRuns: { [competition.id]: completedSession },
    });
    await assertSucceeds(
      set(ref(admin, `competitionRuns/${competition.id}`), review),
    );
    await assertFails(
      set(ref(admin, `competitionRuns/${competition.id}`), completedRun),
    );
    await assertFails(
      update(ref(guest), {
        [`competitions/${competition.id}`]: completedCompetition,
        [`competitionRuns/${competition.id}`]: completedRun,
      }),
    );
    await assertSucceeds(
      update(ref(admin), {
        [`competitions/${competition.id}`]: completedCompetition,
        [`competitionRuns/${competition.id}`]: completedRun,
      }),
    );

    const reopenedRun = reopenAllHandsRun(completedRun, Date.now());
    const reopenedCompetition = {
      ...completedCompetition,
      status: "active" as const,
      revision: completedCompetition.revision + 1,
      updatedAt: Date.now(),
    };
    await assertFails(
      set(
        ref(
          admin,
          `competitionRuns/${competition.id}/sessions/session-1/title`,
        ),
        "Changed while completed",
      ),
    );
    await assertFails(
      update(ref(guest), {
        [`competitions/${competition.id}`]: reopenedCompetition,
        [`competitionRuns/${competition.id}`]: reopenedRun,
      }),
    );
    await assertSucceeds(
      update(ref(admin), {
        [`competitions/${competition.id}`]: reopenedCompetition,
        [`competitionRuns/${competition.id}`]: reopenedRun,
      }),
    );
  });

  it("allows only an admin to atomically activate the exact Group Format preview", async () => {
    const { competition, run } = phaseSixFixture("group-activation");
    await seed({ competitions: { [competition.id]: competition } });
    const rootUpdate = {
      [`competitions/${competition.id}`]: activeCompetition(competition),
      [`competitionRuns/${competition.id}`]: run,
    };
    await assertFails(
      update(
        ref(environment.authenticatedContext("guest").database()),
        rootUpdate,
      ),
    );
    await assertSucceeds(
      update(
        ref(
          environment.authenticatedContext("admin", { admin: true }).database(),
        ),
        rootUpdate,
      ),
    );
  });

  it("rejects malformed Group Format draws, assignments, groups, and unknown fields", async () => {
    const { competition, run } = phaseSixFixture("group-malformed");
    const admin = environment
      .authenticatedContext("admin", { admin: true })
      .database();
    await seed({ competitions: { [competition.id]: competition } });
    const active = activeCompetition(competition);
    const invalidRuns = [
      { ...run, privilegedOverride: true },
      {
        ...run,
        draw: {
          ...run.draw,
          shuffledParticipantIds: [
            "intruder",
            ...run.draw.shuffledParticipantIds.slice(1),
          ],
        },
      },
      {
        ...run,
        groups: [
          {
            ...run.groups[0],
            participantIds: [
              "intruder",
              ...run.groups[0]!.participantIds.slice(1),
            ],
          },
        ],
      },
      {
        ...run,
        draw: {
          ...run.draw,
          assignments: run.draw.assignments.map((assignment, index) =>
            index === 0
              ? { ...assignment, groupId: "secret-group" }
              : assignment,
          ),
        },
      },
    ];
    for (const invalid of invalidRuns) {
      await assertFails(
        update(ref(admin), {
          [`competitions/${competition.id}`]: active,
          [`competitionRuns/${competition.id}`]: invalid,
        }),
      );
    }
  });

  it("allows admin Group Format results and rejects guest, stale, and cross-group match edits", async () => {
    const { competition, run } = phaseSixFixture("group-results");
    const active = activeCompetition(competition);
    await seed({
      competitions: { [competition.id]: active },
      competitionRuns: { [competition.id]: run },
    });
    const match = Object.values(run.matches)[0]!;
    const result = recordGroupMatchResult(run, match.id, {
      expectedMatchRevision: match.revision,
      roundWinnerIds: [match.participantAId!, match.participantAId!],
      organizerUid: "admin",
      now: Date.now(),
    });
    const guest = environment.authenticatedContext("guest").database();
    const admin = environment
      .authenticatedContext("admin", { admin: true })
      .database();
    await assertFails(
      set(ref(guest, `competitionRuns/${competition.id}`), result),
    );
    await assertSucceeds(
      set(ref(admin, `competitionRuns/${competition.id}`), result),
    );
    await assertFails(
      set(ref(admin, `competitionRuns/${competition.id}`), result),
    );
    await assertFails(
      set(ref(admin, `competitionRuns/${competition.id}`), {
        ...result,
        revision: result.revision + 1,
        updatedAt: Date.now(),
        matches: {
          ...result.matches,
          [match.id]: {
            ...result.matches[match.id],
            groupId: "group-b",
            revision: result.matches[match.id]!.revision + 1,
          },
        },
      }),
    );
  });

  it("allows an explicit Group Format qualification snapshot but rejects a premature one", async () => {
    const { competition, run } = phaseSixFixture("group-qualification");
    const active = activeCompetition(competition);
    const completedGroups = finishGroupStage(run);
    const review = beginQualificationReview(
      completedGroups,
      "admin",
      Date.now(),
    );
    const admin = environment
      .authenticatedContext("admin", { admin: true })
      .database();
    await seed({
      competitions: { [competition.id]: active },
      competitionRuns: { [competition.id]: completedGroups },
    });
    await assertSucceeds(
      set(ref(admin, `competitionRuns/${competition.id}`), review),
    );
    await seed({
      competitions: { [competition.id]: active },
      competitionRuns: { [competition.id]: run },
    });
    await assertFails(
      set(ref(admin, `competitionRuns/${competition.id}`), {
        ...review,
        revision: run.revision + 1,
        updatedAt: Date.now(),
      }),
    );
  });

  it("validates Group Format cross-group seed decisions and their qualification fingerprint", async () => {
    const base = phaseSixFixture("group-seeds", {
      participantIds: [
        "guest-1",
        "guest-2",
        "guest-3",
        "guest-4",
        "guest-5",
        "guest-6",
        "guest-7",
        "guest-8",
      ],
      formatConfig: {
        kind: "group-knockout",
        groupCountMode: "manual",
        groupCount: 2,
        qualifiersPerGroup: 2,
        roundRobinLegs: 1,
        series: { kind: "best-of", winsRequired: 2, maximumRounds: 3 },
        allowDraws: false,
        includeThirdPlace: false,
      },
    });
    const active = activeCompetition(base.competition);
    const completed = finishGroupStage(base.run);
    const review = beginQualificationReview(completed, "admin", Date.now());
    const tie = deriveCrossGroupSeeds(review.qualification!, [])
      .unresolvedTieGroups[0]!;
    const resolved = resolveCrossGroupSeedTie(
      review,
      tie.groupRank,
      tie.participantIds,
      tie.participantIds,
      "admin",
      Date.now(),
      "Rules decision",
    );
    const admin = environment
      .authenticatedContext("admin", { admin: true })
      .database();
    await seed({
      competitions: { [base.competition.id]: active },
      competitionRuns: { [base.competition.id]: review },
    });
    await assertSucceeds(
      set(ref(admin, `competitionRuns/${base.competition.id}`), resolved),
    );
    const resolutionId = Object.keys(resolved.seedResolutions)[0]!;
    await assertFails(
      set(ref(admin, `competitionRuns/${base.competition.id}`), {
        ...resolved,
        revision: resolved.revision + 1,
        updatedAt: Date.now(),
        seedResolutions: {
          ...resolved.seedResolutions,
          [resolutionId]: {
            ...resolved.seedResolutions[resolutionId],
            qualificationFingerprint: "forged",
          },
        },
      }),
    );
  });

  it("allows persisted Group Format bracket generation and rejects guest or forged seeds", async () => {
    const { competition, run } = phaseSixFixture("group-bracket");
    const active = activeCompetition(competition);
    const review = beginQualificationReview(
      finishGroupStage(run),
      "admin",
      Date.now(),
    );
    const bracket = generateGroupKnockout(
      confirmGroupSeeds(review),
      "admin",
      Date.now(),
    );
    await seed({
      competitions: { [competition.id]: active },
      competitionRuns: { [competition.id]: confirmGroupSeeds(review) },
    });
    const guest = environment.authenticatedContext("guest").database();
    const admin = environment
      .authenticatedContext("admin", { admin: true })
      .database();
    await assertFails(
      set(ref(guest, `competitionRuns/${competition.id}`), bracket),
    );
    await assertSucceeds(
      set(ref(admin, `competitionRuns/${competition.id}`), bracket),
    );
    await assertFails(
      set(ref(admin, `competitionRuns/${competition.id}`), {
        ...bracket,
        revision: bracket.revision + 1,
        updatedAt: Date.now(),
        knockout: { ...bracket.knockout, qualificationFingerprint: "forged" },
      }),
    );
  });

  it("allows only pre-result Group Format reset to scheduled", async () => {
    const { competition, run } = phaseSixFixture("group-reset");
    const active = activeCompetition(competition);
    const scheduled = {
      ...active,
      status: "scheduled" as const,
      revision: active.revision + 1,
      updatedAt: Date.now(),
    };
    const admin = environment
      .authenticatedContext("admin", { admin: true })
      .database();
    await seed({
      competitions: { [competition.id]: active },
      competitionRuns: { [competition.id]: run },
    });
    await assertSucceeds(
      update(ref(admin), {
        [`competitions/${competition.id}`]: scheduled,
        [`competitionRuns/${competition.id}`]: null,
      }),
    );
    const match = Object.values(run.matches)[0]!;
    const played = recordGroupMatchResult(run, match.id, {
      expectedMatchRevision: match.revision,
      roundWinnerIds: [match.participantAId!, match.participantAId!],
      organizerUid: "admin",
      now: Date.now(),
    });
    await seed({
      competitions: { [competition.id]: active },
      competitionRuns: { [competition.id]: played },
    });
    await assertFails(
      update(ref(admin), {
        [`competitions/${competition.id}`]: scheduled,
        [`competitionRuns/${competition.id}`]: null,
      }),
    );
  });

  it("allows atomic Group Format completion and reopen while preserving results", async () => {
    const { competition, run } = phaseSixFixture("group-completion");
    const active = activeCompetition(competition);
    const review = beginQualificationReview(
      finishGroupStage(run),
      "admin",
      Date.now(),
    );
    const ready = confirmGroupSeeds(review);
    const completedRun = finishGroupKnockout(ready);
    const completedCompetition = {
      ...active,
      status: "completed" as const,
      revision: active.revision + 1,
      updatedAt: Date.now(),
    };
    const admin = environment
      .authenticatedContext("admin", { admin: true })
      .database();
    await seed({
      competitions: { [competition.id]: active },
      competitionRuns: {
        [competition.id]: {
          ...completedRun,
          stage: "knockout",
          placements: null,
          completedAt: null,
          completedByUid: null,
          revision: completedRun.revision - 1,
        },
      },
    });
    const source = (
      await get(ref(admin, `competitionRuns/${competition.id}`))
    ).val();
    await assertSucceeds(
      update(ref(admin), {
        [`competitions/${competition.id}`]: completedCompetition,
        [`competitionRuns/${competition.id}`]: {
          ...completedRun,
          revision: source.revision + 1,
          placements: {
            ...completedRun.placements,
            runtimeRevision: source.revision + 1,
          },
        },
      }),
    );
    const persistedCompleted = (
      await get(ref(admin, `competitionRuns/${competition.id}`))
    ).val();
    const reopenedRun = reopenGroupCompetition(persistedCompleted, Date.now());
    const reopenedCompetition = {
      ...completedCompetition,
      status: "active" as const,
      revision: completedCompetition.revision + 1,
      updatedAt: Date.now(),
    };
    await assertSucceeds(
      update(ref(admin), {
        [`competitions/${competition.id}`]: reopenedCompetition,
        [`competitionRuns/${competition.id}`]: reopenedRun,
      }),
    );
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

  describe("Phase 7 championship ledger", () => {
    function contexts() {
      return {
        admin: environment
          .authenticatedContext("admin", { admin: true })
          .database(),
        guest: environment.authenticatedContext("guest").database(),
        anonymous: environment.unauthenticatedContext().database(),
      };
    }

    async function activeSourceFixture(id = "ledger-cup") {
      const base = phaseFourFixture(id);
      const competition = activeCompetition(base.competition);
      const source = phaseSevenSource(competition, base.run);
      await seed({
        participants: {
          "guest-1": participant("guest-1", "guest-1"),
          "guest-2": participant("guest-2", "guest-2"),
          "guest-3": participant("guest-3", "guest-3"),
          "guest-4": participant("guest-4", "guest-4"),
        },
        competitions: { [competition.id]: competition },
        competitionRuns: { [competition.id]: base.run },
      });
      return { competition, run: base.run, source };
    }

    it("denies unauthenticated competition-source reads", async () => {
      const { anonymous } = contexts();
      await assertFails(
        get(ref(anonymous, "championshipLedger/competitionSources")),
      );
    });

    it("allows authenticated competition-source reads", async () => {
      const { guest } = contexts();
      await assertSucceeds(
        get(ref(guest, "championshipLedger/competitionSources")),
      );
    });

    it("denies guest create, replace, and delete operations", async () => {
      const { guest } = contexts();
      const { competition, source } = await activeSourceFixture();
      const path = `championshipLedger/competitionSources/${competition.id}`;
      await assertFails(set(ref(guest, path), source));
      await seedAt(path, source);
      await assertFails(set(ref(guest, path), { ...source }));
      await assertFails(remove(ref(guest, path)));
    });

    it("allows an admin to create a valid source for an active run", async () => {
      const { admin } = contexts();
      const { competition, source } = await activeSourceFixture();
      await assertSucceeds(
        set(
          ref(admin, `championshipLedger/competitionSources/${competition.id}`),
          source,
        ),
      );
    });

    it("allows a Merry-Go-Round source containing real match awards", async () => {
      const { admin } = contexts();
      const base = phaseFourFixture("ledger-with-match-awards");
      const competition = activeCompetition(base.competition);
      const match = Object.values(base.run.matches)[0]!;
      const run = recordMatchResult(base.run, match.id, {
        expectedMatchRevision: match.revision,
        roundWinnerIds: [
          match.participantAId!,
          match.participantBId!,
          match.participantAId!,
        ],
        organizerUid: "admin",
        now: Date.now(),
      });
      const source = phaseSevenSource(competition, run);
      await seed({
        participants: {
          "guest-1": participant("guest-1", "guest-1"),
          "guest-2": participant("guest-2", "guest-2"),
          "guest-3": participant("guest-3", "guest-3"),
          "guest-4": participant("guest-4", "guest-4"),
        },
        competitions: { [competition.id]: competition },
        competitionRuns: { [competition.id]: run },
      });

      expect(source.meta.entryCount).toBeGreaterThan(0);
      await assertSucceeds(
        set(
          ref(admin, `championshipLedger/competitionSources/${competition.id}`),
          source,
        ),
      );
    });

    it("allows an admin to create a valid source for a completed competition", async () => {
      const { admin } = contexts();
      const fixture = await activeSourceFixture("completed-ledger");
      const competition = {
        ...fixture.competition,
        status: "completed" as const,
      };
      const source = {
        ...fixture.source,
        meta: {
          ...fixture.source.meta,
          competitionStatus: "completed" as const,
        },
      };
      await seed({
        participants: { "guest-1": participant("guest-1", "guest-1") },
        competitions: { [competition.id]: competition },
        competitionRuns: { [competition.id]: fixture.run },
      });
      await assertSucceeds(
        set(
          ref(admin, `championshipLedger/competitionSources/${competition.id}`),
          source,
        ),
      );
    });

    it("rejects a source whose path competition ID does not match", async () => {
      const { admin } = contexts();
      const { source } = await activeSourceFixture();
      await assertFails(
        set(
          ref(admin, "championshipLedger/competitionSources/wrong-id"),
          source,
        ),
      );
    });

    it("rejects a source with the wrong format", async () => {
      const { admin } = contexts();
      const { competition, source } = await activeSourceFixture();
      await assertFails(
        set(
          ref(admin, `championshipLedger/competitionSources/${competition.id}`),
          {
            ...source,
            meta: { ...source.meta, competitionFormat: "all-hands" },
          },
        ),
      );
    });

    it("rejects a source with a mismatched run revision", async () => {
      const { admin } = contexts();
      const { competition, source } = await activeSourceFixture();
      await assertFails(
        set(
          ref(admin, `championshipLedger/competitionSources/${competition.id}`),
          { ...source, meta: { ...source.meta, runRevision: 99 } },
        ),
      );
    });

    it("rejects sources for a missing run and a scheduled competition", async () => {
      const { admin } = contexts();
      const { competition, source } = await activeSourceFixture();
      await seed({ competitions: { [competition.id]: competition } });
      await assertFails(
        set(
          ref(admin, `championshipLedger/competitionSources/${competition.id}`),
          source,
        ),
      );
      await seed({
        competitions: {
          [competition.id]: { ...competition, status: "scheduled" },
        },
      });
      await assertFails(
        set(
          ref(admin, `championshipLedger/competitionSources/${competition.id}`),
          source,
        ),
      );
    });

    it("rejects unknown award types", async () => {
      const { admin } = contexts();
      const { competition, source } = await activeSourceFixture();
      const entry = {
        id: "bad-award",
        participantId: "guest-1",
        sourceNamespace: "competition",
        sourceId: competition.id,
        sourceEntityId: "match-1",
        sourceType: "prediction",
        points: 2,
        label: "Invalid award",
        competitionId: competition.id,
        competitionFormat: competition.format,
        stage: "round-robin",
        awardedAt: Date.now(),
        sourceRevision: 1,
        schemaVersion: 1,
      };
      await assertFails(
        set(
          ref(admin, `championshipLedger/competitionSources/${competition.id}`),
          {
            ...source,
            meta: { ...source.meta, entryCount: 1 },
            entries: { "bad-award": entry },
          },
        ),
      );
    });

    it("rejects negative, fractional, and excessive competition points", async () => {
      const { admin } = contexts();
      const { competition, source } = await activeSourceFixture();
      const baseEntry = {
        id: "test-entry",
        participantId: "guest-1",
        sourceNamespace: "competition",
        sourceId: competition.id,
        sourceEntityId: "match-1",
        sourceType: "match-win",
        points: 2,
        label: "Match win",
        competitionId: competition.id,
        competitionFormat: competition.format,
        stage: "round-robin",
        awardedAt: Date.now(),
        sourceRevision: 1,
        schemaVersion: 1,
      };
      for (const points of [-1, 1.5, 10001]) {
        await assertFails(
          set(
            ref(
              admin,
              `championshipLedger/competitionSources/${competition.id}`,
            ),
            {
              ...source,
              meta: { ...source.meta, entryCount: 1 },
              entries: { "test-entry": { ...baseEntry, points } },
            },
          ),
        );
      }
    });

    it("rejects an invalid entry ID and unexpected privileged fields", async () => {
      const { admin } = contexts();
      const { competition, source } = await activeSourceFixture();
      const entry = {
        id: "different-id",
        participantId: "guest-1",
        sourceNamespace: "competition",
        sourceId: competition.id,
        sourceEntityId: "match-1",
        sourceType: "match-win",
        points: 2,
        label: "Match win",
        competitionId: competition.id,
        competitionFormat: competition.format,
        awardedAt: Date.now(),
        sourceRevision: 1,
        schemaVersion: 1,
      };
      await assertFails(
        set(
          ref(admin, `championshipLedger/competitionSources/${competition.id}`),
          {
            ...source,
            meta: { ...source.meta, entryCount: 1 },
            entries: { "entry-id": entry },
            secret: true,
          },
        ),
      );
    });

    it("allows full replacement of a stale valid source", async () => {
      const { admin } = contexts();
      const { competition, source } = await activeSourceFixture();
      await seed({
        participants: { "guest-1": participant("guest-1", "guest-1") },
        competitions: { [competition.id]: competition },
        competitionRuns: {
          [competition.id]: (await activeSourceFixture()).run,
        },
        championshipLedger: {
          competitionSources: {
            [competition.id]: {
              ...source,
              meta: { ...source.meta, sourceFingerprint: "0000000000000000" },
            },
          },
        },
      });
      await assertSucceeds(
        set(
          ref(admin, `championshipLedger/competitionSources/${competition.id}`),
          source,
        ),
      );
    });

    it("allows admin orphan removal but denies guest removal", async () => {
      const { admin, guest } = contexts();
      const { competition, source } = await activeSourceFixture();
      await seed({
        competitions: {
          [competition.id]: { ...competition, status: "scheduled" },
        },
        championshipLedger: {
          competitionSources: { [competition.id]: source },
        },
      });
      await assertFails(
        remove(
          ref(guest, `championshipLedger/competitionSources/${competition.id}`),
        ),
      );
      await assertSucceeds(
        remove(
          ref(admin, `championshipLedger/competitionSources/${competition.id}`),
        ),
      );
    });

    it("allows guests to read only the public active bonus collection", async () => {
      const { guest } = contexts();
      await assertSucceeds(
        get(ref(guest, "championshipLedger/manualBonusesPublic")),
      );
      await assertFails(get(ref(guest, "championshipLedger/manualBonuses")));
    });

    it("denies guest creation in both bonus collections", async () => {
      const { guest } = contexts();
      const bonus = manualBonus();
      await assertFails(
        set(ref(guest, `championshipLedger/manualBonuses/${bonus.id}`), bonus),
      );
      await assertFails(
        set(
          ref(guest, `championshipLedger/manualBonusesPublic/${bonus.id}`),
          publicManualBonus(bonus),
        ),
      );
    });

    it("allows an admin to create a valid bonus atomically", async () => {
      const { admin } = contexts();
      const bonus = manualBonus();
      await seed({
        participants: { "guest-1": participant("guest-1", "guest-1") },
      });
      await assertSucceeds(
        update(ref(admin), {
          [`championshipLedger/manualBonuses/${bonus.id}`]: bonus,
          [`championshipLedger/manualBonusesPublic/${bonus.id}`]:
            publicManualBonus(bonus),
        }),
      );
    });

    it("rejects zero, negative, fractional, and excessive bonuses", async () => {
      const { admin } = contexts();
      await seed({
        participants: { "guest-1": participant("guest-1", "guest-1") },
      });
      for (const [index, points] of [0, -1, 1.5, 101].entries()) {
        const bonus = { ...manualBonus(`bonus-invalid-${index}`), points };
        await assertFails(
          update(ref(admin), {
            [`championshipLedger/manualBonuses/${bonus.id}`]: bonus,
            [`championshipLedger/manualBonusesPublic/${bonus.id}`]:
              publicManualBonus(bonus),
          }),
        );
      }
    });

    it("rejects an overlong manual bonus label", async () => {
      const { admin } = contexts();
      const bonus = { ...manualBonus(), label: "x".repeat(81) };
      await seed({
        participants: { "guest-1": participant("guest-1", "guest-1") },
      });
      await assertFails(
        update(ref(admin), {
          [`championshipLedger/manualBonuses/${bonus.id}`]: bonus,
          [`championshipLedger/manualBonusesPublic/${bonus.id}`]:
            publicManualBonus(bonus),
        }),
      );
    });

    it("allows valid admin revocation and denies guest revocation", async () => {
      const { admin, guest } = contexts();
      const bonus = manualBonus();
      await seed({
        participants: { "guest-1": participant("guest-1", "guest-1") },
        championshipLedger: {
          manualBonuses: { [bonus.id]: bonus },
          manualBonusesPublic: { [bonus.id]: publicManualBonus(bonus) },
        },
      });
      const revoked = {
        ...bonus,
        status: "revoked",
        revokedAt: Date.now(),
        revokedByUid: "admin",
        updatedAt: Date.now(),
        revision: 2,
      };
      await assertFails(
        update(ref(guest), {
          [`championshipLedger/manualBonuses/${bonus.id}`]: revoked,
          [`championshipLedger/manualBonusesPublic/${bonus.id}`]: null,
        }),
      );
      await assertSucceeds(
        update(ref(admin), {
          [`championshipLedger/manualBonuses/${bonus.id}`]: revoked,
          [`championshipLedger/manualBonusesPublic/${bonus.id}`]: null,
        }),
      );
    });

    it("rejects stale bonus revisions", async () => {
      const { admin } = contexts();
      const bonus = manualBonus();
      await seed({
        participants: { "guest-1": participant("guest-1", "guest-1") },
        championshipLedger: {
          manualBonuses: { [bonus.id]: bonus },
          manualBonusesPublic: { [bonus.id]: publicManualBonus(bonus) },
        },
      });
      await assertFails(
        update(ref(admin), {
          [`championshipLedger/manualBonuses/${bonus.id}`]: {
            ...bonus,
            status: "revoked",
            revokedAt: Date.now(),
            revokedByUid: "admin",
            revision: 1,
          },
          [`championshipLedger/manualBonusesPublic/${bonus.id}`]: null,
        }),
      );
    });

    it("allows restoration with the next revision", async () => {
      const { admin } = contexts();
      const base = manualBonus();
      const revoked = {
        ...base,
        status: "revoked" as const,
        revokedAt: Date.now(),
        revokedByUid: "admin",
        revision: 2,
      };
      await seed({
        participants: { "guest-1": participant("guest-1", "guest-1") },
        championshipLedger: { manualBonuses: { [base.id]: revoked } },
      });
      const restored = {
        ...revoked,
        status: "active" as const,
        revokedAt: null,
        revokedByUid: null,
        updatedAt: Date.now(),
        revision: 3,
      };
      await assertSucceeds(
        update(ref(admin), {
          [`championshipLedger/manualBonuses/${base.id}`]: restored,
          [`championshipLedger/manualBonusesPublic/${base.id}`]:
            publicManualBonus(restored),
        }),
      );
    });

    it("rejects invalid same-state transitions", async () => {
      const { admin } = contexts();
      const bonus = manualBonus();
      await seed({
        participants: { "guest-1": participant("guest-1", "guest-1") },
        championshipLedger: {
          manualBonuses: { [bonus.id]: bonus },
          manualBonusesPublic: { [bonus.id]: publicManualBonus(bonus) },
        },
      });
      const changed = { ...bonus, revision: 2, updatedAt: Date.now() };
      await assertFails(
        update(ref(admin), {
          [`championshipLedger/manualBonuses/${bonus.id}`]: changed,
          [`championshipLedger/manualBonusesPublic/${bonus.id}`]:
            publicManualBonus(changed),
        }),
      );
    });

    it("prevents changing bonus creation metadata", async () => {
      const { admin } = contexts();
      const bonus = manualBonus();
      await seed({
        participants: { "guest-1": participant("guest-1", "guest-1") },
        championshipLedger: {
          manualBonuses: { [bonus.id]: bonus },
          manualBonusesPublic: { [bonus.id]: publicManualBonus(bonus) },
        },
      });
      await assertFails(
        update(ref(admin), {
          [`championshipLedger/manualBonuses/${bonus.id}`]: {
            ...bonus,
            status: "revoked",
            createdAt: bonus.createdAt - 1,
            revokedAt: Date.now(),
            revokedByUid: "admin",
            revision: 2,
          },
          [`championshipLedger/manualBonusesPublic/${bonus.id}`]: null,
        }),
      );
    });

    it("denies hard deletion of a private bonus", async () => {
      const { admin } = contexts();
      const bonus = manualBonus();
      await seed({
        championshipLedger: { manualBonuses: { [bonus.id]: bonus } },
      });
      await assertFails(
        remove(ref(admin, `championshipLedger/manualBonuses/${bonus.id}`)),
      );
    });

    it("accepts Phase 7 audit actions once and remains append-only", async () => {
      const { admin } = contexts();
      const entry = auditEntry("phase-7-audit", "bonus-1", {
        action: "manual-bonus-created",
        entityType: "manual-bonus",
        summary: "Manual championship bonus created.",
      });
      await assertSucceeds(set(ref(admin, "audit/phase-7-audit"), entry));
      await assertFails(
        set(ref(admin, "audit/phase-7-audit"), {
          ...entry,
          summary: "Changed audit entry.",
        }),
      );
    });

    it("keeps future birthday, prediction, and reveal paths denied", async () => {
      const { admin, guest } = contexts();
      for (const path of [
        "birthdayMessages/new",
        "predictions/new",
        "reveals/new",
      ]) {
        await assertFails(set(ref(admin, path), { value: "not implemented" }));
        await assertFails(set(ref(guest, path), { value: "not implemented" }));
      }
    });
  });

  describe("Phase 8 Birthday Vault", () => {
    function contexts() {
      return {
        unauthenticated: environment.unauthenticatedContext().database(),
        guest: environment.authenticatedContext("guest-1").database(),
        otherGuest: environment.authenticatedContext("guest-2").database(),
        admin: environment
          .authenticatedContext("admin", { admin: true })
          .database(),
      };
    }

    async function seedCollecting(overrides: Record<string, unknown> = {}) {
      await seed({
        participants: {
          "guest-1": participant("guest-1", "guest-1"),
          "guest-2": participant("guest-2", "guest-2"),
        },
        userProfiles: {
          "guest-1": {
            uid: "guest-1",
            participantId: "guest-1",
            createdAt: Date.now(),
            updatedAt: Date.now(),
            schemaVersion: 1,
          },
          "guest-2": {
            uid: "guest-2",
            participantId: "guest-2",
            createdAt: Date.now(),
            updatedAt: Date.now(),
            schemaVersion: 1,
          },
        },
        birthdayVault: {
          publicState: birthdayState("collecting"),
          ...overrides,
        },
      });
    }

    async function submitOwn(database: Database) {
      const message = birthdayMessage();
      await update(ref(database), {
        "birthdayVault/privateMessages/guest-1": message,
        [`birthdayVault/submissionReceipts/${birthdayPublicationId}`]:
          birthdayReceipt({
            updatedAt: message.updatedAt,
          }),
      });
      return message;
    }

    it("1 denies unauthenticated public-state reads", async () => {
      await seedCollecting();
      await assertFails(
        get(ref(contexts().unauthenticated, "birthdayVault/publicState")),
      );
    });

    it("2 allows authenticated public-state reads", async () => {
      await seedCollecting();
      await assertSucceeds(
        get(ref(contexts().guest, "birthdayVault/publicState")),
      );
    });

    it("3 denies guest public-state creation and modification", async () => {
      await assertFails(
        set(
          ref(contexts().guest, "birthdayVault/publicState"),
          birthdayState(),
        ),
      );
      await seedCollecting();
      await assertFails(
        set(
          ref(contexts().guest, "birthdayVault/publicState"),
          birthdayState("closed"),
        ),
      );
    });

    it("4 allows an admin to open the vault in collecting state", async () => {
      await assertSucceeds(
        set(
          ref(contexts().admin, "birthdayVault/publicState"),
          birthdayState(),
        ),
      );
    });

    it("5 rejects invalid state transitions", async () => {
      await seedCollecting();
      await assertFails(
        set(
          ref(contexts().admin, "birthdayVault/publicState"),
          birthdayState("revealed", { revision: 2 }),
        ),
      );
    });

    it("6 rejects stale public-state revisions", async () => {
      await seedCollecting();
      await assertFails(
        set(
          ref(contexts().admin, "birthdayVault/publicState"),
          birthdayState("closed", { revision: 1 }),
        ),
      );
    });

    it("7 allows an owner to atomically create one valid message and receipt", async () => {
      await seedCollecting();
      await assertSucceeds(submitOwn(contexts().guest));
    });

    it("8 rejects a submission before participant-profile linking", async () => {
      await seedCollecting();
      await seedAt("userProfiles/guest-1", null);
      await assertFails(submitOwn(contexts().guest));
    });

    it("9 rejects a submission for another participant", async () => {
      await seedCollecting();
      const message = birthdayMessage({ participantId: "guest-2" });
      await assertFails(
        update(ref(contexts().guest), {
          "birthdayVault/privateMessages/guest-1": message,
          [`birthdayVault/submissionReceipts/${birthdayPublicationId}`]:
            birthdayReceipt({ updatedAt: message.updatedAt }),
        }),
      );
    });

    it("10 denies reading another guest private message", async () => {
      await seedCollecting({
        privateMessages: { "guest-1": birthdayMessage() },
      });
      await assertFails(
        get(
          ref(contexts().otherGuest, "birthdayVault/privateMessages/guest-1"),
        ),
      );
    });

    it("11 denies writing another guest private message", async () => {
      await seedCollecting();
      await assertFails(
        set(
          ref(contexts().otherGuest, "birthdayVault/privateMessages/guest-1"),
          birthdayMessage(),
        ),
      );
    });

    it("12 allows an organizer to read the private collection", async () => {
      await seedCollecting({
        privateMessages: { "guest-1": birthdayMessage() },
      });
      await assertSucceeds(
        get(ref(contexts().admin, "birthdayVault/privateMessages")),
      );
    });

    it("13 allows an owner edit with an atomic receipt update while collecting", async () => {
      await seedCollecting();
      const current = await submitOwn(contexts().guest);
      const next = {
        ...current,
        message: "An edited thoughtful birthday note.",
        updatedAt: Date.now(),
        revision: 2,
      };
      await assertSucceeds(
        update(ref(contexts().guest), {
          "birthdayVault/privateMessages/guest-1": next,
          [`birthdayVault/submissionReceipts/${birthdayPublicationId}`]:
            birthdayReceipt({ updatedAt: next.updatedAt }),
        }),
      );
    });

    it("14 rejects owner edits after close", async () => {
      await seedCollecting();
      const current = await submitOwn(contexts().guest);
      await seedAt("birthdayVault/publicState", birthdayState("closed"));
      const next = {
        ...current,
        message: "An edited thoughtful birthday note.",
        updatedAt: Date.now(),
        revision: 2,
      };
      await assertFails(
        update(ref(contexts().guest), {
          "birthdayVault/privateMessages/guest-1": next,
          [`birthdayVault/submissionReceipts/${birthdayPublicationId}`]:
            birthdayReceipt({ updatedAt: next.updatedAt }),
        }),
      );
    });

    it("15 rejects owner edits after reveal", async () => {
      await seedCollecting();
      const current = await submitOwn(contexts().guest);
      await seedAt("birthdayVault/publicState", birthdayState("revealed"));
      const next = {
        ...current,
        message: "An edited thoughtful birthday note.",
        updatedAt: Date.now(),
        revision: 2,
      };
      await assertFails(
        update(ref(contexts().guest), {
          "birthdayVault/privateMessages/guest-1": next,
          [`birthdayVault/submissionReceipts/${birthdayPublicationId}`]:
            birthdayReceipt({ updatedAt: next.updatedAt }),
        }),
      );
    });

    it("16 keeps publication identity immutable", async () => {
      await seedCollecting();
      const current = await submitOwn(contexts().guest);
      const next = {
        ...current,
        publicationId: secondBirthdayPublicationId,
        updatedAt: Date.now(),
        revision: 2,
      };
      await assertFails(
        update(ref(contexts().guest), {
          "birthdayVault/privateMessages/guest-1": next,
          [`birthdayVault/submissionReceipts/${secondBirthdayPublicationId}`]:
            birthdayReceipt({
              publicationId: secondBirthdayPublicationId,
              updatedAt: next.updatedAt,
            }),
        }),
      );
    });

    it("17 keeps participant identity immutable", async () => {
      await seedCollecting();
      const current = await submitOwn(contexts().guest);
      const next = {
        ...current,
        participantId: "guest-2",
        updatedAt: Date.now(),
        revision: 2,
      };
      await assertFails(
        update(ref(contexts().guest), {
          "birthdayVault/privateMessages/guest-1": next,
          [`birthdayVault/submissionReceipts/${birthdayPublicationId}`]:
            birthdayReceipt({ updatedAt: next.updatedAt }),
        }),
      );
    });

    it("18 rejects stale message revisions", async () => {
      await seedCollecting();
      const current = await submitOwn(contexts().guest);
      const next = {
        ...current,
        message: "A stale replacement message.",
        updatedAt: Date.now(),
        revision: 1,
      };
      await assertFails(
        update(ref(contexts().guest), {
          "birthdayVault/privateMessages/guest-1": next,
          [`birthdayVault/submissionReceipts/${birthdayPublicationId}`]:
            birthdayReceipt({ updatedAt: next.updatedAt }),
        }),
      );
    });

    it("19 rejects invalid message lengths", async () => {
      await seedCollecting();
      for (const text of ["four", "x".repeat(1201)]) {
        const message = birthdayMessage({ message: text });
        await assertFails(
          update(ref(contexts().guest), {
            "birthdayVault/privateMessages/guest-1": message,
            [`birthdayVault/submissionReceipts/${birthdayPublicationId}`]:
              birthdayReceipt({ updatedAt: message.updatedAt }),
          }),
        );
      }
    });

    it("20 rejects an overlong title", async () => {
      await seedCollecting();
      const message = birthdayMessage({ title: "x".repeat(61) });
      await assertFails(
        update(ref(contexts().guest), {
          "birthdayVault/privateMessages/guest-1": message,
          [`birthdayVault/submissionReceipts/${birthdayPublicationId}`]:
            birthdayReceipt({ updatedAt: message.updatedAt }),
        }),
      );
    });

    it("21 rejects an unapproved emoji key", async () => {
      await seedCollecting();
      const message = birthdayMessage({ emojiKey: "remote-image" });
      await assertFails(
        update(ref(contexts().guest), {
          "birthdayVault/privateMessages/guest-1": message,
          [`birthdayVault/submissionReceipts/${birthdayPublicationId}`]:
            birthdayReceipt({ updatedAt: message.updatedAt }),
        }),
      );
    });

    it("22 allows withdrawal with a matching inactive receipt", async () => {
      await seedCollecting();
      const current = await submitOwn(contexts().guest);
      const next = {
        ...current,
        status: "withdrawn",
        updatedAt: Date.now(),
        revision: 2,
      };
      await assertSucceeds(
        update(ref(contexts().guest), {
          "birthdayVault/privateMessages/guest-1": next,
          [`birthdayVault/submissionReceipts/${birthdayPublicationId}`]:
            birthdayReceipt({ active: false, updatedAt: next.updatedAt }),
        }),
      );
    });

    it("23 rejects withdrawal after close", async () => {
      await seedCollecting();
      const current = await submitOwn(contexts().guest);
      await seedAt("birthdayVault/publicState", birthdayState("closed"));
      const next = {
        ...current,
        status: "withdrawn",
        updatedAt: Date.now(),
        revision: 2,
      };
      await assertFails(
        update(ref(contexts().guest), {
          "birthdayVault/privateMessages/guest-1": next,
          [`birthdayVault/submissionReceipts/${birthdayPublicationId}`]:
            birthdayReceipt({ active: false, updatedAt: next.updatedAt }),
        }),
      );
    });

    it("24 requires the receipt matching the owner message", async () => {
      await seedCollecting();
      await assertSucceeds(submitOwn(contexts().guest));
      await assertFails(
        set(
          ref(
            contexts().guest,
            `birthdayVault/submissionReceipts/${birthdayPublicationId}`,
          ),
          birthdayReceipt({ updatedAt: Date.now() }),
        ),
      );
    });

    it("25 denies receipts for another publication identity", async () => {
      await seedCollecting();
      await submitOwn(contexts().guest);
      await assertFails(
        set(
          ref(
            contexts().guest,
            `birthdayVault/submissionReceipts/${secondBirthdayPublicationId}`,
          ),
          birthdayReceipt({ publicationId: secondBirthdayPublicationId }),
        ),
      );
    });

    it("26 rejects private fields in a receipt", async () => {
      await seedCollecting();
      const message = birthdayMessage();
      await assertFails(
        update(ref(contexts().guest), {
          "birthdayVault/privateMessages/guest-1": message,
          [`birthdayVault/submissionReceipts/${birthdayPublicationId}`]:
            birthdayReceipt({ message: "private" }),
        }),
      );
    });

    it("27 rejects a receipt inconsistent with message status", async () => {
      await seedCollecting();
      const message = birthdayMessage({ status: "withdrawn" });
      await assertFails(
        update(ref(contexts().guest), {
          "birthdayVault/privateMessages/guest-1": message,
          [`birthdayVault/submissionReceipts/${birthdayPublicationId}`]:
            birthdayReceipt({ active: true, updatedAt: message.updatedAt }),
        }),
      );
    });

    it("28 allows authenticated reads of sanitized receipts", async () => {
      await seedCollecting({
        submissionReceipts: { [birthdayPublicationId]: birthdayReceipt() },
      });
      await assertSucceeds(
        get(ref(contexts().otherGuest, "birthdayVault/submissionReceipts")),
      );
    });

    it("29 denies guest moderation reads", async () => {
      await seedCollecting({ moderation: { "guest-1": birthdayModeration() } });
      await assertFails(
        get(ref(contexts().guest, "birthdayVault/moderation/guest-1")),
      );
    });

    it("30 denies guest moderation writes", async () => {
      await seedCollecting({
        privateMessages: { "guest-1": birthdayMessage() },
      });
      await assertFails(
        set(
          ref(contexts().guest, "birthdayVault/moderation/guest-1"),
          birthdayModeration({ updatedByUid: "guest-1" }),
        ),
      );
    });

    it("31 allows admin approval of the current message revision", async () => {
      await seedCollecting({
        privateMessages: { "guest-1": birthdayMessage() },
      });
      await assertSucceeds(
        set(
          ref(contexts().admin, "birthdayVault/moderation/guest-1"),
          birthdayModeration(),
        ),
      );
    });

    it("32 allows an admin to hide a message", async () => {
      await seedCollecting({
        privateMessages: { "guest-1": birthdayMessage() },
      });
      const hidden = birthdayModeration({ status: "hidden" });
      delete hidden.displayOrder;
      await assertSucceeds(
        set(ref(contexts().admin, "birthdayVault/moderation/guest-1"), hidden),
      );
    });

    it("33 rejects invalid moderation statuses", async () => {
      await seedCollecting({
        privateMessages: { "guest-1": birthdayMessage() },
      });
      await assertFails(
        set(
          ref(contexts().admin, "birthdayVault/moderation/guest-1"),
          birthdayModeration({ status: "pending" }),
        ),
      );
    });

    it("34 rejects stale moderation revisions", async () => {
      await seedCollecting({
        privateMessages: { "guest-1": birthdayMessage() },
        moderation: { "guest-1": birthdayModeration() },
      });
      await assertFails(
        set(
          ref(contexts().admin, "birthdayVault/moderation/guest-1"),
          birthdayModeration({ revision: 1 }),
        ),
      );
    });

    it("35 rejects overlong moderation notes", async () => {
      await seedCollecting({
        privateMessages: { "guest-1": birthdayMessage() },
      });
      await assertFails(
        set(
          ref(contexts().admin, "birthdayVault/moderation/guest-1"),
          birthdayModeration({ note: "x".repeat(281) }),
        ),
      );
    });

    it("36 denies guest writes to published messages", async () => {
      await seedCollecting();
      await assertFails(
        set(
          ref(
            contexts().guest,
            `birthdayVault/publishedMessages/${birthdayPublicationId}`,
          ),
          publishedBirthdayMessage(),
        ),
      );
    });

    it("37 denies published-message reads before reveal", async () => {
      await seedCollecting({
        publishedMessages: {
          [birthdayPublicationId]: publishedBirthdayMessage(),
        },
      });
      await assertFails(
        get(ref(contexts().guest, "birthdayVault/publishedMessages")),
      );
    });

    it("38 allows published-message reads after reveal", async () => {
      await seedCollecting({
        publicState: birthdayState("revealed"),
        publishedMessages: {
          [birthdayPublicationId]: publishedBirthdayMessage(),
        },
      });
      await assertSucceeds(
        get(ref(contexts().guest, "birthdayVault/publishedMessages")),
      );
    });

    it("39 rejects anonymous publication containing participant identity", async () => {
      await seedCollecting({ publicState: birthdayState("revealed") });
      await assertFails(
        set(
          ref(
            contexts().admin,
            `birthdayVault/publishedMessages/${birthdayPublicationId}`,
          ),
          publishedBirthdayMessage({
            author: {
              mode: "anonymous",
              participantId: "guest-1",
              displayName: "Anonymous",
            },
          }),
        ),
      );
    });

    it("40 rejects named publication missing author snapshot data", async () => {
      await seedCollecting({ publicState: birthdayState("revealed") });
      await assertFails(
        set(
          ref(
            contexts().admin,
            `birthdayVault/publishedMessages/${birthdayPublicationId}`,
          ),
          publishedBirthdayMessage({
            author: {
              mode: "named",
              participantId: "guest-1",
              displayName: "Castle Guest",
            },
          }),
        ),
      );
    });

    it("41 rejects invalid published display order", async () => {
      await seedCollecting({ publicState: birthdayState("revealed") });
      await assertFails(
        set(
          ref(
            contexts().admin,
            `birthdayVault/publishedMessages/${birthdayPublicationId}`,
          ),
          publishedBirthdayMessage({ displayOrder: -1 }),
        ),
      );
    });

    it("42 rejects published records with the wrong reveal revision", async () => {
      await seedCollecting({ publicState: birthdayState("revealed") });
      await assertFails(
        set(
          ref(
            contexts().admin,
            `birthdayVault/publishedMessages/${birthdayPublicationId}`,
          ),
          publishedBirthdayMessage({ revealRevision: 2 }),
        ),
      );
    });

    it("43 allows an admin to atomically reveal one valid published set", async () => {
      const closed = birthdayState("closed", {
        closedAt: Date.now() - 120_000,
        closedByUid: "another-admin",
      });
      await seedCollecting({ publicState: closed });
      await assertSucceeds(
        update(ref(contexts().admin), {
          "birthdayVault/publicState": birthdayState("revealed", {
            openedAt: closed.openedAt,
            openedByUid: closed.openedByUid,
            closedAt: closed.closedAt,
            closedByUid: closed.closedByUid,
          }),
          "birthdayVault/publishedMessages": {
            [birthdayPublicationId]: publishedBirthdayMessage(),
          },
          "audit/birthday-reveal": auditEntry(
            "birthday-reveal",
            "birthday-vault",
            {
              action: "birthday-vault-revealed",
              entityType: "birthday-vault",
              beforeRevision: 2,
              afterRevision: 3,
              summary: "Birthday Vault revealed to authenticated guests.",
            },
          ),
        }),
      );
    });

    it("44 blocks a structurally incomplete reveal with no published set", async () => {
      await seedCollecting({
        publicState: birthdayState("closed"),
        privateMessages: { "guest-1": birthdayMessage() },
      });
      await assertFails(
        set(
          ref(contexts().admin, "birthdayVault/publicState"),
          birthdayState("revealed"),
        ),
      );
    });

    it("45 blocks publication changes outside an atomic reveal transition", async () => {
      await seedCollecting({
        publicState: birthdayState("revealed"),
        publishedMessages: {
          [birthdayPublicationId]: publishedBirthdayMessage(),
        },
      });
      await assertFails(
        set(
          ref(
            contexts().admin,
            `birthdayVault/publishedMessages/${birthdayPublicationId}`,
          ),
          publishedBirthdayMessage({ title: "Changed after publication" }),
        ),
      );
    });

    it("46 allows controlled republish with incremented state and reveal revisions", async () => {
      const revealed = birthdayState("revealed");
      await seedCollecting({
        publicState: revealed,
        publishedMessages: {
          [birthdayPublicationId]: publishedBirthdayMessage(),
        },
      });
      await assertSucceeds(
        update(ref(contexts().admin), {
          "birthdayVault/publicState": birthdayState("revealed", {
            openedAt: revealed.openedAt,
            openedByUid: revealed.openedByUid,
            closedAt: revealed.closedAt,
            closedByUid: revealed.closedByUid,
            revision: 4,
            revealRevision: 2,
          }),
          [`birthdayVault/publishedMessages/${birthdayPublicationId}`]:
            publishedBirthdayMessage({ revealRevision: 2 }),
        }),
      );
    });

    it("47 denies guest republish", async () => {
      await seedCollecting({
        publicState: birthdayState("revealed"),
        publishedMessages: {
          [birthdayPublicationId]: publishedBirthdayMessage(),
        },
      });
      await assertFails(
        update(ref(contexts().guest), {
          "birthdayVault/publicState": birthdayState("revealed", {
            revision: 4,
            revealRevision: 2,
            updatedByUid: "guest-1",
            revealedByUid: "guest-1",
          }),
          [`birthdayVault/publishedMessages/${birthdayPublicationId}`]:
            publishedBirthdayMessage({ revealRevision: 2 }),
        }),
      );
    });

    it("48 keeps Birthday Vault audit entries append-only", async () => {
      const entry = auditEntry("birthday-audit", "birthday-vault", {
        action: "birthday-vault-opened",
        entityType: "birthday-vault",
        summary: "Birthday Vault submissions opened.",
      });
      await assertSucceeds(
        set(ref(contexts().admin, "audit/birthday-audit"), entry),
      );
      await assertFails(
        set(ref(contexts().admin, "audit/birthday-audit"), {
          ...entry,
          summary: "Changed.",
        }),
      );
    });

    it("49 preserves existing participant owner protections", async () => {
      await seed({
        participants: { "guest-1": participant("guest-1", "guest-1") },
      });
      await assertFails(remove(ref(contexts().guest, "participants/guest-1")));
    });

    it("50 preserves existing competition guest-write denial", async () => {
      await assertFails(
        set(ref(contexts().guest, "competitions/new"), competitionDraft("new")),
      );
    });

    it("51 preserves existing championship-ledger guest-write denial", async () => {
      await assertFails(
        set(
          ref(contexts().guest, "championshipLedger/manualBonusesPublic/new"),
          { points: 4 },
        ),
      );
    });

    it("52 keeps prediction paths denied", async () => {
      await assertFails(
        set(ref(contexts().admin, "predictions/event/guest-1"), {
          selection: "option-a",
        }),
      );
      await assertFails(
        set(ref(contexts().guest, "predictions/event/guest-1"), {
          selection: "option-a",
        }),
      );
    });

    it("53 keeps special-reveal paths denied", async () => {
      await assertFails(
        set(ref(contexts().admin, "specialReveal/state"), { status: "locked" }),
      );
      await assertFails(
        set(ref(contexts().guest, "specialReveal/state"), { status: "locked" }),
      );
    });
  });

  describe("Phase 9 special reveal and predictions", () => {
    const predictionId = "123e4567-e89b-42d3-a456-426614174001";

    function contexts() {
      const recentAuthTime = Math.floor(Date.now() / 1000);
      return {
        unauthenticated: environment.unauthenticatedContext().database(),
        guest: environment.authenticatedContext("guest-1").database(),
        otherGuest: environment.authenticatedContext("guest-2").database(),
        admin: environment
          .authenticatedContext("admin", { admin: true })
          .database(),
        specialOnly: environment
          .authenticatedContext("special-only", {
            specialRevealAdmin: true,
            auth_time: recentAuthTime,
          })
          .database(),
        revealAdmin: environment
          .authenticatedContext("reveal-admin", {
            admin: true,
            specialRevealAdmin: true,
            auth_time: recentAuthTime,
          })
          .database(),
        oldRevealAdmin: environment
          .authenticatedContext("reveal-admin", {
            admin: true,
            specialRevealAdmin: true,
            auth_time: recentAuthTime - 301,
          })
          .database(),
      };
    }

    function revealState(
      status:
        | "prediction-open"
        | "prediction-locked"
        | "resolved" = "prediction-open",
      overrides: Record<string, unknown> = {},
    ) {
      const now = Date.now();
      return {
        eventId: "event-neutral",
        status,
        openedAt: now,
        ...(status !== "prediction-open" ? { lockedAt: now } : {}),
        ...(status === "resolved" ? { resolvedAt: now } : {}),
        openRevision: 1,
        resolutionRevision: status === "resolved" ? 1 : 0,
        revision:
          status === "prediction-open"
            ? 1
            : status === "prediction-locked"
              ? 2
              : 3,
        schemaVersion: 1,
        ...overrides,
      };
    }

    function revealConfig(overrides: Record<string, unknown> = {}) {
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
        createdByUid: "reveal-admin",
        updatedAt: now,
        updatedByUid: "reveal-admin",
        revision: 1,
        schemaVersion: 1,
        ...overrides,
      };
    }

    function prediction(overrides: Record<string, unknown> = {}) {
      const now = Date.now();
      return {
        ownerUid: "guest-1",
        participantId: "guest-1",
        predictionId,
        selection: "option-a",
        status: "submitted",
        createdAt: now,
        updatedAt: now,
        revision: 1,
        schemaVersion: 1,
        ...overrides,
      };
    }

    function receipt(overrides: Record<string, unknown> = {}) {
      return {
        predictionId,
        active: true,
        updatedAt: Date.now(),
        schemaVersion: 1,
        ...overrides,
      };
    }

    async function seedReveal(
      status:
        | "prediction-open"
        | "prediction-locked"
        | "resolved" = "prediction-open",
      overrides: Record<string, unknown> = {},
    ) {
      await seed({
        participants: {
          "guest-1": participant("guest-1", "guest-1"),
          "guest-2": participant("guest-2", "guest-2"),
        },
        userProfiles: {
          "guest-1": {
            uid: "guest-1",
            participantId: "guest-1",
            createdAt: Date.now(),
            updatedAt: Date.now(),
            schemaVersion: 1,
          },
          "guest-2": {
            uid: "guest-2",
            participantId: "guest-2",
            createdAt: Date.now(),
            updatedAt: Date.now(),
            schemaVersion: 1,
          },
        },
        specialReveal: {
          privateConfig: revealConfig(),
          publicState: revealState(status),
          publicOpening: {
            eventId: "event-neutral",
            title: "A special announcement is ready.",
            body: "Make one private prediction.",
            emojiKey: "sparkles",
            predictionPrompt: "Which option do you predict?",
            optionLabels: { "option-a": "Option A", "option-b": "Option B" },
            publishedAt: Date.now(),
            openRevision: 1,
            schemaVersion: 1,
          },
          ...(status === "resolved"
            ? {
                publicResolution: {
                  eventId: "event-neutral",
                  correctOption: "option-a",
                  correctOptionLabel: "Option A",
                  title: "Option A resolution",
                  body: "Selected presentation.",
                  emojiKey: "star",
                  aggregate: { optionA: 1, optionB: 0, total: 1 },
                  correctPredictionPoints: 3,
                  resolvedAt: Date.now(),
                  resolutionRevision: 1,
                  schemaVersion: 1,
                },
              }
            : {}),
          ...overrides,
        },
      });
    }

    async function submit(database: Database, value = prediction()) {
      await update(ref(database), {
        "specialReveal/predictions/guest-1": value,
        [`specialReveal/predictionReceipts/${predictionId}`]: receipt({
          active: value.status === "submitted",
          updatedAt: value.updatedAt,
        }),
      });
    }

    function typedConfig() {
      return revealConfig() as unknown as SpecialRevealPrivateConfig;
    }

    function typedState(
      status:
        | "prediction-open"
        | "prediction-locked"
        | "resolved" = "prediction-open",
      overrides: Record<string, unknown> = {},
    ) {
      return revealState(
        status,
        overrides,
      ) as unknown as SpecialRevealPublicState;
    }

    function revealPrediction() {
      return prediction() as unknown as SpecialRevealPrediction;
    }

    function browserResolutionInput(
      state: SpecialRevealPublicState,
      correctOption: "option-a" | "option-b" = "option-a",
    ) {
      return {
        config: typedConfig(),
        state,
        predictions: [revealPrediction()],
        participants: {
          "guest-1": participant("guest-1", "guest-1"),
          "guest-2": participant("guest-2", "guest-2"),
        },
        profiles: {
          "guest-1": { participantId: "guest-1" },
          "guest-2": { participantId: "guest-2" },
        },
        correctOption,
        actorUid: "reveal-admin",
        now: Date.now(),
      };
    }

    it("1 denies unauthenticated public-state reads", async () => {
      await seedReveal();
      await assertFails(
        get(ref(contexts().unauthenticated, "specialReveal/publicState")),
      );
    });
    it("2 allows authenticated public-state reads", async () => {
      await seedReveal();
      await assertSucceeds(
        get(ref(contexts().guest, "specialReveal/publicState")),
      );
    });
    it("3 denies guest public-state writes", async () => {
      await seedReveal();
      await assertFails(
        set(ref(contexts().guest, "specialReveal/publicState"), revealState()),
      );
    });
    it("4 denies ordinary admin public-state writes", async () => {
      await seedReveal();
      await assertFails(
        set(ref(contexts().admin, "specialReveal/publicState"), revealState()),
      );
    });
    it("5 denies opening reads before publication", async () => {
      await seed({ specialReveal: { privateConfig: revealConfig() } });
      await assertFails(
        get(ref(contexts().guest, "specialReveal/publicOpening")),
      );
    });
    it("6 allows opening reads after publication", async () => {
      await seedReveal();
      await assertSucceeds(
        get(ref(contexts().guest, "specialReveal/publicOpening")),
      );
    });
    it("7 denies resolution reads before resolution", async () => {
      await seedReveal("prediction-locked", {
        publicResolution: { value: "unavailable" },
      });
      await assertFails(
        get(ref(contexts().guest, "specialReveal/publicResolution")),
      );
    });
    it("8 allows resolution reads after resolution", async () => {
      await seedReveal("resolved");
      await assertSucceeds(
        get(ref(contexts().guest, "specialReveal/publicResolution")),
      );
    });
    it("9 denies guest private-config reads", async () => {
      await seedReveal();
      await assertFails(
        get(ref(contexts().guest, "specialReveal/privateConfig")),
      );
    });
    it("10 allows a dedicated reveal admin to read private config", async () => {
      await seedReveal();
      await assertSucceeds(
        get(ref(contexts().revealAdmin, "specialReveal/privateConfig")),
      );
    });
    it("11 allows a dedicated reveal admin to create valid pre-open configuration", async () => {
      await assertSucceeds(
        set(
          ref(contexts().revealAdmin, "specialReveal/privateConfig"),
          revealConfig(),
        ),
      );
    });
    it("12 denies guest configuration creation", async () => {
      await assertFails(
        set(
          ref(contexts().guest, "specialReveal/privateConfig"),
          revealConfig({ createdByUid: "guest-1", updatedByUid: "guest-1" }),
        ),
      );
    });
    it("13 denies invalid configuration option labels", async () => {
      await assertFails(
        set(
          ref(contexts().revealAdmin, "specialReveal/privateConfig"),
          revealConfig({
            optionLabels: { "option-a": "", "option-b": "Option B" },
          }),
        ),
      );
    });
    it("14 denies unknown configuration fields", async () => {
      await assertFails(
        set(
          ref(contexts().revealAdmin, "specialReveal/privateConfig"),
          revealConfig({ hiddenOutcome: "option-a" }),
        ),
      );
    });
    it("15 allows one-step pre-open configuration revision", async () => {
      const current = revealConfig();
      await seed({ specialReveal: { privateConfig: current } });
      await assertSucceeds(
        set(
          ref(contexts().revealAdmin, "specialReveal/privateConfig"),
          revealConfig({ createdAt: current.createdAt, revision: 2 }),
        ),
      );
    });
    it("16 denies stale configuration revision", async () => {
      const current = revealConfig();
      await seed({ specialReveal: { privateConfig: current } });
      await assertFails(
        set(
          ref(contexts().revealAdmin, "specialReveal/privateConfig"),
          revealConfig({ createdAt: current.createdAt, revision: 3 }),
        ),
      );
    });
    it("17 freezes configuration after opening", async () => {
      await seedReveal();
      await assertFails(
        set(
          ref(contexts().revealAdmin, "specialReveal/privateConfig"),
          revealConfig({ revision: 2 }),
        ),
      );
    });
    it("18 denies configuration deletion", async () => {
      await seed({ specialReveal: { privateConfig: revealConfig() } });
      await assertFails(
        remove(ref(contexts().revealAdmin, "specialReveal/privateConfig")),
      );
    });
    it("19 allows an owner to read only their prediction path", async () => {
      await seedReveal();
      await seedAt("specialReveal/predictions/guest-1", prediction());
      await assertSucceeds(
        get(ref(contexts().guest, "specialReveal/predictions/guest-1")),
      );
    });
    it("20 denies another guest prediction reads", async () => {
      await seedReveal();
      await seedAt("specialReveal/predictions/guest-1", prediction());
      await assertFails(
        get(ref(contexts().otherGuest, "specialReveal/predictions/guest-1")),
      );
    });
    it("21 denies admin-client prediction reads", async () => {
      await seedReveal();
      await seedAt("specialReveal/predictions/guest-1", prediction());
      await assertFails(
        get(ref(contexts().admin, "specialReveal/predictions/guest-1")),
      );
    });
    it("22 denies prediction collection enumeration", async () => {
      await seedReveal();
      await assertFails(
        get(ref(contexts().guest, "specialReveal/predictions")),
      );
    });
    it("23 allows an owner-coupled atomic prediction submission", async () => {
      await seedReveal();
      await assertSucceeds(submit(contexts().guest));
    });
    it("24 exposes only sanitized receipts to authenticated guests", async () => {
      await seedReveal();
      await submit(contexts().guest);
      const result = await get(
        ref(contexts().otherGuest, "specialReveal/predictionReceipts"),
      );
      expect(result.val()[predictionId]).toEqual(
        expect.objectContaining({ active: true, predictionId }),
      );
      expect(result.val()[predictionId]).not.toHaveProperty("selection");
    });
    it("25 denies submission without its receipt", async () => {
      await seedReveal();
      await assertFails(
        set(
          ref(contexts().guest, "specialReveal/predictions/guest-1"),
          prediction(),
        ),
      );
    });
    it("26 denies forged ownership", async () => {
      await seedReveal();
      await assertFails(
        submit(contexts().guest, prediction({ ownerUid: "guest-2" })),
      );
    });
    it("27 denies forged participant linkage", async () => {
      await seedReveal();
      await assertFails(
        submit(contexts().guest, prediction({ participantId: "guest-2" })),
      );
    });
    it("28 denies an invalid prediction option", async () => {
      await seedReveal();
      await assertFails(
        submit(contexts().guest, prediction({ selection: "option-c" })),
      );
    });
    it("29 denies initial withdrawn records", async () => {
      await seedReveal();
      await assertFails(
        submit(contexts().guest, prediction({ status: "withdrawn" })),
      );
    });
    it("30 denies unknown prediction fields", async () => {
      await seedReveal();
      await assertFails(
        submit(contexts().guest, prediction({ outcome: "correct" })),
      );
    });
    it("31 allows selection replacement while open", async () => {
      await seedReveal();
      const current = prediction();
      await submit(contexts().guest, current);
      await assertSucceeds(
        submit(
          contexts().guest,
          prediction({
            createdAt: current.createdAt,
            updatedAt: Date.now(),
            revision: 2,
            selection: "option-b",
          }),
        ),
      );
    });
    it("32 allows withdrawal while open", async () => {
      await seedReveal();
      const current = prediction();
      await submit(contexts().guest, current);
      await assertSucceeds(
        submit(
          contexts().guest,
          prediction({
            createdAt: current.createdAt,
            updatedAt: Date.now(),
            revision: 2,
            status: "withdrawn",
          }),
        ),
      );
    });
    it("33 allows resubmission while open", async () => {
      await seedReveal();
      const current = prediction();
      await submit(contexts().guest, current);
      const withdrawn = prediction({
        createdAt: current.createdAt,
        updatedAt: Date.now(),
        revision: 2,
        status: "withdrawn",
      });
      await submit(contexts().guest, withdrawn);
      await assertSucceeds(
        submit(
          contexts().guest,
          prediction({
            createdAt: current.createdAt,
            updatedAt: Date.now(),
            revision: 3,
          }),
        ),
      );
    });
    it("34 denies immutable prediction ID changes", async () => {
      await seedReveal();
      const current = prediction();
      await submit(contexts().guest, current);
      await assertFails(
        update(ref(contexts().guest, "specialReveal/predictions/guest-1"), {
          predictionId: "123e4567-e89b-42d3-a456-426614174002",
          revision: 2,
          updatedAt: Date.now(),
        }),
      );
    });
    it("35 denies stale prediction revisions", async () => {
      await seedReveal();
      const current = prediction();
      await submit(contexts().guest, current);
      await assertFails(
        submit(
          contexts().guest,
          prediction({ createdAt: current.createdAt, revision: 3 }),
        ),
      );
    });
    it("36 denies guest writes after lock", async () => {
      await seedReveal("prediction-locked");
      await assertFails(submit(contexts().guest));
    });
    it("37 allows guest writes after an authorized reopen", async () => {
      await seedReveal("prediction-open", {
        publicState: revealState("prediction-open", { revision: 3 }),
      });
      await assertSucceeds(submit(contexts().guest));
    });
    it("38 denies guest writes after resolution", async () => {
      await seedReveal("resolved");
      await assertFails(submit(contexts().guest));
    });
    it("39 denies admin-client prediction writes", async () => {
      await seedReveal();
      await assertFails(
        set(
          ref(contexts().admin, "specialReveal/predictions/admin"),
          prediction({ ownerUid: "admin" }),
        ),
      );
    });
    it("40 denies uncoupled receipt writes", async () => {
      await seedReveal();
      await assertFails(
        set(
          ref(
            contexts().guest,
            `specialReveal/predictionReceipts/${predictionId}`,
          ),
          receipt(),
        ),
      );
    });
    it("42 denies prediction-source reads before resolution", async () => {
      await seedReveal("prediction-locked");
      await seedAt("championshipLedger/predictionSources/event-neutral", {
        meta: { status: "resolved" },
      });
      await assertFails(
        get(
          ref(
            contexts().guest,
            "championshipLedger/predictionSources/event-neutral",
          ),
        ),
      );
    });
    it("43 allows prediction-source reads after resolution", async () => {
      await seedReveal("resolved");
      await seedAt("championshipLedger/predictionSources/event-neutral", {
        meta: { status: "resolved" },
      });
      await assertSucceeds(
        get(
          ref(
            contexts().guest,
            "championshipLedger/predictionSources/event-neutral",
          ),
        ),
      );
    });
    it("44 denies guest and admin-client prediction-source writes", async () => {
      await seedReveal("resolved");
      await assertFails(
        set(
          ref(
            contexts().guest,
            "championshipLedger/predictionSources/event-neutral",
          ),
          { value: true },
        ),
      );
      await assertFails(
        set(
          ref(
            contexts().admin,
            "championshipLedger/predictionSources/event-neutral",
          ),
          { value: true },
        ),
      );
    });
    it("45 preserves default denial for unknown special-reveal children", async () => {
      await seedReveal();
      await assertFails(
        set(ref(contexts().admin, "specialReveal/unknown"), { value: true }),
      );
    });

    it("46 denies private config to ordinary and single-claim admins", async () => {
      await seed({ specialReveal: { privateConfig: revealConfig() } });
      await assertFails(
        get(ref(contexts().admin, "specialReveal/privateConfig")),
      );
      await assertFails(
        get(ref(contexts().specialOnly, "specialReveal/privateConfig")),
      );
    });

    it("47 allows only a recently authenticated dual-claim admin to enumerate predictions", async () => {
      await seedReveal("prediction-open", {
        predictions: { "guest-1": prediction() },
      });
      await assertSucceeds(
        get(ref(contexts().revealAdmin, "specialReveal/predictions")),
      );
      await assertFails(
        get(ref(contexts().oldRevealAdmin, "specialReveal/predictions")),
      );
      await assertFails(
        get(ref(contexts().admin, "specialReveal/predictions")),
      );
    });

    it("48 opens atomically only with both claims and recent auth", async () => {
      const config = typedConfig();
      await seed({ specialReveal: { privateConfig: config } });
      const mutation = buildOpenRevealMutation({
        config,
        state: null,
        expectedConfigRevision: 1,
        actorUid: "reveal-admin",
        auditId: "audit-open",
        now: Date.now(),
      });
      await assertFails(update(ref(contexts().admin), mutation.updates!));
      await assertFails(update(ref(contexts().specialOnly), mutation.updates!));
      await assertFails(
        update(ref(contexts().oldRevealAdmin), mutation.updates!),
      );
      await assertSucceeds(
        update(ref(contexts().revealAdmin), mutation.updates!),
      );
      const opening = await get(
        ref(contexts().guest, "specialReveal/publicOpening"),
      );
      expect(opening.val()).not.toHaveProperty("resolutionPayloads");
    });

    it("48a accepts the matching opening payload when state already exists", async () => {
      const timestamp = Date.now();
      const config = typedConfig();
      const state = typedState("prediction-open", { openedAt: timestamp });
      await seed({
        specialReveal: { privateConfig: config, publicState: state },
      });
      await assertSucceeds(
        set(ref(contexts().revealAdmin, "specialReveal/publicOpening"), {
          eventId: config.eventId,
          title: config.opening.title,
          body: config.opening.body,
          emojiKey: config.opening.emojiKey,
          predictionPrompt: config.predictionPrompt,
          optionLabels: config.optionLabels,
          publishedAt: timestamp,
          openRevision: 1,
          schemaVersion: 1,
        }),
      );
    });

    it("48b accepts the initial state when the matching opening exists", async () => {
      const timestamp = Date.now();
      const config = typedConfig();
      const state = typedState("prediction-open", { openedAt: timestamp });
      await seed({
        specialReveal: {
          privateConfig: config,
          publicOpening: {
            eventId: config.eventId,
            title: config.opening.title,
            body: config.opening.body,
            emojiKey: config.opening.emojiKey,
            predictionPrompt: config.predictionPrompt,
            optionLabels: config.optionLabels,
            publishedAt: timestamp,
            openRevision: 1,
            schemaVersion: 1,
          },
        },
      });
      await assertSucceeds(
        set(ref(contexts().revealAdmin, "specialReveal/publicState"), state),
      );
    });

    it("49 lets a recent reveal admin lock and reopen with one-step revisions", async () => {
      const openState = typedState();
      await seedReveal("prediction-open", { publicState: openState });
      const locked = buildPredictionStateMutation({
        state: openState,
        expectedStateRevision: 1,
        action: "lock",
        actorUid: "reveal-admin",
        auditId: "audit-lock",
        now: Date.now(),
      });
      await assertSucceeds(
        update(ref(contexts().revealAdmin), locked.updates!),
      );
      const lockedState = locked.updates?.[
        "specialReveal/publicState"
      ] as SpecialRevealPublicState;
      const reopened = buildPredictionStateMutation({
        state: lockedState,
        expectedStateRevision: 2,
        action: "reopen",
        actorUid: "reveal-admin",
        auditId: "audit-reopen",
        now: Date.now(),
      });
      await assertSucceeds(
        update(ref(contexts().revealAdmin), reopened.updates!),
      );
    });

    it("50 denies old sessions, invalid transitions, and stale revisions", async () => {
      const openState = typedState();
      await seedReveal("prediction-open", { publicState: openState });
      const locked = buildPredictionStateMutation({
        state: openState,
        expectedStateRevision: 1,
        action: "lock",
        actorUid: "reveal-admin",
        auditId: "audit-old-lock",
        now: Date.now(),
      });
      await assertFails(
        update(ref(contexts().oldRevealAdmin), locked.updates!),
      );
      await assertFails(
        update(ref(contexts().revealAdmin), {
          ...locked.updates,
          "specialReveal/publicState": {
            ...openState,
            status: "resolved",
            lockedAt: Date.now(),
            resolvedAt: Date.now(),
            resolutionRevision: 1,
            revision: 2,
          },
        }),
      );
      await assertFails(
        update(ref(contexts().revealAdmin), {
          ...locked.updates,
          "specialReveal/publicState": {
            ...(locked.updates?.[
              "specialReveal/publicState"
            ] as SpecialRevealPublicState),
            revision: 4,
          },
        }),
      );
    });

    it("51 resolves public data and deterministic points atomically", async () => {
      const state = typedState("prediction-locked");
      await seedReveal("prediction-locked", {
        publicState: state,
        predictions: { "guest-1": prediction() },
      });
      const input = browserResolutionInput(state);
      const mutation = buildResolveRevealMutation({
        ...input,
        expectedStateRevision: 2,
        expectedConfigRevision: 1,
        auditId: "audit-resolve",
      });
      await assertSucceeds(
        update(ref(contexts().revealAdmin), mutation.updates!),
      );
      const source = await get(
        ref(
          contexts().guest,
          "championshipLedger/predictionSources/event-neutral",
        ),
      );
      expect(source.val().meta.entryCount).toBe(1);
    });

    it("51a accepts the matching public resolution independently", async () => {
      const lockedState = typedState("prediction-locked");
      const input = browserResolutionInput(lockedState);
      const mutation = buildResolveRevealMutation({
        ...input,
        expectedStateRevision: 2,
        expectedConfigRevision: 1,
        auditId: "audit-resolution-isolation",
      });
      const resolvedState = mutation.updates?.[
        "specialReveal/publicState"
      ] as SpecialRevealPublicState;
      const resolution = mutation.updates?.[
        "specialReveal/publicResolution"
      ] as SpecialRevealPublicResolution;
      await seedReveal("resolved", {
        publicState: resolvedState,
        publicResolution: null,
        predictions: { "guest-1": prediction() },
      });
      await assertSucceeds(
        set(
          ref(contexts().revealAdmin, "specialReveal/publicResolution"),
          resolution,
        ),
      );
    });

    it("51b accepts the matching prediction source independently", async () => {
      const lockedState = typedState("prediction-locked");
      const input = browserResolutionInput(lockedState);
      const mutation = buildResolveRevealMutation({
        ...input,
        expectedStateRevision: 2,
        expectedConfigRevision: 1,
        auditId: "audit-source-isolation",
      });
      const resolvedState = mutation.updates?.[
        "specialReveal/publicState"
      ] as SpecialRevealPublicState;
      const resolution = mutation.updates?.[
        "specialReveal/publicResolution"
      ] as SpecialRevealPublicResolution;
      const source = mutation.updates?.[
        "championshipLedger/predictionSources/event-neutral"
      ] as PredictionLedgerSnapshot;
      await seedReveal("resolved", {
        publicState: resolvedState,
        publicResolution: resolution,
        predictions: { "guest-1": prediction() },
      });
      await assertSucceeds(
        set(
          ref(
            contexts().revealAdmin,
            "championshipLedger/predictionSources/event-neutral",
          ),
          source,
        ),
      );
    });

    it("52 denies old or ordinary admins from resolving", async () => {
      const state = typedState("prediction-locked");
      await seedReveal("prediction-locked", {
        publicState: state,
        predictions: { "guest-1": prediction() },
      });
      const mutation = buildResolveRevealMutation({
        ...browserResolutionInput(state),
        expectedStateRevision: 2,
        expectedConfigRevision: 1,
        auditId: "audit-denied-resolve",
      });
      await assertFails(update(ref(contexts().admin), mutation.updates!));
      await assertFails(
        update(ref(contexts().oldRevealAdmin), mutation.updates!),
      );
    });

    it("53 rejects arbitrary points and resolution-source revision mismatch", async () => {
      const state = typedState("prediction-locked");
      await seedReveal("prediction-locked", {
        publicState: state,
        predictions: { "guest-1": prediction() },
      });
      const mutation = buildResolveRevealMutation({
        ...browserResolutionInput(state),
        expectedStateRevision: 2,
        expectedConfigRevision: 1,
        auditId: "audit-invalid-resolve",
      });
      const updates = structuredClone(mutation.updates!);
      const source = updates[
        "championshipLedger/predictionSources/event-neutral"
      ] as PredictionLedgerSnapshot;
      Object.values(source.entries)[0]!.points = 99;
      await assertFails(update(ref(contexts().revealAdmin), updates));

      const mismatched = structuredClone(mutation.updates!);
      const mismatchedSource = mismatched[
        "championshipLedger/predictionSources/event-neutral"
      ] as PredictionLedgerSnapshot;
      mismatchedSource.meta.resolutionRevision = 2;
      await assertFails(update(ref(contexts().revealAdmin), mismatched));
    });

    it("54 corrects by replacing the public resolution and complete source", async () => {
      const state = typedState("prediction-locked");
      await seedReveal("prediction-locked", {
        publicState: state,
        predictions: { "guest-1": prediction() },
      });
      const input = browserResolutionInput(state);
      const initial = buildResolveRevealMutation({
        ...input,
        expectedStateRevision: 2,
        expectedConfigRevision: 1,
        auditId: "audit-initial",
      });
      await assertSucceeds(
        update(ref(contexts().revealAdmin), initial.updates!),
      );
      const resolvedState = initial.updates?.[
        "specialReveal/publicState"
      ] as SpecialRevealPublicState;
      const currentResolution = initial.updates?.[
        "specialReveal/publicResolution"
      ] as SpecialRevealPublicResolution;
      const correction = buildCorrectRevealMutation({
        ...input,
        state: resolvedState,
        currentResolution,
        correctOption: "option-b",
        expectedStateRevision: 3,
        expectedResolutionRevision: 1,
        auditId: "audit-correction",
        now: Date.now(),
      });
      await assertSucceeds(
        update(ref(contexts().revealAdmin), correction.updates!),
      );
      const source = await get(
        ref(
          contexts().guest,
          "championshipLedger/predictionSources/event-neutral",
        ),
      );
      expect(source.val().meta.entryCount).toBe(0);
    });

    it("55 repairs a missing source and repeated reconciliation is a no-op", async () => {
      const state = typedState("prediction-locked");
      await seedReveal("prediction-locked", {
        publicState: state,
        predictions: { "guest-1": prediction() },
      });
      const input = browserResolutionInput(state);
      const initial = buildResolveRevealMutation({
        ...input,
        expectedStateRevision: 2,
        expectedConfigRevision: 1,
        auditId: "audit-resolve-reconcile",
      });
      await assertSucceeds(
        update(ref(contexts().revealAdmin), initial.updates!),
      );
      const resolvedState = initial.updates?.[
        "specialReveal/publicState"
      ] as SpecialRevealPublicState;
      const resolution = initial.updates?.[
        "specialReveal/publicResolution"
      ] as SpecialRevealPublicResolution;
      await seedAt("championshipLedger/predictionSources/event-neutral", null);
      const reconcile = buildReconcilePredictionMutation({
        ...input,
        state: resolvedState,
        resolution,
        currentSource: null,
        expectedStateRevision: 3,
        auditId: "audit-reconcile",
        now: Date.now(),
      });
      await assertSucceeds(
        update(ref(contexts().revealAdmin), reconcile.updates!),
      );
      const source = reconcile.updates?.[
        "championshipLedger/predictionSources/event-neutral"
      ] as PredictionLedgerSnapshot;
      const repeated = buildReconcilePredictionMutation({
        ...input,
        state: resolvedState,
        resolution,
        currentSource: source,
        expectedStateRevision: 3,
        auditId: "audit-reconcile-repeat",
        now: Date.now(),
      });
      expect(repeated).toMatchObject({
        updates: null,
        result: { applied: false },
      });
    });

    it("56 keeps special reveal audit records append-only", async () => {
      const entry = {
        id: "audit-special",
        action: "prediction-event-locked",
        entityType: "special-reveal",
        entityId: "event-neutral",
        actorUid: "reveal-admin",
        beforeRevision: 1,
        afterRevision: 2,
        occurredAt: Date.now(),
        summary: "Prediction event locked.",
        schemaVersion: 1,
      };
      await assertSucceeds(
        set(ref(contexts().revealAdmin, "audit/audit-special"), entry),
      );
      await assertFails(
        set(ref(contexts().revealAdmin, "audit/audit-special"), {
          ...entry,
          summary: "Changed.",
        }),
      );
    });
  });
});
