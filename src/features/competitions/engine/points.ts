import type {
  CompetitionMatch,
  CompetitionPointBreakdown,
  CompetitionPointItem,
  CompetitionRun,
} from "./types";

function addItem(
  items: CompetitionPointItem[],
  participantId: string,
  reason: CompetitionPointItem["reason"],
  label: string,
  points: number,
  sourceMatchId: string | null,
) {
  if (points === 0) return;
  items.push({
    id: `${reason}:${sourceMatchId ?? "competition"}:${participantId}`,
    participantId,
    sourceMatchId,
    reason,
    label,
    points,
  });
}

function addMatchPoints(
  items: CompetitionPointItem[],
  match: CompetitionMatch,
  run: CompetitionRun,
) {
  if (!match.result || match.isBye || match.status !== "completed") return;
  const scoring = run.configSnapshot.overallScoring;
  const participants = [match.participantAId, match.participantBId].filter(
    Boolean,
  ) as string[];
  participants.forEach((participantId) => {
    addItem(
      items,
      participantId,
      "participation",
      "Completed-match participation",
      scoring.participationPoints,
      match.id,
    );
  });
  addItem(
    items,
    match.result.winnerId,
    "match-win",
    "Match win",
    scoring.matchWinBonus,
    match.id,
  );
  const roundCounts = new Map<string, number>();
  match.result.roundWinnerIds.forEach((participantId) => {
    roundCounts.set(participantId, (roundCounts.get(participantId) ?? 0) + 1);
  });
  roundCounts.forEach((roundsWon, participantId) => {
    addItem(
      items,
      participantId,
      "round-win",
      `${roundsWon} individual round${roundsWon === 1 ? "" : "s"} won`,
      roundsWon * scoring.pointsPerRoundWon,
      match.id,
    );
  });
}

export function deriveCompetitionPointBreakdown(run: CompetitionRun) {
  const items: CompetitionPointItem[] = [];
  Object.values(run.matches).forEach((match) =>
    addMatchPoints(items, match, run),
  );
  const scoring = run.configSnapshot.overallScoring;
  run.knockout?.qualificationParticipantIds.forEach((participantId) => {
    addItem(
      items,
      participantId,
      "qualification",
      "Qualified for the knockout",
      scoring.qualificationBonus,
      null,
    );
  });
  const placements = run.placements?.entries ?? [];
  placements.forEach((placement) => {
    if (placement.place === 1) {
      addItem(
        items,
        placement.participantId,
        "competition-winner",
        "Competition winner",
        scoring.competitionWinnerBonus,
        null,
      );
    } else if (placement.place === 2) {
      addItem(
        items,
        placement.participantId,
        "runner-up",
        "Competition runner-up",
        scoring.runnerUpBonus,
        null,
      );
    } else if (placement.place === 3) {
      addItem(
        items,
        placement.participantId,
        "third-place",
        "Competition third place",
        scoring.thirdPlaceBonus,
        null,
      );
    }
  });

  return run.participantIds.map<CompetitionPointBreakdown>((participantId) => {
    const participantItems = items.filter(
      (item) => item.participantId === participantId,
    );
    return {
      participantId,
      total: participantItems.reduce((total, item) => total + item.points, 0),
      items: participantItems,
    };
  });
}
