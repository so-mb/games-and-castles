import {
  equalTo,
  get,
  onValue,
  orderByChild,
  push,
  query,
  ref,
  serverTimestamp,
  set,
  update,
  type Database,
  type Unsubscribe,
} from "firebase/database";
import {
  participantIcons,
  participantTones,
  type Participant,
  type ParticipantAvatarSelection,
  type ParticipantInput,
  type UserProfile,
} from "../../features/participants/types";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isAvatar(value: unknown): value is ParticipantAvatarSelection {
  return (
    isRecord(value) &&
    participantIcons.includes(
      value.icon as ParticipantAvatarSelection["icon"],
    ) &&
    participantTones.includes(value.tone as ParticipantAvatarSelection["tone"])
  );
}

export function parseParticipant(value: unknown): Participant | null {
  if (!isRecord(value) || !isAvatar(value.avatar)) return null;
  if (
    typeof value.id !== "string" ||
    typeof value.displayName !== "string" ||
    !["active", "inactive"].includes(String(value.status)) ||
    typeof value.createdAt !== "number" ||
    typeof value.createdByUid !== "string" ||
    typeof value.updatedAt !== "number" ||
    typeof value.updatedByUid !== "string" ||
    value.schemaVersion !== 1
  ) {
    return null;
  }

  return {
    id: value.id,
    ownerUid: typeof value.ownerUid === "string" ? value.ownerUid : null,
    displayName: value.displayName,
    avatar: value.avatar,
    status: value.status as Participant["status"],
    createdAt: value.createdAt,
    createdByUid: value.createdByUid,
    updatedAt: value.updatedAt,
    updatedByUid: value.updatedByUid,
    schemaVersion: 1,
  };
}

export function parseUserProfile(value: unknown): UserProfile | null {
  if (
    !isRecord(value) ||
    typeof value.uid !== "string" ||
    (typeof value.participantId !== "string" && value.participantId !== null) ||
    typeof value.createdAt !== "number" ||
    typeof value.updatedAt !== "number" ||
    value.schemaVersion !== 1
  ) {
    return null;
  }

  return value as unknown as UserProfile;
}

export function normalizeDisplayName(displayName: string) {
  return displayName.trim().replace(/\s+/g, " ");
}

export function validateDisplayName(displayName: string) {
  const normalized = normalizeDisplayName(displayName);
  if (normalized.length < 2 || normalized.length > 24) {
    return "Use between 2 and 24 characters.";
  }
  return null;
}

export function hasDuplicateDisplayName(
  displayName: string,
  participants: Participant[],
  excludedParticipantId?: string,
) {
  const normalized = normalizeDisplayName(displayName).toLocaleLowerCase();
  return participants.some(
    (participant) =>
      participant.id !== excludedParticipantId &&
      participant.displayName.toLocaleLowerCase() === normalized,
  );
}

function participantValues(value: unknown) {
  if (!isRecord(value)) return [];
  return Object.values(value)
    .map(parseParticipant)
    .filter((participant): participant is Participant => participant !== null)
    .sort((a, b) => a.displayName.localeCompare(b.displayName));
}

export function subscribeToActiveParticipants(
  database: Database,
  onData: (participants: Participant[]) => void,
  onError: (error: Error) => void,
): Unsubscribe {
  const activeQuery = query(
    ref(database, "participants"),
    orderByChild("status"),
    equalTo("active"),
  );
  return onValue(
    activeQuery,
    (snapshot) => onData(participantValues(snapshot.val())),
    onError,
  );
}

export function subscribeToAllParticipants(
  database: Database,
  onData: (participants: Participant[]) => void,
  onError: (error: Error) => void,
): Unsubscribe {
  return onValue(
    ref(database, "participants"),
    (snapshot) => onData(participantValues(snapshot.val())),
    onError,
  );
}

export function subscribeToUserProfile(
  database: Database,
  uid: string,
  onData: (profile: UserProfile | null) => void,
  onError: (error: Error) => void,
) {
  return onValue(
    ref(database, `userProfiles/${uid}`),
    (snapshot) => onData(parseUserProfile(snapshot.val())),
    onError,
  );
}

export function subscribeToParticipant(
  database: Database,
  participantId: string,
  onData: (participant: Participant | null) => void,
  onError: (error: Error) => void,
) {
  return onValue(
    ref(database, `participants/${participantId}`),
    (snapshot) => onData(parseParticipant(snapshot.val())),
    onError,
  );
}

export async function createGuestParticipant(
  database: Database,
  uid: string,
  input: ParticipantInput,
) {
  const displayName = normalizeDisplayName(input.displayName);
  const participant = {
    id: uid,
    ownerUid: uid,
    displayName,
    avatar: input.avatar,
    status: "active",
    createdAt: serverTimestamp(),
    createdByUid: uid,
    updatedAt: serverTimestamp(),
    updatedByUid: uid,
    schemaVersion: 1,
  };
  const profile = {
    uid,
    participantId: uid,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    schemaVersion: 1,
  };

  await update(ref(database), {
    [`participants/${uid}`]: participant,
    [`userProfiles/${uid}`]: profile,
  });
}

export async function updateGuestParticipant(
  database: Database,
  uid: string,
  participantId: string,
  input: ParticipantInput,
) {
  await update(ref(database, `participants/${participantId}`), {
    displayName: normalizeDisplayName(input.displayName),
    avatar: input.avatar,
    updatedAt: serverTimestamp(),
    updatedByUid: uid,
  });
}

export async function createOrganizerParticipant(
  database: Database,
  uid: string,
  input: ParticipantInput,
) {
  const participantRef = push(ref(database, "participants"));
  if (!participantRef.key) throw new Error("Could not generate participant ID");

  await set(participantRef, {
    id: participantRef.key,
    displayName: normalizeDisplayName(input.displayName),
    avatar: input.avatar,
    status: "active",
    createdAt: serverTimestamp(),
    createdByUid: uid,
    updatedAt: serverTimestamp(),
    updatedByUid: uid,
    schemaVersion: 1,
  });
  return participantRef.key;
}

export async function updateOrganizerParticipant(
  database: Database,
  uid: string,
  participantId: string,
  input: ParticipantInput,
) {
  await update(ref(database, `participants/${participantId}`), {
    displayName: normalizeDisplayName(input.displayName),
    avatar: input.avatar,
    updatedAt: serverTimestamp(),
    updatedByUid: uid,
  });
}

export async function setParticipantStatus(
  database: Database,
  uid: string,
  participantId: string,
  status: Participant["status"],
) {
  await update(ref(database, `participants/${participantId}`), {
    status,
    updatedAt: serverTimestamp(),
    updatedByUid: uid,
  });
}

export async function readParticipant(
  database: Database,
  participantId: string,
) {
  const snapshot = await get(ref(database, `participants/${participantId}`));
  return parseParticipant(snapshot.val());
}
