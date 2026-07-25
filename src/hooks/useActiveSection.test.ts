import { describe, expect, it } from "vitest";
import { pickActiveSection } from "./useActiveSection";

describe("pickActiveSection", () => {
  it("prefers the section with the strongest intersection", () => {
    expect(
      pickActiveSection([
        { id: "weekend", ratio: 0.2, top: 100 },
        { id: "championship", ratio: 0.65, top: 260 },
      ]),
    ).toBe("championship");
  });

  it("uses proximity to the viewport edge when ratios match", () => {
    expect(
      pickActiveSection([
        { id: "birthday", ratio: 0.35, top: -220 },
        { id: "reveal", ratio: 0.35, top: 80 },
      ]),
    ).toBe("reveal");
  });
});
