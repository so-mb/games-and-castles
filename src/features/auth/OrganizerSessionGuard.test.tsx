import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { OrganizerSessionGuard } from "./OrganizerSessionGuard";

const mocks = vi.hoisted(() => ({
  staySignedIn: vi.fn(),
  signOutOrganizer: vi.fn(),
}));

vi.mock("./AuthProvider", () => ({
  useAuth: () => ({
    organizerSession: { status: "warning", remainingMs: 5 * 60 * 1000 },
    staySignedIn: mocks.staySignedIn,
    signOutOrganizer: mocks.signOutOrganizer,
  }),
}));

describe("OrganizerSessionGuard", () => {
  it("warns accessibly and offers explicit stay or sign-out actions", () => {
    render(
      <OrganizerSessionGuard>
        <p>Guest content remains mounted</p>
      </OrganizerSessionGuard>,
    );

    expect(
      screen.getByRole("dialog", { name: "Organizer session expiring" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Guest content remains mounted")).toBeVisible();

    fireEvent.click(screen.getByRole("button", { name: "Stay signed in" }));
    expect(mocks.staySignedIn).toHaveBeenCalledOnce();
    fireEvent.click(screen.getByRole("button", { name: "Sign out now" }));
    expect(mocks.signOutOrganizer).toHaveBeenCalledOnce();
  });
});
