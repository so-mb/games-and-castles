import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Participant } from "../../participants/types";
import { WinnerCelebration } from "./WinnerCelebration";

const participants: Participant[] = [
  {
    id: "p1",
    ownerUid: "p1",
    displayName: "Ada Castle",
    avatar: { icon: "rocket", tone: "gold" },
    status: "active",
    createdAt: 100,
    createdByUid: "p1",
    updatedAt: 100,
    updatedByUid: "p1",
    schemaVersion: 1,
  },
];

afterEach(() => {
  vi.useRealTimers();
});

describe("WinnerCelebration", () => {
  it("personalizes a new win for the private participant view", () => {
    const onDismiss = vi.fn();
    render(
      <WinnerCelebration
        competitionTitle="Castle Cup"
        event={{
          id: "castle-cup:match:match-1",
          runId: "castle-cup",
          participantIds: ["p1"],
          completedAt: 500,
          kind: "match",
        }}
        onDismiss={onDismiss}
        ownParticipantId="p1"
        participants={participants}
      />,
    );

    expect(screen.getByRole("status")).toHaveTextContent("You won!");
    expect(screen.getByRole("status")).toHaveTextContent("Castle Cup");
    expect(
      screen.getByRole("img", { name: "Ada Castle avatar, winner" }),
    ).toBeInTheDocument();
    fireEvent.click(
      screen.getByRole("button", { name: "Dismiss win celebration" }),
    );
    expect(onDismiss).toHaveBeenCalledOnce();
  });

  it("renders the result without motion-only information", () => {
    render(
      <WinnerCelebration
        competitionTitle="Castle Cup"
        event={{
          id: "castle-cup:match:match-1",
          runId: "castle-cup",
          participantIds: ["p1"],
          completedAt: 500,
          kind: "match",
        }}
        onDismiss={vi.fn()}
        ownParticipantId={null}
        participants={participants}
      />,
    );

    expect(screen.getByRole("status")).toHaveTextContent("Ada Castle wins!");
    expect(screen.getByText("Round complete")).toBeInTheDocument();
  });

  it("dismisses automatically after 15 seconds", () => {
    vi.useFakeTimers();
    const onDismiss = vi.fn();
    render(
      <WinnerCelebration
        competitionTitle="Castle Cup"
        event={{
          id: "castle-cup:match:match-1",
          runId: "castle-cup",
          participantIds: ["p1"],
          completedAt: 500,
          kind: "match",
        }}
        onDismiss={onDismiss}
        ownParticipantId="p1"
        participants={participants}
      />,
    );

    expect(screen.getByTestId("win-celebration-countdown")).toBeInTheDocument();
    act(() => vi.advanceTimersByTime(14_999));
    expect(onDismiss).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(1));
    expect(onDismiss).toHaveBeenCalledOnce();
  });
});
