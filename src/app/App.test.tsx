import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { itineraryItems } from "../data/itinerary";
import { specialRevealState } from "../data/lockedStates";
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

    const logoLink = screen.getByRole("link", {
      name: "Games & Castles — back to top",
    });
    expect(logoLink.querySelector("img")?.getAttribute("src")).toMatch(
      /\/favicon\.svg$/,
    );
    expect(
      screen.getByRole("heading", { level: 1, name: /games & castles/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Skip to main content" }),
    ).toHaveAttribute("href", "#main-content");
    expect(document.getElementById("main-content")).toHaveAttribute(
      "tabindex",
      "-1",
    );

    const navigation = screen.getByRole("navigation", { name: "Primary" });
    expect(
      within(navigation)
        .getAllByRole("link")
        .map((link) => link.textContent),
    ).toEqual(["Weekend", "Games", "Birthday", "Reveal", "Prague", "Info"]);
    expect(
      Array.from(document.querySelector("main")?.children ?? []).map(
        (section) => section.id,
      ),
    ).toEqual([
      "top",
      "weekend",
      "championship",
      "birthday",
      "reveal",
      "itinerary",
      "trip-info",
    ]);
    navigationItems.forEach((item) => {
      const link = within(navigation).getByRole("link", {
        name: item.shortLabel,
      });
      expect(link).toHaveAttribute("href", `#${item.id}`);
      expect(document.getElementById(item.id)).toBeInTheDocument();
    });
    expect(
      screen.getByRole("heading", { name: "Live and scheduled games" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Weekend championship" }),
    ).toBeInTheDocument();
    expect(screen.queryByText(/sample leaderboard/i)).not.toBeInTheDocument();
  });

  it("shows all three weekend days while keeping Friday unscheduled", () => {
    renderApp();

    expect(screen.getByText("Friday, 31 July")).toBeInTheDocument();
    expect(screen.getByText("Saturday, 1 August")).toBeInTheDocument();
    expect(screen.getByText("Sunday, 2 August")).toBeInTheDocument();

    const friday = document.getElementById("game-night");
    expect(friday).toBeInTheDocument();
    expect(friday?.textContent).not.toMatch(/\b\d{1,2}:\d{2}\b/);

    const sundayDepartures = screen.getByRole("region", {
      name: "Three groups. One departure point.",
    });
    expect(
      within(sundayDepartures).getByText(
        "Prague (Central Bus Station Florenc)",
      ),
    ).toBeInTheDocument();
    ["08:50", "09:00", "09:20"].forEach((time) => {
      expect(within(sundayDepartures).getByText(time)).toBeInTheDocument();
    });
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

  it("renders the live Birthday Vault and keeps the special reveal neutral", async () => {
    renderApp();

    expect(
      await screen.findByRole("heading", { name: "Birthday Vault" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: specialRevealState.title }),
    ).toBeInTheDocument();
    expect(screen.getByText(/private digital guestbook/i)).toBeInTheDocument();

    const lockedData = JSON.stringify([specialRevealState]);
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
