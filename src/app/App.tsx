import { SiteNavigation } from "../components/navigation/SiteNavigation";
import { BirthdayVaultSection } from "../features/birthday-vault/BirthdayVaultSection";
import { ChampionshipSection } from "../features/championship/ChampionshipSection";
import { HeroSection } from "../features/hero/HeroSection";
import { ItinerarySection } from "../features/itinerary/ItinerarySection";
import { SpecialRevealSection } from "../features/special-reveal/SpecialRevealSection";
import { TripInformationSection } from "../features/trip-information/TripInformationSection";
import { WeekendOverviewSection } from "../features/weekend-overview/WeekendOverviewSection";

export function App() {
  return (
    <>
      <a className="skip-link" href="#main-content">
        Skip to main content
      </a>
      <SiteNavigation />
      <main id="main-content">
        <HeroSection />
        <WeekendOverviewSection />
        <ChampionshipSection />
        <ItinerarySection />
        <BirthdayVaultSection />
        <SpecialRevealSection />
        <TripInformationSection />
      </main>
    </>
  );
}
