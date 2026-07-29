import type { BuildInfo } from "../../lib/buildInfo";

export function parseBuildInfo(value: unknown): BuildInfo | null {
  if (!value || typeof value !== "object") return null;
  const candidate = value as Record<string, unknown>;
  if (
    typeof candidate.sha !== "string" ||
    typeof candidate.ref !== "string" ||
    typeof candidate.builtAt !== "string" ||
    (candidate.schemaVersion !== undefined && candidate.schemaVersion !== 1)
  )
    return null;
  return {
    sha: candidate.sha,
    ref: candidate.ref,
    builtAt: candidate.builtAt,
  };
}

export function versionMetadataUrl(baseUrl: string, checkedAt: number) {
  return `${baseUrl}version.json?at=${checkedAt}`;
}

export async function fetchDeployedBuild(
  fetcher: typeof fetch,
  baseUrl: string,
  checkedAt: number,
) {
  const response = await fetcher(versionMetadataUrl(baseUrl, checkedAt), {
    cache: "no-store",
    headers: { Accept: "application/json" },
  });
  if (!response.ok) throw new Error("Version endpoint unavailable");
  const next = parseBuildInfo(await response.json());
  if (!next) throw new Error("Invalid version metadata");
  return next;
}
