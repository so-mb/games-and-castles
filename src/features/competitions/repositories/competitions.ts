import {
  get,
  onValue,
  push,
  ref,
  runTransaction,
  serverTimestamp,
  set,
  update,
  type Database,
  type Unsubscribe,
} from "firebase/database";
import {
  createDraftRecord,
  duplicateCompetitionRecord,
  isScheduledCompetition,
  publishDraftRecord,
  sortCompetitions,
  updateDraftRecord,
  updatePublishedRecord,
} from "../domain/transforms";
import {
  parseCompetitionCollection,
  parseCompetitionRecord,
} from "../domain/runtime";
import type {
  CompetitionDraft,
  CompetitionFormValues,
  CompetitionRecord,
  PublishedCompetition,
} from "../domain/types";
import { validateCompetition } from "../domain/validation";

export interface CompetitionSubscriptionResult<T extends CompetitionRecord> {
  records: T[];
  invalidIds: string[];
}

export class CompetitionConflictError extends Error {
  constructor() {
    super(
      "This competition was changed on another device. Reload the latest version before saving your changes.",
    );
    this.name = "CompetitionConflictError";
  }
}

function competitionWriteError() {
  return new Error(
    "Firebase rejected the competition update. Reload the latest data and review the configuration before trying again.",
  );
}

function recordPath(record: CompetitionRecord) {
  return record.status === "draft"
    ? `competitionDrafts/${record.id}`
    : `competitions/${record.id}`;
}

function withServerTimes(
  record: CompetitionRecord,
  options: { created?: boolean; published?: boolean } = {},
) {
  const value: Record<string, unknown> = {
    ...record,
    updatedAt: serverTimestamp(),
  };
  if (options.created) value.createdAt = serverTimestamp();
  if (options.published) value.publishedAt = serverTimestamp();
  return value;
}

function auditValue(
  id: string,
  action: string,
  entityId: string,
  uid: string,
  beforeRevision: number | null,
  afterRevision: number | null,
  summary: string,
) {
  return {
    id,
    action,
    entityType: "competition",
    entityId,
    actorUid: uid,
    ...(beforeRevision === null ? {} : { beforeRevision }),
    ...(afterRevision === null ? {} : { afterRevision }),
    occurredAt: serverTimestamp(),
    summary,
    schemaVersion: 1,
  };
}

function createAuditRef(database: Database) {
  const auditRef = push(ref(database, "audit"));
  if (!auditRef.key) throw new Error("Could not create an audit entry.");
  return auditRef;
}

async function currentRecord(
  database: Database,
  path: string,
): Promise<CompetitionRecord | null> {
  const snapshot = await get(ref(database, path));
  return parseCompetitionRecord(snapshot.val());
}

export async function readCompetitionDraft(
  database: Database,
  competitionId: string,
) {
  const record = await currentRecord(
    database,
    `competitionDrafts/${competitionId}`,
  );
  return record?.status === "draft" ? record : null;
}

async function writeWithRevisionCheck(
  database: Database,
  path: string,
  expectedRevision: number,
  updates: Record<string, unknown>,
) {
  try {
    await update(ref(database), updates);
  } catch {
    const latest = await currentRecord(database, path).catch(() => null);
    if (!latest || latest.revision !== expectedRevision) {
      throw new CompetitionConflictError();
    }
    throw competitionWriteError();
  }
}

function subscribeCollection<T extends CompetitionRecord>(
  database: Database,
  path: string,
  select: (record: CompetitionRecord) => record is T,
  onData: (result: CompetitionSubscriptionResult<T>) => void,
  onError: (error: Error) => void,
): Unsubscribe {
  return onValue(
    ref(database, path),
    (snapshot) => {
      const parsed = parseCompetitionCollection(snapshot.val());
      onData({
        records: parsed.records.filter(select),
        invalidIds: parsed.invalidIds,
      });
    },
    onError,
  );
}

export function subscribeScheduledCompetitions(
  database: Database,
  onData: (result: CompetitionSubscriptionResult<PublishedCompetition>) => void,
  onError: (error: Error) => void,
) {
  return subscribeCollection(
    database,
    "competitions",
    isScheduledCompetition,
    (result) =>
      onData({ ...result, records: sortCompetitions(result.records) }),
    onError,
  );
}

export function subscribeCompetitionDrafts(
  database: Database,
  onData: (result: CompetitionSubscriptionResult<CompetitionDraft>) => void,
  onError: (error: Error) => void,
) {
  return subscribeCollection(
    database,
    "competitionDrafts",
    (record): record is CompetitionDraft => record.status === "draft",
    onData,
    onError,
  );
}

