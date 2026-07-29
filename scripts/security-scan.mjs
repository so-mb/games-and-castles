import { execFileSync } from "node:child_process";
import { readFile, readdir, stat } from "node:fs/promises";
import { basename, extname, join, relative } from "node:path";

const root = process.cwd();
const readableExtensions = new Set([
  "",
  ".css",
  ".html",
  ".js",
  ".json",
  ".md",
  ".mjs",
  ".svg",
  ".ts",
  ".tsx",
  ".txt",
  ".yml",
  ".yaml",
]);
const patterns = [
  {
    label: "private key material",
    pattern: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/g,
  },
  {
    label: "Google service-account private key",
    pattern: /"private_key"\s*:\s*"-----BEGIN/g,
  },
  {
    label: "GitHub access token",
    pattern: /\b(?:ghp|github_pat)_[A-Za-z0-9_]{30,}\b/g,
  },
  { label: "AWS access key", pattern: /\bAKIA[0-9A-Z]{16}\b/g },
  {
    label: "Slack access token",
    pattern: /\bxox[baprs]-[A-Za-z0-9-]{20,}\b/g,
  },
];

async function filesBelow(directory) {
  const files = [];
  try {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) files.push(...(await filesBelow(path)));
      else if (entry.isFile()) files.push(path);
    }
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }
  return files;
}

async function localBannedTerms() {
  try {
    return (await readFile(join(root, ".security-banned-terms.local"), "utf8"))
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith("#"));
  } catch (error) {
    if (error?.code === "ENOENT") return [];
    throw error;
  }
}

function lineNumber(content, index) {
  return content.slice(0, index).split("\n").length;
}

const repositoryFiles = execFileSync(
  "git",
  ["ls-files", "--cached", "--others", "--exclude-standard", "-z"],
  {
    cwd: root,
    encoding: "utf8",
  },
)
  .split("\0")
  .filter(Boolean)
  .map((path) => join(root, path));
const files = [
  ...new Set([...repositoryFiles, ...(await filesBelow(join(root, "dist")))]),
];
const bannedTerms = await localBannedTerms();
const findings = [];
let scanned = 0;

for (const path of files) {
  const repositoryPath = relative(root, path);
  const filename = basename(path);
  if (
    filename === ".env.local" ||
    filename.endsWith(".gacbackup") ||
    filename.endsWith(".gac-backup")
  )
    findings.push({
      path,
      line: 1,
      label: "sensitive local or backup file",
    });
  if (
    repositoryPath.startsWith(
      `.config${process.platform === "win32" ? "\\" : "/"}firebase`,
    )
  )
    findings.push({ path, line: 1, label: "Firebase CLI credential data" });
  if (!readableExtensions.has(extname(path).toLowerCase())) continue;
  const metadata = await stat(path);
  if (metadata.size > 5_000_000) continue;
  const content = await readFile(path, "utf8");
  scanned += 1;
  for (const { label, pattern } of patterns) {
    pattern.lastIndex = 0;
    for (const match of content.matchAll(pattern))
      findings.push({
        path,
        line: lineNumber(content, match.index ?? 0),
        label,
      });
  }
  const lower = content.toLocaleLowerCase("en");
  if (
    /"type"\s*:\s*"service_account"/.test(content) &&
    /"private_key_id"\s*:/.test(content) &&
    /"private_key"\s*:/.test(content)
  )
    findings.push({
      path,
      line: 1,
      label: "Firebase service-account JSON structure",
    });
  const credentialAssignment =
    /GOOGLE_APPLICATION_CREDENTIALS\s*=\s*["']?(\/[\w./ -]+\.json)/.exec(
      content,
    );
  if (
    credentialAssignment &&
    !credentialAssignment[1].includes("/absolute/path/")
  )
    findings.push({
      path,
      line: lineNumber(content, credentialAssignment.index),
      label: "absolute service-account credential path",
    });
  if (
    (repositoryPath.startsWith(".github/") ||
      repositoryPath.startsWith("dist/") ||
      filename.startsWith(".env")) &&
    /VITE_FIREBASE_APP_CHECK_DEBUG\s*[=:]\s*["']?true\b/i.test(content)
  )
    findings.push({
      path,
      line: 1,
      label: "App Check debug mode enabled in distributable configuration",
    });
  for (const term of bannedTerms) {
    const index = lower.indexOf(term.toLocaleLowerCase("en"));
    if (index >= 0)
      findings.push({
        path,
        line: lineNumber(content, index),
        label: "local banned term",
      });
  }
}

if (findings.length > 0) {
  console.error(
    `Security scan found ${findings.length} high-confidence issue(s):`,
  );
  for (const finding of findings)
    console.error(
      `- ${relative(root, finding.path)}:${finding.line} — ${finding.label}`,
    );
  process.exitCode = 1;
} else {
  console.log(
    `Security scan passed: ${scanned} repository/built text files; ${bannedTerms.length} local banned term(s).`,
  );
}
