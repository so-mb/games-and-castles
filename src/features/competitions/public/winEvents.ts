import { numericPlacements, sessionEntities } from "../all-hands/engine";
import type {
  AllHandsConfigSnapshot,
  AllHandsSession,
} from "../all-hands/types";
import type { AnyCompetitionRun } from "../engine/types";

export interface WinEvent {
  id: string;
  runId: string;
  participantIds: string[];
  completedAt: number;
  kind: "match" | "session";
}

export function winningAllHandsParticipantIds(
  session: AllHandsSession,
  config: AllHandsConfigSnapshot,
) {
  if (session.status !== "completed" || !session.result) return [];

  const placements =
    session.result.kind === "winner-only"
      ? [{ entityId: session.result.winnerEntityId, placement: 1 }]
      : session.result.kind === "placement"
        ? session.result.entries
        : session.result.kind === "numeric"
          ? numericPlacements(session.result, config)
          : [];
  const winnerEntityIds = new Set(
    placements
      .filter((entry) => entry.placement === 1)
      .map((entry) => entry.entityId),
  );

  return sessionEntities(session).flatMap((entity) => {
    if (!winnerEntityIds.has(entity.id)) return [];
    return entity.kind === "participant"
      ? [entity.participantId]
      : entity.participantIds;
  });
}

export function deriveWinEvents(runs: AnyCompetitionRun[]): WinEvent[] {
  const events = runs.flatMap((run): WinEvent[] => {
    if (run.format === "all-hands") {
      return Object.values(run.sessions).flatMap((session) => {
        const participantIds = winningAllHandsParticipantIds(
          session,
          run.configSnapshot,
        );
        if (!session.result || participantIds.length === 0) return [];
        return [
          {
            id: `${run.competitionId}:session:${session.id}`,
            runId: run.competitionId,
            participantIds,
            completedAt: session.result.completedAt,
            kind: "session" as const,
          },
        ];
      });
    }

    return Object.values(run.matches).flatMap((match) => {
      if (match.isBye || match.status !== "completed" || !match.result)
        return [];
      return [
        {
          id: `${run.competitionId}:match:${match.id}`,
          runId: run.competitionId,
          participantIds: [match.result.winnerId],
          completedAt: match.result.completedAt,
          kind: "match" as const,
        },
      ];
    });
  });

  return events.sort(
    (left, right) =>
      left.completedAt - right.completedAt || left.id.localeCompare(right.id),
  );
}
