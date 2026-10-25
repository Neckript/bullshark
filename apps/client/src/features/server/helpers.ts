import {
  ChannelPermission,
  hasMention,
  type TJoinedMessage
} from '@bullshark/shared';
import type { channelPermissionsSelector } from './channels/selectors';

const canViewChannel = (
  channel: { id: number; private: boolean },
  channelPermissions: ReturnType<typeof channelPermissionsSelector>,
  isOwner: boolean
) => {
  if (isOwner || !channel.private) {
    return true;
  }

  return (
    channelPermissions[channel.id]?.permissions?.[
      ChannelPermission.VIEW_CHANNEL
    ] === true
  );
};

const hasUnreadMentionInMessages = (
  unreadCount: number,
  messages: { content?: string | null }[],
  ownUserId: number | undefined,
  ownRoleIds: number[] = [],
  mutedRoleMentionIds: number[] = []
) => {
  if (unreadCount <= 0 || messages.length === 0 || ownUserId === undefined) {
    return false;
  }

  const unreadMessages = messages.slice(-unreadCount);

  return unreadMessages.some((message) => {
    if (!message.content) return false;

    return hasMention(
      message.content,
      ownUserId,
      ownRoleIds,
      mutedRoleMentionIds
    );
  });
};

const compareMessagesByDate = (a: TJoinedMessage, b: TJoinedMessage) => {
  const createdAtDifference = a.createdAt - b.createdAt;

  if (createdAtDifference !== 0) {
    return createdAtDifference;
  }

  return a.id - b.id;
};

const mergeMessagesChronologically = (
  existing: TJoinedMessage[],
  incoming: TJoinedMessage[]
) => {
  if (incoming.length === 0) {
    return existing;
  }

  const sortedIncoming = [...incoming].sort(compareMessagesByDate);

  if (existing.length === 0) {
    return sortedIncoming;
  }

  const firstExisting = existing[0];
  const lastExisting = existing[existing.length - 1];
  const firstIncoming = sortedIncoming[0];
  const lastIncoming = sortedIncoming[sortedIncoming.length - 1];

  if (compareMessagesByDate(lastExisting, firstIncoming) <= 0) {
    return [...existing, ...sortedIncoming];
  }

  if (compareMessagesByDate(lastIncoming, firstExisting) <= 0) {
    return [...sortedIncoming, ...existing];
  }

  const merged: TJoinedMessage[] = [];
  let existingIndex = 0;
  let incomingIndex = 0;

  while (
    existingIndex < existing.length &&
    incomingIndex < sortedIncoming.length
  ) {
    if (
      compareMessagesByDate(
        existing[existingIndex],
        sortedIncoming[incomingIndex]
      ) <= 0
    ) {
      merged.push(existing[existingIndex]);
      existingIndex += 1;
    } else {
      merged.push(sortedIncoming[incomingIndex]);
      incomingIndex += 1;
    }
  }

  if (existingIndex < existing.length) {
    merged.push(...existing.slice(existingIndex));
  }

  if (incomingIndex < sortedIncoming.length) {
    merged.push(...sortedIncoming.slice(incomingIndex));
  }

  return merged;
};

type TSignedFile = {
  id: number;
  _accessToken: string;
  _accessTokenExpiresAt: number;
};

type TFileTokens = Record<number, { token: string; expiresAt: number }>;

const isPlainNode = (value: unknown): value is Record<string, unknown> =>
  value !== null &&
  typeof value === 'object' &&
  (Array.isArray(value) || Object.getPrototypeOf(value) === Object.prototype);

const isSignedFile = (node: Record<string, unknown>) =>
  typeof node.id === 'number' &&
  typeof node._accessToken === 'string' &&
  typeof node._accessTokenExpiresAt === 'number';

// Visits every signed file anywhere in the state (users, emojis, roles,
// messages...). Plain objects and arrays only: the slice also holds
// MediaStreams and other class instances.
const forEachSignedFile = (
  node: unknown,
  visit: (file: TSignedFile) => void
) => {
  if (!isPlainNode(node)) return;
  if (isSignedFile(node)) visit(node as unknown as TSignedFile);

  for (const child of Object.values(node)) forEachSignedFile(child, visit);
};

export {
  canViewChannel,
  forEachSignedFile,
  hasUnreadMentionInMessages,
  mergeMessagesChronologically
};
export type { TFileTokens };
