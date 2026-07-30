import { describe, expect, it } from "vitest";
import {
  assertTrustedLocalExecution,
  requireExactProjectConfirmation,
  validateAdminEnvironment,
  validateDatabaseUrl,
} from "./admin-safety.mjs";

describe("trusted Admin SDK target safety", () => {
  it("requires demo project IDs for emulator operations", async () => {
    await expect(
      validateAdminEnvironment({
        projectId: "production-project",
        emulator: true,
      }),
    ).rejects.toThrow("demo-* project ID");
  });

  it("requires an exact repeated project ID before remote credentials", async () => {
    await expect(
      validateAdminEnvironment({
        projectId: "production-project",
        emulator: false,
        confirmedProjectId: "different-project",
      }),
    ).rejects.toThrow("Repeat the exact project ID");
  });

  it("can require exact project confirmation before emulator operations", () => {
    expect(() =>
      requireExactProjectConfirmation({
        projectId: "demo-games-and-castles",
        confirmedProjectId: "demo-other-project",
      }),
    ).toThrow("Repeat the exact project ID");
    expect(() =>
      requireExactProjectConfirmation({
        projectId: "demo-games-and-castles",
        confirmedProjectId: "demo-games-and-castles",
      }),
    ).not.toThrow();
  });

  it("refuses trusted local operations in CI environments", () => {
    expect(() => assertTrustedLocalExecution({ CI: "true" })).toThrow(
      "cannot run in CI",
    );
    expect(() => assertTrustedLocalExecution({ GITHUB_ACTIONS: "1" })).toThrow(
      "cannot run in CI",
    );
    expect(() => assertTrustedLocalExecution({ CI: "false" })).not.toThrow();
  });

  it("requires a root database URL belonging to the confirmed project", () => {
    expect(
      validateDatabaseUrl({
        projectId: "games-and-castles-dev",
        databaseUrl:
          "https://games-and-castles-dev-default-rtdb.europe-west1.firebasedatabase.app",
        emulator: false,
      }),
    ).toBe(
      "https://games-and-castles-dev-default-rtdb.europe-west1.firebasedatabase.app",
    );
    expect(() =>
      validateDatabaseUrl({
        projectId: "games-and-castles-dev",
        databaseUrl:
          "https://games-and-castles-prod-default-rtdb.europe-west1.firebasedatabase.app",
        emulator: false,
      }),
    ).toThrow("does not match");
    expect(() =>
      validateDatabaseUrl({
        projectId: "games-and-castles-dev",
        emulator: false,
      }),
    ).toThrow("--database-url");
  });
});
