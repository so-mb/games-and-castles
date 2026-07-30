import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";
import {
  applicationDefault,
  deleteApp,
  initializeApp,
} from "firebase-admin/app";
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
  applyDevRestore,
  buildDevRestorePlan,
  restoreConfirmationPhrase,
  summarizeDatabase,
} from "./lib/project-restore.mjs";
import { listAllAuthUsers } from "./lib/project-reset.mjs";
import { verifyRecentEncryptedBackup } from "./lib/recent-backup.mjs";
import { promptSecret } from "./lib/secret-prompt.mjs";

const DEVELOPMENT_PROJECT = "games-and-castles-dev";

function usage(message) {
  if (message) console.error(message);
  console.error(
    "Usage: npm run backup:restore-dev -- --project games-and-castles-dev --confirm-project games-and-castles-dev --database-url URL --backup PATH.gac-backup [--apply]",
  );
  process.exit(1);
}

function printPlan(plan, currentDatabase, currentUsers, apply) {
  const current = summarizeDatabase(currentDatabase);
  console.log(`Mode: ${apply ? "APPLY" : "DRY RUN"}`);
  console.log(
    `Backup database: ${plan.database.topLevelBranches} top-level branch(es), ${plan.database.directRecords} direct record(s)`,
  );
  console.log(
    `Current database: ${current.topLevelBranches} top-level branch(es), ${current.directRecords} direct record(s)`,
  );
  console.log(`Current Auth accounts: ${currentUsers.length}`);
  console.log(`- Persistent accounts verified: ${plan.persistentUsers}`);
  console.log(
    `- Anonymous accounts already restored: ${plan.anonymousUsersAlreadyRestored}`,
  );
  console.log(
    `- Anonymous accounts to recreate: ${plan.anonymousUsersToCreate.length}`,
  );
}

assertTrustedLocalExecution();
const projectId = argument("project");
const confirmedProjectId = argument("confirm-project");
const backupPath = argument("backup");
const apply = hasFlag("apply");
const dryRun = hasFlag("dry-run");
if (!projectId || !confirmedProjectId || !backupPath)
  usage("Provide --project, --confirm-project, and --backup.");
if (projectId !== DEVELOPMENT_PROJECT)
  usage(`This rehearsal command is locked to ${DEVELOPMENT_PROJECT}.`);
if (apply && dryRun) usage("Choose either --apply or --dry-run, not both.");
requireExactProjectConfirmation({ projectId, confirmedProjectId });
await validateAdminEnvironment({
  projectId,
  emulator: false,
  confirmedProjectId,
});
const databaseUrl = validateDatabaseUrl({
  projectId,
  databaseUrl: argument("database-url"),
  emulator: false,
});

const passphrase = await promptSecret("Backup passphrase: ");
const { backup } = await verifyRecentEncryptedBackup({
  backupPath,
  projectId,
  passphrase,
});
console.log("Recent encrypted development backup authenticated.");

const app = initializeApp({
  credential: applicationDefault(),
  projectId,
  databaseURL: databaseUrl,
});
try {
  const database = getDatabase(app);
  const auth = getAuth(app);
  const [snapshot, currentUsers] = await Promise.all([
    database.ref().get(),
    listAllAuthUsers(auth),
  ]);
  const currentDatabase = snapshot.val();
  const plan = buildDevRestorePlan({
    backup,
    currentDatabase,
    currentUsers,
  });
  printPlan(plan, currentDatabase, currentUsers, apply);

  if (!apply) {
    console.log("Dry run complete; no database or Auth data was changed.");
  } else {
    const prompt = createInterface({ input: stdin, output: stdout });
    let confirmed = false;
    try {
      const phrase = restoreConfirmationPhrase(projectId);
      const answer = await prompt.question(`Type ${phrase} to continue: `);
      confirmed = answer === phrase;
    } finally {
      prompt.close();
    }

    if (!confirmed) {
      console.log("Cancelled; no database or Auth data was changed.");
    } else {
      const result = await applyDevRestore({ database, auth, backup, plan });
      console.log(
        `Realtime Database restored: ${result.databaseRestored ? "yes" : "already matched"}.`,
      );
      console.log(
        `Anonymous Auth accounts recreated: ${result.anonymousUsersCreated}.`,
      );

      const [verifiedSnapshot, verifiedUsers] = await Promise.all([
        database.ref().get(),
        listAllAuthUsers(auth),
      ]);
      const verified = buildDevRestorePlan({
        backup,
        currentDatabase: verifiedSnapshot.val(),
        currentUsers: verifiedUsers,
      });
      if (
        !verified.databaseAlreadyRestored ||
        verified.anonymousUsersToCreate.length > 0
      )
        throw new Error("Post-restore verification did not converge.");
      console.log("Post-restore database and Auth verification passed.");
    }
  }
} finally {
  await deleteApp(app);
}
