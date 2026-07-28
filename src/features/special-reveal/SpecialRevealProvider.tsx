import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useAuth } from "../auth/AuthProvider";
import {
  assertFreshRevealAuthorization,
  type RecentRevealAuthorization,
} from "../auth/specialRevealAuthorization";
import { useConnection } from "../live/ConnectionProvider";
import { useFirebase } from "../live/FirebaseProvider";
import { useParticipants } from "../participants/ParticipantsProvider";
import type {
  PredictionOption,
  SpecialRevealConfigInput,
  SpecialRevealPrediction,
  SpecialRevealPrivateConfig,
  SpecialRevealPublicOpening,
  SpecialRevealPublicResolution,
  SpecialRevealPublicState,
} from "./domain/types";
import {
  changePredictionStateInBrowser,
  correctSpecialRevealInBrowser,
  openSpecialRevealInBrowser,
  reconcilePredictionLedgerInBrowser,
  resolveSpecialRevealInBrowser,
  savePrediction,
  saveSpecialRevealConfig,
  subscribeOwnPrediction,
  subscribePredictionReceipts,
  subscribeSpecialRevealPrivateConfig,
  subscribeSpecialRevealPublicOpening,
  subscribeSpecialRevealPublicResolution,
  subscribeSpecialRevealPublicState,
  withdrawPrediction,
} from "./repositories/specialReveal";

type LoadState = "idle" | "loading" | "ready" | "error";

interface SpecialRevealContextValue {
  publicState: SpecialRevealPublicState | null;
  opening: SpecialRevealPublicOpening | null;
  resolution: SpecialRevealPublicResolution | null;
  ownPrediction: SpecialRevealPrediction | null;
  predictionCount: number;
  privateConfig: SpecialRevealPrivateConfig | null;
  state: LoadState;
  organizerState: LoadState;
  malformedIds: string[];
  errorMessage: string | null;
  canGuestMutate: boolean;
  canOrganizerMutate: boolean;
  submitPrediction: (selection: PredictionOption) => Promise<void>;
  withdrawPrediction: () => Promise<void>;
  saveConfig: (value: SpecialRevealConfigInput) => Promise<void>;
  open: (authorization: RecentRevealAuthorization) => Promise<void>;
  lock: (authorization: RecentRevealAuthorization) => Promise<void>;
  reopen: (authorization: RecentRevealAuthorization) => Promise<void>;
  resolve: (
    authorization: RecentRevealAuthorization,
    correctOption: PredictionOption,
  ) => Promise<void>;
  correct: (
    authorization: RecentRevealAuthorization,
    correctOption: PredictionOption,
  ) => Promise<void>;
  reconcile: (authorization: RecentRevealAuthorization) => Promise<void>;
}

const SpecialRevealContext = createContext<SpecialRevealContextValue | null>(
  null,
);

