import {
  get,
  onValue,
  push,
  ref,
  serverTimestamp,
  update,
  type Database,
  type Unsubscribe,
} from "firebase/database";
import type { Participant } from "../../participants/types";
import {
  combineBirthdayModeration,
  createPublishedBirthdaySnapshot,
  deriveBirthdayRevealReadiness,
} from "../domain/publication";
import type {
  BirthdayMessage,
  BirthdayMessageInput,
  BirthdayMessageModeration,
  BirthdayModerationItem,
  BirthdayModerationStatus,
  BirthdaySubmissionReceipt,
  BirthdayVaultPublicState,
} from "../domain/types";
import {
  parseBirthdayMessage,
  parseBirthdayMessageCollection,
  parseBirthdayModerationCollection,
  parseBirthdayReceiptCollection,
  parseBirthdayVaultPublicState,
  parsePublishedBirthdayCollection,
  validateBirthdayMessageInput,
} from "../domain/validation";

function pushKey(database: Database, path: string) {
  const candidate = push(ref(database, path));
  if (!candidate.key)
    throw new Error("Firebase could not create an operation ID.");
  return candidate.key;
}

function auditValue(input: {
  id: string;
  uid: string;
  action: string;
  entityId: string;
  beforeRevision: number | null;
  afterRevision: number;
  summary: string;
  timestamp: ReturnType<typeof serverTimestamp>;
}) {
  return {
    id: input.id,
    action: input.action,
    entityType: "birthday-vault",
    entityId: input.entityId,
    actorUid: input.uid,
    ...(input.beforeRevision === null
      ? {}
      : { beforeRevision: input.beforeRevision }),
    afterRevision: input.afterRevision,
    occurredAt: input.timestamp,
    summary: input.summary,
    schemaVersion: 1,
  };
}

function wireMessage(message: BirthdayMessage) {
  return {
    ...message,
    ...(message.title === null ? { title: null } : {}),
    ...(message.emojiKey === null ? { emojiKey: null } : {}),
  };
}

function wireModeration(moderation: BirthdayMessageModeration) {
  return {
    ...moderation,
    ...(moderation.displayOrder === null ? { displayOrder: null } : {}),
    ...(moderation.note === null ? { note: null } : {}),
  };
}

export function subscribeBirthdayVaultPublicState(
  database: Database,
  onData: (state: BirthdayVaultPublicState | null, malformed: boolean) => void,
  onError: (error: Error) => void,
): Unsubscribe {
  return onValue(
    ref(database, "birthdayVault/publicState"),
    (snapshot) => {
      const raw = snapshot.val();
      onData(
        parseBirthdayVaultPublicState(raw),
        raw !== null && parseBirthdayVaultPublicState(raw) === null,
      );
    },
    onError,
  );
}

export function subscribeBirthdaySubmissionReceipts(
  database: Database,
  onData: (result: ReturnType<typeof parseBirthdayReceiptCollection>) => void,
  onError: (error: Error) => void,
): Unsubscribe {
  return onValue(
    ref(database, "birthdayVault/submissionReceipts"),
    (snapshot) => onData(parseBirthdayReceiptCollection(snapshot.val())),
    onError,
  );
}

export function subscribeOwnBirthdayMessage(
  database: Database,
  uid: string,
  onData: (message: BirthdayMessage | null, malformed: boolean) => void,
  onError: (error: Error) => void,
): Unsubscribe {
  return onValue(
    ref(database, `birthdayVault/privateMessages/${uid}`),
    (snapshot) => {
      const raw = snapshot.val();
      onData(
        parseBirthdayMessage(raw),
        raw !== null && parseBirthdayMessage(raw) === null,
      );
    },
    onError,
  );
}

export function subscribeOrganizerBirthdayMessages(
  database: Database,
  onData: (result: ReturnType<typeof parseBirthdayMessageCollection>) => void,
  onError: (error: Error) => void,
): Unsubscribe {
  return onValue(
    ref(database, "birthdayVault/privateMessages"),
    (snapshot) => onData(parseBirthdayMessageCollection(snapshot.val())),
    onError,
  );
}

