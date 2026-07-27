import type {
  HeadToHeadOverallScoring,
  HeadToHeadTableScoring,
  SeriesConfig,
} from "../domain/types";
import type {
  CompetitionMatch,
  CompetitionPointBreakdown,
  KnockoutRuntime,
  PlacementSnapshot,
  StandingRow,
} from "../engine/types";

export type GroupRunStage =
  "group-stage" | "qualification-review" | "knockout" | "completed";

export interface GroupCompetitionConfigSnapshot {
  format: "group-knockout";
  groupCountMode: "automatic" | "manual";
  resolvedGroupCount: number;
  qualifiersPerGroup: number;
  roundRobinLegs: 1 | 2;
  series: SeriesConfig;
  allowDraws: false;
  includeThirdPlace: boolean;
  tableScoring: HeadToHeadTableScoring;
  overallScoring: HeadToHeadOverallScoring;
  expectedGroupMatchCount: number;
  drawVersion: 1;
  fixtureGenerationVersion: 1;
  seedingVersion: 1;
}

export interface DrawAssignment {
  participantId: string;
  shuffledPosition: number;
  groupId: string;
  positionInGroup: number;
}

export interface GroupDrawSnapshot {
  shuffledParticipantIds: string[];
  shuffledPositions: Record<string, number>;
  assignments: DrawAssignment[];
  generatedAt: number;
  drawVersion: 1;
}

export interface CompetitionGroup {
  id: string;
  label: string;
  participantIds: string[];
}

export interface GroupStageMatch extends CompetitionMatch {
  stage: "group-stage";
  groupId: string;
  leg: 1 | 2;
}

export type GroupCompetitionMatch =
  | GroupStageMatch
  | (Omit<CompetitionMatch, "stage"> & {
      stage: "knockout" | "third-place";
    });

export interface GroupTieResolution {
  id: string;
  groupId: string;
  participantIds: string[];
  orderedParticipantIds: string[];
  reason: string;
  standingsFingerprint: string;
  resolvedAt: number;
  resolvedByUid: string;
  schemaVersion: 1;
}

export interface GroupStandingResult {
  groupId: string;
  rows: StandingRow[];
  unresolvedTieGroups: string[][];
  standingsFingerprint: string;
  complete: boolean;
}

export interface QualifiedParticipantSnapshot {
  participantId: string;
  groupId: string;
  groupRank: number;
  played: number;
  matchWins: number;
  tablePoints: number;
  roundsWon: number;
  roundsLost: number;
  roundDifferential: number;
}

export interface QualificationSnapshot {
  entries: QualifiedParticipantSnapshot[];
  byGroup: Record<string, string[]>;
  standingsFingerprints: Record<string, string>;
  qualificationFingerprint: string;
  confirmedAt: number;
  confirmedByUid: string;
  runtimeRevision: number;
  schemaVersion: 1;
}

export interface CrossGroupSeedResolution {
  id: string;
  groupRank: number;
  participantIds: string[];
  orderedParticipantIds: string[];
  reason: string;
  qualificationFingerprint: string;
  resolvedAt: number;
  resolvedByUid: string;
  schemaVersion: 1;
}

export interface CrossGroupSeedResult {
  seedOrder: string[];
  unresolvedTieGroups: Array<{
    groupRank: number;
    participantIds: string[];
  }>;
}

export interface GroupKnockoutRuntime extends KnockoutRuntime {
  qualificationFingerprint: string;
  sameGroupRematchWarning: string | null;
}

export interface GroupKnockoutRun {
  competitionId: string;
  format: "group-knockout";
  stage: GroupRunStage;
  competitionRevision: number;
  participantIds: string[];
  participantIndex: Record<string, true>;
  configSnapshot: GroupCompetitionConfigSnapshot;
  draw: GroupDrawSnapshot;
  groups: CompetitionGroup[];
  matches: Record<string, GroupCompetitionMatch>;
  tieResolutions: Record<string, GroupTieResolution>;
  qualification: QualificationSnapshot | null;
  seedResolutions: Record<string, CrossGroupSeedResolution>;
  knockout: GroupKnockoutRuntime | null;
  placements: PlacementSnapshot | null;
  currentMatchId: string | null;
  resultCount: number;
  generationVersion: 1;
  createdAt: number;
  updatedAt: number;
  activatedAt: number;
  activatedByUid: string;
  completedAt: number | null;
  completedByUid: string | null;
  revision: number;
  schemaVersion: 1;
}

export interface GroupActivationReview {
  canActivate: boolean;
  errors: string[];
  warnings: string[];
  resolvedGroupCount: number;
  groupSizes: number[];
  expectedGroupMatchCount: number;
  qualifierCount: number;
  bracketSize: number;
}

export interface GroupDrawPreview {
  run: GroupKnockoutRun;
  review: GroupActivationReview;
}

export type GroupPointBreakdown = CompetitionPointBreakdown;
