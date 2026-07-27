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
  subscribePublicCompetitions,
  updateDraft,
  updateScheduledCompetition,
} from "./repositories/competitions";
import {
  activateCompetition,
  completeRunCompetition,
  createRunKnockout,
  reopenRunCompetition,
  resetCompetitionRun,
  returnRunMatchToPending,
  saveRunMatchResult,
  saveTieResolution,
  startRunMatch,
  subscribeCompetitionRuns,
  subscribePhaseFourAudit,
} from "./repositories/runs";
import {
  addAllHandsSession,
  beginAllHandsCompletionReview,
  completeStoredAllHandsCompetition,
  deleteStoredPendingAllHandsSession,
  reopenStoredAllHandsCompetition,
  resetStoredAllHandsRun,
  restoreStoredAllHandsSession,
  returnStoredAllHandsSessionToPending,
  saveAllHandsResult,
  saveAllHandsTieResolution,
  startStoredAllHandsSession,
  voidStoredAllHandsSession,
  activateAllHandsCompetition,
} from "./repositories/allHandsRuns";
import {
  activateGroupCompetition,
  completeStoredGroupCompetition,
  generateStoredGroupKnockout,
  openStoredQualificationReview,
  reopenStoredGroupCompetition,
  resetStoredGroupKnockout,
  resetStoredGroupRun,
  returnStoredGroupMatchToPending,
  saveStoredCrossGroupSeedResolution,
  saveStoredGroupResult,
  saveStoredGroupTieResolution,
  startStoredGroupMatch,
} from "./repositories/groupKnockoutRuns";
import type { AnyCompetitionRun, CompetitionRun } from "./engine/types";
import type { RecordResultOptions } from "./engine/lifecycle";
import type {
  AllHandsCompetitionRun,
  AllHandsResultInput,
  AllHandsTeam,
} from "./all-hands/types";
import type { GroupKnockoutRun } from "./group-knockout/types";
import type { GroupRecordResultOptions } from "./group-knockout/engine";
import type {
  CompetitionDraft,
  CompetitionAuditEntry,
  CompetitionFormValues,
  CompetitionRecord,
  PublishedCompetition,
} from "./domain/types";

type LoadState = "idle" | "loading" | "ready" | "error";

