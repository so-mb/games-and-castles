import type { Auth } from "firebase/auth";
import {
  assertFreshOrganizerAuthorization,
  isAuthenticationRecent,
  reauthenticateOrganizerAccount,
  RECENT_AUTH_MAX_AGE_MS,
  type RecentOrganizerAuthorization,
} from "./recentAuthorization";

export const SPECIAL_REVEAL_RECENT_AUTH_MS = RECENT_AUTH_MAX_AGE_MS;

export type RecentRevealAuthorization = RecentOrganizerAuthorization;

export function isSpecialRevealAuthRecent(
  authTimeMs: number,
  nowMs = Date.now(),
) {
  return isAuthenticationRecent(authTimeMs, nowMs);
}

export function assertFreshRevealAuthorization(
  authorization: RecentRevealAuthorization,
  uid: string,
  nowMs = Date.now(),
) {
  assertFreshOrganizerAuthorization(authorization, uid, nowMs);
}

export async function reauthenticateSpecialRevealOrganizer(
  auth: Auth,
  password: string,
  nowMs?: number,
): Promise<RecentRevealAuthorization> {
  return reauthenticateOrganizerAccount(auth, password, {
    requireSpecialReveal: true,
    nowMs,
  });
}
