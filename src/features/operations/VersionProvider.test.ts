import { describe, expect, it, vi } from "vitest";
import {
  fetchDeployedBuild,
  parseBuildInfo,
  versionMetadataUrl,
} from "./versionMetadata";

describe("deployed version metadata", () => {
  it("uses the GitHub Pages repository base path", () => {
    expect(versionMetadataUrl("/games-and-castles/", 42)).toBe(
      "/games-and-castles/version.json?at=42",
    );
  });

  it("accepts the current metadata schema", () => {
    expect(
      parseBuildInfo({
        schemaVersion: 1,
        sha: "abc",
        ref: "refs/heads/master",
        builtAt: "2026-07-28T00:00:00Z",
      }),
    ).toEqual({
      sha: "abc",
      ref: "refs/heads/master",
      builtAt: "2026-07-28T00:00:00Z",
    });
  });

  it("fails closed when the deployed request fails", async () => {
    const fetcher = vi.fn().mockResolvedValue({ ok: false });
    await expect(
      fetchDeployedBuild(fetcher, "/games-and-castles/", 42),
    ).rejects.toThrow("Version endpoint unavailable");
  });
});
