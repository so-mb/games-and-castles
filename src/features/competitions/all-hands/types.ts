import type {
  AllHandsResultMode,
  AllHandsTieHandling,
  MetricDirection,
} from "../domain/types";

export type AllHandsRunStage = "sessions" | "completion-review" | "completed";
export type AllHandsSessionStatus =
  "pending" | "in-progress" | "completed" | "voided";

export interface AllHandsMetricConfig {
  primaryLabel: string | null;
  primaryDirection: MetricDirection;
  secondaryLabel: string | null;
  secondaryDirection: MetricDirection | null;
  allowNegativeScores: boolean;
}

export type AllHandsSessionPlan =
  { kind: "fixed"; plannedSessionCount: number } | { kind: "open-ended" };

export interface AllHandsConfigSnapshot {
  format: "all-hands";
  resultMode: AllHandsResultMode;
  sessionPlan: AllHandsSessionPlan;
  allowTeams: boolean;
  teamAwardPolicy: "each-member";
  metrics: AllHandsMetricConfig;
  tieHandling: AllHandsTieHandling;
  winnerBonus: number;
  participationPoints: number;
  placementPoints: Array<{ place: number; points: number }>;
}

export interface AllHandsTeam {
  id: string;
  name: string;
  participantIds: string[];
}

export type SessionResultEntity =
  | {
      kind: "participant";
      id: string;
      participantId: string;
    }
  | {
      kind: "team";
      id: string;
      teamId: string;
      participantIds: string[];
    };

interface ResultMetadata {
  entityIndex: Record<string, true>;
  completedAt: number;
  completedByUid: string;
  resultRevision: number;
}

export interface WinnerOnlyResult extends ResultMetadata {
  kind: "winner-only";
  winnerEntityId: string;
}

export interface PlacementResultEntry {
  entityId: string;
  placement: number;
}

export interface PlacementResult extends ResultMetadata {
  kind: "placement";
  entries: PlacementResultEntry[];
}

export interface NumericResultEntry {
  entityId: string;
  primaryScore: number;
  secondaryScore: number | null;
}

export interface NumericResult extends ResultMetadata {
  kind: "numeric";
  mode: "highest-score" | "lowest-score";
  entries: NumericResultEntry[];
  manualOrderEntityIds: string[] | null;
}

export interface CustomPointEntry {
  entityId: string;
  points: number;
  note: string | null;
}

export interface CustomResult extends ResultMetadata {
  kind: "custom";
  entries: CustomPointEntry[];
}

export type AllHandsSessionResult =
  WinnerOnlyResult | PlacementResult | NumericResult | CustomResult;

export interface AllHandsSession {
  id: string;
  competitionId: string;
  title: string;
  sequence: number;
  mode: "individual" | "team";
  participantIds: string[];
  participantIndex: Record<string, true>;
  teams: Record<string, AllHandsTeam>;
  entityIds: string[];
  entityIndex: Record<string, true>;
  teamAssignments: Record<string, string>;
  status: AllHandsSessionStatus;
  result: AllHandsSessionResult | null;
  createdAt: number;
  createdByUid: string;
  startedAt: number | null;
  startedByUid: string | null;
  completedAt: number | null;
  completedByUid: string | null;
  voidedAt: number | null;
  voidedByUid: string | null;
  voidReason: string | null;
  revision: number;
  schemaVersion: 1;
}

export interface AllHandsTieResolution {
  id: string;
  participantIds: string[];
  orderedParticipantIds: string[];
  reason: string | null;
  standingsFingerprint: string;
  resolvedAt: number;
  resolvedByUid: string;
  schemaVersion: 1;
}

export interface AllHandsFinalPlacement {
  participantId: string;
  place: number;
  totalCompetitionPoints: number;
  sessionWins: number;
  secondPlaceFinishes: number;
  thirdPlaceFinishes: number;
  completionAwards: number;
}

export interface AllHandsPlacementSnapshot {
  entries: AllHandsFinalPlacement[];
  completedAt: number;
  completedByUid: string;
  runtimeRevision: number;
  schemaVersion: 1;
}

export interface AllHandsCompetitionRun {
  competitionId: string;
  format: "all-hands";
  stage: AllHandsRunStage;
  competitionRevision: number;
  eligibleParticipantIds: string[];
  eligibleParticipantIndex: Record<string, true>;
  configSnapshot: AllHandsConfigSnapshot;
  sessions: Record<string, AllHandsSession>;
  tieResolutions: Record<string, AllHandsTieResolution>;
  placements: AllHandsPlacementSnapshot | null;
  currentSessionId: string | null;
  sessionCount: number;
  resultCount: number;
  createdAt: number;
  updatedAt: number;
  activatedAt: number;
  activatedByUid: string;
  completedAt: number | null;
  completedByUid: string | null;
  revision: number;
  schemaVersion: 1;
}

export type AllHandsAwardSource =
  "winner" | "placement" | "participation" | "custom" | "team-result";

export interface DerivedSessionAward {
  id: string;
  sessionId: string;
  sessionLabel: string;
  participantId: string;
  source: AllHandsAwardSource;
  points: number;
  label: string;
}

export interface AllHandsStandingRow {
  participantId: string;
  rank: number;
  tied: boolean;
  competitionPoints: number;
  sessionsPlayed: number;
  sessionWins: number;
  secondPlaceFinishes: number;
  thirdPlaceFinishes: number;
  placementCounts: Record<string, number>;
  averagePlacement: number | null;
  participationCount: number;
  customPoints: number;
  teamSessions: number;
  remainingPlannedSessions: number | null;
}

export interface AllHandsStandings {
  rows: AllHandsStandingRow[];
  unresolvedTieGroups: string[][];
  standingsFingerprint: string;
}

export interface AllHandsPointBreakdown {
  participantId: string;
  total: number;
  items: DerivedSessionAward[];
}

export type AllHandsResultInput =
  | { kind: "winner-only"; winnerEntityId: string }
  | { kind: "placement"; entries: PlacementResultEntry[] }
  | {
      kind: "numeric";
      mode: "highest-score" | "lowest-score";
      entries: NumericResultEntry[];
      manualOrderEntityIds: string[] | null;
    }
  | { kind: "custom"; entries: CustomPointEntry[] };

export interface CreateAllHandsSessionInput {
  id: string;
  title: string;
  mode: "individual" | "team";
  participantIds: string[];
  teams: AllHandsTeam[];
  startImmediately: boolean;
  organizerUid: string;
  now: number;
}

export interface AllHandsActivationReview {
  canActivate: boolean;
  errors: string[];
  warnings: string[];
  participantCount: number;
}