export function subscribeOrganizerCompetitions(
  database: Database,
  onData: (result: CompetitionSubscriptionResult<PublishedCompetition>) => void,
  onError: (error: Error) => void,
) {
  return subscribeCollection(
    database,
    "competitions",
    (record): record is PublishedCompetition => record.status !== "draft",
    (result) =>
      onData({ ...result, records: sortCompetitions(result.records) }),
    onError,
  );
}

export async function createDraft(
  database: Database,
  uid: string,
  values: CompetitionFormValues,
) {
  const validation = validateCompetition(values, "draft");
  if (validation.some((item) => item.severity === "error")) {
    throw new Error("Fix the draft validation errors before saving.");
  }
  const draftRef = push(ref(database, "competitionDrafts"));
  if (!draftRef.key) throw new Error("Could not create a competition ID.");
  const draft = createDraftRecord(values, {
    id: draftRef.key,
    uid,
    now: Date.now(),
  });
  const auditRef = createAuditRef(database);
  try {
    await update(ref(database), {
      [`competitionDrafts/${draft.id}`]: withServerTimes(draft, {
        created: true,
      }),
      [`audit/${auditRef.key}`]: auditValue(
        auditRef.key!,
        "draft-created",
        draft.id,
        uid,
        null,
        1,
        "Competition draft created.",
      ),
    });
  } catch {
    throw competitionWriteError();
  }
  return draft.id;
}

export async function updateDraft(
  database: Database,
  uid: string,
  draft: CompetitionDraft,
  values: CompetitionFormValues,
) {
  const validation = validateCompetition(values, "draft");
  if (validation.some((item) => item.severity === "error")) {
    throw new Error("Fix the draft validation errors before saving.");
  }
  const next = updateDraftRecord(draft, values, uid, Date.now());
  const auditRef = createAuditRef(database);
  await writeWithRevisionCheck(
    database,
    `competitionDrafts/${draft.id}`,
    draft.revision,
    {
      [`competitionDrafts/${draft.id}`]: withServerTimes(next),
      [`audit/${auditRef.key}`]: auditValue(
        auditRef.key!,
        "draft-updated",
        draft.id,
        uid,
        draft.revision,
        next.revision,
        "Competition draft updated.",
      ),
    },
  );
}

export async function deleteDraft(
  database: Database,
  uid: string,
  draft: CompetitionDraft,
) {
  let result;
  try {
    result = await runTransaction(
      ref(database, `competitionDrafts/${draft.id}`),
      (current) => {
        const parsed = parseCompetitionRecord(current);
        if (
          !parsed ||
          parsed.status !== "draft" ||
          parsed.revision !== draft.revision
        ) {
          return;
        }
        return null;
      },
      { applyLocally: false },
    );
  } catch {
    throw competitionWriteError();
  }
  if (!result.committed) throw new CompetitionConflictError();
  const auditRef = createAuditRef(database);
  try {
    await set(
      auditRef,
      auditValue(
        auditRef.key!,
        "draft-deleted",
        draft.id,
        uid,
        draft.revision,
        null,
        "Competition draft deleted.",
      ),
    );
  } catch {
    throw new Error(
      "The draft was deleted, but its audit entry could not be confirmed. Reload before taking another action.",
    );
  }
}

export async function publishDraft(
  database: Database,
  uid: string,
  draft: CompetitionDraft,
  scheduled: PublishedCompetition[],
) {
  const validation = validateCompetition(draft, "publish");
  if (validation.some((item) => item.severity === "error")) {
    throw new Error(
      "Complete the competition configuration before publishing.",
    );
  }
  const displayOrder =
    Math.max(0, ...scheduled.map((competition) => competition.displayOrder)) +
    100;
  const published = publishDraftRecord(draft, uid, Date.now(), displayOrder);
  const auditRef = createAuditRef(database);
  await writeWithRevisionCheck(
    database,
    `competitionDrafts/${draft.id}`,
    draft.revision,
    {
      [`competitions/${draft.id}`]: withServerTimes(published, {
        published: true,
      }),
      [`competitionDrafts/${draft.id}`]: null,
      [`audit/${auditRef.key}`]: auditValue(
        auditRef.key!,
        "competition-published",
        draft.id,
        uid,
        draft.revision,
        published.revision,
        "Competition published to the scheduled list.",
      ),
    },
  );
}

