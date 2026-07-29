import { applicationDefault, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { argument, validateAdminEnvironment } from "./lib/admin-safety.mjs";

function usage(message) {
  if (message) console.error(message);
  console.error(
    "Usage: npm run admin:set-claim -- (--email person@example.com | --uid UID) [--admin true|false] [--special-reveal-admin true|false] --project PROJECT_ID --confirm-project PROJECT_ID",
  );
  process.exitCode = 1;
}

const email = argument("email");
const uid = argument("uid");
const adminValue = argument("admin");
const specialRevealAdminValue = argument("special-reveal-admin");
const projectId = argument("project");

function validBoolean(value) {
  return value === undefined || value === "true" || value === "false";
}

if ((!email && !uid) || (email && uid)) {
  usage("Provide exactly one of --email or --uid.");
} else if (!projectId || projectId.startsWith("demo-")) {
  usage("Provide a non-demo Firebase project ID with --project.");
} else if (!validBoolean(adminValue)) {
  usage("Set --admin to either true or false when provided.");
} else if (!validBoolean(specialRevealAdminValue)) {
  usage("Set --special-reveal-admin to either true or false when provided.");
} else if (adminValue === undefined && specialRevealAdminValue === undefined) {
  usage("Provide at least one claim change.");
} else {
  await validateAdminEnvironment({
    projectId,
    emulator: false,
    confirmedProjectId: argument("confirm-project"),
  });
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
  else if (adminValue === "false") delete nextClaims.admin;

  if (specialRevealAdminValue === "true") nextClaims.specialRevealAdmin = true;
  else if (specialRevealAdminValue === "false")
    delete nextClaims.specialRevealAdmin;

  if (nextClaims.specialRevealAdmin === true && nextClaims.admin !== true) {
    usage("specialRevealAdmin requires admin to remain true.");
    process.exit();
  }

  await auth.setCustomUserClaims(user.uid, nextClaims);
  console.log(
    `Updated organizer claims for ${user.email ?? user.uid}. The user must sign out and in again or force-refresh the ID token.`,
  );
}
