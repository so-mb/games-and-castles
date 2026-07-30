import { mkdir, open } from "node:fs/promises";
import { dirname } from "node:path";
import {
  applicationDefault,
  deleteApp,
  initializeApp,
} from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getDatabase } from "firebase-admin/database";
import {
  argument,
  hasFlag,
  validateAdminEnvironment,
  validateBackupOutputPath,
  validateDatabaseUrl,
} from "./lib/admin-safety.mjs";
import { encryptBackup } from "./lib/backup-crypto.mjs";
import { promptSecret } from "./lib/secret-prompt.mjs";

function usage(message) {
  if (message) console.error(message);
  console.error(
    "Usage: npm run backup:create -- --project PROJECT_ID --output PATH.gac-backup [--dry-run] [--emulator] [--confirm-project PROJECT_ID] [--database-url URL]",
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
const outputPath = validateBackupOutputPath({ output, projectId });

await validateAdminEnvironment({
  projectId,
  emulator,
  confirmedProjectId: argument("confirm-project"),
});
const databaseUrl = validateDatabaseUrl({
  projectId,
  databaseUrl: argument("database-url"),
  emulator,
});
if (emulator) {
  process.env.FIREBASE_DATABASE_EMULATOR_HOST = "127.0.0.1:9000";
  process.env.FIREBASE_AUTH_EMULATOR_HOST = "127.0.0.1:9099";
}
const app = initializeApp(
  emulator
    ? { projectId, databaseURL: databaseUrl }
    : { credential: applicationDefault(), projectId, databaseURL: databaseUrl },
);
try {
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
  } else {
    const passphrase = await promptSecret("Backup passphrase: ");
    const confirmation = await promptSecret("Repeat passphrase: ");
    if (passphrase !== confirmation)
      throw new Error("Passphrases do not match.");
    const encrypted = await encryptBackup(payload, passphrase);
    await mkdir(dirname(outputPath), { recursive: true, mode: 0o700 });
    const handle = await open(outputPath, "wx", 0o600);
    try {
      await handle.writeFile(encrypted, "utf8");
    } finally {
      await handle.close();
    }
    console.log(`Encrypted backup written with mode 600: ${outputPath}`);
  }
} finally {
  await deleteApp(app);
}
