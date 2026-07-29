import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { OperationsWorkspace } from "./OperationsWorkspace";

const mocks = vi.hoisted(() => ({
  clipboard: vi.fn(),
  check: vi.fn(),
  signOut: vi.fn(),
}));

vi.mock("../auth/AuthProvider", () => ({
  useAuth: () => ({
    guest: { status: "ready", uid: "private-guest-uid" },
    organizer: {
      status: "authorized",
      uid: "private-organizer-uid",
      email: "organizer@example.test",
      specialRevealAdmin: true,
      authTimeMs: Date.now(),
    },
    organizerSession: { status: "active", remainingMs: 1_200_000 },
    signOutOrganizer: mocks.signOut,
  }),
}));
vi.mock("../live/FirebaseProvider", () => ({
  useFirebase: () => ({
    status: "ready",
    config: {
      options: {
        projectId: "demo-games-and-castles",
        databaseURL:
          "https://demo-games-and-castles.europe-west1.firebasedatabase.app",
      },
    },
    clients: {
      useEmulators: true,
      appCheckReady: Promise.resolve({
        provider: "disabled",
        debug: false,
        enforcement: "unknown",
        guest: {
          status: "disabled",
          tokenAvailable: false,
          message: "disabled",
        },
        organizer: {
          status: "disabled",
          tokenAvailable: false,
          message: "disabled",
        },
      }),
    },
  }),
}));
vi.mock("../live/ConnectionProvider", () => ({
  useConnection: () => "online",
}));
vi.mock("../participants/ParticipantsProvider", () => ({
  useParticipants: () => ({ activeState: "ready", organizerState: "ready" }),
}));
vi.mock("../competitions/CompetitionsProvider", () => ({
  useCompetitions: () => ({
    active: [{ id: "active-one" }],
    publicState: "ready",
    organizerState: "ready",
    publicMalformedCount: 0,
    organizerMalformedCount: 0,
    runtimeMalformedCount: 0,
  }),
}));
vi.mock("../birthday-vault/BirthdayVaultProvider", () => ({
  useBirthdayVault: () => ({
    state: "ready",
    organizerState: "ready",
    malformedIds: [],
  }),
}));
vi.mock("../special-reveal/SpecialRevealProvider", () => ({
  useSpecialReveal: () => ({
    state: "ready",
    organizerState: "ready",
    malformedIds: [],
  }),
}));
vi.mock("../championship/ChampionshipProvider", () => ({
  useChampionship: () => ({
    state: "ready",
    reconciliation: [],
    malformedSourceIds: [],
    malformedBonusIds: [],
  }),
}));
vi.mock("./VersionProvider", () => ({
  useVersion: () => ({
    current: {
      sha: "abcdef1234567890",
      ref: "refs/heads/master",
      builtAt: "now",
    },
    deployed: {
      sha: "abcdef1234567890",
      ref: "refs/heads/master",
      builtAt: "now",
    },
    status: "current",
    checkedAt: Date.now(),
    check: mocks.check,
  }),
}));

describe("OperationsWorkspace", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText: mocks.clipboard },
    });
    mocks.clipboard.mockResolvedValue(undefined);
    mocks.check.mockResolvedValue(undefined);
  });

  it("copies only sanitized diagnostics and opens a relevant workspace", async () => {
    const openWorkspace = vi.fn();
    render(<OperationsWorkspace onOpenWorkspace={openWorkspace} />);

    expect(screen.getByText("Current build SHA known")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Copy diagnostics" }));
    await waitFor(() => expect(mocks.clipboard).toHaveBeenCalledOnce());

    const copied = mocks.clipboard.mock.calls[0][0] as string;
    expect(copied).toContain("demo-games-and-castles");
    expect(copied).toContain("europe-west1.firebasedatabase.app");
    expect(copied).not.toContain("private-guest-uid");
    expect(copied).not.toContain("private-organizer-uid");
    expect(copied).not.toContain("organizer@example.test");

    fireEvent.click(screen.getByRole("button", { name: "Championship Desk" }));
    expect(openWorkspace).toHaveBeenCalledWith("championship");
  });
});