export async function updateScheduledCompetition(
  database: Database,
  uid: string,
  competition: PublishedCompetition,
  values: CompetitionFormValues,
) {
  const validation = validateCompetition(values, "publish");
  if (validation.some((item) => item.severity === "error")) {
    throw new Error("Fix the competition validation errors before saving.");
  }
  const next = updatePublishedRecord(competition, values, uid, Date.now());
  const auditRef = createAuditRef(database);
  await writeWithRevisionCheck(
    database,
    `competitions/${competition.id}`,
    competition.revision,
    {
      [`competitions/${competition.id}`]: withServerTimes(next),
      [`audit/${auditRef.key}`]: auditValue(
        auditRef.key!,
        "competition-updated",
        competition.id,
        uid,
        competition.revision,
        next.revision,
        "Scheduled competition configuration updated.",
      ),
    },
  );
}

async function transitionCompetition(
  database: Database,
  uid: string,
  competition: PublishedCompetition,
  status: PublishedCompetition["status"],
) {
  const next: PublishedCompetition = {
    ...competition,
    status,
    revision: competition.revision + 1,
    updatedAt: Date.now(),
    updatedByUid: uid,
  };
  const restoring = status === "scheduled";
  const auditRef = createAuditRef(database);
  await writeWithRevisionCheck(
    database,
    `competitions/${competition.id}`,
    competition.revision,
    {
      [`competitions/${competition.id}`]: withServerTimes(next),
      [`audit/${auditRef.key}`]: auditValue(
        auditRef.key!,
        restoring ? "competition-restored" : "competition-archived",
        competition.id,
        uid,
        competition.revision,
        next.revision,
        restoring
          ? "Competition restored to the scheduled list."
          : "Competition archived.",
      ),
    },
  );
}

export function archiveCompetition(
  database: Database,
  uid: string,
  competition: PublishedCompetition,
) {
  return transitionCompetition(database, uid, competition, "archived");
}

export function restoreCompetition(
  database: Database,
  uid: string,
  competition: PublishedCompetition,
) {
  return transitionCompetition(database, uid, competition, "scheduled");
}

export async function duplicateCompetition(
  database: Database,
  uid: string,
  source: CompetitionRecord,
  existingTitles: string[],
) {
  const draftRef = push(ref(database, "competitionDrafts"));
  if (!draftRef.key) throw new Error("Could not create a competition ID.");
  const duplicate = duplicateCompetitionRecord(
    source,
    { id: draftRef.key, uid, now: Date.now() },
    existingTitles,
  );
  const auditRef = createAuditRef(database);
  try {
    await update(ref(database), {
      [`competitionDrafts/${duplicate.id}`]: withServerTimes(duplicate, {
        created: true,
      }),
      [`audit/${auditRef.key}`]: auditValue(
        auditRef.key!,
        "draft-duplicated",
        duplicate.id,
        uid,
        null,
        1,
        "Competition configuration duplicated as a draft.",
      ),
    });
  } catch {
    throw competitionWriteError();
  }
  return duplicate.id;
}

export async function reorderCompetitions(
  database: Database,
  uid: string,
  scheduled: PublishedCompetition[],
  competitionId: string,
  direction: "earlier" | "later",
) {
  const ordered = sortCompetitions(scheduled);
  const index = ordered.findIndex(
    (competition) => competition.id === competitionId,
  );
  const targetIndex = direction === "earlier" ? index - 1 : index + 1;
  if (index < 0 || targetIndex < 0 || targetIndex >= ordered.length) return;
  const moved = [...ordered];
  [moved[index], moved[targetIndex]] = [moved[targetIndex]!, moved[index]!];
  const changed = moved
    .map((competition, position) => ({
      competition,
      displayOrder: (position + 1) * 100,
    }))
    .filter(
      ({ competition, displayOrder }) =>
        competition.displayOrder !== displayOrder,
    );
  const rootUpdates: Record<string, unknown> = {};
  changed.forEach(({ competition, displayOrder }) => {
    rootUpdates[`competitions/${competition.id}`] = withServerTimes({
      ...competition,
      displayOrder,
      revision: competition.revision + 1,
      updatedAt: Date.now(),
      updatedByUid: uid,
    });
  });
  const auditRef = createAuditRef(database);
  rootUpdates[`audit/${auditRef.key}`] = auditValue(
    auditRef.key!,
    "competition-reordered",
    competitionId,
    uid,
    ordered[index]!.revision,
    ordered[index]!.revision + 1,
    `Competition moved ${direction} in the flexible Friday order.`,
  );
  await writeWithRevisionCheck(
    database,
    `competitions/${competitionId}`,
    ordered[index]!.revision,
    rootUpdates,
  );
}

export function getRecordPath(record: CompetitionRecord) {
  return recordPath(record);
}
