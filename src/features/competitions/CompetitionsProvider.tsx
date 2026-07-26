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
import {
  archiveCompetition,
  createDraft,
  deleteDraft,
  duplicateCompetition,
  publishDraft,
  readCompetitionDraft,
  reorderCompetitions,
  restoreCompetition,
  subscribeCompetitionDrafts,
  subscribeOrganizerCompetitions,
  subscribeScheduledCompetitions,
  updateDraft,
  updateScheduledCompetition,
} from "./repositories/competitions";
import type {
  CompetitionDraft,
  CompetitionFormValues,
  CompetitionRecord,
  PublishedCompetition,
} from "./domain/types";

type LoadState = "idle" | "loading" | "ready" | "error";

interface CompetitionsContextValue {
  scheduled: PublishedCompetition[];
  archived: PublishedCompetition[];
  drafts: CompetitionDraft[];
  publicState: LoadState;
  organizerState: LoadState;
  publicMalformedCount: number;
  organizerMalformedCount: number;
  errorMessage: string | null;
  canMutate: boolean;
  saveDraft: (
    draft: CompetitionDraft | null,
    values: CompetitionFormValues,
  ) => Promise<string>;
  publish: (
    draft: CompetitionDraft | null,
    values?: CompetitionFormValues,
  ) => Promise<void>;
  saveScheduled: (
    competition: PublishedCompetition,
    values: CompetitionFormValues,
  ) => Promise<void>;
  deleteDraft: (draft: CompetitionDraft) => Promise<void>;
  duplicate: (record: CompetitionRecord) => Promise<string>;
  archive: (competition: PublishedCompetition) => Promise<void>;
  restore: (competition: PublishedCompetition) => Promise<void>;
  reorder: (
    competitionId: string,
    direction: "earlier" | "later",
  ) => Promise<void>;
}

const CompetitionsContext = createContext<CompetitionsContextValue | null>(
  null,
);

