import { describe, expect, it } from "vitest";
import {
  deriveOrganizerIdleState,
  ORGANIZER_IDLE_TIMEOUT_MS,
  ORGANIZER_IDLE_WARNING_MS,
} from "./organizerSession";

describe("organizer idle session", () => {
  it("becomes warning five minutes before expiry and expires at the deadline", () => {
    const now = 1_000_000;
    expect(
      deriveOrganizerIdleState(now + ORGANIZER_IDLE_TIMEOUT_MS, now).state,
    ).toBe("active");
    expect(
      deriveOrganizerIdleState(now + ORGANIZER_IDLE_WARNING_MS, now).state,
    ).toBe("warning");
    expect(deriveOrganizerIdleState(now, now)).toEqual({
      state: "expired",
      remainingMs: 0,
    });
  });
});