export function SpecialRevealProvider({ children }: { children: ReactNode }) {
  const firebase = useFirebase();
  const auth = useAuth();
  const connection = useConnection();
  const participants = useParticipants();
  const [publicState, setPublicState] =
    useState<SpecialRevealPublicState | null>(null);
  const [opening, setOpening] = useState<SpecialRevealPublicOpening | null>(
    null,
  );
  const [resolution, setResolution] =
    useState<SpecialRevealPublicResolution | null>(null);
  const [ownPrediction, setOwnPrediction] =
    useState<SpecialRevealPrediction | null>(null);
  const [predictionCount, setPredictionCount] = useState(0);
  const [privateConfig, setPrivateConfig] =
    useState<SpecialRevealPrivateConfig | null>(null);
  const [state, setState] = useState<LoadState>("loading");
  const [organizerState, setOrganizerState] = useState<LoadState>("idle");
  const [malformedIds, setMalformedIds] = useState<string[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const isSpecialRevealOrganizer =
    auth.organizer.status === "authorized" && auth.organizer.specialRevealAdmin;

  const setMalformed = useCallback((id: string, malformed: boolean) => {
    setMalformedIds((current) =>
      malformed
        ? [...new Set([...current, id])]
        : current.filter((candidate) => candidate !== id),
    );
  }, []);

  useEffect(() => {
    if (firebase.status !== "ready" || auth.guest.status !== "ready") return;
    let readyCount = 0;
    const ready = () => {
      readyCount += 1;
      if (readyCount === 3) setState("ready");
    };
    const fail = () => {
      setState("error");
      setErrorMessage(
        "The special reveal state could not be verified right now.",
      );
    };
    const stops = [
      subscribeSpecialRevealPublicState(
        firebase.clients.guestDatabase,
        (value, malformed) => {
          setPublicState(value);
          setMalformed("public-state", malformed);
          ready();
        },
        fail,
      ),
      subscribePredictionReceipts(
        firebase.clients.guestDatabase,
        ({ receipts, invalidIds }) => {
          setPredictionCount(
            receipts.filter((receipt) => receipt.active).length,
          );
          setMalformedIds((current) => [
            ...new Set([
              ...current.filter((id) => !id.startsWith("receipt:")),
              ...invalidIds.map((id) => `receipt:${id}`),
            ]),
          ]);
          ready();
        },
        fail,
      ),
      subscribeOwnPrediction(
        firebase.clients.guestDatabase,
        auth.guest.uid,
        (value, malformed) => {
          setOwnPrediction(value);
          setMalformed("own-prediction", malformed);
          ready();
        },
        fail,
      ),
    ];
    return () => stops.forEach((stop) => stop());
  }, [auth.guest, firebase, setMalformed]);

  useEffect(() => {
    if (
      firebase.status !== "ready" ||
      auth.guest.status !== "ready" ||
      !publicState
    ) {
      return;
    }
    return subscribeSpecialRevealPublicOpening(
      firebase.clients.guestDatabase,
      (value, malformed) => {
        setOpening(value);
        setMalformed("public-opening", malformed);
      },
      () => setErrorMessage("The published opening could not be loaded."),
    );
  }, [auth.guest, firebase, publicState, setMalformed]);

  useEffect(() => {
    if (
      firebase.status !== "ready" ||
      auth.guest.status !== "ready" ||
      publicState?.status !== "resolved"
    ) {
      return;
    }
    return subscribeSpecialRevealPublicResolution(
      firebase.clients.guestDatabase,
      (value, malformed) => {
        setResolution(value);
        setMalformed("public-resolution", malformed);
      },
      () => setErrorMessage("The published resolution could not be loaded."),
    );
  }, [auth.guest, firebase, publicState?.status, setMalformed]);

  useEffect(() => {
    if (firebase.status !== "ready" || !isSpecialRevealOrganizer) {
      return;
    }
    return subscribeSpecialRevealPrivateConfig(
      firebase.clients.organizerDatabase,
      (value, malformed) => {
        setPrivateConfig(value);
        setMalformed("private-config", malformed);
        setOrganizerState(malformed ? "error" : "ready");
      },
      () => {
        setOrganizerState("error");
        setErrorMessage(
          "The protected event configuration could not be loaded.",
        );
      },
    );
  }, [firebase, isSpecialRevealOrganizer, setMalformed]);

  const requireGuest = useCallback(() => {
    if (connection !== "online")
      throw new Error("Predictions are paused while offline.");
    if (
      firebase.status !== "ready" ||
      auth.guest.status !== "ready" ||
      !participants.ownParticipant
    )
      throw new Error(
        "Join the participant roster before making a prediction.",
      );
    return {
      database: firebase.clients.guestDatabase,
      uid: auth.guest.uid,
      participantId: participants.ownParticipant.id,
    };
  }, [auth.guest, connection, firebase, participants.ownParticipant]);

  const requireOrganizer = useCallback(() => {
    if (connection !== "online")
      throw new Error("Special reveal controls are paused while offline.");
    if (
      firebase.status !== "ready" ||
      auth.organizer.status !== "authorized" ||
      !auth.organizer.specialRevealAdmin
    )
      throw new Error("Organizer access is not ready.");
    return {
      database: firebase.clients.organizerDatabase,
      uid: auth.organizer.uid,
    };
  }, [auth.organizer, connection, firebase]);

  const requireRecentOrganizer = useCallback(
    (authorization: RecentRevealAuthorization) => {
      const organizer = requireOrganizer();
      assertFreshRevealAuthorization(authorization, organizer.uid);
      return organizer;
    },
    [requireOrganizer],
  );

  const value = useMemo<SpecialRevealContextValue>(
    () => ({
      publicState,
      opening: publicState ? opening : null,
      resolution: publicState?.status === "resolved" ? resolution : null,
      ownPrediction,
      predictionCount,
      privateConfig: isSpecialRevealOrganizer ? privateConfig : null,
      state: firebase.status === "ready" ? state : "idle",
      organizerState,
      malformedIds,
      errorMessage,
      canGuestMutate:
        connection === "online" &&
        auth.guest.status === "ready" &&
        participants.ownParticipant !== null &&
        publicState?.status === "prediction-open",
      canOrganizerMutate: connection === "online" && isSpecialRevealOrganizer,
      submitPrediction: async (selection) => {
        const guest = requireGuest();
        await savePrediction({ ...guest, current: ownPrediction, selection });
      },
      withdrawPrediction: async () => {
        const guest = requireGuest();
        if (!ownPrediction)
          throw new Error("No prediction is available to withdraw.");
        await withdrawPrediction({
          database: guest.database,
          uid: guest.uid,
          current: ownPrediction,
        });
      },
      saveConfig: async (config) => {
        const organizer = requireOrganizer();
        await saveSpecialRevealConfig({
          database: organizer.database,
          uid: organizer.uid,
          current: privateConfig,
          value: config,
        });
      },
      open: async (authorization) => {
        const organizer = requireRecentOrganizer(authorization);
        if (!privateConfig)
          throw new Error("Save the protected event configuration first.");
        await openSpecialRevealInBrowser({
          ...organizer,
          expectedConfigRevision: privateConfig.revision,
        });
      },
      lock: async (authorization) => {
        const organizer = requireRecentOrganizer(authorization);
        if (!publicState)
          throw new Error("The prediction event has not opened.");
        await changePredictionStateInBrowser({
          ...organizer,
          state: publicState,
          action: "lock",
        });
      },
      reopen: async (authorization) => {
        const organizer = requireRecentOrganizer(authorization);
        if (!publicState)
          throw new Error("The prediction event has not opened.");
        await changePredictionStateInBrowser({
          ...organizer,
          state: publicState,
          action: "reopen",
        });
      },
      resolve: async (authorization, correctOption) => {
        const organizer = requireRecentOrganizer(authorization);
        if (!publicState || !privateConfig)
          throw new Error("The event state is incomplete.");
        await resolveSpecialRevealInBrowser({
          ...organizer,
          state: publicState,
          config: privateConfig,
          correctOption,
        });
      },
      correct: async (authorization, correctOption) => {
        const organizer = requireRecentOrganizer(authorization);
        if (!publicState || !privateConfig || !resolution)
          throw new Error("The event state is incomplete.");
        await correctSpecialRevealInBrowser({
          ...organizer,
          state: publicState,
          config: privateConfig,
          resolution,
          correctOption,
        });
      },
      reconcile: async (authorization) => {
        const organizer = requireRecentOrganizer(authorization);
        if (!publicState || !privateConfig || !resolution)
          throw new Error("The event state is incomplete.");
        await reconcilePredictionLedgerInBrowser({
          ...organizer,
          state: publicState,
          config: privateConfig,
          resolution,
        });
      },
    }),
    [
      auth.guest.status,
      connection,
      errorMessage,
      firebase.status,
      isSpecialRevealOrganizer,
      malformedIds,
      opening,
      organizerState,
      ownPrediction,
      participants.ownParticipant,
      predictionCount,
      privateConfig,
      publicState,
      requireGuest,
      requireOrganizer,
      requireRecentOrganizer,
      resolution,
      state,
    ],
  );

  return (
    <SpecialRevealContext.Provider value={value}>
      {children}
    </SpecialRevealContext.Provider>
  );
}

// Hooks intentionally share this module with their provider.
// eslint-disable-next-line react-refresh/only-export-components
export function useSpecialReveal() {
  const value = useContext(SpecialRevealContext);
  if (!value)
    throw new Error(
      "useSpecialReveal must be used within SpecialRevealProvider",
    );
  return value;
}
