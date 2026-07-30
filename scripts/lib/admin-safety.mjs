import { readFile, realpath, stat } from "node:fs/promises";
import { dirname, isAbsolute, relative, resolve } from "node:path";

export function argument(name) {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

export function hasFlag(name) {
  return process.argv.includes(`--${name}`);
}

export function requireExactProjectConfirmation({
  projectId,
  confirmedProjectId,
}) {
  if (!projectId) throw new Error("Provide the exact target project ID.");
  if (confirmedProjectId !== projectId)
    throw new Error(
      "Repeat the exact project ID with --confirm-project before this operation.",
    );
}

function enabled(value) {
  return (
    typeof value === "string" &&
    value.trim() !== "" &&
    !["0", "false", "no", "off"].includes(value.trim().toLowerCase())
  );
}

export function assertTrustedLocalExecution(environment = process.env) {
  const ciVariable = [
    "CI",
    "GITHUB_ACTIONS",
    "BUILD_BUILDID",
    "BUILDKITE",
    "CIRCLECI",
    "GITLAB_CI",
  ].find((name) => enabled(environment[name]));
  if (ciVariable)
    throw new Error(
      `Trusted local Admin SDK operations cannot run in CI (${ciVariable} is set).`,
    );
}

export function validateDatabaseUrl({ projectId, databaseUrl, emulator }) {
  if (emulator)
    return `http://127.0.0.1:9000?ns=${encodeURIComponent(projectId)}`;
  if (!databaseUrl)
    throw new Error(
      "Provide the exact Realtime Database URL with --database-url.",
    );
  let parsed;
  try {
    parsed = new URL(databaseUrl);
  } catch {
    throw new Error("The Realtime Database URL is invalid.");
  }
  const hostname = parsed.hostname.toLowerCase();
  const firebaseHost =
    hostname.endsWith(".firebasedatabase.app") ||
    hostname.endsWith(".firebaseio.com");
  if (
    parsed.protocol !== "https:" ||
    parsed.username ||
    parsed.password ||
    parsed.pathname !== "/" ||
    parsed.search ||
    parsed.hash ||
    !firebaseHost
  )
    throw new Error("Provide a root HTTPS Firebase Realtime Database URL.");
  if (
    hostname !== `${projectId}.firebaseio.com` &&
    !hostname.startsWith(`${projectId}-`)
  )
    throw new Error(
      "The Realtime Database URL does not match the target project.",
    );
  return parsed.origin;
}

function within(parent, child) {
  const path = relative(parent, child);
  return path === "" || (!path.startsWith("..") && !isAbsolute(path));
}

export function validateBackupOutputPath({
  output,
  projectId,
  repositoryPath = process.cwd(),
}) {
  if (!output?.endsWith(".gac-backup"))
    throw new Error("Backup output must end in .gac-backup.");

  const repository = resolve(repositoryPath);
  const outputPath = resolve(repository, output);
  if (!within(repository, outputPath)) return outputPath;

  const environment = projectId?.endsWith("-dev")
    ? "dev"
    : projectId?.endsWith("-prod")
      ? "prod"
      : null;
  if (!environment)
    throw new Error(
      "Repository-local backups require a project ID ending in -dev or -prod.",
    );

  const expectedDirectory = resolve(repository, ".backup", environment);
  if (dirname(outputPath) !== expectedDirectory)
    throw new Error(
      `Store this project backup directly in .backup/${environment}/.`,
    );

  return outputPath;
}

export async function validateAdminEnvironment({
  projectId,
  emulator,
  confirmedProjectId,
}) {
  if (!projectId) throw new Error("Provide the exact target project ID.");
  if (emulator) {
    if (!projectId.startsWith("demo-"))
      throw new Error("Emulator operations require a demo-* project ID.");
    return { credentialPath: null };
  }
  if (projectId.startsWith("demo-"))
    throw new Error("Demo project IDs require emulator mode.");
  requireExactProjectConfirmation({ projectId, confirmedProjectId });

  const configuredPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (!configuredPath)
    throw new Error(
      "Set GOOGLE_APPLICATION_CREDENTIALS to a local service-account file outside the repository.",
    );
  const credentialPath = await realpath(resolve(configuredPath));
  const repositoryPath = await realpath(process.cwd());
  if (within(repositoryPath, credentialPath))
    console.warn(
      "WARNING: GOOGLE_APPLICATION_CREDENTIALS points inside the repository. Move it outside before continuing.",
    );
  const metadata = await stat(credentialPath);
  if (!metadata.isFile()) throw new Error("The credential path is not a file.");
  if ((metadata.mode & 0o077) !== 0)
    throw new Error(
      "The credential file is readable by group/others. Restrict it to mode 600 and retry.",
    );
  const credential = JSON.parse(await readFile(credentialPath, "utf8"));
  if (credential.project_id !== projectId)
    throw new Error(
      `Credential project mismatch: expected ${projectId}, received ${credential.project_id ?? "none"}.`,
    );
  return { credentialPath };
}
