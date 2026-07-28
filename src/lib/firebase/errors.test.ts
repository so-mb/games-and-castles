import { describe, expect, it } from "vitest";
import { friendlyFirebaseError } from "./errors";

describe("friendlyFirebaseError", () => {
  it("maps the wrong-password code returned by the Auth emulator", () => {
    const error = Object.assign(new Error("Firebase rejected the password."), {
      code: "auth/wrong-password",
    });

    expect(friendlyFirebaseError(error)).toBe(
      "That email and password combination was not accepted.",
    );
  });

  it("maps a code-less Realtime Database permission error", () => {
    expect(friendlyFirebaseError(new Error("Permission denied"))).toBe(
      "Firebase rejected the operation. Reauthenticate and reload the latest state.",
    );
  });
});