interface CompetitionsContextValue {
  scheduled: PublishedCompetition[];
  active: PublishedCompetition[];
  completed: PublishedCompetition[];
  archived: PublishedCompetition[];
  drafts: CompetitionDraft[];
  runs: AnyCompetitionRun[];
  auditEntries: CompetitionAuditEntry[];
  publicState: LoadState;
  organizerState: LoadState;
  publicMalformedCount: number;
  organizerMalformedCount: number;
  runtimeMalformedCount: number;
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
  activate: (competition: PublishedCompetition) => Promise<void>;
  activateGroup: (
    competition: PublishedCompetition,
    previewRun: GroupKnockoutRun,
  ) => Promise<void>;
  startMatch: (
    run: CompetitionRun,
    matchId: string,
    expectedMatchRevision: number,
  ) => Promise<void>;
  returnMatchToPending: (
    run: CompetitionRun,
    matchId: string,
    expectedMatchRevision: number,
  ) => Promise<void>;
  recordResult: (
    run: CompetitionRun,
    matchId: string,
    options: Omit<RecordResultOptions, "organizerUid" | "now">,
  ) => Promise<void>;
  resolveTie: (
    run: CompetitionRun,
    participantIds: string[],
    orderedParticipantIds: string[],
    reason: string,
  ) => Promise<void>;
  generateKnockout: (run: CompetitionRun) => Promise<void>;
  complete: (
    competition: PublishedCompetition,
    run: CompetitionRun,
  ) => Promise<void>;
  reopen: (
    competition: PublishedCompetition,
    run: CompetitionRun,
  ) => Promise<void>;
  resetRun: (
    competition: PublishedCompetition,
    run: CompetitionRun,
  ) => Promise<void>;
  createAllHandsSession: (
    run: AllHandsCompetitionRun,
    input: {
      title: string;
      mode: "individual" | "team";
      participantIds: string[];
      teams: AllHandsTeam[];
      startImmediately: boolean;
    },
  ) => Promise<void>;
  startAllHandsSession: (
    run: AllHandsCompetitionRun,
    sessionId: string,
    expectedRevision: number,
  ) => Promise<void>;
  returnAllHandsSessionToPending: (
    run: AllHandsCompetitionRun,
    sessionId: string,
    expectedRevision: number,
  ) => Promise<void>;
  recordAllHandsResult: (
    run: AllHandsCompetitionRun,
    sessionId: string,
    expectedRevision: number,
    input: AllHandsResultInput,
  ) => Promise<void>;
  voidAllHandsSession: (
    run: AllHandsCompetitionRun,
    sessionId: string,
    expectedRevision: number,
    reason: string,
  ) => Promise<void>;
  restoreAllHandsSession: (
    run: AllHandsCompetitionRun,
    sessionId: string,
    expectedRevision: number,
  ) => Promise<void>;
  deleteAllHandsSession: (
    run: AllHandsCompetitionRun,
    sessionId: string,
    expectedRevision: number,
  ) => Promise<void>;
  reviewAllHandsCompletion: (run: AllHandsCompetitionRun) => Promise<void>;
  resolveAllHandsTie: (
    run: AllHandsCompetitionRun,
    participantIds: string[],
    orderedParticipantIds: string[],
    reason: string | null,
  ) => Promise<void>;
  completeAllHands: (
    competition: PublishedCompetition,
    run: AllHandsCompetitionRun,
  ) => Promise<void>;
  reopenAllHands: (
    competition: PublishedCompetition,
    run: AllHandsCompetitionRun,
  ) => Promise<void>;
  resetAllHands: (
    competition: PublishedCompetition,
    run: AllHandsCompetitionRun,
  ) => Promise<void>;
  startGroupMatch: (
    run: GroupKnockoutRun,
    matchId: string,
    expectedMatchRevision: number,
  ) => Promise<void>;
  returnGroupMatchToPending: (
    run: GroupKnockoutRun,
    matchId: string,
    expectedMatchRevision: number,
  ) => Promise<void>;
  recordGroupResult: (
    run: GroupKnockoutRun,
    matchId: string,
    options: Omit<GroupRecordResultOptions, "organizerUid" | "now">,
  ) => Promise<void>;
  resolveGroupTie: (
    run: GroupKnockoutRun,
    groupId: string,
    participantIds: string[],
    orderedParticipantIds: string[],
    reason: string,
  ) => Promise<void>;
  openQualificationReview: (run: GroupKnockoutRun) => Promise<void>;
  resolveCrossGroupSeed: (
    run: GroupKnockoutRun,
    groupRank: number,
    participantIds: string[],
    orderedParticipantIds: string[],
    reason: string,
  ) => Promise<void>;
  generateGroupKnockout: (run: GroupKnockoutRun) => Promise<void>;
  resetGroupKnockout: (run: GroupKnockoutRun) => Promise<void>;
  completeGroup: (
    competition: PublishedCompetition,
    run: GroupKnockoutRun,
  ) => Promise<void>;
  reopenGroup: (
    competition: PublishedCompetition,
    run: GroupKnockoutRun,
  ) => Promise<void>;
  resetGroup: (
    competition: PublishedCompetition,
    run: GroupKnockoutRun,
  ) => Promise<void>;
}

const CompetitionsContext = createContext<CompetitionsContextValue | null>(
  null,
);

