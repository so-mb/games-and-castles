import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { RecentRevealAuthorization } from "../../auth/specialRevealAuthorization";
import { SensitiveActionDialog } from "./SensitiveActionDialog";

const authorization: RecentRevealAuthorization = {
  uid: "admin-uid",
  email: "organizer@example.test",
  authTimeMs: Date.now(),
  verifiedAtMs: Date.now(),
};

function setup(
  overrides: {
    online?: boolean;
    onReauthenticate?: (password: string) => Promise<RecentRevealAuthorization>;
    onExecute?: (value: RecentRevealAuthorization) => Promise<void>;
  } = {},
) {
  const onCancel = vi.fn();
  const onSuccess = vi.fn();
  const onReauthenticate =
    overrides.onReauthenticate ?? vi.fn().mockResolvedValue(authorization);
  const onExecute = overrides.onExecute ?? vi.fn().mockResolvedValue(undefined);
  render(
    <SensitiveActionDialog
      confirmationPhrase="OPEN REVEAL"
      consequence="Publishes the opening."
      onCancel={onCancel}
      onExecute={onExecute}
      onReauthenticate={onReauthenticate}
      onSuccess={onSuccess}
      online={overrides.online ?? true}
      open
      organizerEmail="organizer@example.test"
      title="Open the special reveal"
    />,
  );
  return { onCancel, onSuccess, onReauthenticate, onExecute };
}

function fill() {
  fireEvent.change(screen.getByLabelText("Current organizer password"), {
    target: { value: "current-password" },
  });
  fireEvent.change(screen.getByLabelText(/Type OPEN REVEAL/), {
    target: { value: "OPEN REVEAL" },
  });
}

describe("SensitiveActionDialog", () => {
  it("requires the phrase, reauthenticates, clears password, then executes", async () => {
    const onExecute = vi.fn(async () => {
      await waitFor(() =>
        expect(screen.getByLabelText("Current organizer password")).toHaveValue(
          "",
        ),
      );
    });
    const state = setup({ onExecute });
    const submit = screen.getByRole("button", {
      name: "Reauthenticate and continue",
    });
    expect(submit).toBeDisabled();
    fill();
    fireEvent.click(submit);

    await waitFor(() =>
      expect(state.onExecute).toHaveBeenCalledWith(authorization),
    );
    expect(state.onReauthenticate).toHaveBeenCalledWith("current-password");
    await waitFor(() => expect(state.onSuccess).toHaveBeenCalledOnce());
  });

  it("clears a wrong password, then accepts a correct retry", async () => {
    const wrongPassword = Object.assign(new Error("Wrong password."), {
      code: "auth/wrong-password",
    });
    const onReauthenticate = vi
      .fn()
      .mockRejectedValueOnce(wrongPassword)
      .mockResolvedValue(authorization);
    const state = setup({
      onReauthenticate,
    });
    fill();
    fireEvent.click(
      screen.getByRole("button", { name: "Reauthenticate and continue" }),
    );

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "That email and password combination was not accepted.",
    );
    expect(screen.getByLabelText("Current organizer password")).toHaveValue("");
    expect(state.onExecute).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText("Current organizer password"), {
      target: { value: "correct-password" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Reauthenticate and continue" }),
    );

    await waitFor(() =>
      expect(state.onExecute).toHaveBeenCalledWith(authorization),
    );
    expect(onReauthenticate).toHaveBeenNthCalledWith(1, "current-password");
    expect(onReauthenticate).toHaveBeenNthCalledWith(2, "correct-password");
    expect(state.onSuccess).toHaveBeenCalledOnce();
  });

  it("cancels without reauthentication and blocks submission offline", () => {
    const state = setup({ online: false });
    expect(
      screen.getByRole("button", { name: "Reauthenticate and continue" }),
    ).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(state.onCancel).toHaveBeenCalledOnce();
    expect(state.onReauthenticate).not.toHaveBeenCalled();
    expect(state.onExecute).not.toHaveBeenCalled();
  });
});
