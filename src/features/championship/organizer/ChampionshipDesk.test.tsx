import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ChampionshipDesk } from "./ChampionshipDesk";

const state = vi.hoisted(() => ({
  championship: {
    canMutate: true,
    reconciliation: [] as Array<Record<string, unknown>>,
    organizerBonuses: [] as Array<Record<string, unknown>>,
    sources: [] as Array<Record<string, unknown>>,
    malformedSourceIds: [] as string[],
    malformedBonusIds: [] as string[],
    reconcileOne: vi.fn().mockResolvedValue(undefined),
    reconcileAll: vi.fn().mockResolvedValue(undefined),
    removeOrphan: vi.fn().mockResolvedValue(undefined),
    createBonus: vi.fn().mockResolvedValue(undefined),
    revokeBonus: vi.fn().mockResolvedValue(undefined),
    restoreBonus: vi.fn().mockResolvedValue(undefined),
  },
  participants: {
    organizerParticipants: [
      {
        id: "player-1",
        displayName: "Ada Castle",
        status: "active",
      },
      {
        id: "player-2",
        displayName: "Bert Board",
        status: "inactive",
      },
    ],
  },
}));

vi.mock("../ChampionshipProvider", () => ({
  useChampionship: () => state.championship,
}));

vi.mock("../../participants/ParticipantsProvider", () => ({
  useParticipants: () => state.participants,
}));

function missingSource() {
  return {
    competitionId: "competition-1",
    competitionTitle: "Castle Circuit",
    status: "missing",
    current: null,
    expected: {
      meta: { runRevision: 4, entryCount: 3 },
      entries: {},
    },
    entryDelta: 3,
    warning: "This existing run needs a Phase 7 backfill.",
  };
}

function bonus(id: string, status: "active" | "revoked") {
  return {
    id,
    participantId: status === "active" ? "player-1" : "player-2",
    points: status === "active" ? 5 : 3,
    label: status === "active" ? "Great host" : "Table helper",
    note: "Well earned",
    status,
    revision: status === "active" ? 1 : 2,
    createdAt: 100,
    createdByUid: "admin",
    updatedAt: 100,
    updatedByUid: "admin",
    schemaVersion: 1,
  };
}

describe("ChampionshipDesk", () => {
  beforeEach(() => {
    state.championship.canMutate = true;
    state.championship.reconciliation = [];
    state.championship.organizerBonuses = [];
    state.championship.sources = [];
    state.championship.malformedSourceIds = [];
    state.championship.malformedBonusIds = [];
    vi.clearAllMocks();
  });

  it("previews changes and invokes one-source and bulk reconciliation", async () => {
    const item = missingSource();
    state.championship.reconciliation = [item];
    render(<ChampionshipDesk />);

    expect(screen.getByText("Missing source")).toBeInTheDocument();
    expect(screen.getByText(/\+3 entry change/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Reconcile source" }));
    await waitFor(() =>
      expect(state.championship.reconcileOne).toHaveBeenCalledWith(item),
    );

    fireEvent.click(screen.getByRole("button", { name: "Reconcile all (1)" }));
    await waitFor(() =>
      expect(state.championship.reconcileAll).toHaveBeenCalledTimes(1),
    );
  });

  it("submits a bounded manual bonus through the repository boundary", async () => {
    render(<ChampionshipDesk />);

    fireEvent.change(screen.getByLabelText("Participant"), {
      target: { value: "player-1" },
    });
    fireEvent.change(screen.getByLabelText("Points"), {
      target: { value: "7" },
    });
    fireEvent.change(screen.getByLabelText("Reason"), {
      target: { value: "Puzzle master" },
    });
    fireEvent.change(screen.getByLabelText("Optional note"), {
      target: { value: "Solved the final table" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Award bonus" }));

    await waitFor(() =>
      expect(state.championship.createBonus).toHaveBeenCalledWith({
        participantId: "player-1",
        points: 7,
        label: "Puzzle master",
        note: "Solved the final table",
      }),
    );
  });

  it("requires confirmation before revoking or restoring a bonus", async () => {
    const active = bonus("bonus-active", "active");
    const revoked = bonus("bonus-revoked", "revoked");
    state.championship.organizerBonuses = [active, revoked];
    render(<ChampionshipDesk />);

    fireEvent.click(screen.getByRole("button", { name: "Revoke…" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirm" }));
    await waitFor(() =>
      expect(state.championship.revokeBonus).toHaveBeenCalledWith(active),
    );

    fireEvent.click(screen.getByRole("button", { name: "Restore…" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirm" }));
    await waitFor(() =>
      expect(state.championship.restoreBonus).toHaveBeenCalledWith(revoked),
    );
  });

  it("disables every organizer mutation while offline", () => {
    state.championship.canMutate = false;
    state.championship.reconciliation = [missingSource()];
    render(<ChampionshipDesk />);

    expect(
      screen.getByText(/require an online organizer session/i),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Reconcile all (1)" }),
    ).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "Reconcile source" }),
    ).toBeDisabled();
    expect(screen.getByRole("button", { name: "Award bonus" })).toBeDisabled();
  });
});
