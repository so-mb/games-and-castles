import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type {
  ChampionshipStanding,
  CompetitionLedgerSnapshot,
} from "./domain/types";
import { ChampionshipSection } from "./ChampionshipSection";

const state = vi.hoisted(() => ({
  value: {} as Record<string, unknown>,
}));

vi.mock("./ChampionshipProvider", () => ({
  useChampionship: () => state.value,
}));

vi.mock("../participants/ParticipantLivePanel", () => ({
  ParticipantLivePanel: () => <div>Registered participants</div>,
}));

vi.mock("../competitions/public/PublicCompetitionList", () => ({
  PublicCompetitionList: () => <div>Live competition experiences</div>,
}));

const entry = {
  id: "match-win-1234567890abcdef",
  participantId: "player-1",
  sourceNamespace: "competition" as const,
  sourceId: "castle-cup",
  sourceEntityId: "match-1",
  sourceType: "match-win" as const,
  points: 4,
  label: "Match win",
  competitionId: "castle-cup",
  competitionFormat: "round-robin-knockout" as const,
  stage: "round-robin",
  awardedAt: 200,
  sourceRevision: 1,
  schemaVersion: 1 as const,
};

const source: CompetitionLedgerSnapshot = {
  meta: {
    competitionId: "castle-cup",
    competitionFormat: "round-robin-knockout",
    competitionStatus: "active",
    competitionTitle: "Castle Cup",
    runRevision: 2,
    sourceFingerprint: "1234567890abcdef",
    generatedAt: 200,
    generatedBy: "organizer",
    entryCount: 1,
    schemaVersion: 1,
  },
  entries: { [entry.id]: entry },
};

function standing(
  participantId: string,
  displayName: string,
  totalPoints: number,
  rank: number,
): ChampionshipStanding {
  const award = { ...entry, id: `${entry.id}-${participantId}`, participantId };
  const awardView = {
    id: award.id,
    participantId,
    points: totalPoints,
    label: "Match win",
    awardedAt: 200,
    awardType: "match-win" as const,
    competitionId: "castle-cup",
    competitionTitle: "Castle Cup",
    competitionFormat: "round-robin-knockout" as const,
    stage: "round-robin",
  };
  return {
    participantId,
    participant: {
      id: participantId,
      ownerUid: null,
      displayName,
      avatar: { icon: "castle", tone: "cyan" },
      status: "active",
      createdAt: 1,
      createdByUid: "admin",
      updatedAt: 1,
      updatedByUid: "admin",
      schemaVersion: 1,
    },
    displayName,
    rank,
    tied: rank === 1,
    totalPoints,
    competitionPoints: totalPoints,
    bonusPoints: 0,
    competitionsScored: totalPoints ? 1 : 0,
    scoredEvents: totalPoints ? 1 : 0,
    contributions: totalPoints
      ? [
          {
            competitionId: "castle-cup",
            title: "Castle Cup",
            format: "round-robin-knockout",
            points: totalPoints,
            awards: [awardView],
          },
        ]
      : [],
    byAwardType: totalPoints ? { "match-win": totalPoints } : {},
    awards: totalPoints ? [awardView] : [],
    recentAwards: totalPoints ? [awardView] : [],
    isMissingParticipant: false,
  };
}

function setChampionship(overrides: Record<string, unknown> = {}) {
  state.value = {
    sources: [],
    publicBonuses: [],
    organizerBonuses: [],
    standings: [standing("player-1", "Alex", 0, 1)],
    achievements: [],
    reconciliation: [],
    state: "ready",
    malformedSourceIds: [],
    malformedBonusIds: [],
    errorMessage: null,
    canMutate: false,
    ...overrides,
  };
}

describe("realtime championship public experience", () => {
  beforeEach(() => setChampionship());

  it("shows a truthful empty state and active zero-point participants", () => {
    render(<ChampionshipSection />);
    expect(
      screen.getByRole("heading", {
        name: "Championship begins when results are recorded",
      }),
    ).toBeInTheDocument();
    expect(screen.getByText("Registered participants")).toBeInTheDocument();
    expect(
      screen.queryByText(/Player A|sample leader/i),
    ).not.toBeInTheDocument();
  });

  it("renders real co-leaders, shared ranks, contributions, and recent awards", () => {
    setChampionship({
      sources: [source],
      standings: [
        standing("player-1", "Alex", 4, 1),
        standing("player-2", "Sam", 4, 1),
        standing("player-3", "Jo", 2, 3),
      ],
      reconciliation: [
        {
          competitionId: "castle-cup",
          competitionTitle: "Castle Cup",
          status: "in-sync",
          expected: source,
          persisted: source,
          entryDelta: 0,
          warning: null,
        },
      ],
      achievements: [
        {
          id: "match-master",
          title: "Match Master",
          criterion: "Most match-win points",
          participantIds: ["player-1", "player-2"],
          value: 4,
        },
      ],
    });
    render(<ChampionshipSection />);
    expect(
      screen.getByRole("list", {
        name: "Current top-three championship podium",
      }),
    ).toBeInTheDocument();
    expect(screen.getAllByLabelText(/Rank 1, tied/)).toHaveLength(2);
    expect(screen.getByText("Competition contributions")).toBeInTheDocument();
    expect(screen.getByText("Latest scoring awards")).toBeInTheDocument();
    expect(screen.getByText("Match Master")).toBeInTheDocument();
    expect(screen.queryByText(/sample leaderboard/i)).not.toBeInTheDocument();
  });

  it("opens an itemized participant explanation without direct edit controls", () => {
    setChampionship({
      sources: [source],
      standings: [standing("player-1", "Alex", 4, 1)],
      reconciliation: [
        {
          competitionId: "castle-cup",
          competitionTitle: "Castle Cup",
          status: "in-sync",
          expected: source,
          persisted: source,
          entryDelta: 0,
          warning: null,
        },
      ],
    });
    render(<ChampionshipSection />);
    fireEvent.click(
      screen.getByRole("button", { name: "Open Alex's score breakdown" }),
    );
    const dialog = screen.getByRole("dialog", {
      name: "Alex · score breakdown",
    });
    expect(within(dialog).getByText("Itemized awards")).toBeInTheDocument();
    expect(within(dialog).getAllByText("Match win").length).toBeGreaterThan(0);
    expect(within(dialog).getAllByText("4 pts")).toHaveLength(2);
    expect(
      within(dialog).queryByRole("button", { name: /edit points/i }),
    ).not.toBeInTheDocument();
  });

  it("warns when a source is missing or malformed without crashing", () => {
    setChampionship({
      reconciliation: [
        {
          competitionId: "castle-cup",
          competitionTitle: "Castle Cup",
          status: "missing",
          expected: source,
          persisted: null,
          entryDelta: 1,
          warning: "Backfill required",
        },
      ],
      malformedSourceIds: ["bad-source"],
    });
    render(<ChampionshipSection />);
    expect(
      screen.getByText(/Some points are awaiting organizer verification/),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Weekend championship" }),
    ).toBeInTheDocument();
  });
});
