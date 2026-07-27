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
import { useConnection } from "../live/ConnectionProvider";
import { useFirebase } from "../live/FirebaseProvider";
import { useParticipants } from "../participants/ParticipantsProvider";
import {
  combineBirthdayModeration,
  deriveBirthdayRevealReadiness,
  deriveBirthdayVaultCounts,
} from "./domain/publication";
import type {
  BirthdayMessage,
  BirthdayMessageInput,
  BirthdayMessageModeration,
  BirthdayModerationItem,
  BirthdayModerationStatus,
  BirthdaySubmissionReceipt,
  BirthdayVaultPublicState,
  PublishedBirthdayMessage,
} from "./domain/types";
import {
  bulkApproveBirthdayMessages,
  closeBirthdayVault,
  initializeBirthdayVault,
  moderateBirthdayMessage,
  publishBirthdayVault,
  reorderBirthdayMessages,
  reopenBirthdayVault,
  submitBirthdayMessage,
  subscribeBirthdayModeration,
  subscribeBirthdaySubmissionReceipts,
  subscribeBirthdayVaultPublicState,
  subscribeOrganizerBirthdayMessages,
  subscribeOwnBirthdayMessage,
  subscribePublishedBirthdayMessages,
  withdrawBirthdayMessage,
} from "./repositories/birthdayVault";

type LoadState = "idle" | "loading" | "ready" | "error";

interface BirthdayVaultContextValue {
  publicState: BirthdayVaultPublicState | null;
  publicCount: number;
  ownMessage: BirthdayMessage | null;
  publishedMessages: PublishedBirthdayMessage[];
  organizerItems: BirthdayModerationItem[];
  counts: ReturnType<typeof deriveBirthdayVaultCounts>;
  readiness: ReturnType<typeof deriveBirthdayRevealReadiness>;
  state: LoadState;
  organizerState: LoadState;
  errorMessage: string | null;
  malformedIds: string[];
  canGuestMutate: boolean;
  canOrganizerMutate: boolean;
  submit: (value: BirthdayMessageInput) => Promise<void>;
  withdraw: () => Promise<void>;
  initialize: () => Promise<void>;
  close: () => Promise<void>;
  reopen: () => Promise<void>;
  moderate: (
    item: BirthdayModerationItem,
    status: BirthdayModerationStatus,
    note: string,
  ) => Promise<void>;
  bulkApprove: () => Promise<number>;
  move: (item: BirthdayModerationItem, direction: -1 | 1) => Promise<void>;
  publish: (republish: boolean) => Promise<number>;
}

const BirthdayVaultContext = createContext<BirthdayVaultContextValue | null>(
  null,
);

