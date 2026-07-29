import {
  EmailAuthProvider,
  getIdTokenResult,
  reauthenticateWithCredential,
  type Auth,
} from "firebase/auth";

export const RECENT_AUTH_MAX_AGE_MS = 5 * 60 * 1000;
export const ACTION_AUTHORIZATION_MAX_AGE_MS = 60 * 1000;

export interface RecentOrganizerAuthorization {
  uid: string;
  email: string;
  authTimeMs: number;
  verifiedAtMs: number;
}

export function isAuthenticationRecent(authTimeMs: number, nowMs = Date.now()) {
  const age = nowMs - authTimeMs;
  return age >= 0 && age <= RECENT_AUTH_MAX_AGE_MS;
}

export function assertFreshOrganizerAuthorization(
  authorization: RecentOrganizerAuthorization,
  uid: string,
  nowMs = Date.now(),
) {
  if (
    authorization.uid !== uid ||
    !isAuthenticationRecent(authorization.authTimeMs, nowMs) ||
    nowMs - authorization.verifiedAtMs < 0 ||
    nowMs - authorization.verifiedAtMs > ACTION_AUTHORIZATION_MAX_AGE_MS
  )
    throw new Error("Reauthenticate immediately before this operation.");
}

export async function reauthenticateOrganizerAccount(
  auth: Auth,
  password: string,
  options: { requireSpecialReveal: boolean; nowMs?: number },
): Promise<RecentOrganizerAuthorization> {
  const user = auth.currentUser;
  if (!user?.email)
    throw new Error("The signed-in organizer account has no email address.");
  const credential = EmailAuthProvider.credential(user.email, password);
  await reauthenticateWithCredential(user, credential);
  const token = await getIdTokenResult(user, true);
  if (token.claims.admin !== true)
    throw new Error("This account does not have organizer access.");
  if (options.requireSpecialReveal && token.claims.specialRevealAdmin !== true)
    throw new Error(
      "This organizer account does not have protected reveal access.",
    );
  const authTimeMs = Date.parse(token.authTime);
  const verifiedAtMs = options.nowMs ?? Date.now();
  if (
    !Number.isFinite(authTimeMs) ||
    !isAuthenticationRecent(authTimeMs, verifiedAtMs)
  )
    throw new Error("Recent organizer authentication could not be verified.");
  return {
    uid: user.uid,
    email: user.email,
    authTimeMs,
    verifiedAtMs,
  };
}
