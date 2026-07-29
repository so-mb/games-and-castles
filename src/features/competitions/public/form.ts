export type RecentFormResult = "win" | "draw" | "loss";

export interface FormMatch {
  globalSequence: number;
  participantAId: string | null;
  participantBId: string | null;
  isBye: boolean;
  status: string;
  result: {
    winnerId: string | null;
    isDraw: boolean;
  } | null;
}

export function deriveParticipantForm(
  matches: FormMatch[],
  participantId: string,
  limit = 5,
): RecentFormResult[] {
  if (limit <= 0) return [];

  return matches
    .filter(
      (match) =>
        !match.isBye &&
        match.status === "completed" &&
        match.result &&
        (match.participantAId === participantId ||
          match.participantBId === participantId),
    )
    .sort((left, right) => left.globalSequence - right.globalSequence)
    .slice(-limit)
    .map((match) => {
      if (match.result!.isDraw) return "draw";
      return match.result!.winnerId === participantId ? "win" : "loss";
    });
}
