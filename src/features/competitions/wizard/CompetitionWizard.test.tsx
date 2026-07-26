import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { Participant } from "../../participants/types";
import { createCompetitionFormValues } from "../domain/config";
import { createDraftRecord } from "../domain/transforms";
import { CompetitionWizard } from "./CompetitionWizard";

const participants: Participant[] = [
  {
    id: "guest-1",
    ownerUid: "guest-1",
    displayName: "Ada Castle",
    avatar: { icon: "castle", tone: "cyan" },
    status: "active",
    createdAt: 100,
    createdByUid: "guest-1",
    updatedAt: 100,
    updatedByUid: "guest-1",
    schemaVersion: 1,
  },
  {
    id: "guest-2",
    ownerUid: null,
    displayName: "Bo Dice",
    avatar: { icon: "dice", tone: "gold" },
    status: "active",
    createdAt: 100,
    createdByUid: "admin",
    updatedAt: 100,
    updatedByUid: "admin",
    schemaVersion: 1,
  },
  {
    id: "guest-3",
    ownerUid: null,
    displayName: "Cy Crown",
    avatar: { icon: "crown", tone: "red" },
    status: "inactive",
    createdAt: 100,
    createdByUid: "admin",
    updatedAt: 100,
    updatedByUid: "admin",
    schemaVersion: 1,
  },
  {
    id: "guest-4",
    ownerUid: null,
    displayName: "Dee Route",
    avatar: { icon: "trophy", tone: "neutral" },
    status: "active",
    createdAt: 100,
    createdByUid: "admin",
    updatedAt: 100,
    updatedByUid: "admin",
    schemaVersion: 1,
  },
];

function handlers() {
  return {
    onCancel: vi.fn(),
    onSaveDraft: vi.fn().mockResolvedValue(undefined),
    onPublish: vi.fn().mockResolvedValue(undefined),
    onSaveScheduled: vi.fn().mockResolvedValue(undefined),
  };
}

