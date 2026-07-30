import { readFile, stat } from "node:fs/promises";
import { resolve } from "node:path";
import { decryptBackup } from "./backup-crypto.mjs";

export const MAX_BACKUP_AGE_MS = 24 * 60 * 60 * 1000;

export async function verifyRecentEncryptedBackup({
  backupPath,
  projectId,
  passphrase,
  now = Date.now(),
}) {
  if (!backupPath?.endsWith(".gac-backup"))
    throw new Error("The encrypted backup must end in .gac-backup.");
  const path = resolve(backupPath);
  const file = await stat(path);
  if (!file.isFile())
    throw new Error("The encrypted backup path is not a file.");
  if ((file.mode & 0o077) !== 0)
    throw new Error(
      "The encrypted backup is readable by group/others. Restrict it to mode 600 and retry.",
    );
  const fileAge = now - file.mtimeMs;
  if (fileAge < 0 || fileAge >= MAX_BACKUP_AGE_MS)
    throw new Error(
      "The supplied encrypted backup is not less than 24 hours old.",
    );
  const backup = await decryptBackup(await readFile(path, "utf8"), passphrase);
  if (backup.metadata.projectId !== projectId)
    throw new Error("The encrypted backup belongs to a different project.");
  const createdAt = Date.parse(backup.metadata.createdAt);
  const payloadAge = now - createdAt;
  if (
    !Number.isFinite(createdAt) ||
    payloadAge < 0 ||
    payloadAge >= MAX_BACKUP_AGE_MS
  )
    throw new Error(
      "The encrypted backup payload is not less than 24 hours old.",
    );
  return { path, backup };
}
