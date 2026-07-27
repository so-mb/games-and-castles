import type {
  HeadToHeadOverallScoring,
  HeadToHeadTableScoring,
  ParticipantReference,
  RoundRobinKnockoutConfig,
  SeriesConfig,
} from "../domain/types";
import type { AllHandsCompetitionRun } from "../all-hands/types";
import type { GroupKnockoutRun } from "../group-knockout/types";

export type CompetitionRunStage =
  "round-robin" | "qualification-review" | "knockout" | "completed";

export type MatchStage =
  "round-robin" | "group-stage" | "knockout" | "third-place";
export type MatchStatus = "pending" | "ready" | "in-progress" | "completed";

export interface MatchSource {
  matchId: string;
  outcome: "winner" | "loser";
}

export interface MatchResult {
  roundWinnerIds: string[];
  participantAWins: number;
  participantBWins: number;
  winnerId: string;
  isDraw: false;
  completedAt: number;
  completedByUid: string;
  resultRevision: number;
}

export interface CompetitionMatch {
  id: string;
  competitionId: string;
  stage: MatchStage;
  fixtureRound: number | null;
  sequenceInRound: number;
  bracketRound: number | null;
  bracketSlot: number | null;
  globalSequence: number;
  participantAId: string | null;
  participantBId: string | null;
  sourceA?: MatchSource;
  sourceB?: MatchSource;
  seedA?: number;
  seedB?: number;
  isBye: boolean;
  status: MatchStatus;
  result: MatchResult | null;
  revision: number;
  schemaVersion: 1;
}

export interface RoundRobinRound {
  number: number;
  matchIds: string[];
  byeParticipantId: string | null;
}

export interface RoundRobinRuntime {
  fixtureRoundCount: number;
  expectedMatchCount: number;
  rounds: RoundRobinRound[];
}

export interface RoundRobinCompetitionConfigSnapshot {
  format: "round-robin-knockout";
  series: SeriesConfig;
  allowDraws: false;
  qualificationCount: number;
  includeThirdPlace: boolean;
  tableScoring: HeadToHeadTableScoring;
  overallScoring: HeadToHeadOverallScoring;
}

export interface TieResolution {
  id: string;
  participantIds: string[];
  orderedParticipantIds: string[];
  reason: string;
  resultFingerprint: string;
  resolvedAt: number;
  resolvedByUid: string;
  schemaVersion: 1;
}

export interface KnockoutRound {
  number: number;
  label: string;
  matchIds: string[];
}

export interface KnockoutRuntime {
  qualificationParticipantIds: string[];
  seedOrder: string[];
  bracketSize: number;
  rounds: KnockoutRound[];
  thirdPlaceMatchId: string | null;
  sourceResultFingerprint: string;
  generatedAt: number;
  generatedByUid: string;
  generationVersion: 1;
}

export interface Placement {
  participantId: string;
  place: number | null;
  placementBand: string;
  eliminationStage: string;
}

export interface PlacementSnapshot {
  entries: Placement[];
  completedAt: number;
  completedByUid: string;
  runtimeRevision: number;
  schemaVersion: 1;
}

export interface CompetitionRun {
  competitionId: string;
  format: "round-robin-knockout";
  stage: CompetitionRunStage;
  competitionRevision: number;
  participantIds: string[];
  participantIndex: Record<string, true>;
  randomizedParticipantIds: string[];
  randomizedPositions: Record<string, number>;
  configSnapshot: RoundRobinCompetitionConfigSnapshot;
  roundRobin: RoundRobinRuntime;
  matches: Record<string, CompetitionMatch>;
  tieResolutions: Record<string, TieResolution>;
  knockout: KnockoutRuntime | null;
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

export type AnyCompetitionRun =
  CompetitionRun | AllHandsCompetitionRun | GroupKnockoutRun;

export interface FixtureGeneration {
  rounds: RoundRobinRound[];
  matches: CompetitionMatch[];
}

export interface StandingRow {
  participantId: string;
  rank: number;
  tied: boolean;
  decidedBy:
    | "table-points"
    | "head-to-head"
    | "round-differential"
    | "rounds-won"
    | "match-wins"
    | "organizer-decision"
    | "unresolved";
  played: number;
  matchWins: number;
  matchDraws: number;
  matchLosses: number;
  tablePoints: number;
  roundsWon: number;
  roundsLost: number;
  roundDifferential: number;
  remainingMatches: number;
}

export interface StandingResult {
  rows: StandingRow[];
  unresolvedTieGroups: string[][];
  resultFingerprint: string;
  roundRobinComplete: boolean;
}

export type PointReason =
  | "match-win"
  | "round-win"
  | "participation"
  | "qualification"
  | "competition-winner"
  | "runner-up"
  | "third-place";

export interface CompetitionPointItem {
  id: string;
  participantId: string;
  sourceMatchId: string | null;
  reason: PointReason;
  label: string;
  points: number;
}

export interface CompetitionPointBreakdown {
  participantId: string;
  total: number;
  items: CompetitionPointItem[];
}

export interface ActivationReview {
  canActivate: boolean;
  errors: string[];
  warnings: string[];
  participantCount: number;
  expectedMatchCount: number;
  expectedFixtureRounds: number;
  bracketSize: number;
  knockoutMatchCount: number;
}

export interface ParticipantLookup {
  get(participantId: string): ParticipantReference | undefined;
}

export interface ActivationInput {
  competitionId: string;
  competitionRevision: number;
  participantIds: string[];
  formatConfig: RoundRobinKnockoutConfig;
  tableScoring: HeadToHeadTableScoring;
  overallScoring: HeadToHeadOverallScoring;
  activatedAt: number;
  activatedByUid: string;
}

export type RandomIntegerSource = (maximumExclusive: number) => number;
