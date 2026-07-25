import { createContext, useContext, useMemo, type ReactNode } from "react";
import {
  createFirebaseClients,
  type FirebaseClients,
} from "../../lib/firebase/client";
import {
  readFirebaseRuntimeConfig,
  type FirebaseRuntimeConfig,
} from "../../lib/firebase/config";

export type FirebaseContextValue =
  | {
      status: "unconfigured";
      config: Extract<FirebaseRuntimeConfig, { status: "unconfigured" }>;
      clients: null;
    }
  | {
      status: "ready";
      config: Extract<FirebaseRuntimeConfig, { status: "configured" }>;
      clients: FirebaseClients;
    }
  | {
      status: "error";
      config: Extract<FirebaseRuntimeConfig, { status: "configured" }>;
      clients: null;
    };

const FirebaseContext = createContext<FirebaseContextValue | null>(null);

interface FirebaseProviderProps {
  children: ReactNode;
  runtimeConfig?: FirebaseRuntimeConfig;
  createClients?: typeof createFirebaseClients;
}

export function FirebaseProvider({
  children,
  runtimeConfig = readFirebaseRuntimeConfig(),
  createClients = createFirebaseClients,
}: FirebaseProviderProps) {
  const value = useMemo<FirebaseContextValue>(() => {
    if (runtimeConfig.status === "unconfigured") {
      return { status: "unconfigured", config: runtimeConfig, clients: null };
    }

    try {
      return {
        status: "ready",
        config: runtimeConfig,
        clients: createClients(runtimeConfig),
      };
    } catch {
      return { status: "error", config: runtimeConfig, clients: null };
    }
  }, [createClients, runtimeConfig]);

  return (
    <FirebaseContext.Provider value={value}>
      {children}
    </FirebaseContext.Provider>
  );
}

// Hooks intentionally share this module with their provider.
// eslint-disable-next-line react-refresh/only-export-components
export function useFirebase() {
  const value = useContext(FirebaseContext);
  if (!value)
    throw new Error("useFirebase must be used within FirebaseProvider");
  return value;
}
