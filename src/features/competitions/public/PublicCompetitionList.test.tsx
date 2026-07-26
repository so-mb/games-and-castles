import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { createCompetitionFormValues } from "../domain/config";
import { createDraftRecord, publishDraftRecord } from "../domain/transforms";
import type { Participant } from "../../participants/types";
import {
  PublicCompetitionList,
  ScheduledCompetitionCard,
} from "./PublicCompetitionList";

const hookState = vi.hoisted(() => ({
  firebase: { status: "unconfigured" } as { status: string },
  connection: "online" as "online" | "offline" | "unknown",
  competitions: {
    scheduled: [] as ReturnType<typeof publishDraftRecord>[],
    publicState: "ready",
    publicMalformedCount: 0,
  },
  participants: { activeParticipants: [] as Participant[] },
}));

vi.mock("../../live/FirebaseProvider", () => ({
  useFirebase: () => hookState.firebase,
}));
vi.mock("../../live/ConnectionProvider", () => ({
  useConnection: () => hookState.connection,
}));
vi.mock("../../participants/ParticipantsProvider", () => ({
  useParticipants: () => hookState.participants,
}));
vi.mock("../CompetitionsProvider", () => ({
  useCompetitions: () => hookState.competitions,
}));

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
];

describe("scheduled competition card", () => {
  it("renders a real configuration as scheduled without generated play state", () => {
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
    const competition = publishDraftRecord(draft, "admin", 200, 100);

    render(
      <ScheduledCompetitionCard
        competition={competition}
        participants={participants}
      />,
    );

    expect(
      screen.getByRole("heading", { name: "Castle Cup" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Merry-Go-Round")).toBeInTheDocument();
    expect(
      screen.getByText("Scheduled · fixtures pending"),
    ).toBeInTheDocument();
    expect(
      screen.getByLabelText("2 selected participants"),
    ).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(
      /result submission|live score/i,
    );
  });

  it("keeps the public page usable when Firebase is unconfigured", () => {
    hookState.firebase = { status: "unconfigured" };
    render(<PublicCompetitionList />);

    expect(screen.getByText("Live games unavailable")).toBeInTheDocument();
    expect(
      screen.getByText(
        /static weekend page and championship preview remain available/i,
      ),
    ).toBeInTheDocument();
  });
});
