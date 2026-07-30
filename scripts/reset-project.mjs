import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";
import { applicationDefault, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getDatabase } from "firebase-admin/database";
import {
  argument,
  assertTrustedLocalExecution,
  hasFlag,
  requireExactProjectConfirmation,
  validateAdminEnvironment,
  validateDatabaseUrl,
} from "./lib/admin-safety.mjs";
import {
  buildProjectResetPreview,
  listAllAuthUsers,
  resetConfirmationPhrase,
  resetProjectData,
} from "./lib/project-reset.mjs";
import { verifyRecentEncryptedBackup } from "./lib/recent-backup.mjs";
import { promptSecret } from "./lib/secret-prompt.mjs";

function usage(message) {
  if (message) console.error(message);
  console.error(
    "Usage: npm run ops:reset-project -- --project PROJECT_ID --confirm-project PROJECT_ID --database-url URL [--apply --backup PATH.gac-backup] [--emulator]",
  );
  process.exit(1);
}

function printPreview(projectId, apply, preview) {
  console.log(`Target project: ${projectId}`);
  console.log(`Mode: ${apply ? "APPLY" : "DRY RUN"}`);
  console.log(
    `Realtime Database: ${preview.database.topLevelBranches} top-level branch(es), ${preview.database.directRecords} direct record(s)`,
  );
  for (const branch of preview.database.branches)
    console.log(`- /${branch.path}: ${branch.records} direct record(s)`);
  console.log(`Auth users: ${preview.auth.total}`);
  console.log(`- Anonymous accounts to delete: ${preview.auth.anonymous}`);
  console.log(
    `- Email/Password organizers to preserve: ${preview.auth.organizers}`,
  );
  console.log(`- Other persistent accounts to preserve: ${preview.auth.other}`);
  if (!apply) {
    console.log("Non-anonymous, non-organizer Auth accounts:");
    if (preview.auth.otherAccounts.length === 0) console.log("- None");
    for (const account of preview.auth.otherAccounts)
      console.log(
        `- ${account.email ?? "no email"} | uid=${account.uid} | providers=${account.providerIds.join(",") || "none"}`,
      );
  }
}

assertTrustedLocalExecution();
const projectId = argument("project");
const confirmedProjectId = argument("confirm-project");
const backupPath = argument("backup");
const apply = hasFlag("apply");
const dryRun = hasFlag("dry-run");
const emulator = hasFlag("emulator");
if (!projectId || !confirmedProjectId)
  usage("Provide both --project and --confirm-project.");
if (apply && dryRun) usage("Choose either --apply or --dry-run, not both.");
if (apply && !backupPath) usage("Apply mode requires --backup.");
requireExactProjectConfirmation({ projectId, confirmedProjectId });
await validateAdminEnvironment({ projectId, emulator, confirmedProjectId });
const databaseUrl = validateDatabaseUrl({
  projectId,
  databaseUrl: argument("database-url"),
  emulator,
});

if (apply) {
  const passphrase = await promptSecret("Backup passphrase: ");
  await verifyRecentEncryptedBackup({ backupPath, projectId, passphrase });
  console.log("Recent encrypted backup authenticated for this project.");
}

if (emulator) {
  process.env.FIREBASE_DATABASE_EMULATOR_HOST = "127.0.0.1:9000";
  process.env.FIREBASE_AUTH_EMULATOR_HOST = "127.0.0.1:9099";
}
const app = initializeApp(
  emulator
    ? { projectId, databaseURL: databaseUrl }
    : { credential: applicationDefault(), projectId, databaseURL: databaseUrl },
);
const database = getDatabase(app);
const auth = getAuth(app);
const [snapshot, users] = await Promise.all([
  database.ref().get(),
  listAllAuthUsers(auth),
]);
const preview = buildProjectResetPreview(snapshot.val() ?? {}, users);
printPreview(projectId, apply, preview);

if (!apply) {
  console.log("Dry run complete; no data or Auth accounts were changed.");
  process.exit(0);
}

const prompt = createInterface({ input: stdin, output: stdout });
try {
  const phrase = resetConfirmationPhrase(projectId);
  const answer = await prompt.question(`Type ${phrase} to continue: `);
  if (answer !== phrase) {
    console.log("Cancelled; no data or Auth accounts were changed.");
    process.exit(0);
  }
} finally {
  prompt.close();
}

const result = await resetProjectData({ database, auth });
console.log("Realtime Database root cleared.");
console.log(
  `Anonymous Auth accounts deleted: ${result.anonymousUsersDeleted}.`,
);
console.log(
  "Email/Password organizers, their custom claims, and all other persistent Auth accounts were preserved.",
);
