import { t } from '../../utils/trpc';
import { getPublicKeyRoute } from './get-public-key';
import { subscribeRoute } from './subscribe';
import { unsubscribeRoute } from './unsubscribe';

export const pushRouter = t.router({
  getPublicKey: getPublicKeyRoute,
  subscribe: subscribeRoute,
  unsubscribe: unsubscribeRoute
});
