import type { Participant } from "../../participants/types";
import type {
  BirthdayMessage,
  BirthdayMessageModeration,
  BirthdayModerationItem,
  BirthdayRevealReadiness,
  BirthdayVaultCounts,
  BirthdayVaultPublicState,
  PublishedBirthdayMessage,
} from "./types";
import {
  isValidPublicationId,
  parseBirthdayMessage,
  participantForMessage,
} from "./validation";

export function combineBirthdayModeration(
  messages: BirthdayMessage[],
  moderation: BirthdayMessageModeration[],
  participants: Participant[],
): BirthdayModerationItem[] {
  const moderationByOwner = new Map(
    moderation.map((record) => [record.ownerUid, record]),
  );
  return messages
    .map((message) => {
      const record = moderationByOwner.get(message.ownerUid) ?? null;
      return {
        message,
        moderation: record,
        moderationIsCurrent:
          record !== null && record.messageRevision === message.revision,
        participantName:
          participantForMessage(message, participants)?.displayName ??
          "Unavailable participant",
        malformed: false as const,
      };
    })
    .sort((left, right) => left.message.createdAt - right.message.createdAt);
}

export function deriveBirthdayVaultCounts(
  items: BirthdayModerationItem[],
): BirthdayVaultCounts {
  return items.reduce<BirthdayVaultCounts>(
    (counts, item) => {
      if (item.message.status === "withdrawn") {
        counts.withdrawn += 1;
        return counts;
      }
      counts.submitted += 1;
      if (!item.moderation) counts.pending += 1;
      else if (!item.moderationIsCurrent) counts.stale += 1;
      else if (item.moderation.status === "approved") counts.approved += 1;
      else counts.hidden += 1;
      return counts;
    },
    {
      submitted: 0,
      pending: 0,
      approved: 0,
      hidden: 0,
      withdrawn: 0,
      stale: 0,
    },
  );
}

export function approvedBirthdayMessages(items: BirthdayModerationItem[]) {
  return items
    .filter(
      (item) =>
        item.message.status === "submitted" &&
        item.moderationIsCurrent &&
        item.moderation?.status === "approved",
    )
    .sort((left, right) => {
      const leftOrder = left.moderation?.displayOrder;
      const rightOrder = right.moderation?.displayOrder;
      if (
        leftOrder !== null &&
        leftOrder !== undefined &&
        rightOrder !== null &&
        rightOrder !== undefined
      ) {
        if (leftOrder !== rightOrder) return leftOrder - rightOrder;
      } else if (leftOrder !== null && leftOrder !== undefined) return -1;
      else if (rightOrder !== null && rightOrder !== undefined) return 1;
      return left.message.createdAt - right.message.createdAt;
    });
}

export function deriveBirthdayRevealReadiness(input: {
  state: BirthdayVaultPublicState | null;
  items: BirthdayModerationItem[];
  participants: Participant[];
  online: boolean;
  authorized: boolean;
  malformedMessageIds: string[];
  malformedModerationIds: string[];
}): BirthdayRevealReadiness {
  const approved = approvedBirthdayMessages(input.items);
  const ids = input.items.map((item) => item.message.publicationId);
  const currentSubmitted = input.items.filter(
    (item) => item.message.status === "submitted",
  );
  const validNamedParticipants = approved.every((item) => {
    if (item.message.displayMode === "anonymous") return true;
    return participantForMessage(item.message, input.participants) !== null;
  });
  const checks = [
    {
      id: "closed",
      label: "Submissions are closed",
      passed:
        input.state?.status === "closed" || input.state?.status === "revealed",
    },
    {
      id: "approved",
      label: "At least one current message is approved",
      passed: approved.length > 0,
    },
    {
      id: "pending",
      label: "No submitted message is pending review",
      passed: currentSubmitted.every((item) => item.moderation !== null),
    },
    {
      id: "stale",
      label: "No submitted approval is stale",
      passed: currentSubmitted.every(
        (item) => !item.moderation || item.moderationIsCurrent,
      ),
    },
    {
      id: "ids",
      label: "Publication identities are valid and unique",
      passed:
        ids.every(isValidPublicationId) && new Set(ids).size === ids.length,
    },
    {
      id: "valid",
      label: "All approved messages pass verification",
      passed:
        approved.every((item) => parseBirthdayMessage(item.message) !== null) &&
        input.malformedMessageIds.length === 0 &&
        input.malformedModerationIds.length === 0,
    },
    {
      id: "participants",
      label: "Named author snapshots are available",
      passed: validNamedParticipants,
    },
    {
      id: "online",
      label: "Organizer connection is online",
      passed: input.online,
    },
    {
      id: "admin",
      label: "Organizer claim is current",
      passed: input.authorized,
    },
  ];
  return {
    ready: checks.every((check) => check.passed),
    checks,
    approvedMessages: approved,
  };
}

export function createPublishedBirthdaySnapshot(input: {
  items: BirthdayModerationItem[];
  participants: Participant[];
  publishedAt: number;
  revealRevision: number;
}) {
  const published: Record<string, PublishedBirthdayMessage> = {};
  approvedBirthdayMessages(input.items).forEach((item, displayOrder) => {
    const participant = participantForMessage(item.message, input.participants);
    if (item.message.displayMode === "named" && !participant) {
      throw new Error("A named message is missing its participant profile.");
    }
    published[item.message.publicationId] = {
      id: item.message.publicationId,
      title: item.message.title,
      message: item.message.message,
      emojiKey: item.message.emojiKey,
      author:
        item.message.displayMode === "anonymous"
          ? {
              mode: "anonymous",
              participantId: null,
              displayName: "Anonymous",
              avatarIcon: null,
              avatarTone: null,
            }
          : {
              mode: "named",
              participantId: participant!.id,
              displayName: participant!.displayName,
              avatarIcon: participant!.avatar.icon,
              avatarTone: participant!.avatar.tone,
            },
      displayOrder,
      sourceMessageRevision: item.message.revision,
      publishedAt: input.publishedAt,
      revealRevision: input.revealRevision,
      schemaVersion: 1,
    };
  });
  return published;
}

export function canTransitionBirthdayVault(
  before: BirthdayVaultPublicState | null,
  afterStatus: BirthdayVaultPublicState["status"],
) {
  if (!before) return afterStatus === "collecting";
  if (before.status === "collecting") return afterStatus === "closed";
  if (before.status === "closed") {
    return afterStatus === "collecting" || afterStatus === "revealed";
  }
  return afterStatus === "revealed";
}
