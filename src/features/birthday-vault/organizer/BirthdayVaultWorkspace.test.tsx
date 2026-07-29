import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { BirthdayVaultWorkspace } from "./BirthdayVaultWorkspace";

const mocks = vi.hoisted(() => ({
  reauthenticate: vi.fn(),
  publish: vi.fn(),
  vault: {
    publicState: {
      status: "closed",
      revision: 2,
      revealRevision: 0,
      updatedAt: 1,
    },
    counts: {
      submitted: 0,
      pending: 0,
      approved: 0,
      hidden: 0,
      withdrawn: 0,
      stale: 0,
    },
    readiness: { ready: true, checks: [], approvedMessages: [] },
    organizerItems: [],
    organizerState: "ready",
    canOrganizerMutate: true,
    malformedIds: [],
    initialize: vi.fn(),
    close: vi.fn(),
    reopen: vi.fn(),
    moderate: vi.fn(),
    bulkApprove: vi.fn(),
    move: vi.fn(),
    publish: vi.fn(),
  },
}));

vi.mock("../BirthdayVaultProvider", () => ({
  useBirthdayVault: () => mocks.vault,
}));
vi.mock("../../participants/ParticipantsProvider", () => ({
  useParticipants: () => ({ organizerParticipants: [] }),
}));
vi.mock("../../auth/AuthProvider", () => ({
  useAuth: () => ({
    organizer: {
      status: "authorized",
      email: "organizer@example.test",
    },
    reauthenticateOrganizer: mocks.reauthenticate,
  }),
}));
vi.mock("../../live/ConnectionProvider", () => ({
  useConnection: () => "online",
}));

describe("Birthday Vault sensitive publication", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.vault.publish = mocks.publish;
    mocks.reauthenticate.mockResolvedValue({
      uid: "admin",
      email: "organizer@example.test",
      authTimeMs: 100,
      verifiedAtMs: 100,
    });
    mocks.publish.mockResolvedValue(0);
  });

  it("reauthenticates and clears the password before publishing", async () => {
    render(<BirthdayVaultWorkspace />);
    fireEvent.click(
      screen.getByRole("button", { name: "Reveal approved messages" }),
    );
    const password = screen.getByLabelText("Current organizer password");
    fireEvent.change(password, { target: { value: "current-password" } });
    fireEvent.change(screen.getByLabelText(/Type REVEAL to continue/i), {
      target: { value: "REVEAL" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Reauthenticate and continue" }),
    );

    await waitFor(() =>
      expect(mocks.reauthenticate).toHaveBeenCalledWith("current-password"),
    );
    await waitFor(() => expect(password).toHaveValue(""));
    await waitFor(() =>
      expect(mocks.publish).toHaveBeenCalledWith(
        false,
        expect.objectContaining({ uid: "admin" }),
      ),
    );
  });
});
