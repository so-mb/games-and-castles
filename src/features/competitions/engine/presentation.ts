import type { SeriesConfig } from "../domain/types";
import type { CompetitionMatch, CompetitionRun } from "./types";

export function seriesLabel(series: SeriesConfig) {
  if (series.kind === "single") return "Single round";
  if (series.kind === "best-of") return `Best of ${series.maximumRounds}`;
  return `First to ${series.winsRequired}`;
}

export function runStageLabel(stage: CompetitionRun["stage"]) {
  if (stage === "round-robin") return "Round robin";
  if (stage === "qualification-review") return "Qualification review";
  if (stage === "knockout") return "Knockout";
  return "Completed";
}

export function matchStatusLabel(match: CompetitionMatch) {
  if (match.isBye) return "Bye advanced";
  if (match.status === "in-progress") return "Now playing";
  if (match.status === "completed") return "Result recorded";
  if (!match.participantAId || !match.participantBId)
    return "Waiting for qualifier";
  return match.status === "ready" ? "Up next" : "Pending";
}

export function matchScore(match: CompetitionMatch) {
  return match.result
    ? `${match.result.participantAWins}–${match.result.participantBWins}`
    : "—";
}

export function runProgress(run: CompetitionRun) {
  const playable = Object.values(run.matches).filter((match) => !match.isBye);
  const completed = playable.filter((match) => match.result).length;
  return {
    completed,
    total: playable.length,
    percentage:
      playable.length === 0
        ? 0
        : Math.round((completed / playable.length) * 100),
  };
}
