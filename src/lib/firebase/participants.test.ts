import { describe, expect, it } from "vitest";
import {
  hasDuplicateDisplayName,
  normalizeDisplayName,
  parseParticipant,
  parseUserProfile,
  validateDisplayName,
} from "./participants";
import type { Participant } from "../../features/participants/types";

const participant: Participant = {
  id: "guest-a",
  ownerUid: "guest-a",
  displayName: "Castle Guest",
  avatar: { icon: "castle", tone: "cyan" },
  status: "active",
  createdAt: 1,
  createdByUid: "guest-a",
  updatedAt: 1,
  updatedByUid: "guest-a",
  schemaVersion: 1,
};

describe("participant data helpers", () => {
  it("normalizes display-name whitespace", () => {
    expect(normalizeDisplayName("  Castle   Guest ")).toBe("Castle Guest");
  });

  it("validates the display-name length boundaries", () => {
    expect(validateDisplayName("A")).toMatch(/2 and 24/);
    expect(validateDisplayName("AB")).toBeNull();
    expect(validateDisplayName("A".repeat(25))).toMatch(/2 and 24/);
  });

  it("warns about case-insensitive duplicate names", () => {
    expect(hasDuplicateDisplayName("castle guest", [participant])).toBe(true);
  });

  it("can exclude the record being edited from duplicate detection", () => {
    expect(
      hasDuplicateDisplayName("Castle Guest", [participant], "guest-a"),
    ).toBe(false);
  });

  it("maps a missing organizer owner field to null", () => {
    expect(
      parseParticipant({ ...participant, ownerUid: undefined })?.ownerUid,
    ).toBeNull();
  });

  it("rejects unknown avatar values while parsing", () => {
    expect(
      parseParticipant({
        ...participant,
        avatar: { icon: "dragon", tone: "cyan" },
      }),
    ).toBeNull();
  });

  it("parses an expanded themed avatar", () => {
    expect(
      parseParticipant({
        ...participant,
        avatar: { icon: "rocket", tone: "red" },
      })?.avatar,
    ).toEqual({ icon: "rocket", tone: "red" });
  });

  it("parses a valid user profile", () => {
    expect(
      parseUserProfile({
        uid: "guest-a",
        participantId: "guest-a",
        createdAt: 1,
        updatedAt: 1,
        schemaVersion: 1,
      }),
    ).toMatchObject({ uid: "guest-a", participantId: "guest-a" });
  });
});
