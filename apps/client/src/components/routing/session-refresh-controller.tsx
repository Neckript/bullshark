import { useIsConnected } from '@/features/server/hooks';
import {
  getLocalStorageItemBool,
  LocalStorageKey,
  SessionStorageKey,
  setLocalStorageItem,
  setSessionStorageItem
} from '@/helpers/storage';
import { getTRPCClient } from '@/lib/trpc';
import { memo, useEffect } from 'react';

// Authentication tokens expire after a week. Renewing while the app is open
// turns that into a sliding window, so someone who uses the app regularly never
// has to type their credentials again.
const REFRESH_INTERVAL_MS = 24 * 60 * 60 * 1_000;

const SessionRefreshController = memo(() => {
  const isConnected = useIsConnected();

  useEffect(() => {
    if (!isConnected) {
      return;
    }

    let cancelled = false;

    const refresh = async () => {
      try {
        const { token } = await getTRPCClient().security.refreshToken.mutate();

        if (cancelled) {
          return;
        }

        setSessionStorageItem(SessionStorageKey.TOKEN, token);

        if (getLocalStorageItemBool(LocalStorageKey.AUTO_LOGIN)) {
          setLocalStorageItem(LocalStorageKey.AUTO_LOGIN_TOKEN, token);
        }
      } catch {
        // the current token is still valid, so a failed renewal is harmless -
        // the next interval or the next connection will try again
      }
    };

    refresh();

    const interval = setInterval(refresh, REFRESH_INTERVAL_MS);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [isConnected]);

  return null;
});

export { SessionRefreshController };
