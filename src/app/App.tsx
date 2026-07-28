import { lazy, Suspense } from "react";
import { SiteNavigation } from "../components/navigation/SiteNavigation";
import { ChampionshipSection } from "../features/championship/ChampionshipSection";
import { HeroSection } from "../features/hero/HeroSection";
import { ItinerarySection } from "../features/itinerary/ItinerarySection";
import { SpecialRevealSection } from "../features/special-reveal/SpecialRevealSection";
import { TripInformationSection } from "../features/trip-information/TripInformationSection";
import { WeekendOverviewSection } from "../features/weekend-overview/WeekendOverviewSection";

const BirthdayVaultSection = lazy(() =>
  import("../features/birthday-vault/BirthdayVaultSection").then((module) => ({
    default: module.BirthdayVaultSection,
  })),
);
import { ConnectionStatus } from "../features/live/ConnectionStatus";
import { LiveProviders } from "../features/live/LiveProviders";

export function App() {
  return (
    <LiveProviders>
      <a className="skip-link" href="#main-content">
        Skip to main content
      </a>
      <SiteNavigation />
      <main id="main-content" tabIndex={-1}>
        <HeroSection />
        <WeekendOverviewSection />
        <ChampionshipSection />
        <ItinerarySection />
        <Suspense
          fallback={
            <section
              aria-busy="true"
              aria-label="Opening Birthday Vault"
              className="bg-[var(--color-cream-50)] py-24"
              id="birthday"
            />
          }
        >
          <BirthdayVaultSection />
        </Suspense>
        <SpecialRevealSection />
        <TripInformationSection />
      </main>
      <ConnectionStatus />
    </LiveProviders>
  );
}
