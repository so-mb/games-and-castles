import type { ReactNode } from "react";
import { AuthProvider } from "../auth/AuthProvider";
import { OrganizerSessionGuard } from "../auth/OrganizerSessionGuard";
import { CompetitionsProvider } from "../competitions/CompetitionsProvider";
import { ChampionshipProvider } from "../championship/ChampionshipProvider";
import { ParticipantsProvider } from "../participants/ParticipantsProvider";
import { BirthdayVaultProvider } from "../birthday-vault/BirthdayVaultProvider";
import { SpecialRevealProvider } from "../special-reveal/SpecialRevealProvider";
import { ConnectionProvider } from "./ConnectionProvider";
import { FirebaseProvider } from "./FirebaseProvider";
import { VersionProvider } from "../operations/VersionProvider";

export function LiveProviders({ children }: { children: ReactNode }) {
  return (
    <VersionProvider>
      <FirebaseProvider>
        <AuthProvider>
          <OrganizerSessionGuard>
            <ConnectionProvider>
              <ParticipantsProvider>
                <BirthdayVaultProvider>
                  <CompetitionsProvider>
                    <SpecialRevealProvider>
                      <ChampionshipProvider>{children}</ChampionshipProvider>
                    </SpecialRevealProvider>
                  </CompetitionsProvider>
                </BirthdayVaultProvider>
              </ParticipantsProvider>
            </ConnectionProvider>
          </OrganizerSessionGuard>
        </AuthProvider>
      </FirebaseProvider>
    </VersionProvider>
  );
}
