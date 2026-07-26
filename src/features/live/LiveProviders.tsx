import type { ReactNode } from "react";
import { AuthProvider } from "../auth/AuthProvider";
import { CompetitionsProvider } from "../competitions/CompetitionsProvider";
import { ParticipantsProvider } from "../participants/ParticipantsProvider";
import { ConnectionProvider } from "./ConnectionProvider";
import { FirebaseProvider } from "./FirebaseProvider";

export function LiveProviders({ children }: { children: ReactNode }) {
  return (
    <FirebaseProvider>
      <AuthProvider>
        <ConnectionProvider>
          <ParticipantsProvider>
            <CompetitionsProvider>{children}</CompetitionsProvider>
          </ParticipantsProvider>
        </ConnectionProvider>
      </AuthProvider>
    </FirebaseProvider>
  );
}
