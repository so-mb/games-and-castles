import { describe, expect, it } from "vitest";
import type { Participant } from "../../participants/types";
import {
  approvedBirthdayMessages,
  canTransitionBirthdayVault,
  combineBirthdayModeration,
  createPublishedBirthdaySnapshot,
  deriveBirthdayRevealReadiness,
  deriveBirthdayVaultCounts,
} from "./publication";
import type {
  BirthdayMessage,
  BirthdayMessageModeration,
  BirthdayVaultPublicState,
} from "./types";
import {
  normalizeBirthdayMessage,
  parseBirthdayReceiptCollection,
  parsePublishedBirthdayCollection,
  validateBirthdayMessageInput,
} from "./validation";

const publicationIds = [
  "00000000-0000-4000-8000-000000000001",
  "00000000-0000-4000-8000-000000000002",
  "00000000-0000-4000-8000-000000000003",
];

function participant(id = "participant-1"): Participant {
  return {
    id,
    ownerUid: `owner-${id}`,
    displayName: `Guest ${id.at(-1)}`,
    avatar: { icon: "castle", tone: "red" },
    status: "active",
    createdAt: 1,
    createdByUid: `owner-${id}`,
    updatedAt: 1,
    updatedByUid: `owner-${id}`,
    schemaVersion: 1,
  };
}

function message(
  index = 0,
  overrides: Partial<BirthdayMessage> = {},
): BirthdayMessage {
  return {
    ownerUid: `owner-participant-${index + 1}`,
    participantId: `participant-${index + 1}`,
    publicationId: publicationIds[index]!,
    title: null,
    message: "A thoughtful birthday note.",
    emojiKey: "sparkles",
    displayMode: "named",
    status: "submitted",
    createdAt: index + 1,
    updatedAt: index + 1,
    revision: 1,
    schemaVersion: 1,
    ...overrides,
  };
}

function moderation(
  source: BirthdayMessage,
  overrides: Partial<BirthdayMessageModeration> = {},
): BirthdayMessageModeration {
  return {
    ownerUid: source.ownerUid,
    messageRevision: source.revision,
    status: "approved",
    displayOrder: null,
    note: null,
    updatedAt: 3,
    updatedByUid: "admin",
    revision: 1,
    schemaVersion: 1,
    ...overrides,
  };
}

function state(
  status: BirthdayVaultPublicState["status"] = "closed",
): BirthdayVaultPublicState {
  return {
    status,
    openedAt: 1,
    openedByUid: "admin",
    closedAt: status === "collecting" ? null : 2,
    closedByUid: status === "collecting" ? null : "admin",
    revealedAt: status === "revealed" ? 3 : null,
    revealedByUid: status === "revealed" ? "admin" : null,
    revealRevision: status === "revealed" ? 1 : 0,
    updatedAt: 3,
    updatedByUid: "admin",
    revision: status === "collecting" ? 1 : status === "closed" ? 2 : 3,
    schemaVersion: 1,
  };
}

