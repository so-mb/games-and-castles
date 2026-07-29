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
    expect(screen.getAllByRole("button", { name: /avatar$/ })).toHaveLength(16);
    fireEvent.click(screen.getByRole("button", { name: "robot avatar" }));
    fireEvent.click(screen.getByRole("button", { name: "Antique gold" }));
    fireEvent.click(screen.getByRole("button", { name: "Join roster" }));
    await waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith({
        displayName: "Ada",
        avatar: { icon: "robot", tone: "gold" },
      }),
    );
  });

  it("updates the selected icon and colour choices to the chosen tone", () => {
    render(
      <ParticipantForm
        initialValue={{
          displayName: "Ivie",
          avatar: { icon: "puzzle", tone: "cyan" },
        }}
        onSubmit={vi.fn()}
        participants={[]}
        submitLabel="Save profile"
      />,
    );
    const selectedIcon = screen.getByRole("button", {
      name: "puzzle avatar",
    });
    const cyan = screen.getByRole("button", { name: "Electric cyan" });
    const red = screen.getByRole("button", { name: "Prague red" });

    expect(selectedIcon).toHaveClass("text-[var(--color-electric-cyan-400)]");
    expect(cyan).toHaveClass("text-[var(--color-electric-cyan-400)]");
    expect(red).toHaveClass("text-[#ffb3b7]");

    fireEvent.click(red);

    expect(selectedIcon).toHaveClass("text-[#ffb3b7]");
    expect(red).toHaveAttribute("aria-pressed", "true");
    expect(cyan).toHaveAttribute("aria-pressed", "false");
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
