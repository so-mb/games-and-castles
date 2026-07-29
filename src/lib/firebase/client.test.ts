import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getApps: vi.fn(),
  initializeApp: vi.fn(),
  getAuth: vi.fn(),
  setPersistence: vi.fn(),
  getDatabase: vi.fn(),
  appCheck: vi.fn(),
}));

vi.mock("firebase/app", () => ({
  getApp: vi.fn(),
  getApps: mocks.getApps,
  initializeApp: mocks.initializeApp,
}));
vi.mock("firebase/auth", () => ({
  browserLocalPersistence: { name: "local" },
  browserSessionPersistence: { name: "session" },
  connectAuthEmulator: vi.fn(),
  getAuth: mocks.getAuth,
  setPersistence: mocks.setPersistence,
}));
vi.mock("firebase/database", () => ({
  connectDatabaseEmulator: vi.fn(),
  getDatabase: mocks.getDatabase,
}));
vi.mock("./appCheck", () => ({
  initializeAppCheckClients: mocks.appCheck,
}));

import { createFirebaseClients } from "./client";

const config = {
  status: "configured" as const,
  options: {
    apiKey: "public-key",
    authDomain: "demo.firebaseapp.com",
    databaseURL: "https://demo.firebaseio.com",
    projectId: "demo",
    appId: "app",
    messagingSenderId: "123",
  },
  useEmulators: false,
  appCheck: { status: "disabled" as const },
};

describe("Firebase client session isolation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getApps.mockReturnValue([]);
    mocks.initializeApp.mockImplementation((_, name?: string) => ({
      name: name ?? "[DEFAULT]",
    }));
    mocks.getAuth.mockImplementation((app) => ({ app }));
    mocks.getDatabase.mockImplementation((app) => ({ app }));
    mocks.setPersistence.mockResolvedValue(undefined);
    mocks.appCheck.mockResolvedValue({});
  });

  it("keeps guest local persistence and organizer session persistence separate", async () => {
    const clients = createFirebaseClients(config);
    await clients.persistenceReady;

    expect(clients.guestApp.name).toBe("[DEFAULT]");
    expect(clients.organizerApp.name).toBe("games-and-castles-organizer");
    expect(mocks.setPersistence).toHaveBeenNthCalledWith(1, clients.guestAuth, {
      name: "local",
    });
    expect(mocks.setPersistence).toHaveBeenNthCalledWith(
      2,
      clients.organizerAuth,
      { name: "session" },
    );
  });
});
