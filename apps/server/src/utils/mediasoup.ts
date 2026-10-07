import { getErrorMessage } from '@bullshark/shared';
import mediasoup from 'mediasoup';
import { config, SERVER_PUBLIC_IP } from '../config.js';
import { MEDIASOUP_BINARY_PATH } from '../helpers/paths.js';
import { logger } from '../logger.js';
import {
  patchSpawnForMediasoup,
  restoreSpawn
} from './bun-mediasoup-workaround.js';
import { IS_PRODUCTION } from './env.js';

let mediaSoupWorker: mediasoup.types.Worker<mediasoup.types.AppData>;
let webRtcServer: mediasoup.types.WebRtcServer<mediasoup.types.AppData>;
let webRtcServerListenInfo: { ip: string; announcedAddress?: string };

const loadMediasoup = async () => {
  const port = +config.webRtc.port;

  const workerConfig: mediasoup.types.WorkerSettings = {
    // 'debug' was hard-coded here, including in production, where the worker
    // then logs per-packet events for every call. There is a single worker for
    // the whole server, so that cost lands on the one core all voice channels
    // share. Tied to the same switch as the app logger (logger.ts), so
    // BULLSHARK_DEBUG turns both on together.
    logLevel: config.server.debug ? 'debug' : 'warn',
    // disableLiburing is gone: mediasoup removed io_uring support entirely in
    // 3.20.7, so there is nothing left to disable and no replacement option.
    workerBin: MEDIASOUP_BINARY_PATH
  };

  logger.debug(
    `Loading mediasoup worker with config ${JSON.stringify(workerConfig, null, 2)}`
  );

  // On Bun/Windows, extra stdio pipes (fd 3/4) are broken (oven-sh/bun#11044).
  // This patches child_process.spawn to use Bun.spawn() for the mediasoup
  // worker, which correctly supports extra stdio pipe handles.
  try {
    patchSpawnForMediasoup();
    mediaSoupWorker = await mediasoup.createWorker(workerConfig);
  } catch (error) {
    logger.error('Failed to load mediasoup worker: %s', getErrorMessage(error));
    // Swallowing this left mediaSoupWorker undefined and the .on('died') call
    // below threw a TypeError that masked the real cause logged just above.
    // A server with no worker cannot serve voice, so fail loudly instead.
    throw error;
  } finally {
    restoreSpawn();
  }

  mediaSoupWorker.on('died', (error) => {
    logger.error('Mediasoup worker died: %s', getErrorMessage(error));

    setTimeout(() => process.exit(0), 2000);
  });

  logger.debug('Mediasoup worker loaded');

  if (IS_PRODUCTION) {
    const announcedAddress = config.webRtc.announcedAddress || SERVER_PUBLIC_IP;

    webRtcServer = await mediaSoupWorker.createWebRtcServer({
      listenInfos: [
        { protocol: 'udp', ip: '0.0.0.0', announcedAddress, port },
        { protocol: 'tcp', ip: '0.0.0.0', announcedAddress, port }
      ]
    });

    webRtcServerListenInfo = { ip: '0.0.0.0', announcedAddress };

    logger.debug(
      `WebRtcServer created on port ${port} with announcedAddress ${announcedAddress}`
    );
  } else {
    webRtcServer = await mediaSoupWorker.createWebRtcServer({
      listenInfos: [
        { protocol: 'udp', ip: '127.0.0.1', port },
        { protocol: 'tcp', ip: '127.0.0.1', port }
      ]
    });

    webRtcServerListenInfo = { ip: '127.0.0.1' };

    logger.debug(`WebRtcServer created on 127.0.0.1:${port} (dev mode)`);
  }
};

export { loadMediasoup, mediaSoupWorker, webRtcServer, webRtcServerListenInfo };
