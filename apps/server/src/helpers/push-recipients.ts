import { hasMention, MUTED_ROLE_MENTION_PREFIX } from '@sharkord/shared';

type TPushDecisionInput = {
  userId: number;
  authorId: number;
  isDmChannel: boolean;
  messageContent: string | null;
  replyToUserId: number | null;
  userRoleIds: number[];
  settings: Record<string, string>;
};

const isOn = (settings: Record<string, string>, key: string) =>
  settings[key] === 'true';

const decidePushForUser = (input: TPushDecisionInput): boolean => {
  if (input.userId === input.authorId) return false;

  // precedence mirrors apps/client/src/features/server/messages/actions.ts:150-186
  // (a fall-through chain: a DM with dms-off still gets the mentions/all/replies checks)
  if (input.isDmChannel && isOn(input.settings, 'browser_notifications_dms')) {
    return true;
  }

  if (isOn(input.settings, 'browser_notifications_mentions')) {
    const mutedRoleIds = Object.keys(input.settings)
      .filter(
        (k) =>
          k.startsWith(MUTED_ROLE_MENTION_PREFIX) &&
          input.settings[k] === 'true'
      )
      .map((k) => Number(k.slice(MUTED_ROLE_MENTION_PREFIX.length)));

    return hasMention(
      input.messageContent,
      input.userId,
      input.userRoleIds,
      mutedRoleIds
    );
  }

  if (isOn(input.settings, 'browser_notifications')) return true;

  if (isOn(input.settings, 'browser_notifications_replies')) {
    return input.replyToUserId === input.userId;
  }

  return false;
};

export { decidePushForUser, type TPushDecisionInput };
