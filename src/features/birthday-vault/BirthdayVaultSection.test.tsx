import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { BirthdayVaultSection } from "./BirthdayVaultSection";
import { BirthdayMessageForm } from "./submission/BirthdayMessageForm";
import { BirthdayVaultPresentation } from "./presentation/BirthdayVaultPresentation";

const mocks = vi.hoisted(() => ({
  firebase: { status: "ready" },
  participants: {
    ownParticipant: {
      id: "participant-1",
      displayName: "Guest One",
    },
  },
  vault: {
    publicState: {
      status: "collecting",
      revealRevision: 0,
    },
    publicCount: 2,
    ownMessage: null as Record<string, unknown> | null,
    publishedMessages: [] as Record<string, unknown>[],
    state: "ready",
    errorMessage: null,
    canGuestMutate: true,
    submit: vi.fn(),
    withdraw: vi.fn(),
  },
}));

vi.mock("../live/FirebaseProvider", () => ({
  useFirebase: () => mocks.firebase,
}));
vi.mock("../participants/ParticipantsProvider", () => ({
  useParticipants: () => mocks.participants,
}));
vi.mock("./BirthdayVaultProvider", () => ({
  useBirthdayVault: () => mocks.vault,
}));

describe("Birthday Vault guest experience", () => {
  beforeEach(() => {
    mocks.firebase.status = "ready";
    mocks.participants.ownParticipant = {
      id: "participant-1",
      displayName: "Guest One",
    };
    mocks.vault.publicState = { status: "collecting", revealRevision: 0 };
    mocks.vault.publicCount = 2;
    mocks.vault.ownMessage = null;
    mocks.vault.publishedMessages = [];
    mocks.vault.canGuestMutate = true;
    mocks.vault.submit.mockReset();
  });

  it("shows the count and opens a live submission form", () => {
    render(<BirthdayVaultSection />);
    expect(screen.getByText("2")).toBeInTheDocument();
    fireEvent.click(
      screen.getByRole("button", { name: /write your message/i }),
    );
    expect(screen.getByLabelText("Your message")).toBeInTheDocument();
    expect(screen.getByText("Live preview")).toBeInTheDocument();
  });

  it("shows the roster requirement when the guest has no participant", () => {
    mocks.participants.ownParticipant = null as never;
    render(<BirthdayVaultSection />);
    expect(screen.getByText("Join the roster first")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /participant onboarding/i }),
    ).toHaveAttribute("href", "#games");
  });

  it("shows the owner-only sealed preview and disables editing after close", () => {
    mocks.vault.publicState = { status: "closed", revealRevision: 0 };
    mocks.vault.ownMessage = {
      ownerUid: "owner",
      participantId: "participant-1",
      publicationId: "00000000-0000-4000-8000-000000000001",
      title: "For the road",
      message: "Have a wonderful year.",
      emojiKey: "cake",
      displayMode: "anonymous",
      status: "submitted",
      createdAt: 1,
      updatedAt: 2,
      revision: 2,
      schemaVersion: 1,
    };
    mocks.vault.canGuestMutate = false;
    render(<BirthdayVaultSection />);
    expect(screen.getByText("Your message is sealed")).toBeInTheDocument();
    expect(screen.getByText("Have a wonderful year.")).toBeInTheDocument();
    expect(screen.getByText(/editing is closed/i)).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /edit message/i }),
    ).not.toBeInTheDocument();
  });

  it("submits normalized input through the repository boundary", async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(
      <BirthdayMessageForm
        disabled={false}
        onCancel={vi.fn()}
        onSubmit={onSubmit}
      />,
    );
    fireEvent.change(screen.getByLabelText("Your message"), {
      target: { value: "A valid birthday note" },
    });
    fireEvent.click(screen.getByRole("radio", { name: /show anonymous/i }));
    fireEvent.click(screen.getByRole("button", { name: "Birthday cake" }));
    fireEvent.click(screen.getByRole("button", { name: /seal my message/i }));
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        message: "A valid birthday note",
        displayMode: "anonymous",
        emojiKey: "cake",
      }),
    );
  });

  it("renders a keyboard-operable presentation without a write callback", () => {
    const onClose = vi.fn();
    render(
      <BirthdayVaultPresentation
        label="Private preview"
        messages={[
          {
            id: "00000000-0000-4000-8000-000000000001",
            title: null,
            message: "A safe published note.",
            emojiKey: null,
            author: {
              mode: "anonymous",
              participantId: null,
              displayName: "Anonymous",
              avatarIcon: null,
              avatarTone: null,
            },
            displayOrder: 0,
            sourceMessageRevision: 1,
            publishedAt: 1,
            revealRevision: 1,
            schemaVersion: 1,
          },
        ]}
        onClose={onClose}
      />,
    );
    expect(
      screen.getByRole("dialog", { name: /Private preview. Message 1 of 1/i }),
    ).toBeInTheDocument();
    expect(screen.getByText("Shared anonymously")).toBeInTheDocument();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
