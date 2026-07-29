import { describe, expect, it } from "vitest";
import { validateAdminEnvironment } from "./admin-safety.mjs";

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
});
