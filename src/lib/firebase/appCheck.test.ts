import { beforeEach, describe, expect, it, vi } from "vitest";

const firebaseAppCheck = vi.hoisted(() => ({
  initialize: vi.fn(),
  token: vi.fn(),
  provider: vi.fn(),
}));

vi.mock("firebase/app-check", () => ({
  initializeAppCheck: firebaseAppCheck.initialize,
  getToken: firebaseAppCheck.token,
  ReCaptchaEnterpriseProvider: firebaseAppCheck.provider,
}));

import { initializeAppCheckClients } from "./appCheck";

describe("staged App Check initialization", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete window.FIREBASE_APPCHECK_DEBUG_TOKEN;
    delete window.__GAC_APP_CHECK_INSTANCES__;
    firebaseAppCheck.initialize
      .mockReturnValueOnce({ name: "guest" })
      .mockReturnValueOnce({ name: "organizer" });
    firebaseAppCheck.token.mockResolvedValue({ token: "attested" });
  });

  it("keeps both clients disabled without calling the SDK", async () => {
    const result = await initializeAppCheckClients({
      config: { status: "disabled" },
      guestApp: {} as never,
      organizerApp: {} as never,
    });
    expect(result.guest.status).toBe("disabled");
    expect(firebaseAppCheck.initialize).not.toHaveBeenCalled();
  });

  it("initializes and probes guest and organizer app instances", async () => {
    const result = await initializeAppCheckClients({
      config: {
        status: "enabled",
        provider: "recaptcha-enterprise",
        siteKey: "public-site-key",
        debug: true,
      },
      guestApp: { name: "[DEFAULT]" } as never,
      organizerApp: { name: "organizer" } as never,
    });
    expect(firebaseAppCheck.initialize).toHaveBeenCalledTimes(2);
    expect(firebaseAppCheck.token).toHaveBeenCalledTimes(2);
    expect(result.guest).toMatchObject({
      status: "ready",
      tokenAvailable: true,
    });
    expect(result.organizer.status).toBe("ready");
    expect(window.FIREBASE_APPCHECK_DEBUG_TOKEN).toBe(true);
    expect(result.enforcement).toBe("unknown");
  });

  it("degrades safely when token acquisition fails", async () => {
    firebaseAppCheck.token.mockRejectedValue(new Error("network"));
    const result = await initializeAppCheckClients({
      config: {
        status: "enabled",
        provider: "recaptcha-enterprise",
        siteKey: "public-site-key",
        debug: false,
      },
      guestApp: {} as never,
      organizerApp: {} as never,
    });
    expect(result.guest.status).toBe("degraded");
    expect(result.organizer.status).toBe("degraded");
  });

  it("isolates an initialization failure to one Firebase app", async () => {
    firebaseAppCheck.initialize
      .mockReset()
      .mockImplementationOnce(() => {
        throw new Error("guest initialization failed");
      })
      .mockReturnValueOnce({ name: "organizer" });

    const result = await initializeAppCheckClients({
      config: {
        status: "enabled",
        provider: "recaptcha-enterprise",
        siteKey: "public-site-key",
        debug: false,
      },
      guestApp: { name: "[DEFAULT]" } as never,
      organizerApp: { name: "organizer" } as never,
    });

    expect(result.guest).toMatchObject({
      status: "degraded",
      tokenAvailable: false,
    });
    expect(result.organizer).toMatchObject({
      status: "ready",
      tokenAvailable: true,
    });
  });

  it("reuses both App Check instances across module refresh-style calls", async () => {
    const input = {
      config: {
        status: "enabled" as const,
        provider: "recaptcha-enterprise" as const,
        siteKey: "public-site-key",
        debug: false,
      },
      guestApp: { name: "[DEFAULT]" } as never,
      organizerApp: { name: "organizer" } as never,
    };

    await initializeAppCheckClients(input);
    await initializeAppCheckClients(input);

    expect(firebaseAppCheck.initialize).toHaveBeenCalledTimes(2);
    expect(firebaseAppCheck.token).toHaveBeenCalledTimes(4);
  });
});
