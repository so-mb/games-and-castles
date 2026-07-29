import {
  getToken,
  initializeAppCheck,
  ReCaptchaEnterpriseProvider,
  type AppCheck,
} from "firebase/app-check";
import type { FirebaseApp } from "firebase/app";
import type { AppCheckRuntimeConfig } from "./config";

export type AppCheckClientState =
  | { status: "disabled"; tokenAvailable: false; message: string }
  | { status: "invalid"; tokenAvailable: false; message: string }
  | {
      status: "ready" | "degraded";
      tokenAvailable: boolean;
      message: string;
    };

export interface AppCheckDiagnostics {
  provider: "disabled" | "recaptcha-enterprise";
  debug: boolean;
  enforcement: "unknown";
  guest: AppCheckClientState;
  organizer: AppCheckClientState;
}

declare global {
  interface Window {
    FIREBASE_APPCHECK_DEBUG_TOKEN?: boolean | string;
    __GAC_APP_CHECK_INSTANCES__?: Record<string, AppCheck>;
  }
}

function invalidMessage(
  config: Extract<AppCheckRuntimeConfig, { status: "invalid" }>,
) {
  switch (config.reason) {
    case "missing-site-key":
      return "App Check is enabled but its site key is missing.";
    case "unsupported-provider":
      return "The configured App Check provider is unsupported.";
    case "production-debug":
      return "App Check debug mode is blocked in production builds.";
    case "debug-while-disabled":
      return "App Check debug mode cannot be enabled while App Check is disabled.";
  }
}

function getOrInitializeAppCheck(app: FirebaseApp, siteKey: string) {
  const instances = (window.__GAC_APP_CHECK_INSTANCES__ ??= {});
  const existing = instances[app.name];
  if (existing) return existing;
  const appCheck = initializeAppCheck(app, {
    provider: new ReCaptchaEnterpriseProvider(siteKey),
    isTokenAutoRefreshEnabled: true,
  });
  instances[app.name] = appCheck;
  return appCheck;
}

async function probe(appCheck: AppCheck): Promise<AppCheckClientState> {
  try {
    const result = await getToken(appCheck);
    return result.token
      ? {
          status: "ready",
          tokenAvailable: true,
          message: "Attestation token available.",
        }
      : {
          status: "degraded",
          tokenAvailable: false,
          message: "App Check initialized without an attestation token.",
        };
  } catch {
    return {
      status: "degraded",
      tokenAvailable: false,
      message:
        "App Check could not obtain a token. Firebase remains available while enforcement is staged off.",
    };
  }
}

async function initializeClient(
  app: FirebaseApp,
  siteKey: string,
): Promise<AppCheckClientState> {
  try {
    return await probe(getOrInitializeAppCheck(app, siteKey));
  } catch {
    return {
      status: "degraded",
      tokenAvailable: false,
      message:
        "App Check could not initialize for this Firebase context. Firebase remains available while enforcement is staged off.",
    };
  }
}

export function initializeAppCheckClients(input: {
  config: AppCheckRuntimeConfig;
  guestApp: FirebaseApp;
  organizerApp: FirebaseApp;
}): Promise<AppCheckDiagnostics> {
  if (input.config.status === "disabled")
    return Promise.resolve({
      provider: "disabled",
      debug: false,
      enforcement: "unknown",
      guest: {
        status: "disabled",
        tokenAvailable: false,
        message: "App Check is staged off for this build.",
      },
      organizer: {
        status: "disabled",
        tokenAvailable: false,
        message: "App Check is staged off for this build.",
      },
    });

  if (input.config.status === "invalid") {
    const message = invalidMessage(input.config);
    return Promise.resolve({
      provider: "disabled",
      debug: false,
      enforcement: "unknown",
      guest: { status: "invalid", tokenAvailable: false, message },
      organizer: { status: "invalid", tokenAvailable: false, message },
    });
  }

  const config = input.config;
  if (config.debug) window.FIREBASE_APPCHECK_DEBUG_TOKEN = true;
  return Promise.all([
    initializeClient(input.guestApp, config.siteKey),
    initializeClient(input.organizerApp, config.siteKey),
  ]).then(([guestState, organizerState]) => ({
    provider: config.provider,
    debug: config.debug,
    enforcement: "unknown" as const,
    guest: guestState,
    organizer: organizerState,
  }));
}
