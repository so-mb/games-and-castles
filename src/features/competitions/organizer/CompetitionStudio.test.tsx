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
import { createAllHandsRun, createAllHandsSession } from "../all-hands/engine";
import { createCompetitionRun } from "../engine/activation";
import {
  generateRunKnockout,
  recordMatchResult,
  resolveRunTie,
  setMatchInProgress,
} from "../engine/lifecycle";
import { deriveStandings } from "../engine/standings";
import type { AnyCompetitionRun, CompetitionRun } from "../engine/types";
import { CompetitionStudio } from "./CompetitionStudio";
import { MerryGoRoundControlRoom } from "./MerryGoRoundControlRoom";
import { createGroupDrawPreview } from "../group-knockout/generation";

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

function scheduledAllHandsCompetition(
  resultMode: "winner-only" | "placement" = "winner-only",
) {
  const values = createCompetitionFormValues("all-hands");
  values.title = "All Hands Table";
  values.gameName = "Party Challenge";
  values.participantIds = participants.map((participant) => participant.id);
  if (values.formatConfig.kind === "all-hands") {
    values.formatConfig = {
      ...values.formatConfig,
      resultMode,
      allowTeams: true,
    };
  }
  const draft = createDraftRecord(values, {
    id: `all-hands-${resultMode}`,
    uid: "admin",
    now: 100,
  });
  return publishDraftRecord(draft, "admin", 200, 100);
}

