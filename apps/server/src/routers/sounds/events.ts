import { ServerEvents } from '@sharkord/shared';
import { protectedProcedure } from '../../utils/trpc';

const onSoundCreateRoute = protectedProcedure.subscription(async ({ ctx }) => {
  return ctx.pubsub.subscribe(ServerEvents.SOUND_CREATE);
});

const onSoundDeleteRoute = protectedProcedure.subscription(async ({ ctx }) => {
  return ctx.pubsub.subscribe(ServerEvents.SOUND_DELETE);
});

const onSoundUpdateRoute = protectedProcedure.subscription(async ({ ctx }) => {
  return ctx.pubsub.subscribe(ServerEvents.SOUND_UPDATE);
});

export { onSoundCreateRoute, onSoundDeleteRoute, onSoundUpdateRoute };
