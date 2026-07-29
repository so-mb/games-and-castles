import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { OrganizerAccess } from "./OrganizerAccess";

const organizerState = vi.hoisted(() => ({
  auth: {
    guest: { status: "ready", uid: "guest", message: null },
    organizer: {
      status: "authorized",
      uid: "admin",
      email: "organizer@example.test",
      specialRevealAdmin: true,
      authTimeMs: Date.now(),
      message: null,
    },
    signInOrganizer: vi.fn(),
    signOutOrganizer: vi.fn(),
    reauthenticateSpecialReveal: vi.fn(),
    reauthenticateOrganizer: vi.fn(),
    organizerSession: { status: "active", remainingMs: 1_800_000 },
    staySignedIn: vi.fn(),
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

vi.mock("../championship/organizer/ChampionshipDesk", () => ({
  ChampionshipDesk: () => (
    <section aria-label="Championship Desk content">
      Championship Desk content
    </section>
  ),
}));

vi.mock("../birthday-vault/organizer/BirthdayVaultWorkspace", () => ({
  BirthdayVaultWorkspace: () => (
    <section aria-label="Birthday Vault content">
      Birthday Vault content
    </section>
  ),
}));

vi.mock("../special-reveal/organizer/SpecialRevealWorkspace", () => ({
  SpecialRevealWorkspace: () => (
    <section aria-label="Special Reveal content">
      Special Reveal content
    </section>
  ),
}));

vi.mock("../operations/OperationsWorkspace", () => ({
  OperationsWorkspace: ({
    onOpenWorkspace,
  }: {
    onOpenWorkspace: (workspace: "championship") => void;
  }) => (
    <section aria-label="Operations content">
      Operations content
      <button onClick={() => onOpenWorkspace("championship")} type="button">
        Open championship from Operations
      </button>
    </section>
  ),
}));

describe("OrganizerAccess", () => {
  beforeEach(() => {
    organizerState.auth.organizer.status = "authorized";
    organizerState.auth.organizer.specialRevealAdmin = true;
  });

  it("hides protected reveal tools from an ordinary admin", () => {
    organizerState.auth.organizer.specialRevealAdmin = false;
    render(<OrganizerAccess />);

    fireEvent.click(
      screen.getByRole("button", {
        name: "Open Organizer Mode — signed in",
      }),
    );

    const dialog = screen.getByRole("dialog", { name: "Organizer console" });
    expect(
      within(dialog).queryByRole("tab", { name: "Special Reveal" }),
    ).not.toBeInTheDocument();
    expect(
      within(dialog).getByRole("tab", { name: "Competition Studio" }),
    ).toBeInTheDocument();
  });

  it("does not expose Championship Desk before organizer authentication", () => {
    organizerState.auth.organizer.status = "signed-out";
    render(<OrganizerAccess />);

    fireEvent.click(
      screen.getByRole("button", { name: "Open Organizer Mode" }),
    );

    const dialog = screen.getByRole("dialog", { name: "Organizer access" });
    expect(
      within(dialog).getByRole("button", { name: "Sign in as organizer" }),
    ).toBeInTheDocument();
    expect(
      within(dialog).queryByRole("tab", { name: "Championship Desk" }),
    ).not.toBeInTheDocument();
  });

  it("opens all six authorized organizer workspaces including Operations", async () => {
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
    const championshipTab = within(dialog).getByRole("tab", {
      name: "Championship Desk",
    });
    const birthdayTab = within(dialog).getByRole("tab", {
      name: "Birthday Vault",
    });
    const specialRevealTab = within(dialog).getByRole("tab", {
      name: "Special Reveal",
    });
    const operationsTab = within(dialog).getByRole("tab", {
      name: "Operations",
    });

    expect(studioTab).toHaveAttribute("aria-selected", "true");
    expect(
      within(dialog).getByRole("tablist", { name: "Organizer workspaces" }),
    ).toBeInTheDocument();
    expect(
      within(dialog).getByRole("tabpanel", { name: "Competition Studio" }),
    ).toContainElement(
      await within(dialog).findByRole("region", {
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
      await within(dialog).findByText("Competition Studio content"),
    ).toBeInTheDocument();

    fireEvent.click(championshipTab);
    expect(championshipTab).toHaveAttribute("aria-selected", "true");
    expect(
      await within(dialog).findByRole("tabpanel", {
        name: "Championship Desk",
      }),
    ).toBeInTheDocument();
    expect(
      await within(dialog).findByText("Championship Desk content"),
    ).toBeInTheDocument();

    fireEvent.click(birthdayTab);
    expect(birthdayTab).toHaveAttribute("aria-selected", "true");
    expect(
      await within(dialog).findByRole("tabpanel", { name: "Birthday Vault" }),
    ).toBeInTheDocument();
    expect(
      await within(dialog).findByText("Birthday Vault content"),
    ).toBeInTheDocument();

    fireEvent.click(specialRevealTab);
    expect(specialRevealTab).toHaveAttribute("aria-selected", "true");
    expect(
      await within(dialog).findByRole("tabpanel", { name: "Special Reveal" }),
    ).toBeInTheDocument();
    expect(
      await within(dialog).findByText("Special Reveal content"),
    ).toBeInTheDocument();

    fireEvent.click(operationsTab);
    expect(operationsTab).toHaveAttribute("aria-selected", "true");
    expect(
      await within(dialog).findByRole("tabpanel", { name: "Operations" }),
    ).toBeInTheDocument();
    expect(
      await within(dialog).findByText("Operations content"),
    ).toBeInTheDocument();

    fireEvent.click(
      within(dialog).getByRole("button", {
        name: "Open championship from Operations",
      }),
    );
    expect(championshipTab).toHaveAttribute("aria-selected", "true");
    expect(
      await within(dialog).findByRole("tabpanel", {
        name: "Championship Desk",
      }),
    ).toBeInTheDocument();
  });
});