export function subscribeBirthdayModeration(
  database: Database,
  onData: (
    result: ReturnType<typeof parseBirthdayModerationCollection>,
  ) => void,
  onError: (error: Error) => void,
): Unsubscribe {
  return onValue(
    ref(database, "birthdayVault/moderation"),
    (snapshot) => onData(parseBirthdayModerationCollection(snapshot.val())),
    onError,
  );
}

export function subscribePublishedBirthdayMessages(
  database: Database,
  onData: (result: ReturnType<typeof parsePublishedBirthdayCollection>) => void,
  onError: (error: Error) => void,
): Unsubscribe {
  return onValue(
    ref(database, "birthdayVault/publishedMessages"),
    (snapshot) => onData(parsePublishedBirthdayCollection(snapshot.val())),
    onError,
  );
}

export async function submitBirthdayMessage(input: {
  database: Database;
  uid: string;
  participantId: string;
  current: BirthdayMessage | null;
  value: BirthdayMessageInput;
}) {
  const validation = validateBirthdayMessageInput(input.value);
  if (!validation.valid)
    throw new Error("Check the message fields before saving.");
  const persisted = parseBirthdayMessage(
    (
      await get(
        ref(input.database, `birthdayVault/privateMessages/${input.uid}`),
      )
    ).val(),
  );
  if ((persisted?.revision ?? null) !== (input.current?.revision ?? null)) {
    throw new Error(
      "Your message changed on another device. Reload before saving.",
    );
  }
  const now = Date.now();
  const message: BirthdayMessage = persisted
    ? {
        ...persisted,
        title: validation.title,
        message: validation.message,
        emojiKey: input.value.emojiKey,
        displayMode: input.value.displayMode,
        status: "submitted",
        updatedAt: now,
        revision: persisted.revision + 1,
      }
    : {
        ownerUid: input.uid,
        participantId: input.participantId,
        publicationId: crypto.randomUUID(),
        title: validation.title,
        message: validation.message,
        emojiKey: input.value.emojiKey,
        displayMode: input.value.displayMode,
        status: "submitted",
        createdAt: now,
        updatedAt: now,
        revision: 1,
        schemaVersion: 1,
      };
  const receipt: BirthdaySubmissionReceipt = {
    publicationId: message.publicationId,
    active: true,
    updatedAt: now,
    schemaVersion: 1,
  };
  const timestamp = serverTimestamp();
  await update(ref(input.database), {
    [`birthdayVault/privateMessages/${input.uid}`]: {
      ...wireMessage(message),
      ...(!persisted ? { createdAt: timestamp } : {}),
      updatedAt: timestamp,
    },
    [`birthdayVault/submissionReceipts/${message.publicationId}`]: {
      ...receipt,
      updatedAt: timestamp,
    },
  });
}

export async function withdrawBirthdayMessage(input: {
  database: Database;
  uid: string;
  current: BirthdayMessage;
}) {
  const persisted = parseBirthdayMessage(
    (
      await get(
        ref(input.database, `birthdayVault/privateMessages/${input.uid}`),
      )
    ).val(),
  );
  if (!persisted || persisted.revision !== input.current.revision) {
    throw new Error(
      "Your message changed on another device. Reload before withdrawing.",
    );
  }
  const now = Date.now();
  const message: BirthdayMessage = {
    ...persisted,
    status: "withdrawn",
    updatedAt: now,
    revision: persisted.revision + 1,
  };
  const timestamp = serverTimestamp();
  await update(ref(input.database), {
    [`birthdayVault/privateMessages/${input.uid}`]: {
      ...wireMessage(message),
      updatedAt: timestamp,
    },
    [`birthdayVault/submissionReceipts/${message.publicationId}`]: {
      publicationId: message.publicationId,
      active: false,
      updatedAt: timestamp,
      schemaVersion: 1,
    },
  });
}

