import { t } from '../../utils/trpc';
import { changeLogoRoute } from './change-logo';
import { changeServerBannerRoute } from './change-server-banner';
import { onServerSettingsUpdateRoute } from './events';
import { getSettingsRoute } from './get-settings';
import { getStorageSettingsRoute } from './get-storage-settings';
import { getUpdateRoute } from './get-update';
import { handshakeRoute } from './handshake';
import { joinServerRoute } from './join';
import { rotateOwnerTokenRoute } from './rotate-owner-token';
import { updateServerRoute } from './update-server';
import { updateSettingsRoute } from './update-settings';
import { useSecretTokenRoute } from './use-secret-token';

export const othersRouter = t.router({
  joinServer: joinServerRoute,
  handshake: handshakeRoute,
  updateSettings: updateSettingsRoute,
  changeLogo: changeLogoRoute,
  changeServerBanner: changeServerBannerRoute,
  getSettings: getSettingsRoute,
  onServerSettingsUpdate: onServerSettingsUpdateRoute,
  useSecretToken: useSecretTokenRoute,
  rotateOwnerToken: rotateOwnerTokenRoute,
  getStorageSettings: getStorageSettingsRoute,
  getUpdate: getUpdateRoute,
  updateServer: updateServerRoute
});
