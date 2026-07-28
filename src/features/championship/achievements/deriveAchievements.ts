import type {
  ChampionshipAchievement,
  ChampionshipStanding,
} from "../domain/types";

function maximumAchievement(
  standings: ChampionshipStanding[],
  input: {
    id: string;
    title: string;
    criterion: string;
    value: (standing: ChampionshipStanding) => number;
  },
): ChampionshipAchievement | null {
  const values = standings.map((standing) => ({
    participantId: standing.participantId,
    value: input.value(standing),
  }));
  const maximum = Math.max(0, ...values.map((item) => item.value));
  if (maximum <= 0) return null;
  return {
    id: input.id,
    title: input.title,
    criterion: input.criterion,
    participantIds: values
      .filter((item) => item.value === maximum)
      .map((item) => item.participantId),
    value: maximum,
  };
}

export function deriveChampionshipAchievements(
  standings: ChampionshipStanding[],
) {
  const definitions = [
    {
      id: "prediction-master",
      title: "Prediction Master",
      criterion: "Most correct prediction awards",
      value: (row: ChampionshipStanding) =>
        row.byAwardType["prediction-correct"] ?? 0,
    },
    {
      id: "round-warrior",
      title: "Round Warrior",
      criterion: "Most points earned from individual round wins",
      value: (row: ChampionshipStanding) => row.byAwardType["round-win"] ?? 0,
    },
    {
      id: "match-master",
      title: "Match Master",
      criterion: "Most points earned from head-to-head match wins",
      value: (row: ChampionshipStanding) => row.byAwardType["match-win"] ?? 0,
    },
    {
      id: "table-star",
      title: "Table Star",
      criterion: "Most points earned from All Hands wins and placements",
      value: (row: ChampionshipStanding) =>
        (row.byAwardType["session-win"] ?? 0) +
        (row.byAwardType["session-placement"] ?? 0),
    },
    {
      id: "podium-regular",
      title: "Podium Regular",
      criterion: "Most points earned from competition podium finishes",
      value: (row: ChampionshipStanding) =>
        (row.byAwardType["competition-winner"] ?? 0) +
        (row.byAwardType["competition-runner-up"] ?? 0) +
        (row.byAwardType["competition-third-place"] ?? 0),
    },
    {
      id: "versatile-player",
      title: "Versatile Player",
      criterion: "Earned points in the most competitions",
      value: (row: ChampionshipStanding) => row.competitionsScored,
    },
    {
      id: "bonus-hunter",
      title: "Bonus Hunter",
      criterion: "Most manual bonus points",
      value: (row: ChampionshipStanding) => row.bonusPoints,
    },
  ];
  return definitions.flatMap((definition) => {
    const achievement = maximumAchievement(standings, definition);
    return achievement ? [achievement] : [];
  });
}
