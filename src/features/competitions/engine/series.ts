import type { SeriesConfig } from "../domain/types";
import type { CompetitionMatch, MatchResult } from "./types";

export interface SeriesProgress {
  participantAWins: number;
  participantBWins: number;
  winsRequired: number;
  complete: boolean;
  winnerId: string | null;
  roundsRemaining: number;
}

export function deriveSeriesProgress(
  match: Pick<CompetitionMatch, "participantAId" | "participantBId">,
  series: SeriesConfig,
  roundWinnerIds: string[],
): SeriesProgress {
  const { participantAId, participantBId } = match;
  if (!participantAId || !participantBId) {
    throw new Error("Both match participants must be known.");
  }
  let participantAWins = 0;
  let participantBWins = 0;
  let clinched = false;
  roundWinnerIds.forEach((winnerId) => {
    if (clinched) {
      throw new Error("No rounds may be recorded after the series is won.");
    }
    if (winnerId === participantAId) participantAWins += 1;
    else if (winnerId === participantBId) participantBWins += 1;
    else throw new Error("A round winner must be a participant in the match.");
    clinched =
      participantAWins === series.winsRequired ||
      participantBWins === series.winsRequired;
  });
  if (roundWinnerIds.length > series.maximumRounds) {
    throw new Error("Too many rounds were recorded for this series.");
  }
  const winnerId =
    participantAWins === series.winsRequired
      ? participantAId
      : participantBWins === series.winsRequired
        ? participantBId
        : null;
  return {
    participantAWins,
    participantBWins,
    winsRequired: series.winsRequired,
    complete: winnerId !== null,
    winnerId,
    roundsRemaining: series.maximumRounds - roundWinnerIds.length,
  };
}

export function appendRoundWinner(
  match: Pick<CompetitionMatch, "participantAId" | "participantBId">,
  series: SeriesConfig,
  roundWinnerIds: string[],
  winnerId: string,
) {
  deriveSeriesProgress(match, series, roundWinnerIds);
  const next = [...roundWinnerIds, winnerId];
  deriveSeriesProgress(match, series, next);
  return next;
}

export function undoLastRound(roundWinnerIds: string[]) {
  return roundWinnerIds.slice(0, -1);
}

export function createMatchResult(
  match: Pick<CompetitionMatch, "participantAId" | "participantBId">,
  series: SeriesConfig,
  roundWinnerIds: string[],
  completedByUid: string,
  completedAt: number,
  resultRevision: number,
): MatchResult {
  const progress = deriveSeriesProgress(match, series, roundWinnerIds);
  if (!progress.complete || !progress.winnerId) {
    throw new Error("Complete the series before confirming the result.");
  }
  return {
    roundWinnerIds: [...roundWinnerIds],
    participantAWins: progress.participantAWins,
    participantBWins: progress.participantBWins,
    winnerId: progress.winnerId,
    isDraw: false,
    completedAt,
    completedByUid,
    resultRevision,
  };
}

export function validateMatchResult(
  match: Pick<CompetitionMatch, "participantAId" | "participantBId">,
  series: SeriesConfig,
  result: MatchResult,
) {
  try {
    const progress = deriveSeriesProgress(match, series, result.roundWinnerIds);
    return (
      result.isDraw === false &&
      progress.complete &&
      progress.winnerId === result.winnerId &&
      progress.participantAWins === result.participantAWins &&
      progress.participantBWins === result.participantBWins &&
      Number.isInteger(result.resultRevision) &&
      result.resultRevision >= 1 &&
      Number.isFinite(result.completedAt) &&
      result.completedAt >= 0 &&
      Boolean(result.completedByUid)
    );
  } catch {
    return false;
  }
}
