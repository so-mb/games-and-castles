import { describe, expect, it } from "vitest";
import {
  buildPrivateCleanupMutation,
  PRIVATE_CLEANUP_PATHS,
} from "./private-cleanup.mjs";

describe("post-event private cleanup", () => {
  it("builds one bounded update while preserving public results", () => {
    const root = {
      birthdayVault: {
        privateMessages: { one: { message: "private" } },
        moderation: { one: { status: "approved" } },
        submissionReceipts: { receipt: { active: true } },
        publishedMessages: { public: { message: "published" } },
      },
      specialReveal: {
        privateConfig: { eventId: "event" },
        predictions: { one: { selection: "option-a" } },
        predictionReceipts: { receipt: { active: true } },
        publicResolution: { eventId: "event" },
      },
      championshipLedger: { predictionSources: { event: { entries: {} } } },
    };
    const result = buildPrivateCleanupMutation({
      root,
      auditId: "audit-id",
      now: 100,
    });
    expect(result.applied).toBe(true);
    for (const path of PRIVATE_CLEANUP_PATHS)
      expect(result.updates[path]).toBeNull();
    expect(result.updates).not.toHaveProperty(
      "birthdayVault/publishedMessages",
    );
    expect(result.updates).not.toHaveProperty("specialReveal/publicResolution");
    expect(result.updates).not.toHaveProperty(
      "championshipLedger/predictionSources",
    );
    expect(result.updates["audit/audit-id"]).toMatchObject({
      action: "private-data-purged",
    });
  });

  it("is idempotent when private paths are already absent", () => {
    expect(
      buildPrivateCleanupMutation({ root: {}, auditId: "unused", now: 100 }),
    ).toMatchObject({ applied: false, updates: null });
  });
});
