import webpush from 'web-push';
import { updateSettings } from '../db/mutations/server';
import { getSettings } from '../db/queries/server';
import { logger } from '../logger';

let cached: { publicKey: string; privateKey: string } | null = null;

const ensureVapidKeys = async (): Promise<void> => {
  try {
    const current = await getSettings();

    if (current.vapidPublicKey && current.vapidPrivateKey) {
      cached = {
        publicKey: current.vapidPublicKey,
        privateKey: current.vapidPrivateKey
      };
      return;
    }

    const keys = webpush.generateVAPIDKeys();

    await updateSettings({
      vapidPublicKey: keys.publicKey,
      vapidPrivateKey: keys.privateKey
    });

    cached = keys;
    logger.info('[Push] VAPID keys generated');
  } catch (error) {
    cached = null;
    logger.error(`[Push] VAPID init failed, push disabled: ${error}`);
  }
};

const getVapidKeys = (): { publicKey: string; privateKey: string } | null =>
  cached;

export { ensureVapidKeys, getVapidKeys };
