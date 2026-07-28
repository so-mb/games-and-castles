import { beforeEach, describe, expect, it, vi } from "vitest";

const firebaseAuth = vi.hoisted(() => ({
  credential: vi.fn(() => ({ providerId: "password" })),
  reauthenticate: vi.fn(),
  token: vi.fn(),
}));

vi.mock("firebase/auth", () => ({
  EmailAuthProvider: { credential: firebaseAuth.credential },
  reauthenticateWithCredential: firebaseAuth.reauthenticate,
  getIdTokenResult: firebaseAuth.token,
}));

import {
  assertFreshRevealAuthorization,
  isSpecialRevealAuthRecent,
  reauthenticateSpecialRevealOrganizer,
} from "./specialRevealAuthorization";

const now = Date.parse("2026-07-28T10:00:00.000Z");
const user = { uid: "admin-uid", email: "organizer@example.test" };
const auth = { currentUser: user };

describe("Special Reveal reauthentication", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    firebaseAuth.reauthenticate.mockResolvedValue({ user });
    firebaseAuth.token.mockResolvedValue({
      claims: { admin: true, specialRevealAdmin: true },
      authTime: new Date(now).toISOString(),
    });
  });

  it("reauthenticates the current email account and force-refreshes claims", async () => {
    const result = await reauthenticateSpecialRevealOrganizer(
      auth as never,
      "current-password",
      now,
    );

    expect(firebaseAuth.credential).toHaveBeenCalledWith(
      user.email,
      "current-password",
    );
    expect(firebaseAuth.reauthenticate).toHaveBeenCalledWith(user, {
      providerId: "password",
    });
    expect(firebaseAuth.token).toHaveBeenCalledWith(user, true);
    expect(result).toEqual({
      uid: user.uid,
      email: user.email,
      authTimeMs: now,
      verifiedAtMs: now,
    });
  });

  it("blocks missing dedicated claims and expired authentication", async () => {
    firebaseAuth.token.mockResolvedValueOnce({
      claims: { admin: true },
      authTime: new Date(now).toISOString(),
    });
    await expect(
      reauthenticateSpecialRevealOrganizer(auth as never, "password", now),
    ).rejects.toThrow("protected reveal access");

    firebaseAuth.token.mockResolvedValueOnce({
      claims: { admin: true, specialRevealAdmin: true },
      authTime: new Date(now - 300_001).toISOString(),
    });
    await expect(
      reauthenticateSpecialRevealOrganizer(auth as never, "password", now),
    ).rejects.toThrow("Recent organizer authentication");
  });

  it("recognizes the five-minute boundary and one-action authorization age", () => {
    expect(isSpecialRevealAuthRecent(now - 300_000, now)).toBe(true);
    expect(isSpecialRevealAuthRecent(now - 300_001, now)).toBe(false);
    expect(() =>
      assertFreshRevealAuthorization(
        {
          uid: user.uid,
          email: user.email,
          authTimeMs: now,
          verifiedAtMs: now - 60_001,
        },
        user.uid,
        now,
      ),
    ).toThrow("Reauthenticate immediately");
  });
});
