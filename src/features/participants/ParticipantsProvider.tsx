import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  createGuestParticipant,
  createOrganizerParticipant,
  setParticipantStatus,
  subscribeToActiveParticipants,
  subscribeToAllParticipants,
  subscribeToParticipant,
  subscribeToUserProfile,
  updateGuestParticipant,
  updateOrganizerParticipant,
} from "../../lib/firebase/participants";
import { useAuth } from "../auth/AuthProvider";
import { useConnection } from "../live/ConnectionProvider";
import { useFirebase } from "../live/FirebaseProvider";
import type { LoadState, Participant, ParticipantInput } from "./types";

interface ParticipantsContextValue {
  activeParticipants: Participant[];
  activeState: LoadState;
  ownParticipant: Participant | null;
  ownState: LoadState;
  organizerParticipants: Participant[];
  organizerState: LoadState;
  errorMessage: string | null;
  canMutate: boolean;
  createOwn: (input: ParticipantInput) => Promise<void>;
  updateOwn: (input: ParticipantInput) => Promise<void>;
  organizerCreate: (input: ParticipantInput) => Promise<void>;
  organizerUpdate: (
    participantId: string,
    input: ParticipantInput,
  ) => Promise<void>;
  organizerSetStatus: (
    participantId: string,
    status: Participant["status"],
  ) => Promise<void>;
}

const ParticipantsContext = createContext<ParticipantsContextValue | null>(
  null,
);

