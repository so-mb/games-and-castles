import type {
  CompetitionDraft,
  CompetitionFormValues,
  CompetitionRecord,
  ParticipantReference,
  PublishedCompetition,
} from "./types";
import { normalizeCompetitionText } from "./validation";

interface RecordMetadata {
  id: string;
  uid: string;
  now: number;
}

export function createDraftRecord(
  values: CompetitionFormValues,
  metadata: RecordMetadata,
): CompetitionDraft {
  return {
    ...normalizeCompetitionText(values),
    id: metadata.id,
    status: "draft",
    displayOrder: 0,
    createdAt: metadata.now,
    updatedAt: metadata.now,
    createdByUid: metadata.uid,
    updatedByUid: metadata.uid,
    revision: 1,
    schemaVersion: 1,
  };
}

export function updateDraftRecord(
  draft: CompetitionDraft,
  values: CompetitionFormValues,
  uid: string,
  now: number,
): CompetitionDraft {
  return {
    ...draft,
    ...normalizeCompetitionText(values),
    updatedAt: now,
    updatedByUid: uid,
    revision: draft.revision + 1,
  };
}

export function publishDraftRecord(
  draft: CompetitionDraft,
  uid: string,
  now: number,
  displayOrder: number,
): PublishedCompetition {
  return {
    ...draft,
    status: "scheduled",
    displayOrder,
    updatedAt: now,
    updatedByUid: uid,
    revision: draft.revision + 1,
    publishedAt: now,
    publishedByUid: uid,
  };
}

export function updatePublishedRecord(
  competition: PublishedCompetition,
  values: CompetitionFormValues,
  uid: string,
  now: number,
): PublishedCompetition {
  return {
    ...competition,
    ...normalizeCompetitionText(values),
    updatedAt: now,
    updatedByUid: uid,
    revision: competition.revision + 1,
  };
}

export function duplicateCompetitionRecord(
  source: CompetitionRecord,
  metadata: RecordMetadata,
  existingTitles: string[],
): CompetitionDraft {
  const proposed = source.title.endsWith(" Copy")
    ? source.title
    : `${source.title} Copy`;
  let title = proposed;
  let copyNumber = 2;
  while (existingTitles.some((candidate) => candidate === title)) {
    title = `${proposed} ${copyNumber}`;
    copyNumber += 1;
  }
  return createDraftRecord(
    {
      title,
      gameName: source.gameName,
      description: source.description,
      iconKey: source.iconKey,
      format: source.format,
      participantIds: [...source.participantIds],
      formatConfig: structuredClone(source.formatConfig),
      scoringConfig: structuredClone(source.scoringConfig),
    },
    metadata,
  );
}

export function sortCompetitions<T extends PublishedCompetition>(
  competitions: T[],
) {
  return [...competitions].sort(
    (a, b) =>
      a.displayOrder - b.displayOrder ||
      a.publishedAt - b.publishedAt ||
      a.id.localeCompare(b.id),
  );
}

export function hasRevisionConflict(expected: number, actual: number) {
  return expected !== actual;
}

export function isScheduledCompetition(
  record: CompetitionRecord,
): record is PublishedCompetition {
  return record.status === "scheduled";
}

export function isPublicCompetition(
  record: CompetitionRecord,
): record is PublishedCompetition {
  return record.status !== "draft" && record.status !== "archived";
}

export function resolveParticipants(
  participantIds: string[],
  participants: ParticipantReference[],
) {
  const byId = new Map(
    participants.map((participant) => [participant.id, participant]),
  );
  return participantIds.map(
    (id) =>
      byId.get(id) ?? {
        id,
        displayName: "Unavailable participant",
        status: "inactive" as const,
      },
  );
}

export function toFormValues(record: CompetitionRecord): CompetitionFormValues {
  return {
    title: record.title,
    gameName: record.gameName,
    description: record.description,
    iconKey: record.iconKey,
    format: record.format,
    participantIds: [...record.participantIds],
    formatConfig: structuredClone(record.formatConfig),
    scoringConfig: structuredClone(record.scoringConfig),
  };
}
