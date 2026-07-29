export type SurfaceTone = "light" | "dark" | "cream" | "locked";
export type BadgeTone =
  "neutral" | "live" | "gold" | "success" | "warning" | "red";

export type ContentIcon =
  | "arcade"
  | "board"
  | "cat"
  | "cards"
  | "cake"
  | "camera"
  | "castle"
  | "coffee"
  | "compass"
  | "controller"
  | "crown"
  | "dice"
  | "film"
  | "food"
  | "gamepad"
  | "gem"
  | "ghost"
  | "key"
  | "luggage"
  | "map"
  | "moon"
  | "puzzle"
  | "robot"
  | "rocket"
  | "route"
  | "shield"
  | "sparkles"
  | "swords"
  | "ticket"
  | "train"
  | "trophy"
  | "users";

export interface NavigationItem {
  id: string;
  label: string;
  shortLabel: string;
  icon: ContentIcon;
}

export interface TripMetadata {
  productName: string;
  dateRange: string;
  context: string;
  tagline: string;
  birthdayNote: string;
  publicAccommodationArea: string;
}

export interface SundayDepartureGroup {
  id: string;
  label: string;
  time: string;
}

export interface SundayDeparturePlan {
  date: string;
  location: string;
  groups: SundayDepartureGroup[];
}

export interface WeekendDay {
  id: "friday" | "saturday" | "sunday";
  eyebrow: string;
  date: string;
  title: string;
  summary: string;
  detail: string;
  icon: ContentIcon;
  tone: "game" | "quest" | "departure";
  items: string[];
  status: string;
  actionTarget?: string;
}

export interface GameNightActivity {
  id: string;
  label: string;
  icon: ContentIcon;
}

export interface ItineraryTag {
  id: string;
  label: string;
  tone: BadgeTone;
  icon?: ContentIcon;
}

export interface ItineraryItem {
  id: string;
  time: string;
  title: string;
  summary: string;
  details: string[];
  tags: ItineraryTag[];
  icon: ContentIcon;
  variant: "arrival" | "attraction" | "travel" | "booking" | "flexible";
}

export type CompetitionFormat =
  "round-robin-knockout" | "all-hands" | "group-knockout";

export interface CompetitionPreview {
  id: CompetitionFormat;
  label: string;
  description: string;
  structure: string;
  icon: ContentIcon;
}

export interface LeaderboardEntry {
  id: string;
  rank: number;
  displayName: string;
  initials: string;
  points: number;
  note: string;
  accent: "cyan" | "gold" | "red" | "neutral";
}

export interface RecentPointPreview {
  id: string;
  displayName: string;
  reason: string;
  points: number;
  timeLabel: string;
}

export interface ActiveMatchPreview {
  competitionLabel: string;
  roundLabel: string;
  participantA: Pick<LeaderboardEntry, "displayName" | "initials">;
  participantB: Pick<LeaderboardEntry, "displayName" | "initials">;
  scoreA: number;
  scoreB: number;
}

export interface LockedDisplayState {
  id: "birthday-vault" | "special-reveal";
  eyebrow: string;
  title: string;
  description: string;
  status: string;
  phaseNote: string;
  countLabel?: string;
  icon: ContentIcon;
}

export interface PublicTripInfoItem {
  id: string;
  label: string;
  value: string;
  note: string;
  icon: ContentIcon;
}
