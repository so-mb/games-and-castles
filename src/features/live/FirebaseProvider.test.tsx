import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { FirebaseRuntimeConfig } from "../../lib/firebase/config";
import { FirebaseProvider, useFirebase } from "./FirebaseProvider";

const configured: FirebaseRuntimeConfig = {
  status: "configured",
  options: {
    apiKey: "public-key",
    authDomain: "demo.firebaseapp.com",
    databaseURL: "https://demo.firebaseio.com",
    projectId: "demo",
    appId: "app",
    messagingSenderId: "123",
  },
  useEmulators: false,
  appCheck: { status: "disabled" },
};

function StateProbe() {
  const firebase = useFirebase();
  return <p>{firebase.status}</p>;
}

describe("FirebaseProvider", () => {
  it("contains initialization errors inside the live feature boundary", () => {
    render(
      <FirebaseProvider
        createClients={() => {
          throw new Error("bad config");
        }}
        runtimeConfig={configured}
      >
        <StateProbe />
      </FirebaseProvider>,
    );
    expect(screen.getByText("error")).toBeInTheDocument();
  });
});
