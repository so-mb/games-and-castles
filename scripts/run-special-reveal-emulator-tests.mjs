import { randomBytes, scrypt as scryptCallback } from "node:crypto";
import { spawn } from "node:child_process";
import { writeFile, unlink } from "node:fs/promises";
import { promisify } from "node:util";

const scrypt = promisify(scryptCallback);
const code = randomBytes(18).toString("base64url");
const salt = randomBytes(24);
const derived = await scrypt(code, salt, 32, {
  N: 16384,
  r: 8,
  p: 1,
  maxmem: 64 * 1024 * 1024,
});
const verifier = `scrypt$v1$N=16384,r=8,p=1$${salt.toString("base64url")}$${derived.toString("base64url")}`;
const secretPath = new URL("../functions/.secret.local", import.meta.url);
const javaPath =
  "/opt/homebrew/opt/openjdk/libexec/openjdk.jdk/Contents/Home/bin";

function run(command, args, env = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: new URL("..", import.meta.url),
      env: { ...process.env, ...env },
      stdio: "inherit",
    });
    child.on("error", reject);
    child.on("exit", (exitCode) =>
      exitCode === 0
        ? resolve()
        : reject(new Error(`${command} exited with status ${exitCode}.`)),
    );
  });
}

try {
  await writeFile(secretPath, `SPECIAL_REVEAL_CODE_VERIFIER=${verifier}\n`, {
    mode: 0o600,
  });
  await run("npm", ["run", "functions:build"]);
  await run(
    "firebase",
    [
      "emulators:exec",
      "--project",
      "demo-games-and-castles",
      "--only",
      "auth,database,functions",
      "vitest run --config vitest.functions.config.ts",
    ],
    {
      PHASE9_TEST_CODE: code,
      PATH: `${javaPath}:${process.env.PATH ?? ""}`,
    },
  );
} finally {
  await unlink(secretPath).catch(() => undefined);
}
