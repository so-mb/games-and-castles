import { FirebaseError } from "firebase/app";

const authMessages: Record<string, string> = {
  "auth/invalid-credential":
    "That email and password combination was not accepted.",
  "auth/invalid-email": "Enter a valid email address.",
  "auth/network-request-failed":
    "The network is unavailable. Try again when you are connected.",
  "auth/too-many-requests":
    "Too many attempts. Wait a moment before trying again.",
  "functions/aborted":
    "The event changed elsewhere. Reload and review the latest state.",
  "functions/deadline-exceeded":
    "The protected operation took too long. Check the latest state before retrying.",
  "functions/failed-precondition":
    "That action is not available in the current event state.",
  "functions/internal":
    "The protected operation could not be completed. Review the latest state and try again.",
  "functions/invalid-argument":
    "The protected operation was not accepted. Review the fields and try again.",
  "functions/permission-denied":
    "The protected operation could not be authorized.",
  "functions/resource-exhausted":
    "Protected operations are temporarily paused after repeated attempts. Try again later.",
  "functions/unauthenticated":
    "Organizer authentication expired. Sign in again before retrying.",
  "functions/unavailable":
    "The protected service is temporarily unavailable. Check your connection and try again.",
};

export function friendlyFirebaseError(
  error: unknown,
  fallback = "Something went wrong. Please try again.",
) {
  if (error instanceof FirebaseError) {
    return authMessages[error.code] ?? fallback;
  }
  return fallback;
}
