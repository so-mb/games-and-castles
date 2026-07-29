import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { VersionUpdateBanner } from "./VersionUpdateBanner";

const mocks = vi.hoisted(() => ({ status: "update-available" as string }));

vi.mock("./VersionProvider", () => ({
  useVersion: () => ({ status: mocks.status }),
}));

describe("VersionUpdateBanner", () => {
  afterEach(() => {
    cleanup();
    mocks.status = "update-available";
  });

  it("offers an explicit reload only when a newer build is available", () => {
    render(<VersionUpdateBanner />);
    expect(
      screen.getByText("A newer Games & Castles build is live."),
    ).toBeVisible();
    expect(
      screen.getByRole("button", { name: "Reload latest build" }),
    ).toBeVisible();

    cleanup();
    mocks.status = "current";
    render(<VersionUpdateBanner />);
    expect(
      screen.queryByRole("button", { name: "Reload latest build" }),
    ).not.toBeInTheDocument();
  });
});
