import { ServerEvents } from '@bullshark/shared';
import { protectedProcedure } from '../../utils/trpc';

const onEmojiCreateRoute = protectedProcedure.subscription(async ({ ctx }) => {
  return ctx.pubsub.subscribe(ServerEvents.EMOJI_CREATE);
});

const onEmojiDeleteRoute = protectedProcedure.subscription(async ({ ctx }) => {
  return ctx.pubsub.subscribe(ServerEvents.EMOJI_DELETE);
});

const onEmojiUpdateRoute = protectedProcedure.subscription(async ({ ctx }) => {
  return ctx.pubsub.subscribe(ServerEvents.EMOJI_UPDATE);
});

export { onEmojiCreateRoute, onEmojiDeleteRoute, onEmojiUpdateRoute };
