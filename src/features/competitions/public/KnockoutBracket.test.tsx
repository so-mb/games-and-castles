import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { Participant } from "../../participants/types";
import { generateKnockout } from "../engine/knockout";
import { KnockoutBracket } from "./KnockoutBracket";

const participants: Participant[] = ["Ada", "Bo", "Cy", "Dee"].map(
  (displayName, index) => ({
    id: `participant-${index + 1}`,
    ownerUid: null,
    displayName,
    avatar: { icon: "trophy", tone: "gold" },
    status: "active",
    createdAt: 1,
    createdByUid: "admin",
    updatedAt: 1,
    updatedByUid: "admin",
    schemaVersion: 1,
  }),
);

describe("knockout bracket visualization", () => {
  it("connects seeded qualifiers to each knockout round", () => {
    const generated = generateKnockout(
      "castle-cup",
      participants.map((participant) => participant.id),
      true,
      "standings-fingerprint",
      "admin",
      100,
      20,
    );

    render(
      <KnockoutBracket
        id="castle-cup-bracket"
        matches={generated.matches}
        participants={participants}
        rounds={generated.knockout.rounds}
        sourceDescription="Group winners and runners-up advance."
        sourceEntries={participants.map((participant, index) => ({
          participantId: participant.id,
          seed: index + 1,
          context: `Group ${index < 2 ? "A" : "B"} · #${(index % 2) + 1}`,
        }))}
        sourceLabel="Group standings"
        thirdPlaceMatchId={generated.knockout.thirdPlaceMatchId}
      />,
    );

    expect(
      screen.getByRole("heading", { name: "Knockout bracket" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Group standings")).toBeInTheDocument();
    expect(screen.getByText("4 qualifiers seeded")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Semifinals" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Final" })).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Third place" }),
    ).toBeInTheDocument();

    const bracket = screen.getByLabelText("Knockout bracket rounds");
    expect(within(bracket).getAllByText("Ada").length).toBeGreaterThan(0);
    expect(within(bracket).getAllByText("Bo").length).toBeGreaterThan(0);
  });
});
