import {
  participantIcons,
  participantTones,
  type Participant,
} from "../../participants/types";
import {
  birthdayEmojiKeys,
  type BirthdayDisplayMode,
  type BirthdayEmojiKey,
  type BirthdayMessage,
  type BirthdayMessageInput,
  type BirthdayMessageModeration,
  type BirthdaySubmissionReceipt,
  type BirthdayVaultPublicState,
  type PublishedBirthdayMessage,
} from "./types";

const publicationIdPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function hasInvalidControl(value: string) {
  return [...value].some((character) => {
    const code = character.charCodeAt(0);
    return code <= 9 || (code >= 11 && code <= 31) || code === 127;
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasExactKeys(value: Record<string, unknown>, keys: string[]) {
  return Object.keys(value).every((key) => keys.includes(key));
}

export function isValidPublicationId(value: string) {
  return publicationIdPattern.test(value);
}

export function normalizeBirthdayTitle(value: string) {
  const normalized = value.trim().replace(/\r\n?/g, "\n");
  return normalized || null;
}

export function normalizeBirthdayMessage(value: string) {
  return value.trim().replace(/\r\n?/g, "\n");
}

export function validateBirthdayMessageInput(input: BirthdayMessageInput) {
  const errors: Partial<
    Record<"title" | "message" | "emojiKey" | "displayMode", string>
  > = {};
  const title = normalizeBirthdayTitle(input.title);
  const message = normalizeBirthdayMessage(input.message);
  if (title && (title.length > 60 || hasInvalidControl(title))) {
    errors.title = "Use plain text up to 60 characters.";
  }
  if (message.length < 5 || message.length > 1200) {
    errors.message = "Use between 5 and 1,200 characters.";
  } else if (hasInvalidControl(message)) {
    errors.message = "Use plain text without control characters.";
  }
  if (input.emojiKey !== null && !birthdayEmojiKeys.includes(input.emojiKey)) {
    errors.emojiKey = "Choose one of the available symbols.";
  }
  if (
    !(["named", "anonymous"] as BirthdayDisplayMode[]).includes(
      input.displayMode,
    )
  ) {
    errors.displayMode = "Choose named or anonymous display.";
  }
  return { valid: Object.keys(errors).length === 0, errors, title, message };
}

export function parseBirthdayVaultPublicState(
  value: unknown,
): BirthdayVaultPublicState | null {
  if (!isRecord(value)) return null;
  const normalized: Record<string, unknown> = {
    ...value,
    closedAt: value.closedAt ?? null,
    closedByUid: value.closedByUid ?? null,
    revealedAt: value.revealedAt ?? null,
    revealedByUid: value.revealedByUid ?? null,
  };
  const keys = [
    "status",
    "openedAt",
    "openedByUid",
    "closedAt",
    "closedByUid",
    "revealedAt",
    "revealedByUid",
    "revealRevision",
    "updatedAt",
    "updatedByUid",
    "revision",
    "schemaVersion",
  ];
  if (
    !hasExactKeys(normalized, keys) ||
    !["collecting", "closed", "revealed"].includes(String(normalized.status)) ||
    typeof normalized.openedAt !== "number" ||
    typeof normalized.openedByUid !== "string" ||
    (normalized.closedAt !== null && typeof normalized.closedAt !== "number") ||
    (normalized.closedByUid !== null &&
      typeof normalized.closedByUid !== "string") ||
    (normalized.revealedAt !== null &&
      typeof normalized.revealedAt !== "number") ||
    (normalized.revealedByUid !== null &&
      typeof normalized.revealedByUid !== "string") ||
    typeof normalized.revealRevision !== "number" ||
    !Number.isInteger(normalized.revealRevision) ||
    normalized.revealRevision < 0 ||
    typeof normalized.updatedAt !== "number" ||
    typeof normalized.updatedByUid !== "string" ||
    typeof normalized.revision !== "number" ||
    !Number.isInteger(normalized.revision) ||
    normalized.revision < 1 ||
    normalized.schemaVersion !== 1
  ) {
    return null;
  }
  if (
    (normalized.status === "collecting" &&
      (normalized.closedAt !== null ||
        normalized.closedByUid !== null ||
        normalized.revealedAt !== null ||
        normalized.revealedByUid !== null ||
        normalized.revealRevision !== 0)) ||
    (normalized.status === "closed" &&
      (normalized.closedAt === null ||
        normalized.closedByUid === null ||
        normalized.revealedAt !== null ||
        normalized.revealedByUid !== null ||
        normalized.revealRevision !== 0)) ||
    (normalized.status === "revealed" &&
      (normalized.closedAt === null ||
        normalized.closedByUid === null ||
        normalized.revealedAt === null ||
        normalized.revealedByUid === null ||
        normalized.revealRevision < 1))
  ) {
    return null;
  }
  return normalized as unknown as BirthdayVaultPublicState;
}

export function parseBirthdayMessage(value: unknown): BirthdayMessage | null {
  if (!isRecord(value)) return null;
  const record: Record<string, unknown> = {
    ...value,
    title: value.title ?? null,
    emojiKey: value.emojiKey ?? null,
  };
  const normalized: BirthdayMessageInput = {
    title: typeof record.title === "string" ? record.title : "",
    message: typeof record.message === "string" ? record.message : "",
    emojiKey:
      typeof record.emojiKey === "string"
        ? (record.emojiKey as BirthdayEmojiKey)
        : null,
    displayMode: record.displayMode as BirthdayDisplayMode,
  };
  const validation = validateBirthdayMessageInput(normalized);
  const keys = [
    "ownerUid",
    "participantId",
    "publicationId",
    "title",
    "message",
    "emojiKey",
    "displayMode",
    "status",
    "createdAt",
    "updatedAt",
    "revision",
    "schemaVersion",
  ];
  if (
    !hasExactKeys(record, keys) ||
    typeof record.ownerUid !== "string" ||
    typeof record.participantId !== "string" ||
    typeof record.publicationId !== "string" ||
    !isValidPublicationId(record.publicationId) ||
    (record.title !== null && typeof record.title !== "string") ||
    (record.emojiKey !== null && typeof record.emojiKey !== "string") ||
    !validation.valid ||
    validation.title !== record.title ||
    validation.message !== record.message ||
    !["submitted", "withdrawn"].includes(String(record.status)) ||
    typeof record.createdAt !== "number" ||
    typeof record.updatedAt !== "number" ||
    typeof record.revision !== "number" ||
    !Number.isInteger(record.revision) ||
    record.revision < 1 ||
    record.schemaVersion !== 1
  ) {
    return null;
  }
  return record as unknown as BirthdayMessage;
}

export function parseBirthdayReceipt(
  value: unknown,
): BirthdaySubmissionReceipt | null {
  if (
    !isRecord(value) ||
    !hasExactKeys(value, [
      "publicationId",
      "active",
      "updatedAt",
      "schemaVersion",
    ]) ||
    typeof value.publicationId !== "string" ||
    !isValidPublicationId(value.publicationId) ||
    typeof value.active !== "boolean" ||
    typeof value.updatedAt !== "number" ||
    value.schemaVersion !== 1
  ) {
    return null;
  }
  return value as unknown as BirthdaySubmissionReceipt;
}

export function parseBirthdayModeration(
  value: unknown,
): BirthdayMessageModeration | null {
  if (!isRecord(value)) return null;
  const normalized: Record<string, unknown> = {
    ...value,
    displayOrder: value.displayOrder ?? null,
    note: value.note ?? null,
  };
  if (
    !hasExactKeys(normalized, [
      "ownerUid",
      "messageRevision",
      "status",
      "displayOrder",
      "note",
      "updatedAt",
      "updatedByUid",
      "revision",
      "schemaVersion",
    ]) ||
    typeof normalized.ownerUid !== "string" ||
    typeof normalized.messageRevision !== "number" ||
    !Number.isInteger(normalized.messageRevision) ||
    normalized.messageRevision < 1 ||
    !["approved", "hidden"].includes(String(normalized.status)) ||
    (normalized.displayOrder !== null &&
      (typeof normalized.displayOrder !== "number" ||
        !Number.isInteger(normalized.displayOrder) ||
        normalized.displayOrder < 0)) ||
    (normalized.note !== null &&
      (typeof normalized.note !== "string" ||
        normalized.note.length > 280 ||
        hasInvalidControl(normalized.note))) ||
    typeof normalized.updatedAt !== "number" ||
    typeof normalized.updatedByUid !== "string" ||
    typeof normalized.revision !== "number" ||
    !Number.isInteger(normalized.revision) ||
    normalized.revision < 1 ||
    normalized.schemaVersion !== 1
  ) {
    return null;
  }
  return normalized as unknown as BirthdayMessageModeration;
}

export function parsePublishedBirthdayMessage(
  value: unknown,
): PublishedBirthdayMessage | null {
  if (!isRecord(value) || !isRecord(value.author)) return null;
  const author: Record<string, unknown> = {
    ...value.author,
    participantId: value.author.participantId ?? null,
    avatarIcon: value.author.avatarIcon ?? null,
    avatarTone: value.author.avatarTone ?? null,
  };
  const record: Record<string, unknown> = {
    ...value,
    title: value.title ?? null,
    emojiKey: value.emojiKey ?? null,
    author,
  };
  const title = typeof record.title === "string" ? record.title : "";
  const input = {
    title,
    message: typeof record.message === "string" ? record.message : "",
    emojiKey:
      typeof record.emojiKey === "string"
        ? (record.emojiKey as BirthdayEmojiKey)
        : null,
    displayMode: author.mode as BirthdayDisplayMode,
  };
  const validation = validateBirthdayMessageInput(input);
  const named =
    author.mode === "named" &&
    typeof author.participantId === "string" &&
    typeof author.displayName === "string" &&
    author.displayName.length >= 2 &&
    author.displayName.length <= 24 &&
    participantIcons.includes(
      author.avatarIcon as (typeof participantIcons)[number],
    ) &&
    participantTones.includes(
      author.avatarTone as (typeof participantTones)[number],
    ) &&
    hasExactKeys(author, [
      "mode",
      "participantId",
      "displayName",
      "avatarIcon",
      "avatarTone",
    ]);
  const anonymous =
    author.mode === "anonymous" &&
    author.participantId === null &&
    author.displayName === "Anonymous" &&
    author.avatarIcon === null &&
    author.avatarTone === null &&
    hasExactKeys(author, [
      "mode",
      "participantId",
      "displayName",
      "avatarIcon",
      "avatarTone",
    ]);
  if (
    !hasExactKeys(record, [
      "id",
      "title",
      "message",
      "emojiKey",
      "author",
      "displayOrder",
      "sourceMessageRevision",
      "publishedAt",
      "revealRevision",
      "schemaVersion",
    ]) ||
    typeof record.id !== "string" ||
    !isValidPublicationId(record.id) ||
    (record.title !== null && typeof record.title !== "string") ||
    (record.emojiKey !== null && typeof record.emojiKey !== "string") ||
    !validation.valid ||
    validation.title !== record.title ||
    validation.message !== record.message ||
    (!named && !anonymous) ||
    typeof record.displayOrder !== "number" ||
    !Number.isInteger(record.displayOrder) ||
    record.displayOrder < 0 ||
    typeof record.sourceMessageRevision !== "number" ||
    !Number.isInteger(record.sourceMessageRevision) ||
    record.sourceMessageRevision < 1 ||
    typeof record.publishedAt !== "number" ||
    typeof record.revealRevision !== "number" ||
    !Number.isInteger(record.revealRevision) ||
    record.revealRevision < 1 ||
    record.schemaVersion !== 1
  ) {
    return null;
  }
  return record as unknown as PublishedBirthdayMessage;
}

export function parseBirthdayMessageCollection(value: unknown) {
  if (!isRecord(value)) return { messages: [], invalidIds: [] };
  const messages: BirthdayMessage[] = [];
  const invalidIds: string[] = [];
  Object.entries(value).forEach(([id, candidate]) => {
    const parsed = parseBirthdayMessage(candidate);
    if (!parsed || parsed.ownerUid !== id) invalidIds.push(id);
    else messages.push(parsed);
  });
  return { messages, invalidIds };
}

export function parseBirthdayModerationCollection(value: unknown) {
  if (!isRecord(value)) return { moderation: [], invalidIds: [] };
  const moderation: BirthdayMessageModeration[] = [];
  const invalidIds: string[] = [];
  Object.entries(value).forEach(([id, candidate]) => {
    const parsed = parseBirthdayModeration(candidate);
    if (!parsed || parsed.ownerUid !== id) invalidIds.push(id);
    else moderation.push(parsed);
  });
  return { moderation, invalidIds };
}

export function parseBirthdayReceiptCollection(value: unknown) {
  if (!isRecord(value)) return { receipts: [], invalidIds: [] };
  const receipts: BirthdaySubmissionReceipt[] = [];
  const invalidIds: string[] = [];
  Object.entries(value).forEach(([id, candidate]) => {
    const parsed = parseBirthdayReceipt(candidate);
    if (!parsed || parsed.publicationId !== id) invalidIds.push(id);
    else receipts.push(parsed);
  });
  return { receipts, invalidIds };
}

export function parsePublishedBirthdayCollection(value: unknown) {
  if (!isRecord(value)) return { messages: [], invalidIds: [] };
  const messages: PublishedBirthdayMessage[] = [];
  const invalidIds: string[] = [];
  const orders = new Set<number>();
  Object.entries(value).forEach(([id, candidate]) => {
    const parsed = parsePublishedBirthdayMessage(candidate);
    if (!parsed || parsed.id !== id || orders.has(parsed.displayOrder)) {
      invalidIds.push(id);
    } else {
      orders.add(parsed.displayOrder);
      messages.push(parsed);
    }
  });
  return {
    messages: messages.sort((a, b) => a.displayOrder - b.displayOrder),
    invalidIds,
  };
}

export function participantForMessage(
  message: BirthdayMessage,
  participants: Participant[],
) {
  return (
    participants.find(
      (participant) => participant.id === message.participantId,
    ) ?? null
  );
}
