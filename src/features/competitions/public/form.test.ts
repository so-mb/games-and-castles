import { describe, expect, it } from "vitest";
import type { FormMatch } from "./form";
import { deriveParticipantForm } from "./form";

function match(
  globalSequence: number,
  winnerId: string | null,
  options: { draw?: boolean; status?: string; bye?: boolean } = {},
): FormMatch {
  return {
    globalSequence,
    participantAId: "participant-a",
    participantBId: "participant-b",
    isBye: options.bye ?? false,
    status: options.status ?? "completed",
    result:
      winnerId || options.draw
        ? { winnerId, isDraw: options.draw ?? false }
        : null,
  };
}

describe("recent competition form", () => {
  it("returns the latest five completed results in chronological order", () => {
    const matches = [
      match(1, "participant-a"),
      match(2, "participant-b"),
      match(3, null, { draw: true }),
      match(4, "participant-a"),
      match(5, "participant-b"),
      match(6, "participant-a"),
      match(7, "participant-a", { status: "pending" }),
      match(8, "participant-a", { bye: true }),
    ];

    expect(deriveParticipantForm(matches, "participant-a")).toEqual([
      "loss",
      "draw",
      "win",
      "loss",
      "win",
    ]);
  });

  it("returns an empty form when there are no completed matches", () => {
    expect(
      deriveParticipantForm([match(1, null, { status: "ready" })], "guest"),
    ).toEqual([]);
  });
});
