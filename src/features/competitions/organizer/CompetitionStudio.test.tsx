import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Participant } from "../../participants/types";
import { createCompetitionFormValues } from "../domain/config";
import { createDraftRecord, publishDraftRecord } from "../domain/transforms";
import type { PublishedCompetition } from "../domain/types";
import { createCompetitionRun } from "../engine/activation";
import {
  generateRunKnockout,
  recordMatchResult,
  resolveRunTie,
  setMatchInProgress,
} from "../engine/lifecycle";
import { deriveStandings } from "../engine/standings";
import type { CompetitionRun } from "../engine/types";
import { CompetitionStudio } from "./CompetitionStudio";
import { MerryGoRoundControlRoom } from "./MerryGoRoundControlRoom";

const participants: Participant[] = Array.from({ length: 4 }, (_, index) => ({
  id: `guest-${index + 1}`,
  ownerUid: `guest-${index + 1}`,
  displayName: ["Ada Castle", "Bo Dice", "Cy Crown", "Dee Route"][index]!,
  avatar: { icon: "castle" as const, tone: "cyan" as const },
  status: "active" as const,
  createdAt: 100,
  createdByUid: `guest-${index + 1}`,
  updatedAt: 100,
  updatedByUid: `guest-${index + 1}`,
  schemaVersion: 1 as const,
}));

function scheduledCompetition(id = "castle-cup") {
  const values = createCompetitionFormValues();
  values.title = "Castle Cup";
  values.gameName = "Controller Duel";
  values.participantIds = participants.map((participant) => participant.id);
  const draft = createDraftRecord(values, { id, uid: "admin", now: 100 });
  return publishDraftRecord(draft, "admin", 200, 100);
}

function activeCompetition(competition: PublishedCompetition) {
  return {
    ...competition,
    status: "active" as const,
    revision: competition.revision + 1,
    updatedAt: 300,
  };
}

