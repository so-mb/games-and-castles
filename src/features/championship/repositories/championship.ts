import {
  get,
  onValue,
  push,
  ref,
  update,
  type Database,
  type Unsubscribe,
} from "firebase/database";
import type { PublishedCompetition } from "../../competitions/domain/types";
import type { AnyCompetitionRun } from "../../competitions/engine/types";
import type {
  CompetitionLedgerSnapshot,
  ManualChampionshipBonus,
} from "../domain/types";
import {
  parseCompetitionLedgerCollection,
  parseManualBonusCollection,
} from "../ledger/runtime";
import { deriveCompetitionLedgerSnapshot } from "../ledger/snapshot";

function pushKey(database: Database, path: string) {
  const value = push(ref(database, path));
  if (!value.key) throw new Error("Firebase could not create an operation ID.");
  return value.key;
}

function auditValue(input: {
  id: string;
  uid: string;
  action: string;
  entityType: "championship-source" | "manual-bonus";
  entityId: string;
  beforeRevision: number | null;
  afterRevision: number | null;
  summary: string;
  now: number;
}) {
  return {
    id: input.id,
    action: input.action,
    entityType: input.entityType,
    entityId: input.entityId,
    actorUid: input.uid,
    ...(input.beforeRevision === null
      ? {}
      : { beforeRevision: input.beforeRevision }),
    ...(input.afterRevision === null
      ? {}
      : { afterRevision: input.afterRevision }),
    occurredAt: input.now,
    summary: input.summary,
    schemaVersion: 1,
  };
}

function publicBonus(bonus: ManualChampionshipBonus) {
  return {
    id: bonus.id,
    participantId: bonus.participantId,
    points: bonus.points,
    label: bonus.label,
    ...(bonus.note === null ? {} : { note: bonus.note }),
    status: "active",
    createdAt: bonus.createdAt,
    updatedAt: bonus.updatedAt,
    revision: bonus.revision,
    schemaVersion: 1,
  };
}

function containsUnsafePlainText(value: string) {
  return (
    /[<>]/.test(value) ||
    [...value].some((character) => {
      const code = character.charCodeAt(0);
      return code < 32 || code === 127;
    })
  );
}

function normalizePublicBonuses(raw: unknown) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { bonuses: [], invalidIds: [] };
  }
  const normalized = Object.fromEntries(
    Object.entries(raw as Record<string, unknown>).map(([id, value]) => {
      const item =
        value && typeof value === "object" && !Array.isArray(value)
          ? (value as Record<string, unknown>)
          : {};
      return [
        id,
        {
          ...item,
          createdByUid: "organizer",
          updatedByUid: "organizer",
          revokedAt: null,
          revokedByUid: null,
        },
      ];
    }),
  );
  return parseManualBonusCollection(normalized);
}

export function subscribeCompetitionLedgerSources(
  database: Database,
  onData: (result: ReturnType<typeof parseCompetitionLedgerCollection>) => void,
  onError: (error: Error) => void,
): Unsubscribe {
  return onValue(
    ref(database, "championshipLedger/competitionSources"),
    (snapshot) => onData(parseCompetitionLedgerCollection(snapshot.val())),
    onError,
  );
}

export function subscribePublicManualBonuses(
  database: Database,
  onData: (result: ReturnType<typeof parseManualBonusCollection>) => void,
  onError: (error: Error) => void,
): Unsubscribe {
  return onValue(
    ref(database, "championshipLedger/manualBonusesPublic"),
    (snapshot) => onData(normalizePublicBonuses(snapshot.val())),
    onError,
  );
}

export function subscribeOrganizerManualBonuses(
  database: Database,
  onData: (result: ReturnType<typeof parseManualBonusCollection>) => void,
  onError: (error: Error) => void,
): Unsubscribe {
  return onValue(
    ref(database, "championshipLedger/manualBonuses"),
    (snapshot) => onData(parseManualBonusCollection(snapshot.val())),
    onError,
  );
}

export async function reconcileCompetitionLedgerSource(
  database: Database,
  uid: string,
  competition: PublishedCompetition,
  run: AnyCompetitionRun,
) {
  const [competitionSnapshot, runSnapshot, ledgerSnapshot] = await Promise.all([
    get(ref(database, `competitions/${competition.id}`)),
    get(ref(database, `competitionRuns/${competition.id}`)),
    get(
      ref(database, `championshipLedger/competitionSources/${competition.id}`),
    ),
  ]);
  const latestCompetition = competitionSnapshot.val() as Record<
    string,
    unknown
  > | null;
  const latestRun = runSnapshot.val() as Record<string, unknown> | null;
  if (
    latestCompetition?.revision !== competition.revision ||
    latestCompetition?.status !== competition.status ||
    latestRun?.revision !== run.revision
  ) {
    throw new Error(
      "This competition changed on another device. Reload before reconciling.",
    );
  }
  const now = Date.now();
  const next = deriveCompetitionLedgerSnapshot({
    competition,
    run,
    generatedAt: now,
  });
  const existing = ledgerSnapshot.exists()
    ? parseCompetitionLedgerCollection({
        [competition.id]: ledgerSnapshot.val(),
      }).sources[0]
    : null;
  if (
    existing?.meta.runRevision === next.meta.runRevision &&
    existing.meta.sourceFingerprint === next.meta.sourceFingerprint
  ) {
    return false;
  }
  const auditId = pushKey(database, "audit");
  await update(ref(database), {
    [`championshipLedger/competitionSources/${competition.id}`]: next,
    [`audit/${auditId}`]: auditValue({
      id: auditId,
      uid,
      action: existing
        ? "championship-source-reconciled"
        : "championship-source-backfilled",
      entityType: "championship-source",
      entityId: competition.id,
      beforeRevision: existing?.meta.runRevision ?? null,
      afterRevision: run.revision,
      summary: existing
        ? "Championship source replaced from the authoritative competition run."
        : "Championship source backfilled from the authoritative competition run.",
      now,
    }),
  });
  return true;
}