export async function initializeBirthdayVault(database: Database, uid: string) {
  const snapshot = await get(ref(database, "birthdayVault/publicState"));
  if (snapshot.exists())
    throw new Error("The Birthday Vault is already initialized.");
  const now = Date.now();
  const auditId = pushKey(database, "audit");
  const state: BirthdayVaultPublicState = {
    status: "collecting",
    openedAt: now,
    openedByUid: uid,
    closedAt: null,
    closedByUid: null,
    revealedAt: null,
    revealedByUid: null,
    revealRevision: 0,
    updatedAt: now,
    updatedByUid: uid,
    revision: 1,
    schemaVersion: 1,
  };
  const timestamp = serverTimestamp();
  await update(ref(database), {
    "birthdayVault/publicState": {
      ...state,
      openedAt: timestamp,
      updatedAt: timestamp,
    },
    [`audit/${auditId}`]: auditValue({
      id: auditId,
      uid,
      action: "birthday-vault-opened",
      entityId: "birthday-vault",
      beforeRevision: null,
      afterRevision: 1,
      summary: "Birthday Vault submissions opened.",
      timestamp,
    }),
  });
}

async function transitionBirthdayVault(input: {
  database: Database;
  uid: string;
  current: BirthdayVaultPublicState;
  status: "collecting" | "closed";
}) {
  const persisted = parseBirthdayVaultPublicState(
    (await get(ref(input.database, "birthdayVault/publicState"))).val(),
  );
  if (!persisted || persisted.revision !== input.current.revision) {
    throw new Error(
      "The Birthday Vault changed on another organizer device. Reload before continuing.",
    );
  }
  if (!(
    (persisted.status === "collecting" && input.status === "closed") ||
    (persisted.status === "closed" && input.status === "collecting")
  )) {
    throw new Error("That Birthday Vault transition is not available.");
  }
  const now = Date.now();
  const next: BirthdayVaultPublicState = {
    ...persisted,
    status: input.status,
    closedAt: input.status === "closed" ? now : null,
    closedByUid: input.status === "closed" ? input.uid : null,
    updatedAt: now,
    updatedByUid: input.uid,
    revision: persisted.revision + 1,
  };
  const reopening = input.status === "collecting";
  const auditId = pushKey(input.database, "audit");
  const timestamp = serverTimestamp();
  await update(ref(input.database), {
    "birthdayVault/publicState": {
      ...next,
      ...(reopening ? {} : { closedAt: timestamp }),
      updatedAt: timestamp,
    },
    [`audit/${auditId}`]: auditValue({
      id: auditId,
      uid: input.uid,
      action: reopening
        ? "birthday-submissions-reopened"
        : "birthday-submissions-closed",
      entityId: "birthday-vault",
      beforeRevision: persisted.revision,
      afterRevision: next.revision,
      summary: reopening
        ? "Birthday Vault submissions reopened."
        : "Birthday Vault submissions closed.",
      timestamp,
    }),
  });
}

export function closeBirthdayVault(
  database: Database,
  uid: string,
  current: BirthdayVaultPublicState,
) {
  return transitionBirthdayVault({ database, uid, current, status: "closed" });
}

export function reopenBirthdayVault(
  database: Database,
  uid: string,
  current: BirthdayVaultPublicState,
) {
  return transitionBirthdayVault({
    database,
    uid,
    current,
    status: "collecting",
  });
}