describe("CompetitionWizard", () => {
  it("saves an explicitly submitted draft without generating play state", async () => {
    const actions = handlers();
    render(
      <CompetitionWizard
        canMutate
        latestRecord={null}
        participants={participants}
        record={null}
        {...actions}
      />,
    );
    fireEvent.change(screen.getByLabelText("Competition title"), {
      target: { value: "Friday Cup" },
    });
    fireEvent.change(screen.getByLabelText("Game name"), {
      target: { value: "Cards" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save draft" }));

    await waitFor(() =>
      expect(actions.onSaveDraft).toHaveBeenCalledWith(
        null,
        expect.objectContaining({ title: "Friday Cup", gameName: "Cards" }),
      ),
    );
    expect(actions.onPublish).not.toHaveBeenCalled();
    expect(actions.onSaveScheduled).not.toHaveBeenCalled();
  });

  it("preserves basics while requiring confirmation before a format reset", () => {
    const actions = handlers();
    render(
      <CompetitionWizard
        canMutate
        latestRecord={null}
        participants={participants}
        record={null}
        {...actions}
      />,
    );
    fireEvent.change(screen.getByLabelText("Competition title"), {
      target: { value: "Friday Cup" },
    });
    fireEvent.click(screen.getByRole("button", { name: /All Hands/ }));
    expect(
      screen.getByRole("dialog", { name: "Change competition format?" }),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Change format" }));
    expect(screen.getByLabelText("Competition title")).toHaveValue(
      "Friday Cup",
    );
    expect(screen.getByRole("button", { name: /All Hands/ })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    fireEvent.click(screen.getByRole("button", { name: /3\. Format setup/ }));
    expect(screen.getByLabelText("Result mode")).toBeInTheDocument();
  });

  it("distinguishes duplicate display names by stable participant IDs", () => {
    const duplicateNameParticipants = [
      ...participants,
      { ...participants[0]!, id: "guest-5", ownerUid: "guest-5" },
    ];
    render(
      <CompetitionWizard
        canMutate
        latestRecord={null}
        participants={duplicateNameParticipants}
        record={null}
        {...handlers()}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /2\. Participants/ }));
    expect(
      screen.getAllByRole("checkbox", { name: /Ada Castle/ }),
    ).toHaveLength(2);
  });

  it("selects active participants while preserving an inactive selected reference", () => {
    const values = {
      ...createCompetitionFormValues(),
      title: "Castle Cup",
      gameName: "Mario Kart",
      participantIds: ["guest-3"],
    };
    const draft = createDraftRecord(values, {
      id: "castle-cup",
      uid: "admin",
      now: 100,
    });
    render(
      <CompetitionWizard
        canMutate
        latestRecord={draft}
        participants={participants}
        record={draft}
        {...handlers()}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /2\. Participants/ }));
    expect(screen.getByRole("checkbox", { name: /Cy Crown/ })).toBeChecked();
    fireEvent.click(screen.getByRole("button", { name: "Select all active" }));
    expect(screen.getByText(/4 selected/)).toBeInTheDocument();
  });

  it("blocks invalid publishing and confirms a valid publish", async () => {
    const invalidActions = handlers();
    const firstRender = render(
      <CompetitionWizard
        canMutate
        latestRecord={null}
        participants={participants}
        record={null}
        {...invalidActions}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /5\. Review/ }));
    expect(
      screen.getByRole("button", { name: "Publish competition" }),
    ).toBeDisabled();
    firstRender.unmount();

    const actions = handlers();
    const values = {
      ...createCompetitionFormValues(),
      title: "Castle Cup",
      gameName: "Mario Kart",
      participantIds: participants.map((participant) => participant.id),
    };
    const draft = createDraftRecord(values, {
      id: "castle-cup",
      uid: "admin",
      now: 100,
    });
    render(
      <CompetitionWizard
        canMutate
        latestRecord={draft}
        participants={participants}
        record={draft}
        {...actions}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /5\. Review/ }));
    fireEvent.click(
      screen.getByRole("button", { name: "Publish competition" }),
    );
    expect(
      screen.getByRole("dialog", { name: "Publish this competition?" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Fixtures and results are not generated yet/),
    ).toBeInTheDocument();
    fireEvent.click(
      screen.getAllByRole("button", { name: "Publish competition" })[1]!,
    );
    await waitFor(() =>
      expect(actions.onPublish).toHaveBeenCalledWith(draft, values),
    );
  });

  it("disables mutations while offline", () => {
    render(
      <CompetitionWizard
        canMutate={false}
        latestRecord={null}
        participants={participants}
        record={null}
        {...handlers()}
      />,
    );
    expect(screen.getByRole("button", { name: "Save draft" })).toBeDisabled();
    expect(
      screen.getByText(
        /Mutations are available only while organizer access is online/,
      ),
    ).toBeInTheDocument();
  });

  it("preserves local state and blocks saving after a remote revision change", () => {
    const values = {
      ...createCompetitionFormValues(),
      title: "Castle Cup",
      gameName: "Cards",
    };
    const draft = createDraftRecord(values, {
      id: "castle-cup",
      uid: "admin",
      now: 100,
    });
    const latest = {
      ...draft,
      title: "Castle Cup Updated Elsewhere",
      revision: 2,
      updatedAt: 200,
    };
    render(
      <CompetitionWizard
        canMutate
        latestRecord={latest}
        participants={participants}
        record={draft}
        {...handlers()}
      />,
    );

    expect(
      screen.getByText("This competition changed on another device."),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Competition title")).toHaveValue(
      "Castle Cup",
    );
    expect(screen.getByRole("button", { name: "Save draft" })).toBeDisabled();

    fireEvent.click(
      screen.getByRole("button", { name: "Discard local changes and reload" }),
    );
    expect(screen.getByLabelText("Competition title")).toHaveValue(
      "Castle Cup Updated Elsewhere",
    );
    expect(
      screen.queryByText("This competition changed on another device."),
    ).not.toBeInTheDocument();
  });
});
