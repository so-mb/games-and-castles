import { describe, expect, it } from "vitest";
import type {
  AllHandsConfigSnapshot,
  AllHandsSession,
} from "../all-hands/types";
import type { AnyCompetitionRun } from "../engine/types";
import { deriveWinEvents, winningAllHandsParticipantIds } from "./winEvents";

const winnerOnlyConfig = {
  format: "all-hands",
  resultMode: "winner-only",
} as AllHandsConfigSnapshot;

function completedTeamSession(): AllHandsSession {
  return {
    id: "session-1",
    competitionId: "all-hands-1",
    title: "Team round",
    sequence: 1,
    mode: "team",
    participantIds: ["p1", "p2", "p3"],
    participantIndex: { p1: true, p2: true, p3: true },
    teams: {
      "team-castle": {
        id: "team-castle",
        name: "Team Castle",
        participantIds: ["p1", "p2"],
      },
      "team-quest": {
        id: "team-quest",
        name: "Team Quest",
        participantIds: ["p3"],
      },
    },
    entityIds: ["team-castle", "team-quest"],
    entityIndex: { "team-castle": true, "team-quest": true },
    teamAssignments: {
      p1: "team-castle",
      p2: "team-castle",
      p3: "team-quest",
    },
    status: "completed",
    result: {
      kind: "winner-only",
      winnerEntityId: "team-castle",
      entityIndex: { "team-castle": true, "team-quest": true },
      completedAt: 500,
      completedByUid: "organizer",
      resultRevision: 1,
    },
    createdAt: 100,
    createdByUid: "organizer",
    startedAt: 200,
    startedByUid: "organizer",
    completedAt: 500,
    completedByUid: "organizer",
    voidedAt: null,
    voidedByUid: null,
    voidReason: null,
    revision: 3,
    schemaVersion: 1,
  };
}

describe("win events", () => {
  it("derives a completed head-to-head winner and ignores byes", () => {
    const run = {
      competitionId: "merry-go-round-1",
      format: "round-robin-knockout",
      matches: {
        final: {
          id: "final",
          isBye: false,
          status: "completed",
          result: { winnerId: "p1", completedAt: 400 },
        },
        bye: {
          id: "bye",
          isBye: true,
          status: "completed",
          result: { winnerId: "p2", completedAt: 300 },
        },
      },
    } as unknown as AnyCompetitionRun;

    expect(deriveWinEvents([run])).toEqual([
      {
        id: "merry-go-round-1:match:final",
        runId: "merry-go-round-1",
        participantIds: ["p1"],
        completedAt: 400,
        kind: "match",
      },
    ]);
  });

  it("expands an All Hands team result to every winning participant", () => {
    const session = completedTeamSession();

    expect(winningAllHandsParticipantIds(session, winnerOnlyConfig)).toEqual([
      "p1",
      "p2",
    ]);
  });
});