export function ParticipantsProvider({ children }: { children: ReactNode }) {
  const firebase = useFirebase();
  const auth = useAuth();
  const connection = useConnection();
  const [activeParticipants, setActiveParticipants] = useState<Participant[]>(
    [],
  );
  const [activeState, setActiveState] = useState<LoadState>("loading");
  const [ownParticipant, setOwnParticipant] = useState<Participant | null>(
    null,
  );
  const [ownState, setOwnState] = useState<LoadState>("loading");
  const [organizerParticipants, setOrganizerParticipants] = useState<
    Participant[]
  >([]);
  const [organizerState, setOrganizerState] = useState<LoadState>("loading");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (firebase.status !== "ready" || auth.guest.status !== "ready") {
      return;
    }
    return subscribeToActiveParticipants(
      firebase.clients.guestDatabase,
      (participants) => {
        setActiveParticipants(participants);
        setActiveState("ready");
        setErrorMessage(null);
      },
      () => {
        setActiveState("error");
        setErrorMessage("The live participant list could not be loaded.");
      },
    );
  }, [auth.guest, firebase]);

  useEffect(() => {
    if (firebase.status !== "ready" || auth.guest.status !== "ready") {
      return;
    }
    let participantUnsubscribe: (() => void) | undefined;
    const profileUnsubscribe = subscribeToUserProfile(
      firebase.clients.guestDatabase,
      auth.guest.uid,
      (profile) => {
        participantUnsubscribe?.();
        if (!profile?.participantId) {
          setOwnParticipant(null);
          setOwnState("ready");
          return;
        }
        participantUnsubscribe = subscribeToParticipant(
          firebase.clients.guestDatabase,
          profile.participantId,
          (participant) => {
            setOwnParticipant(participant);
            setOwnState("ready");
          },
          () => {
            setOwnState("error");
            setErrorMessage("Your participant profile could not be loaded.");
          },
        );
      },
      () => {
        setOwnState("error");
        setErrorMessage("Your participant profile could not be loaded.");
      },
    );

    return () => {
      profileUnsubscribe();
      participantUnsubscribe?.();
    };
  }, [auth.guest, firebase]);

  useEffect(() => {
    if (firebase.status !== "ready" || auth.organizer.status !== "authorized") {
      return;
    }
    return subscribeToAllParticipants(
      firebase.clients.organizerDatabase,
      (participants) => {
        setOrganizerParticipants(participants);
        setOrganizerState("ready");
      },
      () => {
        setOrganizerState("error");
        setErrorMessage("Organizer participant data could not be loaded.");
      },
    );
  }, [auth.organizer, firebase]);

  const requireOnline = useCallback(() => {
    if (connection !== "online") {
      throw new Error(
        "Changes are paused while the live connection is offline.",
      );
    }
  }, [connection]);

  const createOwn = useCallback(
    async (input: ParticipantInput) => {
      requireOnline();
      if (firebase.status !== "ready" || auth.guest.status !== "ready") {
        throw new Error("Guest access is not ready.");
      }
      await createGuestParticipant(
        firebase.clients.guestDatabase,
        auth.guest.uid,
        input,
      );
    },
    [auth.guest, firebase, requireOnline],
  );

  const updateOwn = useCallback(
    async (input: ParticipantInput) => {
      requireOnline();
      if (
        firebase.status !== "ready" ||
        auth.guest.status !== "ready" ||
        !ownParticipant
      ) {
        throw new Error("Your participant profile is not ready.");
      }
      await updateGuestParticipant(
        firebase.clients.guestDatabase,
        auth.guest.uid,
        ownParticipant.id,
        input,
      );
    },
    [auth.guest, firebase, ownParticipant, requireOnline],
  );

  const organizerCreate = useCallback(
    async (input: ParticipantInput) => {
      requireOnline();
      if (
        firebase.status !== "ready" ||
        auth.organizer.status !== "authorized"
      ) {
        throw new Error("Organizer access is not ready.");
      }
      await createOrganizerParticipant(
        firebase.clients.organizerDatabase,
        auth.organizer.uid,
        input,
      );
    },
    [auth.organizer, firebase, requireOnline],
  );

  const organizerUpdate = useCallback(
    async (participantId: string, input: ParticipantInput) => {
      requireOnline();
      if (
        firebase.status !== "ready" ||
        auth.organizer.status !== "authorized"
      ) {
        throw new Error("Organizer access is not ready.");
      }
      await updateOrganizerParticipant(
        firebase.clients.organizerDatabase,
        auth.organizer.uid,
        participantId,
        input,
      );
    },
    [auth.organizer, firebase, requireOnline],
  );

  const organizerSetStatus = useCallback(
    async (participantId: string, status: Participant["status"]) => {
      requireOnline();
      if (
        firebase.status !== "ready" ||
        auth.organizer.status !== "authorized"
      ) {
        throw new Error("Organizer access is not ready.");
      }
      await setParticipantStatus(
        firebase.clients.organizerDatabase,
        auth.organizer.uid,
        participantId,
        status,
      );
    },
    [auth.organizer, firebase, requireOnline],
  );

  const value = useMemo<ParticipantsContextValue>(
    () => ({
      activeParticipants:
        auth.guest.status === "ready" ? activeParticipants : [],
      activeState:
        firebase.status !== "ready"
          ? "idle"
          : auth.guest.status === "ready"
            ? activeState
            : "loading",
      ownParticipant: auth.guest.status === "ready" ? ownParticipant : null,
      ownState:
        firebase.status !== "ready"
          ? "idle"
          : auth.guest.status === "ready"
            ? ownState
            : "loading",
      organizerParticipants:
        auth.organizer.status === "authorized" ? organizerParticipants : [],
      organizerState:
        auth.organizer.status === "authorized" ? organizerState : "idle",
      errorMessage,
      canMutate: connection === "online",
      createOwn,
      updateOwn,
      organizerCreate,
      organizerUpdate,
      organizerSetStatus,
    }),
    [
      activeParticipants,
      activeState,
      auth.guest.status,
      auth.organizer.status,
      connection,
      createOwn,
      errorMessage,
      firebase.status,
      organizerCreate,
      organizerParticipants,
      organizerSetStatus,
      organizerState,
      organizerUpdate,
      ownParticipant,
      ownState,
      updateOwn,
    ],
  );

  return (
    <ParticipantsContext.Provider value={value}>
      {children}
    </ParticipantsContext.Provider>
  );
}

// Hooks intentionally share this module with their provider.
// eslint-disable-next-line react-refresh/only-export-components
export function useParticipants() {
  const value = useContext(ParticipantsContext);
  if (!value) {
    throw new Error("useParticipants must be used within ParticipantsProvider");
  }
  return value;
}
