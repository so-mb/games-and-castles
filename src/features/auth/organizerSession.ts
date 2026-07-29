export const ORGANIZER_IDLE_TIMEOUT_MS = 30 * 60 * 1000;
export const ORGANIZER_IDLE_WARNING_MS = 5 * 60 * 1000;

export type OrganizerIdleState = "active" | "warning" | "expired";

export function deriveOrganizerIdleState(
  deadlineMs: number,
  nowMs = Date.now(),
): { state: OrganizerIdleState; remainingMs: number } {
  const remainingMs = Math.max(0, deadlineMs - nowMs);
  if (remainingMs === 0) return { state: "expired", remainingMs };
  if (remainingMs <= ORGANIZER_IDLE_WARNING_MS)
    return { state: "warning", remainingMs };
  return { state: "active", remainingMs };
}
