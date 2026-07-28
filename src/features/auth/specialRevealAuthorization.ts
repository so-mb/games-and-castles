import {
  EmailAuthProvider,
  getIdTokenResult,
  reauthenticateWithCredential,
  type Auth,
} from "firebase/auth";

export const SPECIAL_REVEAL_RECENT_AUTH_MS = 5 * 60 * 1000;
const ACTION_AUTHORIZATION_MAX_AGE_MS = 60 * 1000;

export interface RecentRevealAuthorization {
  uid: string;
  email: string;
  authTimeMs: number;
  verifiedAtMs: number;
}

export function isSpecialRevealAuthRecent(
  authTimeMs: number,
  nowMs = Date.now(),
) {
  const age = nowMs - authTimeMs;
  return age >= 0 && age <= SPECIAL_REVEAL_RECENT_AUTH_MS;
}

export function assertFreshRevealAuthorization(
  authorization: RecentRevealAuthorization,
  uid: string,
  nowMs = Date.now(),
) {
  if (
    authorization.uid !== uid ||
    !isSpecialRevealAuthRecent(authorization.authTimeMs, nowMs) ||
    nowMs - authorization.verifiedAtMs < 0 ||
    nowMs - authorization.verifiedAtMs > ACTION_AUTHORIZATION_MAX_AGE_MS
  )
    throw new Error("Reauthenticate immediately before this operation.");
}

export async function reauthenticateSpecialRevealOrganizer(
  auth: Auth,
  password: string,
  nowMs?: number,
): Promise<RecentRevealAuthorization> {
  const user = auth.currentUser;
  if (!user?.email)
    throw new Error("The signed-in organizer account has no email address.");
  const credential = EmailAuthProvider.credential(user.email, password);
  await reauthenticateWithCredential(user, credential);
  const token = await getIdTokenResult(user, true);
  if (token.claims.admin !== true || token.claims.specialRevealAdmin !== true)
    throw new Error(
      "This organizer account does not have protected reveal access.",
    );
  const authTimeMs = Date.parse(token.authTime);
  const verifiedAtMs = nowMs ?? Date.now();
  if (
    !Number.isFinite(authTimeMs) ||
    !isSpecialRevealAuthRecent(authTimeMs, verifiedAtMs)
  )
    throw new Error("Recent organizer authentication could not be verified.");
  return {
    uid: user.uid,
    email: user.email,
    authTimeMs,
    verifiedAtMs,
  };
}
