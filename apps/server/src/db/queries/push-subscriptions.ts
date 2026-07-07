import { and, eq, inArray } from 'drizzle-orm';
import { db } from '..';
import { pushSubscriptions } from '../schema';

const addPushSubscription = async (sub: {
  userId: number;
  endpoint: string;
  p256dh: string;
  auth: string;
}): Promise<void> => {
  await db
    .insert(pushSubscriptions)
    .values({ ...sub, createdAt: Date.now() })
    .onConflictDoUpdate({
      target: pushSubscriptions.endpoint,
      set: { userId: sub.userId, p256dh: sub.p256dh, auth: sub.auth }
    });
};

const deletePushSubscriptionByEndpoint = async (
  endpoint: string
): Promise<void> => {
  await db
    .delete(pushSubscriptions)
    .where(eq(pushSubscriptions.endpoint, endpoint));
};

const deletePushSubscriptionsForUser = async (
  userId: number,
  endpoint?: string
): Promise<void> => {
  if (endpoint) {
    await db
      .delete(pushSubscriptions)
      .where(
        and(
          eq(pushSubscriptions.userId, userId),
          eq(pushSubscriptions.endpoint, endpoint)
        )
      );
    return;
  }
  await db
    .delete(pushSubscriptions)
    .where(eq(pushSubscriptions.userId, userId));
};

const getPushSubscriptionsForUsers = async (userIds: number[]) => {
  if (userIds.length === 0) return [];
  return db
    .select({
      userId: pushSubscriptions.userId,
      endpoint: pushSubscriptions.endpoint,
      p256dh: pushSubscriptions.p256dh,
      auth: pushSubscriptions.auth
    })
    .from(pushSubscriptions)
    .where(inArray(pushSubscriptions.userId, userIds));
};

export {
  addPushSubscription,
  deletePushSubscriptionByEndpoint,
  deletePushSubscriptionsForUser,
  getPushSubscriptionsForUsers
};