export async function moderateBirthdayMessage(input: {
  database: Database;
  uid: string;
  message: BirthdayMessage;
  current: BirthdayMessageModeration | null;
  status: BirthdayModerationStatus;
  note: string;
  displayOrder: number | null;
}) {
  const note = input.note.trim().replace(/\s+/g, " ") || null;
  if (note && note.length > 280)
    throw new Error("Moderation notes may use up to 280 characters.");
  const [messageSnapshot, moderationSnapshot] = await Promise.all([
    get(
      ref(
        input.database,
        `birthdayVault/privateMessages/${input.message.ownerUid}`,
      ),
    ),
    get(
      ref(input.database, `birthdayVault/moderation/${input.message.ownerUid}`),
    ),
  ]);
  const message = parseBirthdayMessage(messageSnapshot.val());
  const current =
    parseBirthdayModerationCollection({
      [input.message.ownerUid]: moderationSnapshot.val(),
    }).moderation[0] ?? null;
  if (!message || message.revision !== input.message.revision) {
    throw new Error(
      "This message changed before moderation. Review the latest revision.",
    );
  }
  if ((current?.revision ?? null) !== (input.current?.revision ?? null)) {
    throw new Error(
      "This moderation changed on another device. Reload before continuing.",
    );
  }
  const now = Date.now();
  const moderation: BirthdayMessageModeration = {
    ownerUid: message.ownerUid,
    messageRevision: message.revision,
    status: input.status,
    displayOrder: input.status === "approved" ? input.displayOrder : null,
    note,
    updatedAt: now,
    updatedByUid: input.uid,
    revision: (current?.revision ?? 0) + 1,
    schemaVersion: 1,
  };
  const auditId = pushKey(input.database, "audit");
  const timestamp = serverTimestamp();
  await update(ref(input.database), {
    [`birthdayVault/moderation/${message.ownerUid}`]: {
      ...wireModeration(moderation),
      updatedAt: timestamp,
    },
    [`audit/${auditId}`]: auditValue({
      id: auditId,
      uid: input.uid,
      action:
        input.status === "approved"
          ? "birthday-message-approved"
          : "birthday-message-hidden",
      entityId: message.publicationId,
      beforeRevision: current?.revision ?? null,
      afterRevision: moderation.revision,
      summary:
        input.status === "approved"
          ? "Birthday message approved for its current revision."
          : "Birthday message hidden from publication.",
      timestamp,
    }),
  });
}

export async function bulkApproveBirthdayMessages(input: {
  database: Database;
  uid: string;
  items: BirthdayModerationItem[];
}) {
  const pending = input.items.filter(
    (item) => item.message.status === "submitted" && item.moderation === null,
  );
  if (pending.length === 0) return 0;
  const now = Date.now();
  const timestamp = serverTimestamp();
  const nextDisplayOrder =
    Math.max(
      -1,
      ...input.items.flatMap((item) =>
        item.moderationIsCurrent &&
        item.moderation?.status === "approved" &&
        item.moderation.displayOrder !== null
          ? [item.moderation.displayOrder]
          : [],
      ),
    ) + 1;
  const updates: Record<string, unknown> = {};
  pending.forEach((item, index) => {
    updates[`birthdayVault/moderation/${item.message.ownerUid}`] = {
      ...wireModeration({
        ownerUid: item.message.ownerUid,
        messageRevision: item.message.revision,
        status: "approved",
        displayOrder: nextDisplayOrder + index,
        note: null,
        updatedAt: now,
        updatedByUid: input.uid,
        revision: 1,
        schemaVersion: 1,
      }),
      updatedAt: timestamp,
    };
  });
  const auditId = pushKey(input.database, "audit");
  updates[`audit/${auditId}`] = auditValue({
    id: auditId,
    uid: input.uid,
    action: "birthday-messages-bulk-approved",
    entityId: "birthday-vault",
    beforeRevision: null,
    afterRevision: pending.length,
    summary: `${pending.length} current Birthday Vault messages approved.`,
    timestamp,
  });
  await update(ref(input.database), updates);
  return pending.length;
}

export async function reorderBirthdayMessages(input: {
  database: Database;
  uid: string;
  orderedItems: BirthdayModerationItem[];
}) {
  const now = Date.now();
  const timestamp = serverTimestamp();
  const updates: Record<string, unknown> = {};
  input.orderedItems.forEach((item, displayOrder) => {
    if (
      !item.moderation ||
      !item.moderationIsCurrent ||
      item.moderation.status !== "approved"
    )
      return;
    updates[`birthdayVault/moderation/${item.message.ownerUid}`] = {
      ...wireModeration({
        ...item.moderation,
        displayOrder,
        updatedAt: now,
        updatedByUid: input.uid,
        revision: item.moderation.revision + 1,
      }),
      updatedAt: timestamp,
    };
  });
  const auditId = pushKey(input.database, "audit");
  updates[`audit/${auditId}`] = auditValue({
    id: auditId,
    uid: input.uid,
    action: "birthday-reveal-order-changed",
    entityId: "birthday-vault",
    beforeRevision: null,
    afterRevision: input.orderedItems.length,
    summary: "Birthday Vault reveal order changed.",
    timestamp,
  });
  await update(ref(input.database), updates);
}

