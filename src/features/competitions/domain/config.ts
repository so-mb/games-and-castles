import type {
  AllHandsConfig,
  AllHandsScoringConfig,
  CompetitionFormat,
  CompetitionFormValues,
  CompetitionIconKey,
  FormatConfig,
  HeadToHeadScoringConfig,
  RoundRobinKnockoutConfig,
  SeriesConfig,
} from "./types";

export const competitionFormats = [
  "round-robin-knockout",
  "all-hands",
  "group-knockout",
] as const satisfies readonly CompetitionFormat[];

export const competitionIconKeys = [
  "trophy",
  "route",
  "users",
  "dice",
  "controller",
  "crown",
] as const satisfies readonly CompetitionIconKey[];

export const allHandsResultModes = [
  "winner-only",
  "placement",
  "highest-score",
  "lowest-score",
  "custom",
] as const;

export const competitionLimits = {
  title: 60,
  gameName: 60,
  description: 280,
  metricLabel: 40,
  participantId: 128,
  participants: 32,
  firstTo: 10,
  score: 100,
  sessions: 50,
  groups: 8,
} as const;

export const formatPresentation = {
  "round-robin-knockout": {
    label: "Merry-Go-Round",
    description:
      "Everyone meets once before the leading players enter a knockout.",
    icon: "route",
    minimumParticipants: 2,
  },
  "all-hands": {
    label: "All Hands",
    description:
      "The whole table plays together across planned or open-ended sessions.",
    icon: "users",
    minimumParticipants: 2,
  },
  "group-knockout": {
    label: "Group Format",
    description: "Balanced groups lead into a cross-group knockout stage.",
    icon: "trophy",
    minimumParticipants: 4,
  },
} as const satisfies Record<
  CompetitionFormat,
  {
    label: string;
    description: string;
    icon: CompetitionIconKey;
    minimumParticipants: number;
  }
>;

export function bestOf(maximumRounds: 3 | 5 | 7): SeriesConfig {
  return {
    kind: "best-of",
    maximumRounds,
    winsRequired: ((maximumRounds + 1) / 2) as 2 | 3 | 4,
  };
}

export function firstTo(winsRequired: number): SeriesConfig {
  return {
    kind: "first-to",
    winsRequired,
    maximumRounds: winsRequired * 2 - 1,
  };
}

export function defaultHeadToHeadScoring(): HeadToHeadScoringConfig {
  return {
    kind: "head-to-head",
    table: {
      pointsForMatchWin: 3,
      pointsForDraw: 1,
      pointsForMatchLoss: 0,
    },
    overall: {
      matchWinBonus: 2,
      pointsPerRoundWon: 1,
      participationPoints: 0,
      qualificationBonus: 0,
      competitionWinnerBonus: 0,
      runnerUpBonus: 0,
      thirdPlaceBonus: 0,
    },
  };
}

export function defaultAllHandsScoring(): AllHandsScoringConfig {
  return {
    kind: "all-hands",
    winnerBonus: 2,
    participationPoints: 0,
    placementPoints: [
      { place: 1, points: 6 },
      { place: 2, points: 4 },
      { place: 3, points: 3 },
      { place: 4, points: 2 },
      { place: 5, points: 1 },
      { place: 6, points: 0 },
    ],
  };
}

export function defaultFormatConfig(format: CompetitionFormat): FormatConfig {
  if (format === "all-hands") {
    return {
      kind: "all-hands",
      resultMode: "placement",
      sessionPlan: { kind: "open-ended" },
      allowTeams: false,
      primaryMetricLabel: null,
      secondaryMetricLabel: null,
      tieHandling: "shared",
    } satisfies AllHandsConfig;
  }
  if (format === "group-knockout") {
    return {
      kind: "group-knockout",
      groupCountMode: "automatic",
      groupCount: 2,
      qualifiersPerGroup: 2,
      roundRobinLegs: 1,
      series: bestOf(3),
      allowDraws: false,
      includeThirdPlace: false,
    };
  }
  return {
    kind: "round-robin-knockout",
    series: bestOf(3),
    allowDraws: false,
    qualificationCount: 4,
    includeThirdPlace: false,
  } satisfies RoundRobinKnockoutConfig;
}

export function defaultScoringConfig(format: CompetitionFormat) {
  return format === "all-hands"
    ? defaultAllHandsScoring()
    : defaultHeadToHeadScoring();
}

export function createCompetitionFormValues(
  format: CompetitionFormat = "round-robin-knockout",
): CompetitionFormValues {
  return {
    title: "",
    gameName: "",
    description: "",
    iconKey: formatPresentation[format].icon,
    format,
    participantIds: [],
    formatConfig: defaultFormatConfig(format),
    scoringConfig: defaultScoringConfig(format),
  };
}