const hookState = vi.hoisted(() => ({
  participants: {
    organizerParticipants: [] as Participant[],
  },
  competitions: {
    scheduled: [] as PublishedCompetition[],
    active: [] as PublishedCompetition[],
    completed: [] as PublishedCompetition[],
    archived: [] as PublishedCompetition[],
    drafts: [],
    runs: [] as CompetitionRun[],
    auditEntries: [],
    publicState: "ready",
    organizerState: "ready",
    publicMalformedCount: 0,
    organizerMalformedCount: 0,
    runtimeMalformedCount: 0,
    errorMessage: null,
    canMutate: true,
    saveDraft: vi.fn(),
    publish: vi.fn(),
    saveScheduled: vi.fn(),
    deleteDraft: vi.fn(),
    duplicate: vi.fn(),
    archive: vi.fn(),
    restore: vi.fn(),
    reorder: vi.fn(),
    activate: vi.fn().mockResolvedValue(undefined),
    startMatch: vi.fn().mockResolvedValue(undefined),
    returnMatchToPending: vi.fn().mockResolvedValue(undefined),
    recordResult: vi.fn().mockResolvedValue(undefined),
    resolveTie: vi.fn().mockResolvedValue(undefined),
    generateKnockout: vi.fn().mockResolvedValue(undefined),
    complete: vi.fn().mockResolvedValue(undefined),
    reopen: vi.fn().mockResolvedValue(undefined),
    resetRun: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock("../../participants/ParticipantsProvider", () => ({
  useParticipants: () => hookState.participants,
}));

vi.mock("../CompetitionsProvider", () => ({
  useCompetitions: () => hookState.competitions,
}));

describe("Phase 4 Competition Studio", () => {
  beforeEach(() => {
    hookState.participants.organizerParticipants = participants;
    hookState.competitions.scheduled = [];
    hookState.competitions.active = [];
    hookState.competitions.completed = [];
    hookState.competitions.archived = [];
    hookState.competitions.runs = [];
    hookState.competitions.auditEntries = [];
    hookState.competitions.canMutate = true;
    Object.values(hookState.competitions).forEach((value) => {
      if (typeof value === "function" && "mockClear" in value)
        value.mockClear();
    });
  });

  it("provides an obvious route from Studio to the active Control Room", () => {
    const scheduled = scheduledCompetition();
    const active = activeCompetition(scheduled);
    const run = createCompetitionRun(scheduled, "admin", 300, () => 0);
    hookState.competitions.active = [active];
    hookState.competitions.runs = [run];

    render(<CompetitionStudio />);
    fireEvent.click(screen.getByRole("tab", { name: /Active · 1/i }));
    fireEvent.click(screen.getByRole("button", { name: /Open Control Room/i }));

    expect(
      screen.getByRole("heading", { name: "Castle Cup" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Merry-Go-Round Control Room")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Live standings" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", {
        name: "Qualification tie needs a decision",
      }),
    ).not.toBeInTheDocument();
  });

  it("offers activation only for Merry-Go-Round competitions", () => {
    const merry = scheduledCompetition("merry");
    const allHands = {
      ...scheduledCompetition("all-hands"),
      title: "All Hands Later",
      format: "all-hands" as const,
      formatConfig: {
        kind: "all-hands" as const,
        resultMode: "winner-only" as const,
        sessionPlan: { kind: "open-ended" as const },
        allowTeams: false,
        primaryMetricLabel: null,
        secondaryMetricLabel: null,
        tieHandling: "shared" as const,
      },
      scoringConfig: {
        kind: "all-hands" as const,
        winnerBonus: 1,
        participationPoints: 0,
        placementPoints: [],
      },
    };
    hookState.competitions.scheduled = [merry, allHands];

    render(<CompetitionStudio />);
    fireEvent.click(screen.getByRole("tab", { name: /Scheduled · 2/i }));

    expect(screen.getByRole("button", { name: "Activate" })).toBeEnabled();
    expect(
      screen.getByRole("button", { name: /Engine coming later/i }),
    ).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Activate" }));
    expect(screen.getByText("Activation review")).toBeInTheDocument();
    expect(screen.getByText("Frozen at activation")).toBeInTheDocument();
  });

  it("records a best-of-three result round by round", async () => {
    const scheduled = scheduledCompetition();
    const competition = activeCompetition(scheduled);
    const source = createCompetitionRun(scheduled, "admin", 300, () => 0);
    const first = Object.values(source.matches)[0]!;
    const run = setMatchInProgress(source, first.id, first.revision, 400);
    hookState.competitions.active = [competition];
    hookState.competitions.runs = [run];

    render(
      <MerryGoRoundControlRoom
        competition={competition}
        onBack={vi.fn()}
        participants={participants}
        run={run}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Record result" }));
    const winner = participants.find(
      (participant) => participant.id === first.participantAId,
    )!;
    fireEvent.click(
      screen.getByRole("button", {
        name: `Record ${winner.displayName} as winner of round 1`,
      }),
    );
    fireEvent.click(
      screen.getByRole("button", {
        name: `Record ${winner.displayName} as winner of round 2`,
      }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Confirm result" }));

    await waitFor(() => {
      expect(hookState.competitions.recordResult).toHaveBeenCalledWith(
        run,
        first.id,
        expect.objectContaining({
          expectedMatchRevision: run.matches[first.id]!.revision,
          roundWinnerIds: [first.participantAId, first.participantAId],
        }),
      );
    });
  });

  it("warns before a knockout correction clears a completed descendant", () => {
    const scheduled = scheduledCompetition();
    const competition = activeCompetition(scheduled);
    let run = createCompetitionRun(scheduled, "admin", 300, () => 0);
    Object.values(run.matches).forEach((match, index) => {
      run = recordMatchResult(run, match.id, {
        expectedMatchRevision: run.matches[match.id]!.revision,
        roundWinnerIds: [match.participantAId!, match.participantAId!],
        organizerUid: "admin",
        now: 400 + index,
      });
    });
    const standings = deriveStandings(
      run.participantIds,
      Object.values(run.matches),
      run.configSnapshot.tableScoring,
    );
    standings.unresolvedTieGroups.forEach((group, index) => {
      run = resolveRunTie(run, group, group, "admin", 500 + index);
    });
    run = generateRunKnockout(run, "admin", 600);
    const semifinals = Object.values(run.matches).filter(
      (match) => match.stage === "knockout" && match.bracketRound === 1,
    );
    semifinals.forEach((match, index) => {
      run = recordMatchResult(run, match.id, {
        expectedMatchRevision: run.matches[match.id]!.revision,
        roundWinnerIds: [match.participantAId!, match.participantAId!],
        organizerUid: "admin",
        now: 700 + index,
      });
    });
    const finalId = run.knockout!.rounds.at(-1)!.matchIds[0]!;
    run = recordMatchResult(run, finalId, {
      expectedMatchRevision: run.matches[finalId]!.revision,
      roundWinnerIds: [
        run.matches[finalId]!.participantAId!,
        run.matches[finalId]!.participantAId!,
      ],
      organizerUid: "admin",
      now: 800,
    });

    render(
      <MerryGoRoundControlRoom
        competition={competition}
        onBack={vi.fn()}
        participants={participants}
        run={run}
      />,
    );
    const knockout = screen.getByRole("region", { name: "Knockout matches" });
    fireEvent.click(
      within(knockout).getAllByRole("button", { name: "Correct result" })[0]!,
    );

    expect(
      screen.getByText(
        /dependent downstream matches and results may be cleared/i,
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Confirm correction" }),
    ).toBeDisabled();
  });

  it("disables organizer execution controls while offline", () => {
    const scheduled = scheduledCompetition();
    const competition = activeCompetition(scheduled);
    const run = createCompetitionRun(scheduled, "admin", 300, () => 0);
    hookState.competitions.canMutate = false;

    render(
      <MerryGoRoundControlRoom
        competition={competition}
        onBack={vi.fn()}
        participants={participants}
        run={run}
      />,
    );

    expect(
      screen.getAllByRole("button", { name: "Start match" })[0],
    ).toBeDisabled();
    expect(
      screen.getByRole("button", { name: /Reset unstarted run/i }),
    ).toBeDisabled();
  });

  it("requires an explicit acknowledgement before reopening a completed run", async () => {
    const scheduled = scheduledCompetition();
    const active = activeCompetition(scheduled);
    const competition = {
      ...active,
      status: "completed" as const,
      revision: active.revision + 1,
    };
    const source = createCompetitionRun(scheduled, "admin", 300, () => 0);
    const run: CompetitionRun = {
      ...source,
      stage: "completed",
      completedAt: 500,
      completedByUid: "admin",
      placements: {
        entries: [],
        completedAt: 500,
        completedByUid: "admin",
        runtimeRevision: source.revision,
        schemaVersion: 1,
      },
    };

    render(
      <MerryGoRoundControlRoom
        competition={competition}
        onBack={vi.fn()}
        participants={participants}
        run={run}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Reopen competition" }));
    const confirm = screen.getByRole("button", { name: "Confirm reopen" });
    expect(confirm).toBeDisabled();
    fireEvent.click(
      screen.getByRole("checkbox", {
        name: /makes completed match controls editable again/i,
      }),
    );
    fireEvent.click(confirm);

    await waitFor(() => {
      expect(hookState.competitions.reopen).toHaveBeenCalledWith(
        competition,
        run,
      );
    });
  });
});