export async function publishBirthdayVault(input: {
  database: Database;
  uid: string;
  currentState: BirthdayVaultPublicState;
  items: BirthdayModerationItem[];
  participants: Participant[];
  republish: boolean;
}) {
  const [stateSnapshot, messagesSnapshot, moderationSnapshot] =
    await Promise.all([
      get(ref(input.database, "birthdayVault/publicState")),
      get(ref(input.database, "birthdayVault/privateMessages")),
      get(ref(input.database, "birthdayVault/moderation")),
    ]);
  const state = parseBirthdayVaultPublicState(stateSnapshot.val());
  if (!state || state.revision !== input.currentState.revision) {
    throw new Error(
      "The Birthday Vault changed on another organizer device. Reload before continuing.",
    );
  }
  if (
    (!input.republish && state.status !== "closed") ||
    (input.republish && state.status !== "revealed")
  ) {
    throw new Error(
      input.republish
        ? "Only a revealed Birthday Vault can be republished."
        : "Close submissions before revealing the Birthday Vault.",
    );
  }
  const messageResult = parseBirthdayMessageCollection(messagesSnapshot.val());
  const moderationResult = parseBirthdayModerationCollection(
    moderationSnapshot.val(),
  );
  const latestItems = combineBirthdayModeration(
    messageResult.messages,
    moderationResult.moderation,
    input.participants,
  );
  const expectedRevisions = new Map(
    input.items.map((item) => [
      item.message.ownerUid,
      `${item.message.revision}:${item.moderation?.revision ?? 0}`,
    ]),
  );
  const changed =
    latestItems.some(
      (item) =>
        expectedRevisions.get(item.message.ownerUid) !==
        `${item.message.revision}:${item.moderation?.revision ?? 0}`,
    ) || latestItems.length !== input.items.length;
  if (changed)
    throw new Error(
      "Birthday messages or moderation changed. Review the latest set before publishing.",
    );
  const readiness = deriveBirthdayRevealReadiness({
    state,
    items: latestItems,
    participants: input.participants,
    online: true,
    authorized: true,
    malformedMessageIds: messageResult.invalidIds,
    malformedModerationIds: moderationResult.invalidIds,
  });
  if (!readiness.ready)
    throw new Error("The Birthday Vault is not ready to publish.");
  const now = Date.now();
  const revealRevision = state.revealRevision + 1;
  const published = createPublishedBirthdaySnapshot({
    items: latestItems,
    participants: input.participants,
    publishedAt: now,
    revealRevision,
  });
  const nextState: BirthdayVaultPublicState = {
    ...state,
    status: "revealed",
    revealedAt: now,
    revealedByUid: input.uid,
    revealRevision,
    updatedAt: now,
    updatedByUid: input.uid,
    revision: state.revision + 1,
  };
  const auditId = pushKey(input.database, "audit");
  const timestamp = serverTimestamp();
  const publishedWrite = Object.fromEntries(
    Object.entries(published).map(([publicationId, message]) => [
      publicationId,
      { ...message, publishedAt: timestamp },
    ]),
  );
  const publicationUpdates = {
    "birthdayVault/publishedMessages": publishedWrite,
    "birthdayVault/publicState": {
      ...nextState,
      revealedAt: timestamp,
      updatedAt: timestamp,
    },
    [`audit/${auditId}`]: auditValue({
      id: auditId,
      uid: input.uid,
      action: input.republish
        ? "birthday-vault-republished"
        : "birthday-vault-revealed",
      entityId: "birthday-vault",
      beforeRevision: state.revision,
      afterRevision: nextState.revision,
      summary: input.republish
        ? "Birthday Vault published set replaced."
        : "Birthday Vault revealed to authenticated guests.",
      timestamp,
    }),
  };
  await update(ref(input.database), publicationUpdates);
  return Object.keys(published).length;
}
