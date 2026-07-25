import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { Participant } from "./types";
import { ParticipantForm } from "./ParticipantForm";

const participant: Participant = {
  id: "guest-a",
  ownerUid: "guest-a",
  displayName: "Castle Guest",
  avatar: { icon: "castle", tone: "cyan" },
  status: "active",
  createdAt: 1,
  createdByUid: "guest-a",
  updatedAt: 1,
  updatedByUid: "guest-a",
  schemaVersion: 1,
};

describe("ParticipantForm", () => {
  it("keeps submission disabled until the name is valid", () => {
    render(
      <ParticipantForm
        onSubmit={vi.fn()}
        participants={[]}
        submitLabel="Join roster"
      />,
    );
    expect(screen.getByRole("button", { name: "Join roster" })).toBeDisabled();
    fireEvent.change(screen.getByLabelText("Display name"), {
      target: { value: "A" },
    });
    expect(screen.getByRole("button", { name: "Join roster" })).toBeDisabled();
    fireEvent.change(screen.getByLabelText("Display name"), {
      target: { value: "Ada" },
    });
    expect(screen.getByRole("button", { name: "Join roster" })).toBeEnabled();
  });

  it("shows a non-blocking duplicate-name warning", () => {
    render(
      <ParticipantForm
        onSubmit={vi.fn()}
        participants={[participant]}
        submitLabel="Join roster"
      />,
    );
    fireEvent.change(screen.getByLabelText("Display name"), {
      target: { value: "castle guest" },
    });
    expect(screen.getByRole("status")).toHaveTextContent(
      /already in the roster/i,
    );
    expect(screen.getByRole("button", { name: "Join roster" })).toBeEnabled();
  });

  it("submits the selected curated avatar", async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(
      <ParticipantForm
        onSubmit={onSubmit}
        participants={[]}
        submitLabel="Join roster"
      />,
    );
    fireEvent.change(screen.getByLabelText("Display name"), {
      target: { value: "Ada" },
    });
    fireEvent.click(screen.getByRole("button", { name: "dice avatar" }));
    fireEvent.click(screen.getByRole("button", { name: "Antique gold" }));
    fireEvent.click(screen.getByRole("button", { name: "Join roster" }));
    await waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith({
        displayName: "Ada",
        avatar: { icon: "dice", tone: "gold" },
      }),
    );
  });

  it("prevents a second submission while the first is pending", () => {
    const onSubmit = vi.fn(() => new Promise<void>(() => undefined));
    render(
      <ParticipantForm
        onSubmit={onSubmit}
        participants={[]}
        submitLabel="Join roster"
      />,
    );
    fireEvent.change(screen.getByLabelText("Display name"), {
      target: { value: "Ada" },
    });
    const submit = screen.getByRole("button", { name: "Join roster" });
    fireEvent.click(submit);
    fireEvent.click(submit);
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("button", { name: "Saving…" })).toBeDisabled();
  });
});
