import { t } from '../../utils/trpc';
import { totpSetupRoute } from './totp-setup';
import { totpStatusRoute } from './totp-status';

const securityRouter = t.router({
  totp: t.router({
    status: totpStatusRoute,
    setup: totpSetupRoute
  })
});

export { securityRouter };
