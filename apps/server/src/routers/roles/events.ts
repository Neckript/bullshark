import { ServerEvents } from '@bullshark/shared';
import { protectedProcedure } from '../../utils/trpc';

const onRoleCreateRoute = protectedProcedure.subscription(async ({ ctx }) => {
  return ctx.pubsub.subscribe(ServerEvents.ROLE_CREATE);
});

const onRoleDeleteRoute = protectedProcedure.subscription(async ({ ctx }) => {
  return ctx.pubsub.subscribe(ServerEvents.ROLE_DELETE);
});

const onRoleUpdateRoute = protectedProcedure.subscription(async ({ ctx }) => {
  return ctx.pubsub.subscribe(ServerEvents.ROLE_UPDATE);
});

export { onRoleCreateRoute, onRoleDeleteRoute, onRoleUpdateRoute };
