import { open } from "node:fs/promises";
import { isAbsolute, relative, resolve } from "node:path";
import { applicationDefault, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getDatabase } from "firebase-admin/database";
import {
  argument,
  hasFlag,
  validateAdminEnvironment,
} from "./lib/admin-safety.mjs";
import { encryptBackup } from "./lib/backup-crypto.mjs";
import { promptSecret } from "./lib/secret-prompt.mjs";

function usage(message) {
  if (message) console.error(message);
  console.error(
    "Usage: npm run backup:create -- --project PROJECT_ID --output PATH.gac-backup [--dry-run] [--emulator] [--confirm-project PROJECT_ID]",
  );
  process.exit(1);
}

async function authMetadata(auth) {
  const users = [];
  let pageToken;
  do {
    const page = await auth.listUsers(1000, pageToken);
    users.push(
      ...page.users.map((user) => ({
        uid: user.uid,
        email: user.email ?? null,
        emailVerified: user.emailVerified,
        disabled: user.disabled,
        providerIds: user.providerData.map((provider) => provider.providerId),
        customClaims: user.customClaims ?? {},
        creationTime: user.metadata.creationTime,
        lastSignInTime: user.metadata.lastSignInTime ?? null,
      })),
    );
    pageToken = page.pageToken;
  } while (pageToken);
  return users;
}

function counts(root) {
  return Object.fromEntries(
    Object.entries(root ?? {}).map(([path, value]) => [
      path,
      value && typeof value === "object" ? Object.keys(value).length : 1,
    ]),
  );
}

const projectId = argument("project");
const output = argument("output");
const dryRun = hasFlag("dry-run");
const emulator = hasFlag("emulator");
if (!projectId || !output) usage("Provide --project and --output.");
if (!output.endsWith(".gac-backup"))
  usage("Backup output must end in .gac-backup.");
const outputPath = resolve(output);
const relativeOutput = relative(process.cwd(), outputPath);
if (
  relativeOutput === "" ||
  (!relativeOutput.startsWith("..") && !isAbsolute(relativeOutput))
)
  usage("Backup output must be outside the repository.");

await validateAdminEnvironment({
  projectId,
  emulator,
  confirmedProjectId: argument("confirm-project"),
});
if (emulator) {
  process.env.FIREBASE_DATABASE_EMULATOR_HOST = "127.0.0.1:9000";
  process.env.FIREBASE_AUTH_EMULATOR_HOST = "127.0.0.1:9099";
}
const app = initializeApp(
  emulator
    ? { projectId, databaseURL: `http://127.0.0.1:9000?ns=${projectId}` }
    : { credential: applicationDefault(), projectId },
);
const [databaseSnapshot, users] = await Promise.all([
  getDatabase(app).ref().get(),
  authMetadata(getAuth(app)),
]);
const data = databaseSnapshot.val() ?? {};
const payload = {
  metadata: {
    projectId,
    createdAt: new Date().toISOString(),
    databaseCounts: counts(data),
    authUserCount: users.length,
    schemaVersion: 1,
  },
  database: data,
  authUsers: users,
};

console.log(`Target project: ${projectId}`);
console.log(`Database top-level branches: ${Object.keys(data).length}`);
console.log(`Auth user metadata records: ${users.length}`);
if (dryRun) {
  console.log("Dry run complete; no backup file was written.");
  process.exit(0);
}
const passphrase = await promptSecret("Backup passphrase: ");
const confirmation = await promptSecret("Repeat passphrase: ");
if (passphrase !== confirmation) throw new Error("Passphrases do not match.");
const encrypted = await encryptBackup(payload, passphrase);
const handle = await open(outputPath, "wx", 0o600);
try {
  await handle.writeFile(encrypted, "utf8");
} finally {
  await handle.close();
}
console.log(`Encrypted backup written with mode 600: ${outputPath}`);
