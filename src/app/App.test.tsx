import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { itineraryItems } from "../data/itinerary";
import { birthdayVaultState, specialRevealState } from "../data/lockedStates";
import { competitionPreviews } from "../data/mockChampionship";
import {
  navigationItems,
  publicTripInformation,
  tripMetadata,
} from "../data/trip";
import { App } from "./App";

function renderApp() {
  return render(<App />);
}

describe("Games & Castles static shell", () => {
  it("renders the application and every main navigation target", () => {
    renderApp();

    expect(
      screen.getByRole("heading", { level: 1, name: /games & castles/i }),
    ).toBeInTheDocument();

    const navigation = screen.getByRole("navigation", { name: "Primary" });
    navigationItems.forEach((item) => {
      const link = within(navigation).getByRole("link", {
        name: item.shortLabel,
      });
      expect(link).toHaveAttribute("href", `#${item.id}`);
      expect(document.getElementById(item.id)).toBeInTheDocument();
    });
  });

  it("shows all three weekend days while keeping Friday unscheduled", () => {
    renderApp();

    expect(screen.getByText("Friday, 31 July")).toBeInTheDocument();
    expect(screen.getByText("Saturday, 1 August")).toBeInTheDocument();
    expect(screen.getByText("Sunday, 2 August")).toBeInTheDocument();

    const friday = document.getElementById("game-night");
    expect(friday).toBeInTheDocument();
    expect(friday?.textContent).not.toMatch(/\b\d{1,2}:\d{2}\b/);
  });

  it("renders every required Saturday itinerary location", () => {
    renderApp();

    itineraryItems.forEach((item) => {
      expect(
        screen.getByRole("heading", { name: item.title }),
      ).toBeInTheDocument();
    });

    expect(screen.getByText(/Bus 207 to Staroměstská/)).toBeInTheDocument();
    expect(
      screen.getByText(/Shorten or skip the Army Museum first/),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Skip Kampa before reducing time on Charles Bridge/),
    ).toBeInTheDocument();
  });

  it("contains only the approved public accommodation area", () => {
    renderApp();

    expect(
      screen.getAllByText(tripMetadata.publicAccommodationArea).length,
    ).toBeGreaterThan(0);
    expect(
      screen.queryByText(/exact accommodation address/i),
    ).not.toBeInTheDocument();

    const publicData = JSON.stringify(publicTripInformation);
    expect(publicData).not.toMatch(
      /street|postal|postcode|booking reference|phone number/i,
    );
  });

  it("keeps both locked sections neutral and presentation-only", () => {
    renderApp();

    expect(
      screen.getByRole("heading", { name: birthdayVaultState.title }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: specialRevealState.title }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Interactive submissions arrive in a later phase/i),
    ).toBeInTheDocument();

    const lockedData = JSON.stringify([birthdayVaultState, specialRevealState]);
    expect(lockedData).not.toMatch(/option-a|option-b|secret code|pin/i);
    expect(document.body.textContent).not.toMatch(
      /option-a|option-b|secret code|organizer pin/i,
    );
  });

  it("shows all three friendly competition format labels", () => {
    renderApp();

    competitionPreviews.forEach((competition) => {
      expect(
        screen.getByRole("heading", { name: competition.label }),
      ).toBeInTheDocument();
    });
  });

  it("renders safely when reduced motion is requested", () => {
    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      value: (query: string) => ({
        matches: query.includes("prefers-reduced-motion"),
        media: query,
        onchange: null,
        addEventListener: () => undefined,
        removeEventListener: () => undefined,
        addListener: () => undefined,
        removeListener: () => undefined,
        dispatchEvent: () => false,
      }),
    });

    renderApp();
    expect(screen.getAllByText(tripMetadata.dateRange).length).toBeGreaterThan(
      0,
    );
  });
});
