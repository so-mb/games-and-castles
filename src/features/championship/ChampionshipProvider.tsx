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
import { useCompetitions } from "../competitions/CompetitionsProvider";
import { useConnection } from "../live/ConnectionProvider";
import { useFirebase } from "../live/FirebaseProvider";
import { useParticipants } from "../participants/ParticipantsProvider";
import { deriveChampionshipAchievements } from "./achievements/deriveAchievements";
import { deriveChampionshipLeaderboard } from "./domain/leaderboard";
import { deriveReconciliationItems } from "./domain/reconciliation";
import type {
  ChampionshipAchievement,
  ChampionshipStanding,
  CompetitionLedgerSnapshot,
  ManualChampionshipBonus,
  ReconciliationItem,
} from "./domain/types";
import {
  createManualBonus,
  reconcileCompetitionLedgerSource,
  removeOrphanedCompetitionLedgerSource,
  restoreManualBonus,
  revokeManualBonus,
  subscribeCompetitionLedgerSources,
  subscribeOrganizerManualBonuses,
  subscribePublicManualBonuses,
} from "./repositories/championship";

type LoadState = "idle" | "loading" | "ready" | "error";

interface ChampionshipContextValue {
  sources: CompetitionLedgerSnapshot[];
  publicBonuses: ManualChampionshipBonus[];
  organizerBonuses: ManualChampionshipBonus[];
  standings: ChampionshipStanding[];
  achievements: ChampionshipAchievement[];
  reconciliation: ReconciliationItem[];
  state: LoadState;
  malformedSourceIds: string[];
  malformedBonusIds: string[];
  errorMessage: string | null;
  canMutate: boolean;
  reconcileOne: (item: ReconciliationItem) => Promise<void>;
  reconcileAll: () => Promise<number>;
  removeOrphan: (item: ReconciliationItem) => Promise<void>;
  createBonus: (input: {
    participantId: string;
    points: number;
    label: string;
    note: string;
  }) => Promise<void>;
  revokeBonus: (bonus: ManualChampionshipBonus) => Promise<void>;
  restoreBonus: (bonus: ManualChampionshipBonus) => Promise<void>;
}

const ChampionshipContext = createContext<ChampionshipContextValue | null>(
  null,
);

