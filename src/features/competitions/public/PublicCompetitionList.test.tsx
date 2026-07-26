import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createCompetitionRun } from "../engine/activation";
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
    active: [] as ReturnType<typeof publishDraftRecord>[],
    completed: [] as ReturnType<typeof publishDraftRecord>[],
    runs: [] as ReturnType<typeof createCompetitionRun>[],
    publicState: "ready",
    publicMalformedCount: 0,
    runtimeMalformedCount: 0,
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
  beforeEach(() => {
    hookState.firebase = { status: "unconfigured" };
    hookState.connection = "online";
    hookState.competitions.scheduled = [];
    hookState.competitions.active = [];
    hookState.competitions.completed = [];
    hookState.competitions.runs = [];
    hookState.competitions.publicState = "ready";
    hookState.competitions.publicMalformedCount = 0;
    hookState.competitions.runtimeMalformedCount = 0;
    hookState.participants.activeParticipants = [];
  });
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

  it("renders an active Merry-Go-Round as a read-only live experience", () => {
    const values = {
      ...createCompetitionFormValues(),
      title: "Prague Circuit",
      gameName: "Controller Duel",
      participantIds: participants.map((participant) => participant.id),
    };
    const draft = createDraftRecord(values, {
      id: "prague-circuit",
      uid: "admin",
      now: 100,
    });
    const scheduled = publishDraftRecord(draft, "admin", 200, 100);
    const run = createCompetitionRun(scheduled, "admin", 300, () => 0);
    const active = {
      ...scheduled,
      status: "active" as const,
      revision: scheduled.revision + 1,
      updatedAt: 300,
    };
    hookState.firebase = { status: "ready" };
    hookState.participants.activeParticipants = participants;
    hookState.competitions.active = [active];
    hookState.competitions.runs = [run];

    render(<PublicCompetitionList />);

    expect(
      screen.getByRole("heading", { name: "Prague Circuit" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Live competition")).toBeInTheDocument();
    expect(screen.getByText("Round-robin standings")).toBeInTheDocument();
    expect(
      screen.getByText(/weekend-wide aggregation arrives in Phase 7/i),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /record result/i })).toBeNull();
  });

  it("surfaces offline and quarantined-runtime states without exposing controls", () => {
    hookState.firebase = { status: "ready" };
    hookState.connection = "offline";
    hookState.competitions.runtimeMalformedCount = 1;

    render(<PublicCompetitionList />);

    expect(
      screen.getByText(
        /malformed competition or runtime records were safely omitted/i,
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/saved competition cards may be out of date/i),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /activate|result/i }),
    ).toBeNull();
  });

  it("shows odd-field byes as fixture context rather than fake matches", () => {
    const oddParticipants: Participant[] = Array.from(
      { length: 5 },
      (_, index) => ({
        ...participants[index % participants.length]!,
        id: `odd-${index + 1}`,
        ownerUid: `odd-${index + 1}`,
        displayName: `Guest ${index + 1}`,
      }),
    );
    const values = {
      ...createCompetitionFormValues(),
      title: "Odd Castle Cup",
      gameName: "Table Duel",
      participantIds: oddParticipants.map((participant) => participant.id),
    };
    const draft = createDraftRecord(values, {
      id: "odd-castle-cup",
      uid: "admin",
      now: 100,
    });
    const scheduled = publishDraftRecord(draft, "admin", 200, 100);
    const run = createCompetitionRun(scheduled, "admin", 300, () => 0);
    hookState.firebase = { status: "ready" };
    hookState.participants.activeParticipants = oddParticipants;
    hookState.competitions.active = [
      {
        ...scheduled,
        status: "active" as const,
        revision: scheduled.revision + 1,
      },
    ];
    hookState.competitions.runs = [run];

    render(<PublicCompetitionList />);

    expect(screen.getAllByText(/BYE · Guest/i)).toHaveLength(5);
    expect(document.body.textContent).not.toContain(
      "vs Unavailable participant",
    );
  });
});