export function CompetitionsProvider({ children }: { children: ReactNode }) {
  const firebase = useFirebase();
  const auth = useAuth();
  const connection = useConnection();
  const participants = useParticipants();
  const [scheduled, setScheduled] = useState<PublishedCompetition[]>([]);
  const [active, setActive] = useState<PublishedCompetition[]>([]);
  const [completed, setCompleted] = useState<PublishedCompetition[]>([]);
  const [archived, setArchived] = useState<PublishedCompetition[]>([]);
  const [drafts, setDrafts] = useState<CompetitionDraft[]>([]);
  const [runs, setRuns] = useState<AnyCompetitionRun[]>([]);
  const [auditEntries, setAuditEntries] = useState<CompetitionAuditEntry[]>([]);
  const [publicState, setPublicState] = useState<LoadState>("loading");
  const [organizerState, setOrganizerState] = useState<LoadState>("idle");
  const [publicMalformedCount, setPublicMalformedCount] = useState(0);
  const [draftMalformedCount, setDraftMalformedCount] = useState(0);
  const [publishedMalformedCount, setPublishedMalformedCount] = useState(0);
  const [runtimeMalformedCount, setRuntimeMalformedCount] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (firebase.status !== "ready" || auth.guest.status !== "ready") return;
    const stopCompetitions = subscribePublicCompetitions(
      firebase.clients.guestDatabase,
      (result) => {
        setScheduled(
          result.records.filter((record) => record.status === "scheduled"),
        );
        setActive(
          result.records.filter((record) => record.status === "active"),
        );
        setCompleted(
          result.records.filter((record) => record.status === "completed"),
        );
        setPublicMalformedCount(result.invalidIds.length);
        setPublicState("ready");
      },
      () => {
        setPublicState("error");
        setErrorMessage("Scheduled competitions could not be loaded.");
      },
    );
    const stopRuns = subscribeCompetitionRuns(
      firebase.clients.guestDatabase,
      (result) => {
        setRuns(result.runs);
        setRuntimeMalformedCount(result.invalidIds.length);
      },
      () => {
        setErrorMessage("Live competition runtime data could not be loaded.");
      },
    );
    return () => {
      stopCompetitions();
      stopRuns();
    };
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
    const stopAudit = subscribePhaseFourAudit(
      firebase.clients.organizerDatabase,
      setAuditEntries,
      () => setErrorMessage("Competition audit activity could not be loaded."),
    );
    return () => {
      stopDrafts();
      stopCompetitions();
      stopAudit();
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
    () =>
      [...drafts, ...scheduled, ...active, ...completed, ...archived].map(
        (record) => record.title,
      ),
    [active, archived, completed, drafts, scheduled],
  );

  const value = useMemo<CompetitionsContextValue>(
    () => ({
      scheduled,
      active,
      completed,
      archived,
      drafts,
      runs,
      auditEntries,
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
      runtimeMalformedCount,
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
      activate: async (competition) => {
        const { database, uid } = requireOrganizer();
        if (competition.format === "all-hands") {
          await activateAllHandsCompetition(
            database,
            uid,
            competition,
            participants.organizerParticipants,
          );
        } else if (competition.format === "round-robin-knockout") {
          await activateCompetition(
            database,
            uid,
            competition,
            participants.organizerParticipants,
          );
        } else {
          throw new Error(
            "Confirm the Group Format draw preview before activation.",
          );
        }
      },
      activateGroup: async (competition, previewRun) => {
        const { database, uid } = requireOrganizer();
        await activateGroupCompetition(
          database,
          uid,
          competition,
          participants.organizerParticipants,
          previewRun,
        );
      },
      startMatch: async (run, matchId, expectedMatchRevision) => {
        const { database, uid } = requireOrganizer();
        await startRunMatch(database, uid, run, matchId, expectedMatchRevision);
      },
      returnMatchToPending: async (run, matchId, expectedMatchRevision) => {
        const { database, uid } = requireOrganizer();
        await returnRunMatchToPending(
          database,
          uid,
          run,
          matchId,
          expectedMatchRevision,
        );
      },
      recordResult: async (run, matchId, options) => {
        const { database, uid } = requireOrganizer();
        await saveRunMatchResult(database, uid, run, matchId, options);
      },
      resolveTie: async (
        run,
        participantIds,
        orderedParticipantIds,
        reason,
      ) => {
        const { database, uid } = requireOrganizer();
        await saveTieResolution(
          database,
          uid,
          run,
          participantIds,
          orderedParticipantIds,
          reason,
        );
      },
      generateKnockout: async (run) => {
        const { database, uid } = requireOrganizer();
        await createRunKnockout(database, uid, run);
      },
      complete: async (competition, run) => {
        const { database, uid } = requireOrganizer();
        await completeRunCompetition(database, uid, competition, run);
      },
      reopen: async (competition, run) => {
        const { database, uid } = requireOrganizer();
        await reopenRunCompetition(database, uid, competition, run);
      },
      resetRun: async (competition, run) => {
        const { database, uid } = requireOrganizer();
        await resetCompetitionRun(database, uid, competition, run);
      },
      createAllHandsSession: async (run, input) => {
        const { database, uid } = requireOrganizer();
        await addAllHandsSession(database, uid, run, input);
      },
      startAllHandsSession: async (run, sessionId, expectedRevision) => {
        const { database, uid } = requireOrganizer();
        await startStoredAllHandsSession(
          database,
          uid,
          run,
          sessionId,
          expectedRevision,
        );
      },
      returnAllHandsSessionToPending: async (
        run,
        sessionId,
        expectedRevision,
      ) => {
        const { database, uid } = requireOrganizer();
        await returnStoredAllHandsSessionToPending(
          database,
          uid,
          run,
          sessionId,
          expectedRevision,
        );
      },
      recordAllHandsResult: async (run, sessionId, expectedRevision, input) => {
        const { database, uid } = requireOrganizer();
        await saveAllHandsResult(
          database,
          uid,
          run,
          sessionId,
          expectedRevision,
          input,
        );
      },
      voidAllHandsSession: async (run, sessionId, expectedRevision, reason) => {
        const { database, uid } = requireOrganizer();
        await voidStoredAllHandsSession(
          database,
          uid,
          run,
          sessionId,
          expectedRevision,
          reason,
        );
      },
      restoreAllHandsSession: async (run, sessionId, expectedRevision) => {
        const { database, uid } = requireOrganizer();
        await restoreStoredAllHandsSession(
          database,
          uid,
          run,
          sessionId,
          expectedRevision,
        );
      },
      deleteAllHandsSession: async (run, sessionId, expectedRevision) => {
        const { database, uid } = requireOrganizer();
        await deleteStoredPendingAllHandsSession(
          database,
          uid,
          run,
          sessionId,
          expectedRevision,
        );
      },
      reviewAllHandsCompletion: async (run) => {
        const { database, uid } = requireOrganizer();
        await beginAllHandsCompletionReview(database, uid, run);
      },
      resolveAllHandsTie: async (
        run,
        participantIds,
        orderedParticipantIds,
        reason,
      ) => {
        const { database, uid } = requireOrganizer();
        await saveAllHandsTieResolution(
          database,
          uid,
          run,
          participantIds,
          orderedParticipantIds,
          reason,
        );
      },
      completeAllHands: async (competition, run) => {
        const { database, uid } = requireOrganizer();
        await completeStoredAllHandsCompetition(
          database,
          uid,
          competition,
          run,
        );
      },
      reopenAllHands: async (competition, run) => {
        const { database, uid } = requireOrganizer();
        await reopenStoredAllHandsCompetition(database, uid, competition, run);
      },
      resetAllHands: async (competition, run) => {
        const { database, uid } = requireOrganizer();
        await resetStoredAllHandsRun(database, uid, competition, run);
      },
      startGroupMatch: async (run, matchId, expectedMatchRevision) => {
        const { database, uid } = requireOrganizer();
        await startStoredGroupMatch(
          database,
          uid,
          run,
          matchId,
          expectedMatchRevision,
        );
      },
      returnGroupMatchToPending: async (
        run,
        matchId,
        expectedMatchRevision,
      ) => {
        const { database, uid } = requireOrganizer();
        await returnStoredGroupMatchToPending(
          database,
          uid,
          run,
          matchId,
          expectedMatchRevision,
        );
      },
      recordGroupResult: async (run, matchId, options) => {
        const { database, uid } = requireOrganizer();
        await saveStoredGroupResult(database, uid, run, matchId, options);
      },
      resolveGroupTie: async (
        run,
        groupId,
        participantIds,
        orderedParticipantIds,
        reason,
      ) => {
        const { database, uid } = requireOrganizer();
        await saveStoredGroupTieResolution(
          database,
          uid,
          run,
          groupId,
          participantIds,
          orderedParticipantIds,
          reason,
        );
      },
      openQualificationReview: async (run) => {
        const { database, uid } = requireOrganizer();
        await openStoredQualificationReview(database, uid, run);
      },
      resolveCrossGroupSeed: async (
        run,
        groupRank,
        participantIds,
        orderedParticipantIds,
        reason,
      ) => {
        const { database, uid } = requireOrganizer();
        await saveStoredCrossGroupSeedResolution(
          database,
          uid,
          run,
          groupRank,
          participantIds,
          orderedParticipantIds,
          reason,
        );
      },
      generateGroupKnockout: async (run) => {
        const { database, uid } = requireOrganizer();
        await generateStoredGroupKnockout(database, uid, run);
      },
      resetGroupKnockout: async (run) => {
        const { database, uid } = requireOrganizer();
        await resetStoredGroupKnockout(database, uid, run);
      },
      completeGroup: async (competition, run) => {
        const { database, uid } = requireOrganizer();
        await completeStoredGroupCompetition(database, uid, competition, run);
      },
      reopenGroup: async (competition, run) => {
        const { database, uid } = requireOrganizer();
        await reopenStoredGroupCompetition(database, uid, competition, run);
      },
      resetGroup: async (competition, run) => {
        const { database, uid } = requireOrganizer();
        await resetStoredGroupRun(database, uid, competition, run);
      },
    }),
    [
      active,
      auditEntries,
      archived,
      auth.guest.status,
      auth.organizer.status,
      connection,
      completed,
      drafts,
      errorMessage,
      existingTitles,
      firebase.status,
      draftMalformedCount,
      organizerState,
      participants.organizerParticipants,
      publicMalformedCount,
      publishedMalformedCount,
      publicState,
      publishAction,
      requireOrganizer,
      saveDraftAction,
      runs,
      runtimeMalformedCount,
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
