import type {
  PublishedCompetition,
  CompetitionFormat,
} from "../../competitions/domain/types";
import { deriveCompetitionPointBreakdown } from "../../competitions/engine/points";
import type {
  AnyCompetitionRun,
  CompetitionPointItem,
  CompetitionRun,
} from "../../competitions/engine/types";
import { deriveAllHandsCompetitionPointBreakdown } from "../../competitions/all-hands/engine";
import type {
  AllHandsCompetitionRun,
  DerivedSessionAward,
} from "../../competitions/all-hands/types";
import { deriveGroupPointBreakdown } from "../../competitions/group-knockout/points";
import type { GroupKnockoutRun } from "../../competitions/group-knockout/types";
import type {
  ChampionshipAwardType,
  ChampionshipLedgerEntry,
  CompetitionLedgerSnapshot,
} from "../domain/types";
import { createCompetitionLedgerEntryId, stableHash } from "./identity";

interface NormalizedAward {
  participantId: string;
  sourceEntityId: string;
  sourceType: ChampionshipAwardType;
  points: number;
  label: string;
  stage: string | null;
  awardedAt: number;
  sourceRevision: number;
  discriminator?: string;
}

function assertCompatible(
  competition: PublishedCompetition,
  run: AnyCompetitionRun,
) {
  if (
    competition.id !== run.competitionId ||
    competition.format !== run.format ||
    (competition.status !== "active" && competition.status !== "completed") ||
    run.schemaVersion !== 1
  ) {
    throw new Error("Competition and runtime are not ledger-compatible.");
  }
}

function matchAward(
  run: CompetitionRun | GroupKnockoutRun,
  item: CompetitionPointItem,
): NormalizedAward {
  const match = item.sourceMatchId ? run.matches[item.sourceMatchId] : null;
  const placement = run.placements?.entries.find(
    (entry) => entry.participantId === item.participantId,
  );
  const sourceType: ChampionshipAwardType =
    item.reason === "participation"
      ? "match-participation"
      : item.reason === "runner-up"
        ? "competition-runner-up"
        : item.reason === "third-place"
          ? "competition-third-place"
          : item.reason;
  const sourceEntityId =
    item.sourceMatchId ??
    (item.reason === "qualification"
      ? "qualification"
      : `placement-${placement?.place ?? "final"}`);
  const specialAt =
    item.reason === "qualification"
      ? run.format === "group-knockout"
        ? run.qualification?.confirmedAt
        : run.knockout?.generatedAt
      : run.placements?.completedAt;
  return {
    participantId: item.participantId,
    sourceEntityId,
    sourceType,
    points: item.points,
    label: item.label,
    stage:
      match?.stage ??
      (item.reason === "qualification" ? "qualification" : "final"),
    awardedAt: match?.result?.completedAt ?? specialAt ?? run.updatedAt,
    sourceRevision: match?.result?.resultRevision ?? run.revision,
  };
}

function allHandsAward(
  run: AllHandsCompetitionRun,
  item: DerivedSessionAward,
): NormalizedAward {
  const session = run.sessions[item.sessionId];
  const kind = item.awardKind;
  return {
    participantId: item.participantId,
    sourceEntityId: item.sessionId,
    sourceType:
      kind === "winner"
        ? "session-win"
        : kind === "placement"
          ? "session-placement"
          : kind === "participation"
            ? "session-participation"
            : "custom-session",
    points: item.points,
    label: item.label,
    stage: "session",
    awardedAt: session?.result?.completedAt ?? run.updatedAt,
    sourceRevision: session?.result?.resultRevision ?? run.revision,
    discriminator: kind,
  };
}

function normalize(
  competition: PublishedCompetition,
  run: AnyCompetitionRun,
): NormalizedAward[] {
  if (run.format === "round-robin-knockout") {
    return deriveCompetitionPointBreakdown(run).flatMap((row) =>
      row.items.map((item) => matchAward(run, item)),
    );
  }
  if (run.format === "all-hands") {
    return deriveAllHandsCompetitionPointBreakdown(run).flatMap((row) =>
      row.items.map((item) => allHandsAward(run, item)),
    );
  }
  if (run.format === "group-knockout") {
    return deriveGroupPointBreakdown(run).flatMap((row) =>
      row.items.map((item) => matchAward(run, item)),
    );
  }
  throw new Error(`Unsupported competition format: ${competition.format}`);
}

function fingerprintInput(
  competitionId: string,
  format: CompetitionFormat,
  status: "active" | "completed",
  run: AnyCompetitionRun,
  entries: Record<string, ChampionshipLedgerEntry>,
) {
  return {
    competitionId,
    format,
    status,
    runRevision: run.revision,
    scoring: run.configSnapshot,
    entries: Object.values(entries).sort((left, right) =>
      left.id.localeCompare(right.id),
    ),
  };
}

export function deriveCompetitionLedgerSnapshot(input: {
  competition: PublishedCompetition;
  run: AnyCompetitionRun;
  generatedAt?: number;
}): CompetitionLedgerSnapshot {
  const { competition, run } = input;
  assertCompatible(competition, run);
  const awards = normalize(competition, run);
  const entries: Record<string, ChampionshipLedgerEntry> = {};
  for (const award of awards) {
    if (!Number.isInteger(award.points) || award.points <= 0) continue;
    const id = createCompetitionLedgerEntryId({
      competitionId: competition.id,
      participantId: award.participantId,
      awardType: award.sourceType,
      sourceEntityId: award.sourceEntityId,
      discriminator: award.discriminator,
    });
    if (entries[id]) throw new Error("A deterministic ledger ID collided.");
    entries[id] = {
      id,
      participantId: award.participantId,
      sourceNamespace: "competition",
      sourceId: competition.id,
      sourceEntityId: award.sourceEntityId,
      sourceType: award.sourceType,
      points: award.points,
      label: award.label,
      competitionId: competition.id,
      competitionFormat: competition.format,
      stage: award.stage,
      awardedAt: award.awardedAt,
      sourceRevision: award.sourceRevision,
      schemaVersion: 1,
    };
  }
  const status = competition.status as "active" | "completed";
  return {
    meta: {
      competitionId: competition.id,
      competitionFormat: competition.format,
      competitionStatus: status,
      competitionTitle: competition.title,
      runRevision: run.revision,
      sourceFingerprint: stableHash(
        fingerprintInput(
          competition.id,
          competition.format,
          status,
          run,
          entries,
        ),
      ),
      generatedAt: input.generatedAt ?? run.updatedAt,
      generatedBy: "organizer",
      entryCount: Object.keys(entries).length,
      schemaVersion: 1,
    },
    entries,
  };
}
