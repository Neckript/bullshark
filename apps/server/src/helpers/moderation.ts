import { Permission } from '@bullshark/shared';
import { and, desc, eq } from 'drizzle-orm';
import { db } from '../db';
import { channels, messages, users } from '../db/schema';
import { invariant } from '../utils/invariant';

/** Blocks a message send while the user is under an active moderation timeout. */
const assertNotTimedOut = async (userId: number) => {
  const row = await db
    .select({ mutedUntil: users.mutedUntil })
    .from(users)
    .where(eq(users.id, userId))
    .get();

  const mutedUntil = row?.mutedUntil ?? null;

  if (!mutedUntil || mutedUntil <= Date.now()) return;

  const remainingSeconds = Math.ceil((mutedUntil - Date.now()) / 1000);

  invariant(false, {
    code: 'FORBIDDEN',
    message: `You are timed out for ${remainingSeconds} more second(s).`
  });
};

/**
 * Enforces a channel's slow mode: a user may not send again until
 * slowModeSeconds have passed since their previous message in that channel.
 * Users who can manage messages bypass it, matching the usual moderator escape.
 */
const assertSlowModeOk = async (
  userId: number,
  channelId: number,
  hasPermission: (permission: Permission) => Promise<boolean>
) => {
  const channel = await db
    .select({ slowModeSeconds: channels.slowModeSeconds })
    .from(channels)
    .where(eq(channels.id, channelId))
    .get();

  const slowModeSeconds = channel?.slowModeSeconds ?? 0;

  if (slowModeSeconds <= 0) return;

  if (await hasPermission(Permission.MANAGE_MESSAGES)) return;

  const lastMessage = await db
    .select({ createdAt: messages.createdAt })
    .from(messages)
    .where(and(eq(messages.channelId, channelId), eq(messages.userId, userId)))
    .orderBy(desc(messages.createdAt))
    .limit(1)
    .get();

  if (!lastMessage) return;

  const elapsedMs = Date.now() - lastMessage.createdAt;
  const remainingMs = slowModeSeconds * 1000 - elapsedMs;

  if (remainingMs <= 0) return;

  invariant(false, {
    code: 'TOO_MANY_REQUESTS',
    message: `Slow mode is on. Wait ${Math.ceil(remainingMs / 1000)} more second(s).`
  });
};

export { assertNotTimedOut, assertSlowModeOk };
