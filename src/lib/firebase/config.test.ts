import { describe, expect, it } from "vitest";
import { readAppCheckRuntimeConfig, readFirebaseRuntimeConfig } from "./config";

const configuredEnvironment = {
  VITE_FIREBASE_API_KEY: "public-api-key",
  VITE_FIREBASE_AUTH_DOMAIN: "demo.firebaseapp.com",
  VITE_FIREBASE_DATABASE_URL:
    "https://demo-default-rtdb.europe-west1.firebasedatabase.app",
  VITE_FIREBASE_PROJECT_ID: "demo-project",
  VITE_FIREBASE_APP_ID: "1:123:web:abc",
  VITE_FIREBASE_MESSAGING_SENDER_ID: "123",
};

describe("Firebase runtime configuration", () => {
  it("reports every missing required key without throwing", () => {
    const result = readFirebaseRuntimeConfig({});
    expect(result.status).toBe("unconfigured");
    if (result.status === "unconfigured")
      expect(result.missing).toHaveLength(6);
  });

  it("parses a complete public configuration", () => {
    const result = readFirebaseRuntimeConfig(configuredEnvironment);
    expect(result.status).toBe("configured");
    if (result.status === "configured") {
      expect(result.options.projectId).toBe("demo-project");
      expect(result.useEmulators).toBe(false);
      expect(result.appCheck).toEqual({ status: "disabled" });
    }
  });

  it("enables emulators only for an explicit true value", () => {
    const result = readFirebaseRuntimeConfig({
      ...configuredEnvironment,
      VITE_FIREBASE_USE_EMULATORS: "TRUE",
    });
    expect(result.status === "configured" && result.useEmulators).toBe(true);
  });

  it("rejects an invalid database URL", () => {
    const result = readFirebaseRuntimeConfig({
      ...configuredEnvironment,
      VITE_FIREBASE_DATABASE_URL: "not a URL",
    });
    expect(result).toMatchObject({ status: "unconfigured", reason: "invalid" });
  });

  it("stages Enterprise App Check only with an explicit complete config", () => {
    expect(
      readAppCheckRuntimeConfig(
        {
          VITE_FIREBASE_APP_CHECK_ENABLED: "true",
          VITE_FIREBASE_APP_CHECK_PROVIDER: "enterprise",
          VITE_FIREBASE_APP_CHECK_SITE_KEY: "public-site-key",
        },
        false,
      ),
    ).toEqual({
      status: "enabled",
      provider: "recaptcha-enterprise",
      siteKey: "public-site-key",
      debug: false,
    });
  });

  it("rejects production debug mode and incomplete App Check settings", () => {
    expect(
      readAppCheckRuntimeConfig(
        {
          VITE_FIREBASE_APP_CHECK_ENABLED: "true",
          VITE_FIREBASE_APP_CHECK_SITE_KEY: "public-site-key",
          VITE_FIREBASE_APP_CHECK_DEBUG: "true",
        },
        true,
      ),
    ).toEqual({ status: "invalid", reason: "production-debug" });
    expect(
      readAppCheckRuntimeConfig(
        { VITE_FIREBASE_APP_CHECK_ENABLED: "true" },
        false,
      ),
    ).toEqual({ status: "invalid", reason: "missing-site-key" });
  });
});