export function CompetitionsProvider({ children }: { children: ReactNode }) {
  const firebase = useFirebase();
  const auth = useAuth();
  const connection = useConnection();
  const [scheduled, setScheduled] = useState<PublishedCompetition[]>([]);
  const [archived, setArchived] = useState<PublishedCompetition[]>([]);
  const [drafts, setDrafts] = useState<CompetitionDraft[]>([]);
  const [publicState, setPublicState] = useState<LoadState>("loading");
  const [organizerState, setOrganizerState] = useState<LoadState>("idle");
  const [publicMalformedCount, setPublicMalformedCount] = useState(0);
  const [draftMalformedCount, setDraftMalformedCount] = useState(0);
  const [publishedMalformedCount, setPublishedMalformedCount] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (firebase.status !== "ready" || auth.guest.status !== "ready") return;
    return subscribeScheduledCompetitions(
      firebase.clients.guestDatabase,
      (result) => {
        setScheduled(result.records);
        setPublicMalformedCount(result.invalidIds.length);
        setPublicState("ready");
      },
      () => {
        setPublicState("error");
        setErrorMessage("Scheduled competitions could not be loaded.");
      },
    );
  }, [auth.guest, firebase]);

  useEffect(() => {
    if (firebase.status !== "ready" || auth.organizer.status !== "authorized") {
      return;
    }
    let draftsReady = false;
    let competitionsReady = false;
    const markReady = () => {
      if (draftsReady && competitionsReady) setOrganizerState("ready");
    };
    const stopDrafts = subscribeCompetitionDrafts(
      firebase.clients.organizerDatabase,
      (result) => {
        setDrafts(
          [...result.records].sort(
            (a, b) => b.updatedAt - a.updatedAt || a.id.localeCompare(b.id),
          ),
        );
        setDraftMalformedCount(result.invalidIds.length);
        draftsReady = true;
        markReady();
      },
      () => {
        setOrganizerState("error");
        setErrorMessage("Competition drafts could not be loaded.");
      },
    );
    const stopCompetitions = subscribeOrganizerCompetitions(
      firebase.clients.organizerDatabase,
      (result) => {
        setArchived(
          result.records.filter((record) => record.status === "archived"),
        );
        setPublishedMalformedCount(result.invalidIds.length);
        competitionsReady = true;
        markReady();
      },
      () => {
        setOrganizerState("error");
        setErrorMessage("Organizer competition data could not be loaded.");
      },
    );
    return () => {
      stopDrafts();
      stopCompetitions();
    };
  }, [auth.organizer, firebase]);

  const requireOrganizer = useCallback(() => {
    if (connection !== "online") {
      throw new Error("Competition changes are paused while offline.");
    }
    if (firebase.status !== "ready" || auth.organizer.status !== "authorized") {
      throw new Error("Organizer access is not ready.");
    }
    return {
      database: firebase.clients.organizerDatabase,
      uid: auth.organizer.uid,
    };
  }, [auth.organizer, connection, firebase]);

  const saveDraftAction = useCallback(
    async (draft: CompetitionDraft | null, values: CompetitionFormValues) => {
      const { database, uid } = requireOrganizer();
      if (draft) {
        await updateDraft(database, uid, draft, values);
        return draft.id;
      }
      return createDraft(database, uid, values);
    },
    [requireOrganizer],
  );

  const publishAction = useCallback(
    async (draft: CompetitionDraft | null, values?: CompetitionFormValues) => {
      const { database, uid } = requireOrganizer();
      let source = draft;
      if (!source) {
        if (!values) throw new Error("Competition configuration is missing.");
        const id = await createDraft(database, uid, values);
        source = await readCompetitionDraft(database, id);
      } else if (values) {
        await updateDraft(database, uid, source, values);
        source = await readCompetitionDraft(database, source.id);
      }
      if (!source) throw new Error("The saved draft could not be loaded.");
      await publishDraft(database, uid, source, scheduled);
    },
    [requireOrganizer, scheduled],
  );

  const existingTitles = useMemo(
    () => [...drafts, ...scheduled, ...archived].map((record) => record.title),
    [archived, drafts, scheduled],
  );

  const value = useMemo<CompetitionsContextValue>(
    () => ({
      scheduled,
      archived,
      drafts,
      publicState:
        firebase.status !== "ready"
          ? "idle"
          : auth.guest.status === "ready"
            ? publicState
            : "loading",
      publicMalformedCount,
      organizerState:
        auth.organizer.status === "authorized" && organizerState === "idle"
          ? "loading"
          : organizerState,
      organizerMalformedCount: draftMalformedCount + publishedMalformedCount,
      errorMessage,
      canMutate:
        connection === "online" && auth.organizer.status === "authorized",
      saveDraft: saveDraftAction,
      publish: publishAction,
      saveScheduled: async (competition, values) => {
        const { database, uid } = requireOrganizer();
        await updateScheduledCompetition(database, uid, competition, values);
      },
      deleteDraft: async (draft) => {
        const { database, uid } = requireOrganizer();
        await deleteDraft(database, uid, draft);
      },
      duplicate: async (record) => {
        const { database, uid } = requireOrganizer();
        return duplicateCompetition(database, uid, record, existingTitles);
      },
      archive: async (competition) => {
        const { database, uid } = requireOrganizer();
        await archiveCompetition(database, uid, competition);
      },
      restore: async (competition) => {
        const { database, uid } = requireOrganizer();
        await restoreCompetition(database, uid, competition);
      },
      reorder: async (competitionId, direction) => {
        const { database, uid } = requireOrganizer();
        await reorderCompetitions(
          database,
          uid,
          scheduled,
          competitionId,
          direction,
        );
      },
    }),
    [
      archived,
      auth.guest.status,
      auth.organizer.status,
      connection,
      drafts,
      errorMessage,
      existingTitles,
      firebase.status,
      draftMalformedCount,
      organizerState,
      publicMalformedCount,
      publishedMalformedCount,
      publicState,
      publishAction,
      requireOrganizer,
      saveDraftAction,
      scheduled,
    ],
  );

  return (
    <CompetitionsContext.Provider value={value}>
      {children}
    </CompetitionsContext.Provider>
  );
}

// Hooks intentionally share this module with their provider.
// eslint-disable-next-line react-refresh/only-export-components
export function useCompetitions() {
  const value = useContext(CompetitionsContext);
  if (!value) {
    throw new Error("useCompetitions must be used within CompetitionsProvider");
  }
  return value;
}
