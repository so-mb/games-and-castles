import { act, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { BirthdayVaultPublicState } from "./domain/types";
import {
  BirthdayVaultProvider,
  useBirthdayVault,
} from "./BirthdayVaultProvider";

const contextMocks = vi.hoisted(() => ({
  useAuth: vi.fn(),
  useConnection: vi.fn(),
  useFirebase: vi.fn(),
  useParticipants: vi.fn(),
}));

const repositoryMocks = vi.hoisted(() => ({
  bulkApproveBirthdayMessages: vi.fn(),
  closeBirthdayVault: vi.fn(),
  initializeBirthdayVault: vi.fn(),
  moderateBirthdayMessage: vi.fn(),
  publishBirthdayVault: vi.fn(),
  reorderBirthdayMessages: vi.fn(),
  reopenBirthdayVault: vi.fn(),
  submitBirthdayMessage: vi.fn(),
  subscribeBirthdayModeration: vi.fn(),
  subscribeBirthdaySubmissionReceipts: vi.fn(),
  subscribeBirthdayVaultPublicState: vi.fn(),
  subscribeOrganizerBirthdayMessages: vi.fn(),
  subscribeOwnBirthdayMessage: vi.fn(),
  subscribePublishedBirthdayMessages: vi.fn(),
  withdrawBirthdayMessage: vi.fn(),
}));

vi.mock("../auth/AuthProvider", () => ({ useAuth: contextMocks.useAuth }));
vi.mock("../live/ConnectionProvider", () => ({
  useConnection: contextMocks.useConnection,
}));
vi.mock("../live/FirebaseProvider", () => ({
  useFirebase: contextMocks.useFirebase,
}));
vi.mock("../participants/ParticipantsProvider", () => ({
  useParticipants: contextMocks.useParticipants,
}));
vi.mock("./repositories/birthdayVault", () => repositoryMocks);

const collectingState: BirthdayVaultPublicState = {
  status: "collecting",
  openedAt: 1,
  openedByUid: "organizer",
  closedAt: null,
  closedByUid: null,
  revealedAt: null,
  revealedByUid: null,
  revealRevision: 0,
  updatedAt: 1,
  updatedByUid: "organizer",
  revision: 1,
  schemaVersion: 1,
};

function StateProbe() {
  const vault = useBirthdayVault();
  return <p>{vault.publicState?.status ?? "unopened"}</p>;
}

describe("BirthdayVaultProvider", () => {
  let emitPublicState:
    | ((state: BirthdayVaultPublicState | null, malformed: boolean) => void)
    | undefined;

  beforeEach(() => {
    vi.clearAllMocks();
    contextMocks.useAuth.mockReturnValue({
      guest: { status: "ready", uid: "guest" },
      organizer: { status: "idle" },
    });
    contextMocks.useConnection.mockReturnValue("online");
    contextMocks.useFirebase.mockReturnValue({
      status: "ready",
      clients: { guestDatabase: {}, organizerDatabase: {} },
    });
    contextMocks.useParticipants.mockReturnValue({
      ownParticipant: null,
      organizerParticipants: [],
    });
    repositoryMocks.subscribeBirthdayVaultPublicState.mockImplementation(
      (
        _database: unknown,
        onData: (
          state: BirthdayVaultPublicState | null,
          malformed: boolean,
        ) => void,
      ) => {
        emitPublicState = onData;
        onData(collectingState, false);
        return vi.fn();
      },
    );
    repositoryMocks.subscribeBirthdaySubmissionReceipts.mockImplementation(
      (_database: unknown, onData: (value: unknown) => void) => {
        onData({ receipts: [], invalidIds: [] });
        return vi.fn();
      },
    );
    repositoryMocks.subscribeOwnBirthdayMessage.mockImplementation(
      (
        _database: unknown,
        _uid: string,
        onData: (message: null, malformed: boolean) => void,
      ) => {
        onData(null, false);
        return vi.fn();
      },
    );
    repositoryMocks.subscribePublishedBirthdayMessages.mockReturnValue(vi.fn());
  });

  it("subscribes to published content only after the vault is revealed", async () => {
    render(
      <BirthdayVaultProvider>
        <StateProbe />
      </BirthdayVaultProvider>,
    );

    expect(screen.getByText("collecting")).toBeInTheDocument();
    expect(
      repositoryMocks.subscribePublishedBirthdayMessages,
    ).not.toHaveBeenCalled();

    act(() => {
      emitPublicState?.(
        {
          ...collectingState,
          status: "revealed",
          closedAt: 2,
          closedByUid: "organizer",
          revealedAt: 3,
          revealedByUid: "organizer",
          revealRevision: 1,
          updatedAt: 3,
          revision: 3,
        },
        false,
      );
    });

    await waitFor(() =>
      expect(
        repositoryMocks.subscribePublishedBirthdayMessages,
      ).toHaveBeenCalledTimes(1),
    );
  });
});
