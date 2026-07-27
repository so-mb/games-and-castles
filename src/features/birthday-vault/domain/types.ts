import type {
  ParticipantIcon,
  ParticipantTone,
} from "../../participants/types";

export const birthdayEmojiKeys = [
  "cake",
  "heart",
  "sparkles",
  "crown",
  "castle",
  "confetti",
] as const;

export type BirthdayEmojiKey = (typeof birthdayEmojiKeys)[number];
export type BirthdayVaultStatus = "collecting" | "closed" | "revealed";
export type BirthdayMessageStatus = "submitted" | "withdrawn";
export type BirthdayDisplayMode = "named" | "anonymous";
export type BirthdayModerationStatus = "approved" | "hidden";

export interface BirthdayVaultPublicState {
  status: BirthdayVaultStatus;
  openedAt: number;
  openedByUid: string;
  closedAt: number | null;
  closedByUid: string | null;
  revealedAt: number | null;
  revealedByUid: string | null;
  revealRevision: number;
  updatedAt: number;
  updatedByUid: string;
  revision: number;
  schemaVersion: 1;
}

export interface BirthdayMessage {
  ownerUid: string;
  participantId: string;
  publicationId: string;
  title: string | null;
  message: string;
  emojiKey: BirthdayEmojiKey | null;
  displayMode: BirthdayDisplayMode;
  status: BirthdayMessageStatus;
  createdAt: number;
  updatedAt: number;
  revision: number;
  schemaVersion: 1;
}

export interface BirthdayMessageInput {
  title: string;
  message: string;
  emojiKey: BirthdayEmojiKey | null;
  displayMode: BirthdayDisplayMode;
}

export interface BirthdaySubmissionReceipt {
  publicationId: string;
  active: boolean;
  updatedAt: number;
  schemaVersion: 1;
}

export interface BirthdayMessageModeration {
  ownerUid: string;
  messageRevision: number;
  status: BirthdayModerationStatus;
  displayOrder: number | null;
  note: string | null;
  updatedAt: number;
  updatedByUid: string;
  revision: number;
  schemaVersion: 1;
}

export type PublishedBirthdayAuthor =
  | {
      mode: "named";
      participantId: string;
      displayName: string;
      avatarIcon: ParticipantIcon;
      avatarTone: ParticipantTone;
    }
  | {
      mode: "anonymous";
      participantId: null;
      displayName: "Anonymous";
      avatarIcon: null;
      avatarTone: null;
    };

export interface PublishedBirthdayMessage {
  id: string;
  title: string | null;
  message: string;
  emojiKey: BirthdayEmojiKey | null;
  author: PublishedBirthdayAuthor;
  displayOrder: number;
  sourceMessageRevision: number;
  publishedAt: number;
  revealRevision: number;
  schemaVersion: 1;
}

export interface BirthdayModerationItem {
  message: BirthdayMessage;
  moderation: BirthdayMessageModeration | null;
  moderationIsCurrent: boolean;
  participantName: string;
  malformed: false;
}

export interface BirthdayVaultCounts {
  submitted: number;
  pending: number;
  approved: number;
  hidden: number;
  withdrawn: number;
  stale: number;
}

export interface BirthdayRevealReadiness {
  ready: boolean;
  checks: Array<{ id: string; label: string; passed: boolean }>;
  approvedMessages: BirthdayModerationItem[];
}
