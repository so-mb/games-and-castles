import type { CompetitionFormat } from "../../competitions/domain/types";
import type { Participant } from "../../participants/types";

export const championshipAwardTypes = [
  "match-win",
  "round-win",
  "match-participation",
  "session-win",
  "session-placement",
  "session-participation",
  "custom-session",
  "qualification",
  "competition-winner",
  "competition-runner-up",
  "competition-third-place",
  "prediction-correct",
] as const;

export type ChampionshipAwardType = (typeof championshipAwardTypes)[number];

export interface ChampionshipLedgerEntry {
  id: string;
  participantId: string;
  sourceNamespace: "competition";
  sourceId: string;
  sourceEntityId: string;
  sourceType: ChampionshipAwardType;
  points: number;
  label: string;
  competitionId: string;
  competitionFormat: CompetitionFormat;
  stage: string | null;
  awardedAt: number;
  sourceRevision: number;
  schemaVersion: 1;
}

export interface CompetitionLedgerSourceMeta {
  competitionId: string;
  competitionFormat: CompetitionFormat;
  competitionStatus: "active" | "completed";
  competitionTitle: string;
  runRevision: number;
  sourceFingerprint: string;
  generatedAt: number;
  generatedBy: "organizer";
  entryCount: number;
  schemaVersion: 1;
}

export interface CompetitionLedgerSnapshot {
  meta: CompetitionLedgerSourceMeta;
  entries: Record<string, ChampionshipLedgerEntry>;
}

export interface ManualChampionshipBonus {
  id: string;
  participantId: string;
  points: number;
  label: string;
  note: string | null;
  status: "active" | "revoked";
  createdAt: number;
  createdByUid: string;
  updatedAt: number;
  updatedByUid: string;
  revokedAt: number | null;
  revokedByUid: string | null;
  revision: number;
  schemaVersion: 1;
}

export interface ChampionshipAwardView {
  id: string;
  participantId: string;
  points: number;
  label: string;
  awardedAt: number;
  awardType: ChampionshipAwardType | "manual-bonus";
  sourceNamespace: "competition" | "prediction" | "manual-bonus";
  competitionId: string | null;
  competitionTitle: string | null;
  competitionFormat: CompetitionFormat | null;
  stage: string | null;
}

export interface ParticipantCompetitionContribution {
  competitionId: string;
  title: string;
  format: CompetitionFormat;
  points: number;
  awards: ChampionshipAwardView[];
}

export interface ChampionshipStanding {
  participantId: string;
  participant: Participant | null;
  displayName: string;
  rank: number;
  tied: boolean;
  totalPoints: number;
  competitionPoints: number;
  predictionPoints: number;
  bonusPoints: number;
  competitionsScored: number;
  scoredEvents: number;
  contributions: ParticipantCompetitionContribution[];
  byAwardType: Partial<Record<ChampionshipAwardType | "manual-bonus", number>>;
  awards: ChampionshipAwardView[];
  recentAwards: ChampionshipAwardView[];
  isMissingParticipant: boolean;
}

export interface ChampionshipAchievement {
  id: string;
  title: string;
  criterion: string;
  participantIds: string[];
  value: number;
}

export type ReconciliationStatus =
  | "in-sync"
  | "missing"
  | "stale"
  | "orphaned"
  | "malformed-run"
  | "malformed-source"
  | "unsupported"
  | "not-expected";

export interface ReconciliationItem {
  competitionId: string;
  competitionTitle: string;
  status: ReconciliationStatus;
  expected: CompetitionLedgerSnapshot | null;
  persisted: CompetitionLedgerSnapshot | null;
  entryDelta: number;
  warning: string | null;
}
