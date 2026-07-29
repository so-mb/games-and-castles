import { useEffect, useRef, useState } from "react";
import type { AnyCompetitionRun } from "../engine/types";
import { deriveWinEvents, type WinEvent } from "./winEvents";

export const WIN_CELEBRATION_DURATION_MS = 2_600;

export function useWinCelebration(runs: AnyCompetitionRun[], ready: boolean) {
  const knownRunIds = useRef(new Set<string>());
  const seenEventIds = useRef(new Set<string>());
  const [event, setEvent] = useState<WinEvent | null>(null);

  useEffect(() => {
    if (!ready) return;

    const events = deriveWinEvents(runs);
    const newlyCompleted = events.filter(
      (candidate) =>
        knownRunIds.current.has(candidate.runId) &&
        !seenEventIds.current.has(candidate.id),
    );

    events.forEach((candidate) => seenEventIds.current.add(candidate.id));
    runs.forEach((run) => knownRunIds.current.add(run.competitionId));

    if (newlyCompleted.length > 0) {
      setEvent(newlyCompleted.at(-1) ?? null);
    }
  }, [ready, runs]);

  useEffect(() => {
    if (!event) return;
    const timeout = window.setTimeout(
      () => setEvent(null),
      WIN_CELEBRATION_DURATION_MS,
    );
    return () => window.clearTimeout(timeout);
  }, [event]);

  return event;
}
