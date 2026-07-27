import type { Participant } from "../../participants/types";
import type {
  ChampionshipAwardView,
  ChampionshipStanding,
  CompetitionLedgerSnapshot,
  ManualChampionshipBonus,
} from "./types";

export function deriveChampionshipLeaderboard(input: {
  sources: CompetitionLedgerSnapshot[];
  bonuses: ManualChampionshipBonus[];
  participants: Participant[];
}): ChampionshipStanding[] {
  const participantMap = new Map(
    input.participants.map((participant) => [participant.id, participant]),
  );
  const awards: ChampionshipAwardView[] = input.sources.flatMap((source) =>
    Object.values(source.entries).map((entry) => ({
      id: entry.id,
      participantId: entry.participantId,
      points: entry.points,
      label: entry.label,
      awardedAt: entry.awardedAt,
      awardType: entry.sourceType,
      competitionId: entry.competitionId,
      competitionTitle: source.meta.competitionTitle,
      competitionFormat: entry.competitionFormat,
      stage: entry.stage,
    })),
  );
  input.bonuses
    .filter((bonus) => bonus.status === "active")
    .forEach((bonus) =>
      awards.push({
        id: bonus.id,
        participantId: bonus.participantId,
        points: bonus.points,
        label: bonus.label,
        awardedAt: bonus.createdAt,
        awardType: "manual-bonus",
        competitionId: null,
        competitionTitle: null,
        competitionFormat: null,
        stage: null,
      }),
    );
  const ids = new Set([
    ...input.participants
      .filter((participant) => participant.status === "active")
      .map((participant) => participant.id),
    ...awards.map((award) => award.participantId),
  ]);
  const rows = [...ids].map<ChampionshipStanding>((participantId) => {
    const participant = participantMap.get(participantId) ?? null;
    const participantAwards = awards.filter(
      (award) => award.participantId === participantId,
    );
    const competitionAwards = participantAwards.filter(
      (award) => award.competitionId,
    );
    const bonusAwards = participantAwards.filter(
      (award) => award.awardType === "manual-bonus",
    );
    const contributionMap = new Map<string, ChampionshipAwardView[]>();
    competitionAwards.forEach((award) => {
      const id = award.competitionId!;
      contributionMap.set(id, [...(contributionMap.get(id) ?? []), award]);
    });
    const contributions = [...contributionMap.entries()].map(
      ([competitionId, items]) => ({
        competitionId,
        title: items[0]!.competitionTitle!,
        format: items[0]!.competitionFormat!,
        points: items.reduce((sum, item) => sum + item.points, 0),
        awards: items.sort(
          (left, right) =>
            right.awardedAt - left.awardedAt || left.id.localeCompare(right.id),
        ),
      }),
    );
    const byAwardType: ChampionshipStanding["byAwardType"] = {};
    participantAwards.forEach((award) => {
      byAwardType[award.awardType] =
        (byAwardType[award.awardType] ?? 0) + award.points;
    });
    const competitionPoints = competitionAwards.reduce(
      (sum, award) => sum + award.points,
      0,
    );
    const bonusPoints = bonusAwards.reduce(
      (sum, award) => sum + award.points,
      0,
    );
    return {
      participantId,
      participant,
      displayName: participant?.displayName ?? "Unavailable participant",
      rank: 0,
      tied: false,
      totalPoints: competitionPoints + bonusPoints,
      competitionPoints,
      bonusPoints,
      competitionsScored: contributions.length,
      scoredEvents: participantAwards.length,
      contributions: contributions.sort(
        (left, right) => right.points - left.points,
      ),
      byAwardType,
      awards: participantAwards.sort(
        (left, right) =>
          right.awardedAt - left.awardedAt || left.id.localeCompare(right.id),
      ),
      recentAwards: participantAwards.slice(0, 12),
      isMissingParticipant: !participant,
    };
  });
  rows.sort(
    (left, right) =>
      right.totalPoints - left.totalPoints ||
      left.displayName.localeCompare(right.displayName) ||
      left.participantId.localeCompare(right.participantId),
  );
  rows.forEach((row, index) => {
    const previous = rows[index - 1];
    row.rank =
      previous?.totalPoints === row.totalPoints ? previous.rank : index + 1;
    row.tied = rows.some(
      (candidate) =>
        candidate.participantId !== row.participantId &&
        candidate.totalPoints === row.totalPoints,
    );
  });
  return rows;
}
