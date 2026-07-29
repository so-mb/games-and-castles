import { describe, expect, it } from "vitest";
import { isDifferentDeployedBuild } from "./buildInfo";

describe("deployed build comparison", () => {
  it("reports only a different non-local commit as an update", () => {
    const current = { sha: "abc", ref: "refs/heads/master", builtAt: "one" };
    expect(
      isDifferentDeployedBuild(current, {
        sha: "def",
        ref: "refs/heads/master",
        builtAt: "two",
      }),
    ).toBe(true);
    expect(isDifferentDeployedBuild(current, { ...current })).toBe(false);
    expect(
      isDifferentDeployedBuild(
        { ...current, sha: "local" },
        { ...current, sha: "def" },
      ),
    ).toBe(false);
  });
});
