import { chmod, mkdtemp, rm, utimes, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { encryptBackup } from "./backup-crypto.mjs";
import { verifyRecentEncryptedBackup } from "./recent-backup.mjs";

const now = Date.parse("2026-07-29T18:00:00.000Z");
const passphrase = "a-local-test-passphrase";
const temporaryDirectories = [];

async function backupFile({
  projectId = "demo-games-and-castles",
  createdAt = new Date(now - 60 * 60 * 1000).toISOString(),
} = {}) {
  const directory = await mkdtemp(join(tmpdir(), "gac-recent-backup-"));
  temporaryDirectories.push(directory);
  const path = join(directory, "project.gac-backup");
  const encrypted = await encryptBackup(
    {
      metadata: {
        projectId,
        createdAt,
        databaseCounts: {},
        authUserCount: 0,
        schemaVersion: 1,
      },
      database: {},
      authUsers: [],
    },
    passphrase,
  );
  await writeFile(path, encrypted, { mode: 0o600 });
  await utimes(path, now / 1000, now / 1000);
  return path;
}

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

describe("recent encrypted backup verification", () => {
  it("authenticates a matching backup created less than 24 hours ago", async () => {
    const path = await backupFile();
    await expect(
      verifyRecentEncryptedBackup({
        backupPath: path,
        projectId: "demo-games-and-castles",
        passphrase,
        now,
      }),
    ).resolves.toMatchObject({ path });
  });

  it("rejects stale payloads, project mismatches, and non-backup paths", async () => {
    const stalePath = await backupFile({
      createdAt: new Date(now - 25 * 60 * 60 * 1000).toISOString(),
    });
    await expect(
      verifyRecentEncryptedBackup({
        backupPath: stalePath,
        projectId: "demo-games-and-castles",
        passphrase,
        now,
      }),
    ).rejects.toThrow("payload is not less than 24 hours old");

    const path = await backupFile();
    await expect(
      verifyRecentEncryptedBackup({
        backupPath: path,
        projectId: "different-project",
        passphrase,
        now,
      }),
    ).rejects.toThrow("different project");
    await expect(
      verifyRecentEncryptedBackup({
        backupPath: `${path}.txt`,
        projectId: "demo-games-and-castles",
        passphrase,
        now,
      }),
    ).rejects.toThrow("must end in .gac-backup");
  });

  it("rejects a backup file whose filesystem age is 24 hours or more", async () => {
    const path = await backupFile();
    const oldTime = (now - 24 * 60 * 60 * 1000) / 1000;
    await utimes(path, oldTime, oldTime);
    await expect(
      verifyRecentEncryptedBackup({
        backupPath: path,
        projectId: "demo-games-and-castles",
        passphrase,
        now,
      }),
    ).rejects.toThrow("not less than 24 hours old");
  });

  it("requires the encrypted backup file to use private permissions", async () => {
    const path = await backupFile();
    await chmod(path, 0o644);
    await expect(
      verifyRecentEncryptedBackup({
        backupPath: path,
        projectId: "demo-games-and-castles",
        passphrase,
        now,
      }),
    ).rejects.toThrow("mode 600");
  });
});
