import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SpecialRevealWorkspace } from "./SpecialRevealWorkspace";

const reveal = vi.hoisted(() => ({
  publicState: null,
  privateConfig: null,
  predictionCount: 0,
  canOrganizerMutate: true,
  saveConfig: vi.fn().mockResolvedValue(undefined),
  open: vi.fn(),
  lock: vi.fn(),
  reopen: vi.fn(),
  resolve: vi.fn(),
  correct: vi.fn(),
  reconcile: vi.fn(),
}));

vi.mock("../SpecialRevealProvider", () => ({
  useSpecialReveal: () => reveal,
}));

vi.mock("../../auth/AuthProvider", () => ({
  useAuth: () => ({
    organizer: { status: "authorized", email: "organizer@example.com" },
    reauthenticateSpecialReveal: vi.fn(),
  }),
}));

vi.mock("../../live/ConnectionProvider", () => ({
  useConnection: () => "online",
}));

describe("SpecialRevealWorkspace", () => {
  it("adds and removes extra prediction options with matching reveal fields", () => {
    render(<SpecialRevealWorkspace />);

    expect(screen.getAllByLabelText("Guest-facing label")).toHaveLength(2);
    fireEvent.click(screen.getByRole("button", { name: "Add another option" }));

    expect(screen.getAllByLabelText("Guest-facing label")).toHaveLength(3);
    expect(
      screen.getByRole("group", {
        name: "Reveal shown if Option C is correct",
      }),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Remove Option C" }));
    expect(screen.getAllByLabelText("Guest-facing label")).toHaveLength(2);
    expect(
      screen.queryByRole("group", {
        name: "Reveal shown if Option C is correct",
      }),
    ).not.toBeInTheDocument();
  });
});
