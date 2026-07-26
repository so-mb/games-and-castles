import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { OrganizerAccess } from "./OrganizerAccess";

const organizerState = vi.hoisted(() => ({
  auth: {
    guest: { status: "ready", uid: "guest", message: null },
    organizer: { status: "authorized", uid: "admin", message: null },
    signInOrganizer: vi.fn(),
    signOutOrganizer: vi.fn(),
  },
  participants: {
    canMutate: true,
    organizerParticipants: [],
    organizerState: "ready",
    organizerCreate: vi.fn(),
    organizerUpdate: vi.fn(),
    organizerSetStatus: vi.fn(),
  },
}));

vi.mock("../auth/AuthProvider", () => ({
  useAuth: () => organizerState.auth,
}));

vi.mock("../live/FirebaseProvider", () => ({
  useFirebase: () => ({ status: "ready" }),
}));

vi.mock("../participants/ParticipantsProvider", () => ({
  useParticipants: () => organizerState.participants,
}));

vi.mock("../competitions/organizer/CompetitionStudio", () => ({
  CompetitionStudio: () => (
    <section aria-label="Competition Studio content">
      Competition Studio content
    </section>
  ),
}));

describe("OrganizerAccess", () => {
  it("opens Competition Studio for an authorized organizer and exposes both tool tabs", () => {
    render(<OrganizerAccess />);

    const trigger = screen.getByRole("button", {
      name: "Open Organizer Mode — signed in",
    });
    expect(trigger).toHaveTextContent("Studio");
    fireEvent.click(trigger);

    const dialog = screen.getByRole("dialog", { name: "Organizer console" });
    const studioTab = within(dialog).getByRole("tab", {
      name: "Competition Studio",
    });
    const participantTab = within(dialog).getByRole("tab", {
      name: "Participant Control",
    });

    expect(studioTab).toHaveAttribute("aria-selected", "true");
    expect(
      within(dialog).getByRole("tablist", { name: "Organizer workspaces" }),
    ).toBeInTheDocument();
    expect(
      within(dialog).getByRole("tabpanel", { name: "Competition Studio" }),
    ).toContainElement(
      within(dialog).getByRole("region", {
        name: "Competition Studio content",
      }),
    );

    fireEvent.click(participantTab);
    expect(participantTab).toHaveAttribute("aria-selected", "true");
    expect(
      within(dialog).getByRole("tabpanel", { name: "Participant Control" }),
    ).toBeInTheDocument();
    expect(
      within(dialog).queryByText("Competition Studio content"),
    ).not.toBeInTheDocument();

    fireEvent.click(studioTab);
    expect(
      within(dialog).getByText("Competition Studio content"),
    ).toBeInTheDocument();
  });
});