export async function removeOrphanedCompetitionLedgerSource(
  database: Database,
  uid: string,
  source: CompetitionLedgerSnapshot,
) {
  const [competition, run, persisted] = await Promise.all([
    get(ref(database, `competitions/${source.meta.competitionId}`)),
    get(ref(database, `competitionRuns/${source.meta.competitionId}`)),
    get(
      ref(
        database,
        `championshipLedger/competitionSources/${source.meta.competitionId}`,
      ),
    ),
  ]);
  const live = parseCompetitionLedgerCollection({
    [source.meta.competitionId]: persisted.val(),
  }).sources[0];
  if (
    run.exists() ||
    (competition.exists() &&
      ["active", "completed"].includes(competition.child("status").val())) ||
    live?.meta.sourceFingerprint !== source.meta.sourceFingerprint
  ) {
    throw new Error("This source is no longer safe to remove. Reload first.");
  }
  const now = Date.now();
  const auditId = pushKey(database, "audit");
  await update(ref(database), {
    [`championshipLedger/competitionSources/${source.meta.competitionId}`]:
      null,
    [`audit/${auditId}`]: auditValue({
      id: auditId,
      uid,
      action: "championship-source-orphan-removed",
      entityType: "championship-source",
      entityId: source.meta.competitionId,
      beforeRevision: source.meta.runRevision,
      afterRevision: null,
      summary:
        "Orphaned championship source removed after organizer confirmation.",
      now,
    }),
  });
}

export async function createManualBonus(
  database: Database,
  uid: string,
  input: { participantId: string; points: number; label: string; note: string },
) {
  const label = input.label.trim().replace(/\s+/g, " ");
  const note = input.note.trim().replace(/\s+/g, " ");
  if (
    !input.participantId ||
    !Number.isInteger(input.points) ||
    input.points < 1 ||
    input.points > 100 ||
    label.length < 1 ||
    label.length > 80 ||
    note.length > 280 ||
    containsUnsafePlainText(`${label}${note}`)
  ) {
    throw new Error("Enter a valid positive bonus with a plain-text reason.");
  }
  const id = pushKey(database, "championshipLedger/manualBonuses");
  const auditId = pushKey(database, "audit");
  const now = Date.now();
  const bonus: ManualChampionshipBonus = {
    id,
    participantId: input.participantId,
    points: input.points,
    label,
    note: note || null,
    status: "active",
    createdAt: now,
    createdByUid: uid,
    updatedAt: now,
    updatedByUid: uid,
    revokedAt: null,
    revokedByUid: null,
    revision: 1,
    schemaVersion: 1,
  };
  await update(ref(database), {
    [`championshipLedger/manualBonuses/${id}`]: bonus,
    [`championshipLedger/manualBonusesPublic/${id}`]: publicBonus(bonus),
    [`audit/${auditId}`]: auditValue({
      id: auditId,
      uid,
      action: "manual-bonus-created",
      entityType: "manual-bonus",
      entityId: id,
      beforeRevision: null,
      afterRevision: 1,
      summary: `Manual championship bonus created: ${label}.`,
      now,
    }),
  });
  return id;
}

async function setManualBonusStatus(
  database: Database,
  uid: string,
  bonus: ManualChampionshipBonus,
  status: "active" | "revoked",
) {
  if (bonus.status === status) return false;
  const snapshot = await get(
    ref(database, `championshipLedger/manualBonuses/${bonus.id}`),
  );
  const current = parseManualBonusCollection({ [bonus.id]: snapshot.val() })
    .bonuses[0];
  if (!current || current.revision !== bonus.revision) {
    throw new Error(
      "This bonus changed on another device. Reload the latest version before continuing.",
    );
  }
  const now = Date.now();
  const next: ManualChampionshipBonus = {
    ...current,
    status,
    updatedAt: now,
    updatedByUid: uid,
    revokedAt: status === "revoked" ? now : null,
    revokedByUid: status === "revoked" ? uid : null,
    revision: current.revision + 1,
  };
  const auditId = pushKey(database, "audit");
  await update(ref(database), {
    [`championshipLedger/manualBonuses/${bonus.id}`]: next,
    [`championshipLedger/manualBonusesPublic/${bonus.id}`]:
      status === "active" ? publicBonus(next) : null,
    [`audit/${auditId}`]: auditValue({
      id: auditId,
      uid,
      action:
        status === "active" ? "manual-bonus-restored" : "manual-bonus-revoked",
      entityType: "manual-bonus",
      entityId: bonus.id,
      beforeRevision: current.revision,
      afterRevision: next.revision,
      summary:
        status === "active"
          ? "Manual championship bonus restored."
          : "Manual championship bonus revoked.",
      now,
    }),
  });
  return true;
}

export function revokeManualBonus(
  database: Database,
  uid: string,
  bonus: ManualChampionshipBonus,
) {
  return setManualBonusStatus(database, uid, bonus, "revoked");
}

export function restoreManualBonus(
  database: Database,
  uid: string,
  bonus: ManualChampionshipBonus,
) {
  return setManualBonusStatus(database, uid, bonus, "active");
}
