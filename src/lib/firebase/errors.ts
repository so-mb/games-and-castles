import { FirebaseError } from "firebase/app";

const authMessages: Record<string, string> = {
  "auth/invalid-credential":
    "That email and password combination was not accepted.",
  "auth/invalid-email": "Enter a valid email address.",
  "auth/network-request-failed":
    "The network is unavailable. Try again when you are connected.",
  "auth/too-many-requests":
    "Too many attempts. Wait a moment before trying again.",
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