export function ChampionshipProvider({ children }: { children: ReactNode }) {
  const firebase = useFirebase();
  const auth = useAuth();
  const connection = useConnection();
  const competitions = useCompetitions();
  const participants = useParticipants();
  const [sources, setSources] = useState<CompetitionLedgerSnapshot[]>([]);
  const [publicBonuses, setPublicBonuses] = useState<ManualChampionshipBonus[]>(
    [],
  );
  const [organizerBonuses, setOrganizerBonuses] = useState<
    ManualChampionshipBonus[]
  >([]);
  const [state, setState] = useState<LoadState>("loading");
  const [malformedSourceIds, setMalformedSourceIds] = useState<string[]>([]);
  const [malformedBonusIds, setMalformedBonusIds] = useState<string[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (firebase.status !== "ready" || auth.guest.status !== "ready") return;
    let sourcesReady = false;
    let bonusesReady = false;
    const markReady = () => {
      if (sourcesReady && bonusesReady) setState("ready");
    };
    const fail = () => {
      setState("error");
      setErrorMessage("Championship scores could not be verified right now.");
    };
    const stopSources = subscribeCompetitionLedgerSources(
      firebase.clients.guestDatabase,
      (result) => {
        setSources(result.sources);
        setMalformedSourceIds(result.invalidIds);
        sourcesReady = true;
        markReady();
      },
      fail,
    );
    const stopBonuses = subscribePublicManualBonuses(
      firebase.clients.guestDatabase,
      (result) => {
        setPublicBonuses(result.bonuses);
        setMalformedBonusIds(result.invalidIds);
        bonusesReady = true;
        markReady();
      },
      fail,
    );
    return () => {
      stopSources();
      stopBonuses();
    };
  }, [auth.guest, firebase]);

  useEffect(() => {
    if (firebase.status !== "ready" || auth.organizer.status !== "authorized") {
      return;
    }
    return subscribeOrganizerManualBonuses(
      firebase.clients.organizerDatabase,
      setResult,
      () => setErrorMessage("Organizer bonus records could not be loaded."),
    );

    function setResult(result: {
      bonuses: ManualChampionshipBonus[];
      invalidIds: string[];
    }) {
      setOrganizerBonuses(result.bonuses);
      setMalformedBonusIds((current) => [
        ...new Set([...current, ...result.invalidIds]),
      ]);
    }
  }, [auth.organizer, firebase]);

  const allCompetitions = useMemo(
    () => [
      ...competitions.scheduled,
      ...competitions.active,
      ...competitions.completed,
      ...competitions.archived,
    ],
    [
      competitions.active,
      competitions.archived,
      competitions.completed,
      competitions.scheduled,
    ],
  );
  const standings = useMemo(
    () =>
      deriveChampionshipLeaderboard({
        sources,
        bonuses: publicBonuses,
        participants: participants.championshipParticipants,
      }),
    [participants.championshipParticipants, publicBonuses, sources],
  );
  const achievements = useMemo(
    () => deriveChampionshipAchievements(standings),
    [standings],
  );
  const reconciliation = useMemo(
    () =>
      deriveReconciliationItems({
        competitions: allCompetitions,
        runs: competitions.runs,
        sources,
        invalidRunIds: competitions.runtimeInvalidIds,
        invalidSourceIds: malformedSourceIds,
      }),
    [
      allCompetitions,
      competitions.runs,
      competitions.runtimeInvalidIds,
      malformedSourceIds,
      sources,
    ],
  );

  const requireOrganizer = useCallback(() => {
    if (connection !== "online") {
      throw new Error("Championship changes are paused while offline.");
    }
    if (firebase.status !== "ready" || auth.organizer.status !== "authorized") {
      throw new Error("Organizer access is not ready.");
    }
    return {
      database: firebase.clients.organizerDatabase,
      uid: auth.organizer.uid,
    };
  }, [auth.organizer, connection, firebase]);

  const reconcileOne = useCallback(
    async (item: ReconciliationItem) => {
      const competition = allCompetitions.find(
        (candidate) => candidate.id === item.competitionId,
      );
      const run = competitions.runs.find(
        (candidate) => candidate.competitionId === item.competitionId,
      );
      if (!competition || !run || !["missing", "stale"].includes(item.status)) {
        throw new Error("This championship source is not reconcilable.");
      }
      const { database, uid } = requireOrganizer();
      await reconcileCompetitionLedgerSource(database, uid, competition, run);
    },
    [allCompetitions, competitions.runs, requireOrganizer],
  );

  const value = useMemo<ChampionshipContextValue>(
    () => ({
      sources,
      publicBonuses,
      organizerBonuses:
        auth.organizer.status === "authorized" ? organizerBonuses : [],
      standings,
      achievements,
      reconciliation,
      state: firebase.status === "ready" ? state : "idle",
      malformedSourceIds,
      malformedBonusIds,
      errorMessage,
      canMutate:
        connection === "online" && auth.organizer.status === "authorized",
      reconcileOne,
      reconcileAll: async () => {
        const items = reconciliation.filter((item) =>
          ["missing", "stale"].includes(item.status),
        );
        for (const item of items) await reconcileOne(item);
        return items.length;
      },
      removeOrphan: async (item) => {
        if (item.status !== "orphaned" || !item.persisted) {
          throw new Error("This source is not an orphan.");
        }
        const { database, uid } = requireOrganizer();
        await removeOrphanedCompetitionLedgerSource(
          database,
          uid,
          item.persisted,
        );
      },
      createBonus: async (input) => {
        const { database, uid } = requireOrganizer();
        await createManualBonus(database, uid, input);
      },
      revokeBonus: async (bonus) => {
        const { database, uid } = requireOrganizer();
        await revokeManualBonus(database, uid, bonus);
      },
      restoreBonus: async (bonus) => {
        const { database, uid } = requireOrganizer();
        await restoreManualBonus(database, uid, bonus);
      },
    }),
    [
      achievements,
      auth.organizer.status,
      connection,
      errorMessage,
      firebase.status,
      malformedBonusIds,
      malformedSourceIds,
      organizerBonuses,
      publicBonuses,
      reconciliation,
      reconcileOne,
      requireOrganizer,
      sources,
      standings,
      state,
    ],
  );

  return (
    <ChampionshipContext.Provider value={value}>
      {children}
    </ChampionshipContext.Provider>
  );
}

// Hooks intentionally share this module with their provider.
// eslint-disable-next-line react-refresh/only-export-components
export function useChampionship() {
  const value = useContext(ChampionshipContext);
  if (!value) {
    throw new Error("useChampionship must be used within ChampionshipProvider");
  }
  return value;
}
