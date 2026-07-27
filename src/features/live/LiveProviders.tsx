import type { ReactNode } from "react";
import { AuthProvider } from "../auth/AuthProvider";
import { CompetitionsProvider } from "../competitions/CompetitionsProvider";
import { ChampionshipProvider } from "../championship/ChampionshipProvider";
import { ParticipantsProvider } from "../participants/ParticipantsProvider";
import { ConnectionProvider } from "./ConnectionProvider";
import { FirebaseProvider } from "./FirebaseProvider";

export function LiveProviders({ children }: { children: ReactNode }) {
  return (
    <FirebaseProvider>
      <AuthProvider>
        <ConnectionProvider>
          <ParticipantsProvider>
            <CompetitionsProvider>
              <ChampionshipProvider>{children}</ChampionshipProvider>
            </CompetitionsProvider>
          </ParticipantsProvider>
        </ConnectionProvider>
      </AuthProvider>
    </FirebaseProvider>
  );
}
