import { describe, expect, it } from "vitest";
import {
  backupEnvelopeMetadata,
  decryptBackup,
  encryptBackup,
} from "./backup-crypto.mjs";

const payload = {
  metadata: {
    projectId: "demo-games-and-castles",
    createdAt: "2026-07-28T12:00:00.000Z",
    databaseCounts: { birthdayVault: 3 },
    authUserCount: 1,
    schemaVersion: 1,
  },
  database: { birthdayVault: { privateMessages: { owner: "private note" } } },
  authUsers: [{ uid: "guest", email: null }],
};

describe("encrypted local backup", () => {
  it("round-trips authenticated content without plaintext in the envelope", async () => {
    const encrypted = await encryptBackup(payload, "a-long-test-passphrase");
    expect(encrypted).not.toContain("private note");
    expect(backupEnvelopeMetadata(encrypted)).toMatchObject({
      projectId: "demo-games-and-castles",
      cipher: "aes-256-gcm",
      kdf: "scrypt",
    });
    await expect(
      decryptBackup(encrypted, "a-long-test-passphrase"),
    ).resolves.toEqual(payload);
  });

  it("detects a wrong passphrase and ciphertext corruption", async () => {
    const encrypted = await encryptBackup(payload, "a-long-test-passphrase");
    await expect(
      decryptBackup(encrypted, "another-test-passphrase"),
    ).rejects.toThrow("wrong passphrase or corruption");
    const envelope = JSON.parse(encrypted);
    envelope.ciphertext = `${envelope.ciphertext.slice(0, -2)}AA`;
    await expect(
      decryptBackup(JSON.stringify(envelope), "a-long-test-passphrase"),
    ).rejects.toThrow("wrong passphrase or corruption");
  });
});
