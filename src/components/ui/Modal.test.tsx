import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it } from "vitest";
import { Modal } from "./Modal";

function ModalInputHarness() {
  const [email, setEmail] = useState("");

  return (
    <Modal onClose={() => undefined} open title="Organizer access">
      <label>
        Email
        <input
          onChange={(event) => setEmail(event.target.value)}
          type="email"
          value={email}
        />
      </label>
    </Modal>
  );
}

describe("Modal", () => {
  it("does not reset focus when controlled input state changes", () => {
    render(<ModalInputHarness />);

    const input = screen.getByRole("textbox", { name: "Email" });
    input.focus();
    fireEvent.change(input, { target: { value: "organizer@example.test" } });

    expect(input).toHaveFocus();
    expect(input).toHaveValue("organizer@example.test");
  });
});
