import { readFile, stat } from "node:fs/promises";
import { resolve } from "node:path";
import { argument } from "./lib/admin-safety.mjs";
import { backupEnvelopeMetadata, decryptBackup } from "./lib/backup-crypto.mjs";
import { promptSecret } from "./lib/secret-prompt.mjs";

const input = argument("input");
if (!input) {
  console.error("Usage: npm run backup:inspect -- --input PATH.gac-backup");
  process.exit(1);
}
const path = resolve(input);
const serialized = await readFile(path, "utf8");
const file = await stat(path);
const envelope = backupEnvelopeMetadata(serialized);
console.log(`Encrypted backup: ${path}`);
console.log(`File bytes: ${file.size}`);
console.log(`Project: ${envelope.projectId}`);
console.log(`Created: ${envelope.createdAt}`);
console.log(`Protection: ${envelope.cipher} with ${envelope.kdf}`);
const passphrase = await promptSecret("Backup passphrase: ");
const payload = await decryptBackup(serialized, passphrase);
console.log("Backup authentication: valid");
console.log(`Auth metadata records: ${payload.metadata.authUserCount}`);
console.log("Database record counts:");
for (const [pathName, count] of Object.entries(payload.metadata.databaseCounts))
  console.log(`- ${pathName}: ${count}`);
