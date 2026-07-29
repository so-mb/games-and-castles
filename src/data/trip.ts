import type {
  NavigationItem,
  PublicTripInfoItem,
  SundayDeparturePlan,
  TripMetadata,
  WeekendDay,
} from "../types/content";

export const tripMetadata: TripMetadata = {
  productName: "Games & Castles",
  dateRange: "31 July–2 August 2026",
  context: "Germany → Prague",
  tagline: "One weekend. Many games. One glorious table.",
  birthdayNote: "With a small birthday chapter tucked inside.",
  publicAccommodationArea: "Žižkov, Prague 3",
};

export const navigationItems: NavigationItem[] = [
  { id: "weekend", label: "Weekend", shortLabel: "Weekend", icon: "map" },
  { id: "championship", label: "Games", shortLabel: "Games", icon: "trophy" },
  { id: "birthday", label: "Birthday", shortLabel: "Birthday", icon: "cake" },
  { id: "reveal", label: "Reveal", shortLabel: "Reveal", icon: "sparkles" },
  { id: "itinerary", label: "Prague", shortLabel: "Prague", icon: "castle" },
  { id: "trip-info", label: "Info", shortLabel: "Info", icon: "luggage" },
];

export const sundayDeparturePlan: SundayDeparturePlan = {
  date: "Sunday, 2 August 2026",
  location: "Prague (Central Bus Station Florenc)",
  groups: [
    { id: "departure-first", label: "First group", time: "08:50" },
    { id: "departure-second", label: "Second group", time: "09:00" },
    { id: "departure-third", label: "Third group", time: "09:20" },
  ],
};

export const weekendDays: WeekendDay[] = [
  {
    id: "friday",
    eyebrow: "Day one · Germany",
    date: "Friday, 31 July",
    title: "Game Night",
    summary: "A flexible opening night built around the table, not the clock.",
    detail:
      "Console, cards, boards, food, free play and championship events can happen in any order.",
    icon: "controller",
    tone: "game",
    items: ["Any order", "No fixed times", "Championship opens"],
    status: "Pick as we go",
    actionTarget: "game-night",
  },
  {
    id: "saturday",
    eyebrow: "Day two · Czechia",
    date: "Saturday, 1 August",
    title: "Prague Quest",
    summary:
      "The main adventure day, from Germany to Žižkov, castle views and Old Town.",
    detail:
      "Leave Germany at 06:55, then follow a scheduled city route with free attractions, photography stops and two fixed evening bookings.",
    icon: "castle",
    tone: "quest",
    items: [
      "Germany departure · 06:55",
      "Arrival around 12:30",
      "Free city highlights",
      "Dinner + cinema booked",
    ],
    status: "Full itinerary",
    actionTarget: "itinerary",
  },
  {
    id: "sunday",
    eyebrow: "Day three",
    date: "Sunday, 2 August",
    title: "Departure",
    summary: "Three small departure groups leave Prague from Florenc.",
    detail: "First by 08:50, second by 09:00, and third by 09:20.",
    icon: "train",
    tone: "departure",
    items: ["Florenc", "08:50–09:20", "Onward travel"],
    status: "Three groups",
    actionTarget: "trip-info",
  },
];

export const publicTripInformation: PublicTripInfoItem[] = [
  {
    id: "public-area",
    label: "Accommodation area",
    value: tripMetadata.publicAccommodationArea,
    note: "Public area information only.",
    icon: "map",
  },
  {
    id: "dinner",
    label: "Dinner reservation",
    value: "Three Piglets · 18:00",
    note: "U Tří Prasátek, before the cinema.",
    icon: "food",
  },
  {
    id: "cinema",
    label: "Cinema booking",
    value: "Spider-Man · 20:00",
    note: "Cinema City Flora · original language with Czech subtitles.",
    icon: "film",
  },
  {
    id: "transport",
    label: "Getting around",
    value: "Prague public transport",
    note: "Keep tickets and live route information handy; conditions may change.",
    icon: "train",
  },
  {
    id: "coordination",
    label: "Pack for the quest",
    value: "Comfortable shoes + a light layer",
    note: "Charge phones, stay together and leave room for photographs.",
    icon: "luggage",
  },
  {
    id: "dates",
    label: "Trip dates",
    value: tripMetadata.dateRange,
    note: "Friday game night; Germany → Prague departs Saturday at 06:55; Sunday departure.",
    icon: "ticket",
  },
];
