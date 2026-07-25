import type { ReactNode } from "react";
import { AuthProvider } from "../auth/AuthProvider";
import { ParticipantsProvider } from "../participants/ParticipantsProvider";
import { ConnectionProvider } from "./ConnectionProvider";
import { FirebaseProvider } from "./FirebaseProvider";

export function LiveProviders({ children }: { children: ReactNode }) {
  return (
    <FirebaseProvider>
      <AuthProvider>
        <ConnectionProvider>
          <ParticipantsProvider>{children}</ParticipantsProvider>
        </ConnectionProvider>
      </AuthProvider>
    </FirebaseProvider>
  );
}
