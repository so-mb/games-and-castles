import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { onValue, ref } from "firebase/database";
import { useFirebase } from "./FirebaseProvider";

export type ConnectionState =
  "unconfigured" | "connecting" | "online" | "offline";

const ConnectionContext = createContext<ConnectionState | null>(null);

export function ConnectionProvider({ children }: { children: ReactNode }) {
  const firebase = useFirebase();
  const [connection, setConnection] = useState<ConnectionState>(
    firebase.status === "ready" ? "connecting" : "unconfigured",
  );

  useEffect(() => {
    if (firebase.status !== "ready") return;
    return onValue(
      ref(firebase.clients.guestDatabase, ".info/connected"),
      (snapshot) =>
        setConnection(snapshot.val() === true ? "online" : "offline"),
      () => setConnection("offline"),
    );
  }, [firebase]);

  const value = useMemo(() => connection, [connection]);
  return (
    <ConnectionContext.Provider value={value}>
      {children}
    </ConnectionContext.Provider>
  );
}

// Hooks intentionally share this module with their provider.
// eslint-disable-next-line react-refresh/only-export-components
export function useConnection() {
  const value = useContext(ConnectionContext);
  if (!value) {
    throw new Error("useConnection must be used within ConnectionProvider");
  }
  return value;
}
