import type {
  CompetitionPointBreakdown,
  CompetitionPointItem,
} from "../engine/types";
import type { GroupKnockoutRun } from "./types";

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

export function deriveGroupPointBreakdown(run: GroupKnockoutRun) {
  const items: CompetitionPointItem[] = [];
  const scoring = run.configSnapshot.overallScoring;
  Object.values(run.matches).forEach((match) => {
    if (!match.result || match.isBye || match.status !== "completed") return;
    [match.participantAId, match.participantBId]
      .filter(Boolean)
      .forEach((participantId) => {
        addItem(
          items,
          participantId!,
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
      match.stage === "group-stage"
        ? "Group-stage match win"
        : "Knockout match win",
      scoring.matchWinBonus,
      match.id,
    );
    const roundWins = new Map<string, number>();
    match.result.roundWinnerIds.forEach((participantId) => {
      roundWins.set(participantId, (roundWins.get(participantId) ?? 0) + 1);
    });
    roundWins.forEach((count, participantId) => {
      addItem(
        items,
        participantId,
        "round-win",
        `${count} individual round${count === 1 ? "" : "s"} won`,
        count * scoring.pointsPerRoundWon,
        match.id,
      );
    });
  });
  run.qualification?.entries.forEach((entry) => {
    addItem(
      items,
      entry.participantId,
      "qualification",
      `Qualified from ${run.groups.find((group) => group.id === entry.groupId)?.label ?? "group"}`,
      scoring.qualificationBonus,
      null,
    );
  });
  run.placements?.entries.forEach((placement) => {
    if (placement.place === 1) {
      addItem(
        items,
        placement.participantId,
        "competition-winner",
        "Group Format winner",
        scoring.competitionWinnerBonus,
        null,
      );
    } else if (placement.place === 2) {
      addItem(
        items,
        placement.participantId,
        "runner-up",
        "Group Format runner-up",
        scoring.runnerUpBonus,
        null,
      );
    } else if (placement.place === 3) {
      addItem(
        items,
        placement.participantId,
        "third-place",
        "Group Format third place",
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
