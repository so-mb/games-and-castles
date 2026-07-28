import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { SpecialRevealConfigInput } from "../domain/types";
import { SpecialRevealRehearsal } from "./SpecialRevealRehearsal";

const config: SpecialRevealConfigInput = {
  eventId: "event-neutral",
  opening: {
    title: "A special announcement is ready.",
    body: "Opening copy.",
    emojiKey: "sparkles",
  },
  predictionPrompt: "Which option do you predict?",
  optionLabels: { "option-a": "Option A", "option-b": "Option B" },
  resolutionPayloads: {
    "option-a": {
      title: "Option A resolution",
      body: "Selected payload.",
      emojiKey: "star",
    },
    "option-b": {
      title: "Option B resolution",
      body: "Selected payload.",
      emojiKey: "star",
    },
  },
  correctPredictionPoints: 3,
};

afterEach(() => vi.useRealTimers());

describe("SpecialRevealRehearsal", () => {
  it("plays the local preview through each configured stage", async () => {
    vi.useFakeTimers();
    render(<SpecialRevealRehearsal config={config} onClose={vi.fn()} open />);

    fireEvent.click(screen.getByRole("button", { name: "Play preview" }));
    await act(() => vi.advanceTimersByTimeAsync(1800));
    expect(screen.getByText("Prediction")).toBeInTheDocument();
    await act(() => vi.advanceTimersByTimeAsync(1800));
    expect(
      screen.getByRole("heading", { name: "Option A resolution" }),
    ).toBeInTheDocument();
    await act(() => vi.advanceTimersByTimeAsync(1800));
    expect(
      screen.getByRole("heading", { name: "Option B resolution" }),
    ).toBeInTheDocument();
    await act(() => vi.advanceTimersByTimeAsync(1800));
    expect(
      screen.getByRole("button", { name: "Play preview" }),
    ).toBeInTheDocument();
  });
});
