import { getApp, getApps, initializeApp, type FirebaseApp } from "firebase/app";
import {
  browserLocalPersistence,
  connectAuthEmulator,
  getAuth,
  setPersistence,
  type Auth,
} from "firebase/auth";
import {
  connectDatabaseEmulator,
  getDatabase,
  type Database,
} from "firebase/database";
import {
  connectFunctionsEmulator,
  getFunctions,
  type Functions,
} from "firebase/functions";
import {
  firebaseFunctionsEmulatorPort,
  firebaseFunctionsRegion,
} from "./constants";
import type { FirebaseRuntimeConfig } from "./config";

const organizerAppName = "games-and-castles-organizer";
const emulatorConnections = new Set<string>();

export interface FirebaseClients {
  guestApp: FirebaseApp;
  guestAuth: Auth;
  guestDatabase: Database;
  organizerApp: FirebaseApp;
  organizerAuth: Auth;
  organizerDatabase: Database;
  organizerFunctions: Functions;
  persistenceReady: Promise<void>;
  useEmulators: boolean;
}

function getOrCreateApp(
  options: Extract<FirebaseRuntimeConfig, { status: "configured" }>["options"],
  name?: string,
) {
  const existing = getApps().find((app) => app.name === (name ?? "[DEFAULT]"));
  return existing ?? initializeApp(options, name);
}

function connectEmulatorsOnce(auth: Auth, database: Database, key: string) {
  if (emulatorConnections.has(key)) return;

  connectAuthEmulator(auth, "http://127.0.0.1:9099", {
    disableWarnings: true,
  });
  connectDatabaseEmulator(database, "127.0.0.1", 9000);
  emulatorConnections.add(key);
}

function connectFunctionsEmulatorOnce(functions: Functions, key: string) {
  if (emulatorConnections.has(key)) return;
  connectFunctionsEmulator(
    functions,
    "127.0.0.1",
    firebaseFunctionsEmulatorPort,
  );
  emulatorConnections.add(key);
}

export function createFirebaseClients(
  runtimeConfig: Extract<FirebaseRuntimeConfig, { status: "configured" }>,
): FirebaseClients {
  const guestApp = getApps().some((app) => app.name === "[DEFAULT]")
    ? getApp()
    : getOrCreateApp(runtimeConfig.options);
  const organizerApp = getOrCreateApp(runtimeConfig.options, organizerAppName);
  const guestAuth = getAuth(guestApp);
  const organizerAuth = getAuth(organizerApp);
  const guestDatabase = getDatabase(guestApp);
  const organizerDatabase = getDatabase(organizerApp);
  const organizerFunctions = getFunctions(
    organizerApp,
    firebaseFunctionsRegion,
  );

  if (runtimeConfig.useEmulators) {
    connectEmulatorsOnce(guestAuth, guestDatabase, "guest");
    connectEmulatorsOnce(organizerAuth, organizerDatabase, "organizer");
    connectFunctionsEmulatorOnce(organizerFunctions, "organizer-functions");
  }

  return {
    guestApp,
    guestAuth,
    guestDatabase,
    organizerApp,
    organizerAuth,
    organizerDatabase,
    organizerFunctions,
    persistenceReady: Promise.all([
      setPersistence(guestAuth, browserLocalPersistence),
      setPersistence(organizerAuth, browserLocalPersistence),
    ]).then(() => undefined),
    useEmulators: runtimeConfig.useEmulators,
  };
}
