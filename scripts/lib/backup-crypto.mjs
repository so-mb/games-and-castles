import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  scrypt as scryptCallback,
} from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(scryptCallback);
const FORMAT = "games-and-castles-encrypted-backup";
const VERSION = 1;
const SCRYPT_COST = 32768;

function encode(value) {
  return Buffer.from(value).toString("base64");
}

function decode(value) {
  return Buffer.from(value, "base64");
}

function aad(envelope) {
  return Buffer.from(
    `${envelope.format}|${envelope.version}|${envelope.createdAt}|${envelope.projectId}`,
    "utf8",
  );
}

async function key(passphrase, salt) {
  if (typeof passphrase !== "string" || passphrase.length < 12)
    throw new Error("Use a backup passphrase of at least 12 characters.");
  return scrypt(passphrase, salt, 32, {
    N: SCRYPT_COST,
    r: 8,
    p: 1,
    maxmem: 64 * 1024 * 1024,
  });
}

export async function encryptBackup(payload, passphrase) {
  const salt = randomBytes(16);
  const iv = randomBytes(12);
  const envelope = {
    format: FORMAT,
    version: VERSION,
    createdAt: payload.metadata.createdAt,
    projectId: payload.metadata.projectId,
    cipher: "aes-256-gcm",
    kdf: { name: "scrypt", N: SCRYPT_COST, r: 8, p: 1, salt: encode(salt) },
    iv: encode(iv),
    tag: "",
    ciphertext: "",
  };
  const cipher = createCipheriv("aes-256-gcm", await key(passphrase, salt), iv);
  cipher.setAAD(aad(envelope));
  const encrypted = Buffer.concat([
    cipher.update(JSON.stringify(payload), "utf8"),
    cipher.final(),
  ]);
  envelope.tag = encode(cipher.getAuthTag());
  envelope.ciphertext = encode(encrypted);
  return `${JSON.stringify(envelope, null, 2)}\n`;
}

export async function decryptBackup(serialized, passphrase) {
  let envelope;
  try {
    envelope = JSON.parse(serialized);
  } catch {
    throw new Error("Backup file is not valid JSON.");
  }
  if (
    envelope?.format !== FORMAT ||
    envelope.version !== VERSION ||
    envelope.cipher !== "aes-256-gcm" ||
    envelope.kdf?.name !== "scrypt" ||
    envelope.kdf.N !== SCRYPT_COST
  )
    throw new Error("Unsupported or malformed backup envelope.");
  try {
    const decipher = createDecipheriv(
      "aes-256-gcm",
      await key(passphrase, decode(envelope.kdf.salt)),
      decode(envelope.iv),
    );
    decipher.setAAD(aad(envelope));
    decipher.setAuthTag(decode(envelope.tag));
    const plaintext = Buffer.concat([
      decipher.update(decode(envelope.ciphertext)),
      decipher.final(),
    ]).toString("utf8");
    const payload = JSON.parse(plaintext);
    if (
      payload?.metadata?.projectId !== envelope.projectId ||
      payload?.metadata?.createdAt !== envelope.createdAt ||
      payload?.metadata?.schemaVersion !== 1
    )
      throw new Error("Backup metadata authentication failed.");
    return payload;
  } catch {
    throw new Error(
      "Backup authentication failed: wrong passphrase or corruption.",
    );
  }
}

export function backupEnvelopeMetadata(serialized) {
  const envelope = JSON.parse(serialized);
  if (envelope?.format !== FORMAT || envelope.version !== VERSION)
    throw new Error("Unsupported or malformed backup envelope.");
  return {
    format: envelope.format,
    version: envelope.version,
    projectId: envelope.projectId,
    createdAt: envelope.createdAt,
    cipher: envelope.cipher,
    kdf: envelope.kdf?.name,
  };
}
