import { readFile, realpath, stat } from "node:fs/promises";
import { isAbsolute, relative, resolve } from "node:path";

export function argument(name) {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

export function hasFlag(name) {
  return process.argv.includes(`--${name}`);
}

function within(parent, child) {
  const path = relative(parent, child);
  return path === "" || (!path.startsWith("..") && !isAbsolute(path));
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
  if (confirmedProjectId !== projectId)
    throw new Error(
      "Repeat the exact project ID with --confirm-project before a remote operation.",
    );

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
