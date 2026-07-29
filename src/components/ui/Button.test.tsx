import { render, screen } from "@testing-library/react";
import { Settings2 } from "lucide-react";
import { describe, expect, it } from "vitest";
import { Button } from "./Button";

describe("Button", () => {
  it("keeps an icon and label as side-by-side flex items", () => {
    render(
      <Button>
        <Settings2 aria-hidden="true" data-testid="button-icon" size={17} />
        Organizer
      </Button>,
    );

    const button = screen.getByRole("button", { name: "Organizer" });
    const icon = screen.getByTestId("button-icon");

    expect(button).toHaveClass("flex-row", "items-center");
    expect(icon.parentElement).toBe(button);
  });
});
