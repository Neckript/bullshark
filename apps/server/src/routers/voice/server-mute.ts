import {
  ActivityLogType,
  Permission,
  ServerEvents,
  StreamKind
} from '@bullshark/shared';
import { eq } from 'drizzle-orm';
import z from 'zod';
import { db } from '../../db';
import { users } from '../../db/schema';
import { assertOutranksUser } from '../../helpers/assert-rank';
import { enqueueActivityLog } from '../../queues/activity-log';
import { VoiceRuntime } from '../../runtimes/voice';
import { protectedProcedure } from '../../utils/trpc';

const serverMuteRoute = protectedProcedure
  .input(
    z.object({
      userId: z.number(),
      muted: z.boolean()
    })
  )
  .mutation(async ({ ctx, input }) => {
    await ctx.needsPermission(Permission.MANAGE_USERS);

    await assertOutranksUser(ctx.user.id, input.userId);

    await db
      .update(users)
      .set({ voiceMuted: input.muted, updatedAt: Date.now() })
      .where(eq(users.id, input.userId));

    // Apply live if the target is currently connected to a voice channel.
    const runtime = VoiceRuntime.findRuntimeByUserId(input.userId);

    if (runtime) {
      runtime.updateUserState(input.userId, {
        serverMuted: input.muted,
        ...(input.muted ? { micMuted: true } : {})
      });

      if (input.muted) {
        runtime.removeProducer(input.userId, StreamKind.AUDIO);

        ctx.pubsub.publishForChannel(
          runtime.id,
          ServerEvents.VOICE_PRODUCER_CLOSED,
          {
            channelId: runtime.id,
            remoteId: input.userId,
            kind: StreamKind.AUDIO
          }
        );
      }

      ctx.pubsub.publish(ServerEvents.USER_VOICE_STATE_UPDATE, {
        channelId: runtime.id,
        userId: input.userId,
        state: runtime.getUserState(input.userId)
      });
    }

    if (input.muted) {
      enqueueActivityLog({
        type: ActivityLogType.USER_VOICE_MUTED,
        userId: input.userId,
        details: { mutedBy: ctx.user.id }
      });
    } else {
      enqueueActivityLog({
        type: ActivityLogType.USER_VOICE_UNMUTED,
        userId: input.userId,
        details: { unmutedBy: ctx.user.id }
      });
    }
  });

export { serverMuteRoute };
