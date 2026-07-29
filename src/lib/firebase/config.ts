import type { FirebaseOptions } from "firebase/app";

export const firebaseEnvironmentKeys = [
  "VITE_FIREBASE_API_KEY",
  "VITE_FIREBASE_AUTH_DOMAIN",
  "VITE_FIREBASE_DATABASE_URL",
  "VITE_FIREBASE_PROJECT_ID",
  "VITE_FIREBASE_APP_ID",
  "VITE_FIREBASE_MESSAGING_SENDER_ID",
] as const;

type FirebaseEnvironmentKey = (typeof firebaseEnvironmentKeys)[number];
type FirebaseEnvironment = Partial<
  Record<
    | FirebaseEnvironmentKey
    | "VITE_FIREBASE_USE_EMULATORS"
    | "VITE_FIREBASE_APP_CHECK_ENABLED"
    | "VITE_FIREBASE_APP_CHECK_SITE_KEY"
    | "VITE_FIREBASE_APP_CHECK_PROVIDER"
    | "VITE_FIREBASE_APP_CHECK_DEBUG",
    string
  >
>;

export type AppCheckRuntimeConfig =
  | { status: "disabled" }
  | {
      status: "enabled";
      provider: "recaptcha-enterprise";
      siteKey: string;
      debug: boolean;
    }
  | {
      status: "invalid";
      reason:
        | "missing-site-key"
        | "unsupported-provider"
        | "production-debug"
        | "debug-while-disabled";
    };

export type FirebaseRuntimeConfig =
  | {
      status: "configured";
      options: FirebaseOptions & {
        apiKey: string;
        authDomain: string;
        databaseURL: string;
        projectId: string;
        appId: string;
        messagingSenderId: string;
      };
      useEmulators: boolean;
      appCheck: AppCheckRuntimeConfig;
    }
  | {
      status: "unconfigured";
      missing: FirebaseEnvironmentKey[];
      reason: "missing" | "invalid";
    };

function clean(value: string | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

export function readAppCheckRuntimeConfig(
  environment: FirebaseEnvironment,
  production: boolean,
): AppCheckRuntimeConfig {
  const enabled =
    clean(environment.VITE_FIREBASE_APP_CHECK_ENABLED)?.toLowerCase() ===
    "true";
  const debug =
    clean(environment.VITE_FIREBASE_APP_CHECK_DEBUG)?.toLowerCase() === "true";
  const provider =
    clean(environment.VITE_FIREBASE_APP_CHECK_PROVIDER)?.toLowerCase() ??
    "enterprise";
  const siteKey = clean(environment.VITE_FIREBASE_APP_CHECK_SITE_KEY);

  if (!enabled)
    return debug
      ? { status: "invalid", reason: "debug-while-disabled" }
      : { status: "disabled" };
  if (debug && production)
    return { status: "invalid", reason: "production-debug" };
  if (!["enterprise", "recaptcha-enterprise"].includes(provider))
    return { status: "invalid", reason: "unsupported-provider" };
  if (!siteKey) return { status: "invalid", reason: "missing-site-key" };

  return {
    status: "enabled",
    provider: "recaptcha-enterprise",
    siteKey,
    debug,
  };
}

export function readFirebaseRuntimeConfig(
  environment: FirebaseEnvironment = import.meta.env,
  production = import.meta.env.PROD,
): FirebaseRuntimeConfig {
  const values = Object.fromEntries(
    firebaseEnvironmentKeys.map((key) => [key, clean(environment[key])]),
  ) as Record<FirebaseEnvironmentKey, string | undefined>;
  const missing = firebaseEnvironmentKeys.filter((key) => !values[key]);

  if (missing.length > 0) {
    return { status: "unconfigured", missing, reason: "missing" };
  }

  const useEmulators =
    clean(environment.VITE_FIREBASE_USE_EMULATORS)?.toLowerCase() === "true";

  try {
    const databaseUrl = new URL(values.VITE_FIREBASE_DATABASE_URL!);
    if (!["https:", "http:"].includes(databaseUrl.protocol)) {
      throw new Error("Unsupported Firebase Database URL protocol");
    }
  } catch {
    return {
      status: "unconfigured",
      missing: [],
      reason: "invalid",
    };
  }

  return {
    status: "configured",
    options: {
      apiKey: values.VITE_FIREBASE_API_KEY!,
      authDomain: values.VITE_FIREBASE_AUTH_DOMAIN!,
      databaseURL: values.VITE_FIREBASE_DATABASE_URL!,
      projectId: values.VITE_FIREBASE_PROJECT_ID!,
      appId: values.VITE_FIREBASE_APP_ID!,
      messagingSenderId: values.VITE_FIREBASE_MESSAGING_SENDER_ID!,
    },
    useEmulators,
    appCheck: readAppCheckRuntimeConfig(environment, production),
  };
}
