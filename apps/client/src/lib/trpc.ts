import { resetApp } from '@/features/app/actions';
import { resetDialogs } from '@/features/dialogs/actions';
import { resetServerScreens } from '@/features/server-screens/actions';
import { resetServerState, setDisconnectInfo } from '@/features/server/actions';
import { playSound } from '@/features/server/sounds/actions';
import { SoundType } from '@/features/server/types';
import {
  getSessionStorageItem,
  LocalStorageKey,
  removeLocalStorageItem,
  removeSessionStorageItem,
  SessionStorageKey
} from '@/helpers/storage';
import {
  type AppRouter,
  DisconnectCode,
  type TConnectionParams
} from '@bullshark/shared';
import { createTRPCProxyClient, createWSClient, wsLink } from '@trpc/client';

let wsClient: ReturnType<typeof createWSClient> | null = null;
let trpc: ReturnType<typeof createTRPCProxyClient<AppRouter>> | null = null;
let currentHost: string | null = null;
let isCleaningUp = false;

type TCleanupOptions = {
  // whether the stored session must be dropped, forcing a full login next time
  forgetSession?: boolean;
};

const initializeTRPC = (host: string) => {
  const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';

  wsClient = createWSClient({
    url: `${protocol}://${host}`,
    // @ts-expect-error - the onclose type is not correct in trpc
    onClose: (cause: CloseEvent) => {
      // a kick or a ban is the server refusing this session, so it must not be
      // reused; anything else is an accident we can recover from
      cleanup({
        forgetSession:
          cause.code === DisconnectCode.KICKED ||
          cause.code === DisconnectCode.BANNED
      });

      setDisconnectInfo({
        code: cause.code,
        reason: cause.reason,
        wasClean: cause.wasClean,
        time: new Date()
      });

      if (!cause.wasClean) {
        playSound(SoundType.SERVER_DISCONNECTED);
      }
    },
    connectionParams: async (): Promise<TConnectionParams> => {
      return {
        token: getSessionStorageItem(SessionStorageKey.TOKEN) || ''
      };
    },
    keepAlive: {
      enabled: true,
      intervalMs: 30_000,
      pongTimeoutMs: 5_000
    }
  });

  trpc = createTRPCProxyClient<AppRouter>({
    links: [wsLink({ client: wsClient })]
  });

  currentHost = host;

  return trpc;
};

const connectToTRPC = (host: string) => {
  if (trpc && currentHost === host) {
    return trpc;
  }

  return initializeTRPC(host);
};

const getTRPCClient = () => {
  if (!trpc) {
    throw new Error('TRPC client is not initialized');
  }

  return trpc;
};

// A cleanup only forgets the stored session when the user asked for it (manual
// disconnect) or when the server refused them (kick, ban). Every other reason -
// network hiccup, server restart, device waking up, tab discarded by the OS -
// must keep the session, or the user has to type their credentials again.
const cleanup = ({ forgetSession = false }: TCleanupOptions = {}) => {
  if (isCleaningUp) {
    return;
  }

  isCleaningUp = true;

  if (wsClient) {
    wsClient.close();
    wsClient = null;
  }

  trpc = null;
  currentHost = null;

  if (forgetSession) {
    removeLocalStorageItem(LocalStorageKey.AUTO_LOGIN_TOKEN);
    removeSessionStorageItem(SessionStorageKey.TOKEN);
  }

  resetServerScreens();
  resetServerState();
  resetDialogs();
  resetApp();

  // this should help Firefox users who report that auto login is not consistent
  setTimeout(() => {
    isCleaningUp = false;
  }, 100);
};

export { cleanup, connectToTRPC, getTRPCClient, type AppRouter };
