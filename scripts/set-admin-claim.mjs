import { applicationDefault, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";

function argument(name) {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function usage(message) {
  if (message) console.error(message);
  console.error(
    "Usage: npm run admin:set-claim -- (--email person@example.com | --uid UID) --admin true|false --project PROJECT_ID",
  );
  process.exitCode = 1;
}

const email = argument("email");
const uid = argument("uid");
const adminValue = argument("admin");
const projectId = argument("project");

if ((!email && !uid) || (email && uid)) {
  usage("Provide exactly one of --email or --uid.");
} else if (!projectId || projectId.startsWith("demo-")) {
  usage("Provide a non-demo Firebase project ID with --project.");
} else if (adminValue !== "true" && adminValue !== "false") {
  usage("Set --admin to either true or false.");
} else {
  if (getApps().length === 0) {
    initializeApp({ credential: applicationDefault(), projectId });
  }

  const auth = getAuth();
  const user = email
    ? await auth.getUserByEmail(email)
    : await auth.getUser(uid);
  const existingClaims = user.customClaims ?? {};
  const nextClaims = { ...existingClaims };

  if (adminValue === "true") nextClaims.admin = true;
  else delete nextClaims.admin;

  await auth.setCustomUserClaims(user.uid, nextClaims);
  console.log(
    `${adminValue === "true" ? "Granted" : "Removed"} organizer access for ${user.email ?? user.uid}. The user must refresh their ID token or sign in again.`,
  );
}