export function BirthdayVaultProvider({ children }: { children: ReactNode }) {
  const firebase = useFirebase();
  const auth = useAuth();
  const connection = useConnection();
  const participants = useParticipants();
  const [publicState, setPublicState] =
    useState<BirthdayVaultPublicState | null>(null);
  const [receipts, setReceipts] = useState<BirthdaySubmissionReceipt[]>([]);
  const [ownMessage, setOwnMessage] = useState<BirthdayMessage | null>(null);
  const [publishedMessages, setPublishedMessages] = useState<
    PublishedBirthdayMessage[]
  >([]);
  const [organizerMessages, setOrganizerMessages] = useState<BirthdayMessage[]>(
    [],
  );
  const [moderation, setModeration] = useState<BirthdayMessageModeration[]>([]);
  const [state, setState] = useState<LoadState>("loading");
  const [organizerState, setOrganizerState] = useState<LoadState>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [malformedMessageIds, setMalformedMessageIds] = useState<string[]>([]);
  const [malformedModerationIds, setMalformedModerationIds] = useState<
    string[]
  >([]);
  const [otherMalformedIds, setOtherMalformedIds] = useState<string[]>([]);

  useEffect(() => {
    if (firebase.status !== "ready" || auth.guest.status !== "ready") return;
    let readyCount = 0;
    const markReady = () => {
      readyCount += 1;
      if (readyCount === 3) setState("ready");
    };
    const fail = () => {
      setState("error");
      setErrorMessage("The Birthday Vault could not be verified right now.");
    };
    const stops = [
      subscribeBirthdayVaultPublicState(
        firebase.clients.guestDatabase,
        (next, malformed) => {
          setPublicState(next);
          setOtherMalformedIds((current) =>
            malformed
              ? [...new Set([...current, "publicState"])]
              : current.filter((id) => id !== "publicState"),
          );
          markReady();
        },
        fail,
      ),
      subscribeBirthdaySubmissionReceipts(
        firebase.clients.guestDatabase,
        (result) => {
          setReceipts(result.receipts);
          setOtherMalformedIds((current) => [
            ...new Set([
              ...current.filter((id) => !id.startsWith("receipt:")),
              ...result.invalidIds.map((id) => `receipt:${id}`),
            ]),
          ]);
          markReady();
        },
        fail,
      ),
      subscribeOwnBirthdayMessage(
        firebase.clients.guestDatabase,
        auth.guest.uid,
        (message, malformed) => {
          setOwnMessage(message);
          setOtherMalformedIds((current) =>
            malformed
              ? [...new Set([...current, "own-message"])]
              : current.filter((id) => id !== "own-message"),
          );
          markReady();
        },
        fail,
      ),
    ];
    return () => stops.forEach((stop) => stop());
  }, [auth.guest, firebase]);

  useEffect(() => {
    if (
      firebase.status !== "ready" ||
      auth.guest.status !== "ready" ||
      publicState?.status !== "revealed"
    ) {
      return;
    }
    return subscribePublishedBirthdayMessages(
      firebase.clients.guestDatabase,
      (result) => {
        setPublishedMessages(result.messages);
        setOtherMalformedIds((current) => [
          ...new Set([
            ...current.filter((id) => !id.startsWith("published:")),
            ...result.invalidIds.map((id) => `published:${id}`),
          ]),
        ]);
      },
      () => {
        setErrorMessage("Published Birthday Vault messages could not be read.");
      },
    );
  }, [auth.guest, firebase, publicState?.status]);

  useEffect(() => {
    if (firebase.status !== "ready" || auth.organizer.status !== "authorized") {
      return;
    }
    let messagesReady = false;
    let moderationReady = false;
    const markReady = () => {
      if (messagesReady && moderationReady) setOrganizerState("ready");
    };
    const fail = () => {
      setOrganizerState("error");
      setErrorMessage("Organizer Birthday Vault records could not be loaded.");
    };
    const stopMessages = subscribeOrganizerBirthdayMessages(
      firebase.clients.organizerDatabase,
      (result) => {
        setOrganizerMessages(result.messages);
        setMalformedMessageIds(result.invalidIds);
        messagesReady = true;
        markReady();
      },
      fail,
    );
    const stopModeration = subscribeBirthdayModeration(
      firebase.clients.organizerDatabase,
      (result) => {
        setModeration(result.moderation);
        setMalformedModerationIds(result.invalidIds);
        moderationReady = true;
        markReady();
      },
      fail,
    );
    return () => {
      stopMessages();
      stopModeration();
    };
  }, [auth.organizer, firebase]);

  const organizerItems = useMemo(
    () =>
      combineBirthdayModeration(
        organizerMessages,
        moderation,
        participants.organizerParticipants,
      ),
    [moderation, organizerMessages, participants.organizerParticipants],
  );
  const counts = useMemo(
    () => deriveBirthdayVaultCounts(organizerItems),
    [organizerItems],
  );
  const readiness = useMemo(
    () =>
      deriveBirthdayRevealReadiness({
        state: publicState,
        items: organizerItems,
        participants: participants.organizerParticipants,
        online: connection === "online",
        authorized: auth.organizer.status === "authorized",
        malformedMessageIds,
        malformedModerationIds,
      }),
    [
      auth.organizer.status,
      connection,
      malformedMessageIds,
      malformedModerationIds,
      organizerItems,
      participants.organizerParticipants,
      publicState,
    ],
  );

  const requireGuest = useCallback(() => {
    if (connection !== "online")
      throw new Error("Birthday Vault changes are paused while offline.");
    if (
      firebase.status !== "ready" ||
      auth.guest.status !== "ready" ||
      !participants.ownParticipant
    ) {
      throw new Error("Join the participant roster before writing a message.");
    }
    return {
      database: firebase.clients.guestDatabase,
      uid: auth.guest.uid,
      participantId: participants.ownParticipant.id,
    };
  }, [auth.guest, connection, firebase, participants.ownParticipant]);

  const requireOrganizer = useCallback(() => {
    if (connection !== "online")
      throw new Error("Birthday Vault changes are paused while offline.");
    if (firebase.status !== "ready" || auth.organizer.status !== "authorized") {
      throw new Error("Organizer access is not ready.");
    }
    return {
      database: firebase.clients.organizerDatabase,
      uid: auth.organizer.uid,
    };
  }, [auth.organizer, connection, firebase]);

  const value = useMemo<BirthdayVaultContextValue>(
    () => ({
      publicState,
      publicCount: receipts.filter((receipt) => receipt.active).length,
      ownMessage,
      publishedMessages,
      organizerItems,
      counts,
      readiness,
      state: firebase.status === "ready" ? state : "idle",
      organizerState:
        auth.organizer.status === "authorized" ? organizerState : "idle",
      errorMessage,
      malformedIds: [
        ...malformedMessageIds,
        ...malformedModerationIds,
        ...otherMalformedIds,
      ],
      canGuestMutate:
        connection === "online" &&
        auth.guest.status === "ready" &&
        participants.ownParticipant !== null &&
        publicState?.status === "collecting",
      canOrganizerMutate:
        connection === "online" && auth.organizer.status === "authorized",
      submit: async (input) => {
        const guest = requireGuest();
        await submitBirthdayMessage({
          ...guest,
          current: ownMessage,
          value: input,
        });
      },
      withdraw: async () => {
        const guest = requireGuest();
        if (!ownMessage)
          throw new Error(
            "No Birthday Vault message is available to withdraw.",
          );
        await withdrawBirthdayMessage({
          database: guest.database,
          uid: guest.uid,
          current: ownMessage,
        });
      },
      initialize: async () => {
        const organizer = requireOrganizer();
        await initializeBirthdayVault(organizer.database, organizer.uid);
      },
      close: async () => {
        const organizer = requireOrganizer();
        if (!publicState) throw new Error("Open the Birthday Vault first.");
        await closeBirthdayVault(
          organizer.database,
          organizer.uid,
          publicState,
        );
      },
      reopen: async () => {
        const organizer = requireOrganizer();
        if (!publicState) throw new Error("Open the Birthday Vault first.");
        await reopenBirthdayVault(
          organizer.database,
          organizer.uid,
          publicState,
        );
      },
      moderate: async (item, status, note) => {
        const organizer = requireOrganizer();
        const maximumOrder = Math.max(
          -1,
          ...organizerItems.map(
            (candidate) => candidate.moderation?.displayOrder ?? -1,
          ),
        );
        await moderateBirthdayMessage({
          ...organizer,
          message: item.message,
          current: item.moderation,
          status,
          note,
          displayOrder:
            status === "approved"
              ? (item.moderation?.displayOrder ?? maximumOrder + 1)
              : null,
        });
      },
      bulkApprove: async () => {
        const organizer = requireOrganizer();
        return bulkApproveBirthdayMessages({
          ...organizer,
          items: organizerItems,
        });
      },
      move: async (item, direction) => {
        const organizer = requireOrganizer();
        const ordered = readiness.approvedMessages;
        const index = ordered.findIndex(
          (candidate) => candidate.message.ownerUid === item.message.ownerUid,
        );
        const target = index + direction;
        if (index < 0 || target < 0 || target >= ordered.length) return;
        const next = [...ordered];
        [next[index], next[target]] = [next[target]!, next[index]!];
        await reorderBirthdayMessages({ ...organizer, orderedItems: next });
      },
      publish: async (republish) => {
        const organizer = requireOrganizer();
        if (!publicState) throw new Error("Open the Birthday Vault first.");
        return publishBirthdayVault({
          ...organizer,
          currentState: publicState,
          items: organizerItems,
          participants: participants.organizerParticipants,
          republish,
        });
      },
    }),
    [
      auth.guest.status,
      auth.organizer.status,
      connection,
      counts,
      errorMessage,
      firebase.status,
      malformedMessageIds,
      malformedModerationIds,
      organizerItems,
      organizerState,
      otherMalformedIds,
      ownMessage,
      participants.organizerParticipants,
      participants.ownParticipant,
      publicState,
      publishedMessages,
      readiness,
      receipts,
      requireGuest,
      requireOrganizer,
      state,
    ],
  );

  return (
    <BirthdayVaultContext.Provider value={value}>
      {children}
    </BirthdayVaultContext.Provider>
  );
}

// Hooks intentionally share this module with their provider.
// eslint-disable-next-line react-refresh/only-export-components
export function useBirthdayVault() {
  const value = useContext(BirthdayVaultContext);
  if (!value)
    throw new Error(
      "useBirthdayVault must be used within BirthdayVaultProvider",
    );
  return value;
}
