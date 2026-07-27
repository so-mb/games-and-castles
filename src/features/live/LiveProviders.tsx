import type { ReactNode } from "react";
import { AuthProvider } from "../auth/AuthProvider";
import { CompetitionsProvider } from "../competitions/CompetitionsProvider";
import { ChampionshipProvider } from "../championship/ChampionshipProvider";
import { ParticipantsProvider } from "../participants/ParticipantsProvider";
import { BirthdayVaultProvider } from "../birthday-vault/BirthdayVaultProvider";
import { ConnectionProvider } from "./ConnectionProvider";
import { FirebaseProvider } from "./FirebaseProvider";

export function LiveProviders({ children }: { children: ReactNode }) {
  return (
    <FirebaseProvider>
      <AuthProvider>
        <ConnectionProvider>
          <ParticipantsProvider>
            <BirthdayVaultProvider>
              <CompetitionsProvider>
                <ChampionshipProvider>{children}</ChampionshipProvider>
              </CompetitionsProvider>
            </BirthdayVaultProvider>
          </ParticipantsProvider>
        </ConnectionProvider>
      </AuthProvider>
    </FirebaseProvider>
  );
}