function scheduledGroupCompetition() {
  const values = createCompetitionFormValues("group-knockout");
  values.title = "Group Crown";
  values.gameName = "Castle Clash";
  values.participantIds = participants.map((participant) => participant.id);
  if (values.formatConfig.kind === "group-knockout") {
    values.formatConfig = {
      ...values.formatConfig,
      groupCountMode: "manual",
      groupCount: 1,
      qualifiersPerGroup: 2,
    };
  }
  const draft = createDraftRecord(values, {
    id: "group-crown",
    uid: "admin",
    now: 100,
  });
  return publishDraftRecord(draft, "admin", 200, 100);
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
    runs: [] as AnyCompetitionRun[],
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
    activateGroup: vi.fn().mockResolvedValue(undefined),
    startMatch: vi.fn().mockResolvedValue(undefined),
    returnMatchToPending: vi.fn().mockResolvedValue(undefined),
    recordResult: vi.fn().mockResolvedValue(undefined),
    resolveTie: vi.fn().mockResolvedValue(undefined),
    generateKnockout: vi.fn().mockResolvedValue(undefined),
    complete: vi.fn().mockResolvedValue(undefined),
    reopen: vi.fn().mockResolvedValue(undefined),
    resetRun: vi.fn().mockResolvedValue(undefined),
    createAllHandsSession: vi.fn().mockResolvedValue(undefined),
    startAllHandsSession: vi.fn().mockResolvedValue(undefined),
    returnAllHandsSessionToPending: vi.fn().mockResolvedValue(undefined),
    recordAllHandsResult: vi.fn().mockResolvedValue(undefined),
    voidAllHandsSession: vi.fn().mockResolvedValue(undefined),
    restoreAllHandsSession: vi.fn().mockResolvedValue(undefined),
    deleteAllHandsSession: vi.fn().mockResolvedValue(undefined),
    reviewAllHandsCompletion: vi.fn().mockResolvedValue(undefined),
    resolveAllHandsTie: vi.fn().mockResolvedValue(undefined),
    completeAllHands: vi.fn().mockResolvedValue(undefined),
    reopenAllHands: vi.fn().mockResolvedValue(undefined),
    resetAllHands: vi.fn().mockResolvedValue(undefined),
    startGroupMatch: vi.fn().mockResolvedValue(undefined),
    returnGroupMatchToPending: vi.fn().mockResolvedValue(undefined),
    recordGroupResult: vi.fn().mockResolvedValue(undefined),
    resolveGroupTie: vi.fn().mockResolvedValue(undefined),
    openQualificationReview: vi.fn().mockResolvedValue(undefined),
    resolveCrossGroupSeed: vi.fn().mockResolvedValue(undefined),
    generateGroupKnockout: vi.fn().mockResolvedValue(undefined),
    resetGroupKnockout: vi.fn().mockResolvedValue(undefined),
    completeGroup: vi.fn().mockResolvedValue(undefined),
    reopenGroup: vi.fn().mockResolvedValue(undefined),
    resetGroup: vi.fn().mockResolvedValue(undefined),
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
      screen.getByRole("heading", {
        name: "Round-robin qualification standings",
      }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", {
        name: "Qualification tie needs a decision",
      }),
    ).not.toBeInTheDocument();
  });

  it("offers Phase 5 activation for All Hands and shows its frozen review", () => {
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
        primaryMetricDirection: "higher" as const,
        secondaryMetricLabel: null,
        secondaryMetricDirection: null,
        allowNegativeScores: false,
        tieHandling: "shared-placement" as const,
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

    expect(screen.getAllByRole("button", { name: "Activate" })).toHaveLength(2);
    const allHandsCard = screen
      .getByRole("heading", { name: "All Hands Later" })
      .closest("article");
    expect(allHandsCard).not.toBeNull();
    fireEvent.click(
      within(allHandsCard!).getByRole("button", { name: "Activate" }),
    );
    expect(screen.getByText("All Hands activation review")).toBeInTheDocument();
    expect(screen.getByText(/Frozen at activation/)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Activate All Hands" }),
    ).toBeEnabled();
  });

  it("offers a local Group Format draw preview and an accessible Group Arena route", async () => {
    const scheduled = scheduledGroupCompetition();
    hookState.competitions.scheduled = [scheduled];
    const previewView = render(<CompetitionStudio />);
    fireEvent.click(screen.getByRole("tab", { name: /Scheduled · 1/i }));
    fireEvent.click(screen.getByRole("button", { name: "Activate" }));

    expect(
      screen.getByRole("heading", { name: "Confirm Group Crown" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Still scheduled")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Confirm exact draw & activate/i }),
    ).toBeInTheDocument();
    fireEvent.click(
      screen.getByRole("button", { name: /Confirm exact draw & activate/i }),
    );
    await waitFor(() =>
      expect(hookState.competitions.activateGroup).toHaveBeenCalledWith(
        scheduled,
        expect.objectContaining({
          format: "group-knockout",
          groups: expect.arrayContaining([
            expect.objectContaining({ id: "group-a", label: "Group A" }),
          ]),
          draw: expect.objectContaining({ drawVersion: 1 }),
        }),
      ),
    );
    previewView.unmount();

    const active = activeCompetition(scheduled);
    const run = createGroupDrawPreview(scheduled, "admin", 300, () => 0).run;
    hookState.competitions.scheduled = [];
    hookState.competitions.active = [active];
    hookState.competitions.runs = [run];
    render(<CompetitionStudio />);
    fireEvent.click(screen.getByRole("tab", { name: /Active · 1/i }));
    fireEvent.click(screen.getByRole("button", { name: /Open Control Room/i }));
    expect(screen.getByText("Organizer Group Arena")).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Groups" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Bracket" })).toBeInTheDocument();
  });

  it("creates accessible individual and team sessions from the All Hands control room", async () => {
    const scheduled = scheduledAllHandsCompetition();
    const active = activeCompetition(scheduled);
    const run = createAllHandsRun(scheduled, "admin", 300);
    hookState.competitions.active = [active];
    hookState.competitions.runs = [run];

    render(<CompetitionStudio />);
    fireEvent.click(screen.getByRole("tab", { name: /Active · 1/i }));
    fireEvent.click(screen.getByRole("button", { name: /Open Control Room/i }));
    expect(
      screen.getByText("All Hands Table", { selector: "p" }),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Create session" }));
    expect(screen.getByRole("dialog")).toHaveAccessibleName(
      "Create All Hands session",
    );
    fireEvent.click(screen.getByRole("button", { name: "Review session" }));
    fireEvent.click(screen.getByRole("button", { name: "Save pending" }));
    await waitFor(() =>
      expect(hookState.competitions.createAllHandsSession).toHaveBeenCalledWith(
        run,
        expect.objectContaining({
          mode: "individual",
          participantIds: participants.map((participant) => participant.id),
          startImmediately: false,
        }),
      ),
    );

    fireEvent.click(screen.getByRole("button", { name: "Create session" }));
    fireEvent.click(screen.getByRole("radio", { name: "Teams" }));
    const assignments = screen.getAllByRole("combobox");
    fireEvent.change(assignments[0]!, { target: { value: "team-1" } });
    fireEvent.change(assignments[1]!, { target: { value: "team-1" } });
    fireEvent.change(assignments[2]!, { target: { value: "team-2" } });
    fireEvent.change(assignments[3]!, { target: { value: "team-2" } });
    fireEvent.click(screen.getByRole("button", { name: "Review session" }));
    fireEvent.click(screen.getByRole("button", { name: "Start now" }));
    await waitFor(() =>
      expect(
        hookState.competitions.createAllHandsSession,
      ).toHaveBeenLastCalledWith(
        run,
        expect.objectContaining({
          mode: "team",
          startImmediately: true,
          teams: [
            expect.objectContaining({
              name: "Team 1",
              participantIds: ["guest-1", "guest-2"],
            }),
            expect.objectContaining({
              name: "Team 2",
              participantIds: ["guest-3", "guest-4"],
            }),
          ],
        }),
      ),
    );
  });

  it("records a winner-only All Hands result through the organizer confirmation flow", async () => {
    const scheduled = scheduledAllHandsCompetition();
    const active = activeCompetition(scheduled);
    let run = createAllHandsRun(scheduled, "admin", 300);
    run = createAllHandsSession(run, {
      id: "session-1",
      title: "Opening table",
      mode: "individual",
      participantIds: participants.map((participant) => participant.id),
      teams: [],
      startImmediately: true,
      organizerUid: "admin",
      now: 400,
    });
    hookState.competitions.active = [active];
    hookState.competitions.runs = [run];

    render(<CompetitionStudio />);
    fireEvent.click(screen.getByRole("tab", { name: /Active · 1/i }));
    fireEvent.click(screen.getByRole("button", { name: /Open Control Room/i }));
    fireEvent.click(screen.getByRole("button", { name: "Enter result" }));
    fireEvent.click(screen.getByRole("radio", { name: "Ada Castle" }));
    fireEvent.click(screen.getByRole("button", { name: "Review result" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirm and save" }));

    await waitFor(() =>
      expect(hookState.competitions.recordAllHandsResult).toHaveBeenCalledWith(
        run,
        "session-1",
        run.sessions["session-1"]!.revision,
        { kind: "winner-only", winnerEntityId: "guest-1" },
      ),
    );
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
    const finalWinner = participants.find(
      (participant) =>
        participant.id === run.matches[finalId]!.result!.winnerId,
    )!.displayName;
    const grandWinner = screen.getByRole("region", { name: "Grand Winner" });
    expect(within(grandWinner).getByText(finalWinner)).toBeInTheDocument();
    expect(
      within(grandWinner).getByText(/round-robin points.*do not override/i),
    ).toBeInTheDocument();
    const knockout = screen.getByRole("region", { name: "Knockout bracket" });
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