describe("Birthday Vault domain", () => {
  it("accepts minimum and maximum messages in both display modes", () => {
    expect(
      validateBirthdayMessageInput({
        title: "",
        message: "12345",
        emojiKey: null,
        displayMode: "named",
      }).valid,
    ).toBe(true);
    expect(
      validateBirthdayMessageInput({
        title: "Title",
        message: "x".repeat(1200),
        emojiKey: "cake",
        displayMode: "anonymous",
      }).valid,
    ).toBe(true);
  });

  it("trims surrounding whitespace while preserving intentional line breaks", () => {
    expect(normalizeBirthdayMessage("  First line\r\nSecond line  ")).toBe(
      "First line\nSecond line",
    );
  });

  it("rejects short, excessive, control-character, title, emoji, and mode values", () => {
    expect(
      validateBirthdayMessageInput({
        title: "x".repeat(61),
        message: "bad\u0000message",
        emojiKey: "outside" as never,
        displayMode: "outside" as never,
      }).errors,
    ).toEqual({
      title: "Use plain text up to 60 characters.",
      message: "Use plain text without control characters.",
      emojiKey: "Choose one of the available symbols.",
      displayMode: "Choose named or anonymous display.",
    });
    expect(
      validateBirthdayMessageInput({
        title: "",
        message: "no",
        emojiKey: null,
        displayMode: "named",
      }).valid,
    ).toBe(false);
  });

  it("counts only valid active sanitized receipts", () => {
    const result = parseBirthdayReceiptCollection({
      [publicationIds[0]!]: {
        publicationId: publicationIds[0],
        active: true,
        updatedAt: 1,
        schemaVersion: 1,
      },
      [publicationIds[1]!]: {
        publicationId: publicationIds[1],
        active: false,
        updatedAt: 1,
        schemaVersion: 1,
      },
      malformed: {
        publicationId: "participant-1",
        active: true,
        privateMessage: "no",
        updatedAt: 1,
        schemaVersion: 1,
      },
    });
    expect(result.receipts.filter((receipt) => receipt.active)).toHaveLength(1);
    expect(result.invalidIds).toEqual(["malformed"]);
  });

  it("treats no moderation as pending and detects stale approvals", () => {
    const first = message();
    const items = combineBirthdayModeration([first], [], [participant()]);
    expect(deriveBirthdayVaultCounts(items).pending).toBe(1);
    const edited = { ...first, revision: 2 };
    const stale = combineBirthdayModeration(
      [edited],
      [moderation(first)],
      [participant()],
    );
    expect(deriveBirthdayVaultCounts(stale).stale).toBe(1);
  });

  it("counts current approvals, hidden messages, and withdrawals separately", () => {
    const messages = [
      message(0),
      message(1),
      message(2, { status: "withdrawn" }),
    ];
    const items = combineBirthdayModeration(
      messages,
      [
        moderation(messages[0]!),
        moderation(messages[1]!, { status: "hidden" }),
        moderation(messages[2]!),
      ],
      [
        participant("participant-1"),
        participant("participant-2"),
        participant("participant-3"),
      ],
    );
    expect(deriveBirthdayVaultCounts(items)).toEqual({
      submitted: 2,
      pending: 0,
      approved: 1,
      hidden: 1,
      withdrawn: 1,
      stale: 0,
    });
    expect(
      approvedBirthdayMessages(items).map((item) => item.message.publicationId),
    ).toEqual([publicationIds[0]]);
  });

  it("orders approvals explicitly then by creation time and normalizes duplicate values", () => {
    const messages = [message(0), message(1), message(2)];
    const items = combineBirthdayModeration(
      messages,
      [
        moderation(messages[0]!, { displayOrder: 4 }),
        moderation(messages[1]!, { displayOrder: 4 }),
        moderation(messages[2]!, { displayOrder: null }),
      ],
      [
        participant("participant-1"),
        participant("participant-2"),
        participant("participant-3"),
      ],
    );
    const snapshot = createPublishedBirthdaySnapshot({
      items,
      participants: [
        participant("participant-1"),
        participant("participant-2"),
        participant("participant-3"),
      ],
      publishedAt: 10,
      revealRevision: 1,
    });
    expect(Object.values(snapshot).map((entry) => entry.displayOrder)).toEqual([
      0, 1, 2,
    ]);
  });

  it("creates named snapshots and anonymous snapshots without participant identity", () => {
    const named = message(0);
    const anonymous = message(1, { displayMode: "anonymous" });
    const items = combineBirthdayModeration(
      [named, anonymous],
      [moderation(named), moderation(anonymous)],
      [participant("participant-1"), participant("participant-2")],
    );
    const snapshot = createPublishedBirthdaySnapshot({
      items,
      participants: [
        participant("participant-1"),
        participant("participant-2"),
      ],
      publishedAt: 10,
      revealRevision: 2,
    });
    expect(snapshot[named.publicationId]!.author).toMatchObject({
      mode: "named",
      participantId: "participant-1",
      displayName: "Guest 1",
    });
    expect(snapshot[anonymous.publicationId]!.author).toEqual({
      mode: "anonymous",
      participantId: null,
      displayName: "Anonymous",
      avatarIcon: null,
      avatarTone: null,
    });
    expect(JSON.stringify(snapshot[anonymous.publicationId])).not.toContain(
      anonymous.ownerUid,
    );
  });

  it("creates a stable deterministic full snapshot and drops no-longer-approved records", () => {
    const source = message();
    const participants = [participant()];
    const approved = combineBirthdayModeration(
      [source],
      [moderation(source)],
      participants,
    );
    const first = createPublishedBirthdaySnapshot({
      items: approved,
      participants,
      publishedAt: 10,
      revealRevision: 1,
    });
    const second = createPublishedBirthdaySnapshot({
      items: approved,
      participants,
      publishedAt: 10,
      revealRevision: 1,
    });
    expect(second).toEqual(first);
    const hidden = combineBirthdayModeration(
      [source],
      [moderation(source, { status: "hidden" })],
      participants,
    );
    expect(
      createPublishedBirthdaySnapshot({
        items: hidden,
        participants,
        publishedAt: 11,
        revealRevision: 2,
      }),
    ).toEqual({});
  });

  it("blocks reveal for open, empty, pending, stale, malformed, offline, and missing-author states", () => {
    const source = message();
    const participants = [participant()];
    const base = {
      participants,
      online: true,
      authorized: true,
      malformedMessageIds: [],
      malformedModerationIds: [],
    };
    const pending = combineBirthdayModeration([source], [], participants);
    expect(
      deriveBirthdayRevealReadiness({
        ...base,
        state: state("collecting"),
        items: pending,
      }).ready,
    ).toBe(false);
    expect(
      deriveBirthdayRevealReadiness({ ...base, state: state(), items: [] })
        .ready,
    ).toBe(false);
    expect(
      deriveBirthdayRevealReadiness({ ...base, state: state(), items: pending })
        .ready,
    ).toBe(false);
    const stale = combineBirthdayModeration(
      [{ ...source, revision: 2 }],
      [moderation(source)],
      participants,
    );
    expect(
      deriveBirthdayRevealReadiness({ ...base, state: state(), items: stale })
        .ready,
    ).toBe(false);
    const approved = combineBirthdayModeration(
      [source],
      [moderation(source)],
      participants,
    );
    expect(
      deriveBirthdayRevealReadiness({
        ...base,
        state: state(),
        items: approved,
        online: false,
      }).ready,
    ).toBe(false);
    expect(
      deriveBirthdayRevealReadiness({
        ...base,
        state: state(),
        items: approved,
        malformedMessageIds: ["bad"],
      }).ready,
    ).toBe(false);
    expect(
      deriveBirthdayRevealReadiness({
        ...base,
        state: state(),
        items: approved,
        participants: [],
      }).ready,
    ).toBe(false);
  });

  it("allows hidden and withdrawn records without blocking a valid approved set", () => {
    const messages = [
      message(0),
      message(1),
      message(2, { status: "withdrawn" }),
    ];
    const participants = [
      participant("participant-1"),
      participant("participant-2"),
      participant("participant-3"),
    ];
    const items = combineBirthdayModeration(
      messages,
      [
        moderation(messages[0]!),
        moderation(messages[1]!, { status: "hidden" }),
        moderation(messages[2]!),
      ],
      participants,
    );
    expect(
      deriveBirthdayRevealReadiness({
        state: state(),
        items,
        participants,
        online: true,
        authorized: true,
        malformedMessageIds: [],
        malformedModerationIds: [],
      }).ready,
    ).toBe(true);
  });

  it("models only the approved lifecycle transitions", () => {
    expect(canTransitionBirthdayVault(null, "collecting")).toBe(true);
    expect(canTransitionBirthdayVault(state("collecting"), "closed")).toBe(
      true,
    );
    expect(canTransitionBirthdayVault(state("closed"), "collecting")).toBe(
      true,
    );
    expect(canTransitionBirthdayVault(state("closed"), "revealed")).toBe(true);
    expect(canTransitionBirthdayVault(state("revealed"), "revealed")).toBe(
      true,
    );
    expect(canTransitionBirthdayVault(state("revealed"), "collecting")).toBe(
      false,
    );
  });

  it("quarantines malformed and duplicate-order published records", () => {
    const source = message();
    const items = combineBirthdayModeration(
      [source],
      [moderation(source)],
      [participant()],
    );
    const published = createPublishedBirthdaySnapshot({
      items,
      participants: [participant()],
      publishedAt: 10,
      revealRevision: 1,
    });
    const entry = published[source.publicationId]!;
    const duplicateId = publicationIds[1]!;
    const result = parsePublishedBirthdayCollection({
      [source.publicationId]: entry,
      [duplicateId]: { ...entry, id: duplicateId },
    });
    expect(result.messages).toHaveLength(1);
    expect(result.invalidIds).toEqual([duplicateId]);
  });
});
