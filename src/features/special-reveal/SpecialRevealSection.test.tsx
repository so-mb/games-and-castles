import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SpecialRevealSection } from "./SpecialRevealSection";

const state = vi.hoisted(() => ({
  value: {
    publicState: null as Record<string, unknown> | null,
    opening: null as Record<string, unknown> | null,
    resolution: null as Record<string, unknown> | null,
    ownPrediction: null as Record<string, unknown> | null,
    predictionCount: 0,
    privateConfig: null,
    state: "ready",
    organizerState: "idle",
    malformedIds: [],
    errorMessage: null,
    canGuestMutate: false,
    canOrganizerMutate: false,
    submitPrediction: vi.fn().mockResolvedValue(undefined),
    withdrawPrediction: vi.fn().mockResolvedValue(undefined),
    saveConfig: vi.fn(),
    open: vi.fn(),
    lock: vi.fn(),
    reopen: vi.fn(),
    resolve: vi.fn(),
    correct: vi.fn(),
    reconcile: vi.fn(),
  },
}));

vi.mock("./SpecialRevealProvider", () => ({
  useSpecialReveal: () => state.value,
}));

const opening = {
  eventId: "event-neutral",
  title: "A special announcement is ready.",
  body: "Make one private prediction.",
  emojiKey: "sparkles",
  predictionPrompt: "Which option do you predict?",
  optionLabels: {
    "option-a": "Option A",
    "option-b": "Option B",
    "option-c": "Option C",
  },
  publishedAt: 10,
  openRevision: 1,
  schemaVersion: 1,
};

beforeEach(() => {
  window.localStorage.clear();
  state.value.publicState = null;
  state.value.opening = null;
  state.value.resolution = null;
  state.value.ownPrediction = null;
  state.value.predictionCount = 0;
  state.value.canGuestMutate = false;
  state.value.submitPrediction.mockClear();
  state.value.withdrawPrediction.mockClear();
});

describe("SpecialRevealSection", () => {
  it("renders a neutral locked state without choices or protected content", () => {
    render(<SpecialRevealSection />);
    expect(
      screen.getByRole("heading", { name: "Something waits beyond the lock" }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("radio")).not.toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(
      /correct option|protected code/i,
    );
  });

  it("shows dynamic choices and saves one private prediction while open", async () => {
    state.value.publicState = {
      eventId: "event-neutral",
      status: "prediction-open",
      openedAt: 10,
      openRevision: 1,
      resolutionRevision: 0,
      revision: 1,
      schemaVersion: 1,
    };
    state.value.opening = opening;
    state.value.canGuestMutate = true;
    render(<SpecialRevealSection />);

    expect(screen.getAllByRole("radio")).toHaveLength(3);
    fireEvent.click(screen.getByRole("radio", { name: "Option C" }));
    fireEvent.click(screen.getByRole("button", { name: "Save prediction" }));
    await waitFor(() =>
      expect(state.value.submitPrediction).toHaveBeenCalledWith("option-c"),
    );
    expect(
      screen.getByText("Your private prediction is saved."),
    ).toBeInTheDocument();
  });

  it("keeps the saved choice visible but disables editing after lock", () => {
    state.value.publicState = {
      eventId: "event-neutral",
      status: "prediction-locked",
      openedAt: 10,
      lockedAt: 20,
      openRevision: 1,
      resolutionRevision: 0,
      revision: 2,
      schemaVersion: 1,
    };
    state.value.opening = opening;
    state.value.ownPrediction = {
      ownerUid: "guest",
      participantId: "participant",
      predictionId: "prediction",
      selection: "option-a",
      status: "submitted",
      createdAt: 10,
      updatedAt: 10,
      revision: 1,
      schemaVersion: 1,
    };
    render(<SpecialRevealSection />);
    expect(screen.getByRole("radio", { name: "Option A" })).toBeChecked();
    expect(screen.getByRole("group")).toBeDisabled();
    expect(screen.getByText(/Predictions are locked/)).toBeInTheDocument();
  });

  it("shows the selected public resolution, aggregate, and personal award", () => {
    state.value.publicState = {
      eventId: "event-neutral",
      status: "resolved",
      openedAt: 10,
      lockedAt: 20,
      resolvedAt: 30,
      openRevision: 1,
      resolutionRevision: 1,
      revision: 3,
      schemaVersion: 1,
    };
    state.value.opening = opening;
    state.value.resolution = {
      eventId: "event-neutral",
      correctOption: "option-a",
      correctOptionLabel: "Option A",
      title: "Option A resolution",
      body: "Selected presentation.",
      emojiKey: "star",
      aggregate: { optionA: 2, optionB: 1, optionC: 0, total: 3 },
      correctPredictionPoints: 3,
      resolvedAt: 30,
      resolutionRevision: 1,
      schemaVersion: 1,
    };
    state.value.ownPrediction = {
      ownerUid: "guest",
      participantId: "participant",
      predictionId: "prediction",
      selection: "option-a",
      status: "submitted",
      createdAt: 10,
      updatedAt: 10,
      revision: 1,
      schemaVersion: 1,
    };
    state.value.predictionCount = 3;
    render(<SpecialRevealSection />);
    expect(
      screen.getByRole("heading", { name: "Option A resolution" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Correct · +3 points")).toBeInTheDocument();
    expect(screen.getByText("Option A: 2")).toBeInTheDocument();
    expect(screen.getByText("Option B: 1")).toBeInTheDocument();
    expect(screen.getByText("Option C: 0")).toBeInTheDocument();
  });
});
