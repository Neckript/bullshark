import { signAuthToken } from '../../helpers/auth-token';
import { protectedProcedure } from '../../utils/trpc';

// Issues a fresh authentication token for the already authenticated user, so a
// client that keeps using the app never reaches the expiry of its first token.
const refreshTokenRoute = protectedProcedure.mutation(async ({ ctx }) => ({
  token: await signAuthToken(ctx.userId)
}));

export { refreshTokenRoute };
