import { describe, expect, it, vi } from "vitest";
import {
  isDatabasePermissionDenied,
  waitForRecentDatabaseAuthorization,
} from "./recentDatabaseAuthorization";

function permissionDenied(code = "PERMISSION_DENIED") {
  return Object.assign(new Error("Permission denied"), { code });
}

describe("recent Database authorization handoff", () => {
  it("recognizes Realtime Database permission errors", () => {
    expect(isDatabasePermissionDenied(permissionDenied())).toBe(true);
    expect(
      isDatabasePermissionDenied(
        permissionDenied("database/permission-denied"),
      ),
    ).toBe(true);
    expect(isDatabasePermissionDenied(new Error("Network unavailable"))).toBe(
      false,
    );
  });

  it("waits for the refreshed Auth token to reach Database", async () => {
    const readProbe = vi
      .fn()
      .mockRejectedValueOnce(permissionDenied())
      .mockRejectedValueOnce(permissionDenied())
      .mockResolvedValue(undefined);
    const wait = vi.fn().mockResolvedValue(undefined);

    await waitForRecentDatabaseAuthorization({
      readProbe,
      wait,
      retryDelaysMs: [0, 100, 250],
    });

    expect(readProbe).toHaveBeenCalledTimes(3);
    expect(wait.mock.calls).toEqual([[100], [250]]);
  });

  it("does not retry unrelated read failures", async () => {
    const failure = new Error("Network unavailable");
    const readProbe = vi.fn().mockRejectedValue(failure);
    const wait = vi.fn().mockResolvedValue(undefined);

    await expect(
      waitForRecentDatabaseAuthorization({ readProbe, wait }),
    ).rejects.toBe(failure);
    expect(readProbe).toHaveBeenCalledOnce();
    expect(wait).not.toHaveBeenCalled();
  });

  it("returns a useful error when Database never accepts the token", async () => {
    const readProbe = vi.fn().mockRejectedValue(permissionDenied());
    const wait = vi.fn().mockResolvedValue(undefined);

    await expect(
      waitForRecentDatabaseAuthorization({
        readProbe,
        wait,
        retryDelaysMs: [0, 100],
      }),
    ).rejects.toThrow("did not accept the refreshed organizer session");
    expect(readProbe).toHaveBeenCalledTimes(2);
  });
});
