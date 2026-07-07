import type { TJoinedMessage } from '@sharkord/shared';
import { ChannelPermission } from '@sharkord/shared';
import Queue from 'queue';
import webpush from 'web-push';
import {
  getAffectedUserIdsForChannel,
  getChannel
} from '../../db/queries/channels';
import {
  deletePushSubscriptionByEndpoint,
  getPushSubscriptionsForUsers
} from '../../db/queries/push-subscriptions';
import { getUserRoleIds } from '../../db/queries/roles';
import { getUserSettings } from '../../db/queries/user-settings';
import { getPublicUserById } from '../../db/queries/users';
import { decidePushForUser } from '../../helpers/push-recipients';
import { getVapidKeys } from '../../helpers/vapid';
import { logger } from '../../logger';
import { getOnlineUserIds } from '../../utils/wss';
import { stripHtml, toStringSettings } from './helpers';

const pushQueue = new Queue({
  concurrency: 2,
  autostart: true,
  timeout: 10000
});

const enqueuePushForMessage = (
  message: TJoinedMessage,
  channelId: number
): void => {
  const vapid = getVapidKeys();
  if (!vapid) return; // push disabled (no VAPID keys)

  pushQueue.push(async () => {
    try {
      // plugin/system messages have no real author (userId is nullable on
      // the messages table); nothing to attribute the notification to, skip.
      const authorId = message.userId;
      if (authorId == null) return;

      const channel = await getChannel(channelId);
      if (!channel) return;

      const candidateIds = (
        await getAffectedUserIdsForChannel(channelId, {
          permission: ChannelPermission.VIEW_CHANNEL
        })
      ).filter((id) => id !== authorId);

      if (candidateIds.length === 0) return;

      const online = new Set(getOnlineUserIds());
      const offlineIds = candidateIds.filter((id) => !online.has(id));
      if (offlineIds.length === 0) return;

      const recipients: number[] = [];
      for (const userId of offlineIds) {
        const rawSettings = await getUserSettings(userId);
        const settings = toStringSettings(rawSettings);
        const userRoleIds = await getUserRoleIds(userId);

        const notify = decidePushForUser({
          userId,
          authorId,
          isDmChannel: !!channel.isDm,
          messageContent: message.content ?? null,
          replyToUserId: message.replyTo?.userId ?? null,
          userRoleIds,
          settings
        });

        if (notify) recipients.push(userId);
      }
      if (recipients.length === 0) return;

      const subs = await getPushSubscriptionsForUsers(recipients);
      if (subs.length === 0) return;

      const author = await getPublicUserById(authorId);
      const authorName = author?.name ?? 'Bullshark';

      const title = channel.isDm ? authorName : `#${channel.name}`;
      const body = `${authorName}: ${stripHtml(message.content).slice(0, 140)}`;
      const payload = JSON.stringify({
        title,
        body,
        tag: `channel-${channelId}`,
        url: `/?channelId=${channelId}`
      });

      webpush.setVapidDetails(
        'mailto:admin@localhost',
        vapid.publicKey,
        vapid.privateKey
      );

      await Promise.allSettled(
        subs.map(async (sub) => {
          try {
            await webpush.sendNotification(
              {
                endpoint: sub.endpoint,
                keys: { p256dh: sub.p256dh, auth: sub.auth }
              },
              payload
            );
          } catch (error) {
            const status = (error as { statusCode?: number }).statusCode;
            if (status === 404 || status === 410) {
              await deletePushSubscriptionByEndpoint(sub.endpoint);
            } else {
              logger.debug(`[Push] send failed (${status}): ${error}`);
            }
          }
        })
      );
    } catch (error) {
      logger.error(`[Push] queue job failed: ${error}`);
    }
  });
};

export { enqueuePushForMessage };
