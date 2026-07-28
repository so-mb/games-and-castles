import { FirebaseError } from "firebase/app";

const authMessages: Record<string, string> = {
  "auth/invalid-credential":
    "That email and password combination was not accepted.",
  "auth/wrong-password":
    "That email and password combination was not accepted.",
  "auth/invalid-email": "Enter a valid email address.",
  "auth/network-request-failed":
    "The network is unavailable. Try again when you are connected.",
  "auth/too-many-requests":
    "Too many attempts. Wait a moment before trying again.",
  "auth/user-mismatch": "Reauthenticate the currently signed-in organizer.",
  "auth/user-token-expired": "Organizer authentication expired. Sign in again.",
  "database/permission-denied":
    "Firebase rejected the operation. Reauthenticate and reload the latest state.",
  PERMISSION_DENIED:
    "Firebase rejected the operation. Reauthenticate and reload the latest state.",
};

function firebaseErrorCode(error: unknown) {
  if (error instanceof FirebaseError) return error.code;
  if (!error || typeof error !== "object") return null;
  if ("code" in error && typeof error.code === "string") return error.code;
  return error instanceof Error && /permission[ _-]?denied/i.test(error.message)
    ? "PERMISSION_DENIED"
    : null;
}

export function friendlyFirebaseError(
  error: unknown,
  fallback = "Something went wrong. Please try again.",
) {
  const code = firebaseErrorCode(error);
  return code ? (authMessages[code] ?? fallback) : fallback;
}
