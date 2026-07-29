import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { AnyCompetitionRun } from "../engine/types";
import { useWinCelebration } from "./useWinCelebration";

function runWithResult(completed: boolean): AnyCompetitionRun {
  return {
    competitionId: "castle-cup",
    format: "round-robin-knockout",
    matches: completed
      ? {
          match1: {
            id: "match1",
            isBye: false,
            status: "completed",
            result: { winnerId: "p1", completedAt: 400 },
          },
        }
      : {},
  } as unknown as AnyCompetitionRun;
}

describe("useWinCelebration", () => {
  it("celebrates a newly completed result on a known run", () => {
    const { result, rerender } = renderHook(
      ({ runs }) => useWinCelebration(runs, true),
      { initialProps: { runs: [runWithResult(false)] } },
    );

    expect(result.current.event).toBeNull();

    rerender({ runs: [runWithResult(true)] });

    expect(result.current.event).toMatchObject({
      id: "castle-cup:match:match1",
      participantIds: ["p1"],
    });

    act(() => result.current.dismiss());
    expect(result.current.event).toBeNull();

    rerender({ runs: [runWithResult(true)] });
    expect(result.current.event).toBeNull();
  });

  it("does not replay historical wins on first load", () => {
    const { result } = renderHook(() =>
      useWinCelebration([runWithResult(true)], true),
    );

    expect(result.current.event).toBeNull();
  });
});
