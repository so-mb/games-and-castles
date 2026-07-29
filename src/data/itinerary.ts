import type { ItineraryItem } from "../types/content";

export const itineraryItems: ItineraryItem[] = [
  {
    id: "depart-germany",
    time: "06:55",
    title: "Depart Germany for Prague",
    summary: "The Prague Quest begins with the morning journey to Prague.",
    details: ["Saturday departure from Germany."],
    tags: [
      {
        id: "journey-start",
        label: "Journey begins",
        tone: "gold",
        icon: "train",
      },
    ],
    icon: "train",
    variant: "travel",
  },
  {
    id: "arrival-luggage",
    time: "12:30–13:15",
    title: "Arrival, Žižkov & luggage drop",
    summary:
      "Arrive at Praha hlavní nádraží and travel to the accommodation area.",
    details: [
      "Expected station arrival: approximately 12:30.",
      "Drop luggage before the first visit.",
    ],
    tags: [{ id: "arrival", label: "Arrival", tone: "neutral", icon: "train" }],
    icon: "luggage",
    variant: "arrival",
  },
  {
    id: "army-museum",
    time: "13:15–14:00",
    title: "Army Museum Žižkov",
    summary: "A focused visit rather than a full museum completion.",
    details: [
      "Prioritize World War I, the creation of Czechoslovakia, Nazi occupation and World War II.",
      "Look for reconstructed scenes and major exhibits.",
    ],
    tags: [
      { id: "free", label: "Free", tone: "success", icon: "ticket" },
      { id: "delay-first", label: "First to shorten if late", tone: "warning" },
    ],
    icon: "castle",
    variant: "attraction",
  },
  {
    id: "castle-route",
    time: "14:00–14:45",
    title: "Travel to Prague Castle",
    summary: "A four-part public-transport route from Žižkov to the castle.",
    details: [
      "Walk to U Památníku.",
      "Bus 207 to Staroměstská → Metro A to Malostranská → Tram 22 to Pražský hrad.",
      "Check the route against live transport conditions before travel.",
    ],
    tags: [
      { id: "route", label: "Planned route", tone: "neutral", icon: "route" },
    ],
    icon: "train",
    variant: "travel",
  },
  {
    id: "prague-castle",
    time: "14:45–15:30",
    title: "Prague Castle grounds & gardens",
    summary:
      "Free exterior areas, courtyards and the highest-priority city views.",
    details: [
      "See the exterior of St Vitus Cathedral.",
      "Use South Garden viewpoints when accessible and pause for photographs.",
    ],
    tags: [
      { id: "free", label: "Free", tone: "success", icon: "ticket" },
      { id: "priority", label: "Priority 1", tone: "gold", icon: "crown" },
      { id: "photos", label: "Photography", tone: "neutral", icon: "camera" },
    ],
    icon: "castle",
    variant: "attraction",
  },
  {
    id: "old-castle-stairs",
    time: "15:30–15:50",
    title: "Old Castle Stairs",
    summary: "Historic downhill steps with open city views.",
    details: [
      "Descend toward Malá Strana and stop for photography along the way.",
    ],
    tags: [
      { id: "free", label: "Free", tone: "success", icon: "ticket" },
      { id: "photos", label: "Photography", tone: "neutral", icon: "camera" },
    ],
    icon: "camera",
    variant: "attraction",
  },
  {
    id: "wallenstein-garden",
    time: "15:50–16:20",
    title: "Wallenstein Garden",
    summary: "A high-priority photography stop with theatrical garden details.",
    details: ["Grotto wall, peacocks, statues, pond and Sala Terrena."],
    tags: [
      { id: "free", label: "Free", tone: "success", icon: "ticket" },
      { id: "photos", label: "Photo priority", tone: "gold", icon: "camera" },
    ],
    icon: "camera",
    variant: "attraction",
  },
  {
    id: "mala-strana-bridge",
    time: "16:20–17:05",
    title: "Malá Strana, optional Kampa & Charles Bridge",
    summary: "Cross the river through one of the day’s essential landmarks.",
    details: [
      "Kampa is a short optional detour.",
      "Charles Bridge is mandatory and must keep its planned time if the group is late.",
    ],
    tags: [
      { id: "free", label: "Free", tone: "success", icon: "ticket" },
      {
        id: "mandatory",
        label: "Charles Bridge · must do",
        tone: "red",
        icon: "crown",
      },
      { id: "optional", label: "Kampa · optional", tone: "warning" },
      { id: "photos", label: "Photography", tone: "neutral", icon: "camera" },
    ],
    icon: "route",
    variant: "attraction",
  },
  {
    id: "old-town-square",
    time: "17:05–17:30",
    title: "Old Town Square",
    summary: "A compact circuit of landmark exteriors and square photography.",
    details: [
      "Astronomical Clock exterior and Church of Our Lady before Týn exterior.",
      "Jan Hus Monument and general square photography.",
    ],
    tags: [
      { id: "free", label: "Free", tone: "success", icon: "ticket" },
      { id: "priority", label: "Priority 3", tone: "gold" },
      { id: "photos", label: "Photography", tone: "neutral", icon: "camera" },
    ],
    icon: "camera",
    variant: "attraction",
  },
  {
    id: "travel-flora",
    time: "17:30–17:55",
    title: "Travel to Flora",
    summary: "Metro journey with a small arrival buffer before dinner.",
    details: ["Protect the fixed 18:00 reservation."],
    tags: [{ id: "buffer", label: "Arrival buffer", tone: "warning" }],
    icon: "train",
    variant: "travel",
  },
  {
    id: "three-piglets",
    time: "18:00",
    title: "Three Piglets reservation",
    summary: "Dinner at U Tří Prasátek.",
    details: ["A fixed booking before the cinema."],
    tags: [{ id: "booked", label: "Booked", tone: "red", icon: "ticket" }],
    icon: "food",
    variant: "booking",
  },
  {
    id: "cinema",
    time: "20:00",
    title: "Spider-Man at Cinema City Flora",
    summary: "Original-language screening with Czech subtitles.",
    details: ["A fixed cinema booking."],
    tags: [{ id: "booked", label: "Booked", tone: "red", icon: "ticket" }],
    icon: "film",
    variant: "booking",
  },
  {
    id: "after-film",
    time: "After film",
    title: "Flexible return to Žižkov",
    summary: "Return at an easy pace, with no mandatory scheduled activity.",
    details: ["Optional casual drink or walk if the group feels like it."],
    tags: [
      { id: "flexible", label: "Flexible", tone: "neutral", icon: "moon" },
    ],
    icon: "moon",
    variant: "flexible",
  },
];

export const delayRules = [
  "Shorten or skip the Army Museum first if arrival is delayed.",
  "Skip Kampa before reducing time on Charles Bridge.",
  "Protect the fixed dinner and cinema bookings.",
] as const;
