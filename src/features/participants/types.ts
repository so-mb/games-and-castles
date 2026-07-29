import type { ContentIcon } from "../../types/content";

export const participantIcons = [
  "castle",
  "dice",
  "trophy",
  "controller",
  "crown",
  "sparkles",
  "shield",
  "swords",
  "robot",
  "ghost",
  "rocket",
  "gem",
  "compass",
  "puzzle",
  "cat",
  "key",
] as const satisfies readonly ContentIcon[];

export const participantTones = ["cyan", "gold", "red", "neutral"] as const;

export type ParticipantIcon = (typeof participantIcons)[number];
export type ParticipantTone = (typeof participantTones)[number];

export interface ParticipantAvatarSelection {
  icon: ParticipantIcon;
  tone: ParticipantTone;
}

export interface Participant {
  id: string;
  ownerUid: string | null;
  displayName: string;
  avatar: ParticipantAvatarSelection;
  status: "active" | "inactive";
  createdAt: number;
  createdByUid: string;
  updatedAt: number;
  updatedByUid: string;
  schemaVersion: 1;
}

export interface UserProfile {
  uid: string;
  participantId: string | null;
  createdAt: number;
  updatedAt: number;
  schemaVersion: 1;
}

export interface ParticipantInput {
  displayName: string;
  avatar: ParticipantAvatarSelection;
}

export type LoadState = "idle" | "loading" | "ready" | "error";
