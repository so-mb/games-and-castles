import { randomBytes, scrypt as scryptCallback } from "node:crypto";
import { spawn } from "node:child_process";
import { promisify } from "node:util";

const scrypt = promisify(scryptCallback);
const args = process.argv.slice(2);
const projectIndex = args.indexOf("--project");
const projectId = projectIndex >= 0 ? args[projectIndex + 1] : null;

if (
  !projectId ||
  !/^[a-z][a-z0-9-]{5,29}$/.test(projectId) ||
  projectId.startsWith("demo-")
) {
  console.error(
    "Provide an explicit non-demo Firebase project: --project <project-id>",
  );
  process.exit(1);
}

function hiddenPrompt(label) {
  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    throw new Error("Run this command in an interactive terminal.");
  }
  return new Promise((resolve, reject) => {
    let value = "";
    process.stdout.write(label);
    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.setEncoding("utf8");
    const cleanup = () => {
      process.stdin.setRawMode(false);
      process.stdin.pause();
      process.stdin.removeListener("data", onData);
      process.stdout.write("\n");
    };
    const onData = (character) => {
      if (character === "\u0003") {
        cleanup();
        reject(new Error("Cancelled."));
      } else if (character === "\r" || character === "\n") {
        cleanup();
        resolve(value);
      } else if (character === "\u007f") {
        value = value.slice(0, -1);
      } else if (character >= " ") {
        value += character;
      }
    };
    process.stdin.on("data", onData);
  });
}

function weak(value) {
  return (
    value.length < 12 ||
    !/[a-z]/.test(value) ||
    !/[A-Z]/.test(value) ||
    !/[0-9]/.test(value) ||
    /^(.+)\1+$/.test(value) ||
    /password|qwerty|letmein|special|reveal/i.test(value)
  );
}

async function verifier(value) {
  const cost = 16384;
  const blockSize = 8;
  const parallelization = 1;
  const salt = randomBytes(24);
  const derived = await scrypt(value, salt, 32, {
    N: cost,
    r: blockSize,
    p: parallelization,
    maxmem: 64 * 1024 * 1024,
  });
  return `scrypt$v1$N=${cost},r=${blockSize},p=${parallelization}$${salt.toString("base64url")}$${derived.toString("base64url")}`;
}

function setSecret(value) {
  return new Promise((resolve, reject) => {
    const child = spawn(
      "firebase",
      [
        "functions:secrets:set",
        "SPECIAL_REVEAL_CODE_VERIFIER",
        "--project",
        projectId,
      ],
      { stdio: ["pipe", "inherit", "inherit"] },
    );
    child.stdin.end(`${value}\n`);
    child.on("error", reject);
    child.on("exit", (code) =>
      code === 0
        ? resolve()
        : reject(new Error("Firebase did not accept the secret value.")),
    );
  });
}

try {
  console.log(`Target Firebase project: ${projectId}`);
  const confirmation = await hiddenPrompt(
    "Retype the project ID to continue: ",
  );
  if (confirmation !== projectId)
    throw new Error("Project confirmation did not match.");
  const first = await hiddenPrompt("Enter the protected organizer code: ");
  const second = await hiddenPrompt("Enter it again: ");
  if (first !== second) throw new Error("The two entries did not match.");
  if (weak(first))
    throw new Error(
      "Choose a longer mixed-character code that is not a common phrase.",
    );
  await setSecret(await verifier(first));
  console.log(
    "The versioned verifier was sent directly to Firebase Secret Manager.",
  );
} catch (error) {
  console.error(
    error instanceof Error ? error.message : "The secret was not configured.",
  );
  process.exitCode = 1;
}
