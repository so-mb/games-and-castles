import type {
  ActiveMatchPreview,
  CompetitionPreview,
  LeaderboardEntry,
  RecentPointPreview,
} from "../types/content";

export const competitionPreviews: CompetitionPreview[] = [
  {
    id: "round-robin-knockout",
    label: "Merry-Go-Round",
    description: "Everyone meets before the top contenders enter the bracket.",
    structure: "Round robin → knockout",
    icon: "route",
  },
  {
    id: "all-hands",
    label: "All Hands",
    description: "The whole table plays together across one or more sessions.",
    structure: "Shared sessions",
    icon: "users",
  },
  {
    id: "group-knockout",
    label: "Group Format",
    description: "Balanced groups lead into a cross-group final bracket.",
    structure: "Groups → knockout",
    icon: "trophy",
  },
];

export const mockLeaderboard: LeaderboardEntry[] = [
  {
    id: "preview-player-a",
    rank: 1,
    displayName: "Player A",
    initials: "PA",
    points: 14,
    note: "Sample leader",
    accent: "gold",
  },
  {
    id: "preview-player-b",
    rank: 2,
    displayName: "Player B",
    initials: "PB",
    points: 11,
    note: "Sample standing",
    accent: "cyan",
  },
  {
    id: "preview-player-c",
    rank: 3,
    displayName: "Player C",
    initials: "PC",
    points: 8,
    note: "Sample standing",
    accent: "red",
  },
  {
    id: "preview-player-d",
    rank: 4,
    displayName: "Player D",
    initials: "PD",
    points: 6,
    note: "Sample standing",
    accent: "neutral",
  },
];

export const mockActiveMatch: ActiveMatchPreview = {
  competitionLabel: "Merry-Go-Round · sample match",
  roundLabel: "Best of 3 · presentation preview",
  participantA: { displayName: "Player A", initials: "PA" },
  participantB: { displayName: "Player B", initials: "PB" },
  scoreA: 2,
  scoreB: 1,
};

export const mockRecentPoints: RecentPointPreview[] = [
  {
    id: "sample-points-1",
    displayName: "Player A",
    reason: "Sample match win",
    points: 2,
    timeLabel: "Preview",
  },
  {
    id: "sample-points-2",
    displayName: "Player B",
    reason: "Sample round win",
    points: 1,
    timeLabel: "Preview",
  },
  {
    id: "sample-points-3",
    displayName: "Player C",
    reason: "Sample placement",
    points: 3,
    timeLabel: "Preview",
  },
];
