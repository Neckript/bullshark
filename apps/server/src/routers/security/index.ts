import { t } from '../../utils/trpc';
import { totpDisableRoute } from './totp-disable';
import { totpEnableRoute } from './totp-enable';
import { totpRegenerateRecoveryCodesRoute } from './totp-regenerate-recovery-codes';
import { totpSetupRoute } from './totp-setup';
import { totpStatusRoute } from './totp-status';

const securityRouter = t.router({
  totp: t.router({
    status: totpStatusRoute,
    setup: totpSetupRoute,
    enable: totpEnableRoute,
    disable: totpDisableRoute,
    regenerateRecoveryCodes: totpRegenerateRecoveryCodesRoute
  })
});

export { securityRouter };
