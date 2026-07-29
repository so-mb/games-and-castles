import { readFile, stat } from "node:fs/promises";
import { resolve } from "node:path";
import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";
import { applicationDefault, initializeApp } from "firebase-admin/app";
import { getDatabase } from "firebase-admin/database";
import {
  argument,
  hasFlag,
  validateAdminEnvironment,
} from "./lib/admin-safety.mjs";
import { decryptBackup } from "./lib/backup-crypto.mjs";
import { buildPrivateCleanupMutation } from "./lib/private-cleanup.mjs";
import { promptSecret } from "./lib/secret-prompt.mjs";

function usage(message) {
  if (message) console.error(message);
  console.error(
    "Usage: npm run privacy:cleanup -- --project PROJECT_ID [--apply --backup PATH.gac-backup] [--emulator] [--confirm-project PROJECT_ID]",
  );
  process.exit(1);
}

const projectId = argument("project");
const apply = hasFlag("apply");
const emulator = hasFlag("emulator");
const backupPath = argument("backup");
if (!projectId) usage("Provide --project.");
if (apply && !backupPath) usage("Apply mode requires --backup.");
await validateAdminEnvironment({
  projectId,
  emulator,
  confirmedProjectId: argument("confirm-project"),
});

if (apply) {
  const resolvedBackup = resolve(backupPath);
  const backupFile = await stat(resolvedBackup);
  if (Date.now() - backupFile.mtimeMs > 24 * 60 * 60 * 1000)
    throw new Error("The supplied encrypted backup is older than 24 hours.");
  const passphrase = await promptSecret("Backup passphrase: ");
  const backup = await decryptBackup(
    await readFile(resolvedBackup, "utf8"),
    passphrase,
  );
  if (backup.metadata.projectId !== projectId)
    throw new Error("The encrypted backup belongs to a different project.");
  const backupCreatedAt = Date.parse(backup.metadata.createdAt);
  if (
    !Number.isFinite(backupCreatedAt) ||
    backupCreatedAt > Date.now() ||
    Date.now() - backupCreatedAt > 24 * 60 * 60 * 1000
  )
    throw new Error("The encrypted backup payload is older than 24 hours.");
  console.log("Encrypted backup verified before cleanup.");
}

if (emulator) process.env.FIREBASE_DATABASE_EMULATOR_HOST = "127.0.0.1:9000";
const app = initializeApp(
  emulator
    ? { projectId, databaseURL: `http://127.0.0.1:9000?ns=${projectId}` }
    : { credential: applicationDefault(), projectId },
);
const database = getDatabase(app);
const root = (await database.ref().get()).val() ?? {};
const auditId = database.ref("audit").push().key;
if (!auditId) throw new Error("Firebase could not allocate an audit ID.");
const mutation = buildPrivateCleanupMutation({
  root,
  auditId,
  now: Date.now(),
});
console.log(`Target project: ${projectId}`);
console.log(`Mode: ${apply ? "APPLY" : "DRY RUN"}`);
for (const item of mutation.preview)
  console.log(`- ${item.path}: ${item.records} record(s)`);
if (!mutation.applied) {
  console.log("No private event data remains; no write is required.");
  process.exit(0);
}
if (!apply) {
  console.log("Dry run complete; no data was changed.");
  process.exit(0);
}
const prompt = createInterface({ input: stdin, output: stdout });
try {
  const answer = await prompt.question("Type PURGE PRIVATE DATA to continue: ");
  if (answer !== "PURGE PRIVATE DATA") {
    console.log("Cancelled; no data was changed.");
    process.exit(0);
  }
} finally {
  prompt.close();
}
await database.ref().update(mutation.updates);
console.log(
  "Private event data purged in one update; public results were preserved.",
);
