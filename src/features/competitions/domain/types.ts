import type { ContentIcon } from "../../../types/content";

export type CompetitionFormat =
  "round-robin-knockout" | "all-hands" | "group-knockout";

export type CompetitionStatus = "draft" | "scheduled" | "archived";

export type CompetitionIconKey = Extract<
  ContentIcon,
  "trophy" | "route" | "users" | "dice" | "controller" | "crown"
>;

export type SeriesConfig =
  | { kind: "single"; winsRequired: 1; maximumRounds: 1 }
  | {
      kind: "best-of";
      maximumRounds: 3 | 5 | 7;
      winsRequired: 2 | 3 | 4;
    }
  | {
      kind: "first-to";
      winsRequired: number;
      maximumRounds: number;
    };

export interface HeadToHeadTableScoring {
  pointsForMatchWin: number;
  pointsForDraw: number;
  pointsForMatchLoss: number;
}

export interface HeadToHeadOverallScoring {
  matchWinBonus: number;
  pointsPerRoundWon: number;
  participationPoints: number;
  qualificationBonus: number;
  competitionWinnerBonus: number;
  runnerUpBonus: number;
  thirdPlaceBonus: number;
}

export interface HeadToHeadScoringConfig {
  kind: "head-to-head";
  table: HeadToHeadTableScoring;
  overall: HeadToHeadOverallScoring;
}

export interface PlacementPoints {
  place: number;
  points: number;
}

export interface AllHandsScoringConfig {
  kind: "all-hands";
  winnerBonus: number;
  participationPoints: number;
  placementPoints: PlacementPoints[];
}

export type ScoringConfig = HeadToHeadScoringConfig | AllHandsScoringConfig;

export interface RoundRobinKnockoutConfig {
  kind: "round-robin-knockout";
  series: SeriesConfig;
  allowDraws: boolean;
  qualificationCount: number;
  includeThirdPlace: boolean;
}

export type AllHandsResultMode =
  "winner-only" | "placement" | "highest-score" | "lowest-score" | "custom";

export type SessionPlan =
  { kind: "open-ended" } | { kind: "planned"; sessionCount: number };

export interface AllHandsConfig {
  kind: "all-hands";
  resultMode: AllHandsResultMode;
  sessionPlan: SessionPlan;
  allowTeams: boolean;
  primaryMetricLabel: string | null;
  secondaryMetricLabel: string | null;
  tieHandling: "shared";
}

export interface GroupKnockoutConfig {
  kind: "group-knockout";
  groupCountMode: "automatic" | "manual";
  groupCount: number;
  qualifiersPerGroup: number;
  roundRobinLegs: 1 | 2;
  series: SeriesConfig;
  allowDraws: boolean;
  includeThirdPlace: boolean;
}

export type FormatConfig =
  RoundRobinKnockoutConfig | AllHandsConfig | GroupKnockoutConfig;

export interface CompetitionFormValues {
  title: string;
  gameName: string;
  description: string;
  iconKey: CompetitionIconKey;
  format: CompetitionFormat;
  participantIds: string[];
  formatConfig: FormatConfig;
  scoringConfig: ScoringConfig;
}

export interface CompetitionBase extends CompetitionFormValues {
  id: string;
  displayOrder: number;
  createdAt: number;
  updatedAt: number;
  createdByUid: string;
  updatedByUid: string;
  revision: number;
  schemaVersion: 1;
}

export interface CompetitionDraft extends CompetitionBase {
  status: "draft";
}

export interface PublishedCompetition extends CompetitionBase {
  status: "scheduled" | "archived";
  publishedAt: number;
  publishedByUid: string;
}

export type CompetitionRecord = CompetitionDraft | PublishedCompetition;

export interface CompetitionAuditEntry {
  id: string;
  action:
    | "draft-created"
    | "draft-updated"
    | "draft-deleted"
    | "draft-duplicated"
    | "competition-published"
    | "competition-updated"
    | "competition-archived"
    | "competition-restored"
    | "competition-reordered";
  entityType: "competition";
  entityId: string;
  actorUid: string;
  beforeRevision: number | null;
  afterRevision: number | null;
  occurredAt: number;
  summary: string;
  schemaVersion: 1;
}

export interface ValidationIssue {
  field: string;
  message: string;
  severity: "error" | "warning";
}

export interface ParticipantReference {
  id: string;
  displayName: string;
  status: "active" | "inactive";
}

export interface ParticipantReferenceWarning {
  participantId: string;
  kind: "missing" | "inactive";
  message: string;
}
