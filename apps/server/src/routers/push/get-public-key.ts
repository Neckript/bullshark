import { getVapidKeys } from '../../helpers/vapid';
import { protectedProcedure } from '../../utils/trpc';

const getPublicKeyRoute = protectedProcedure.query(async () => {
  const keys = getVapidKeys();

  return { publicKey: keys?.publicKey ?? null };
});

export { getPublicKeyRoute };
