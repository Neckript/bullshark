import { fetchServerInfo, setIsAutoConnecting } from '@/features/app/actions';
import { useIsAppLoading, useIsPluginsLoading } from '@/features/app/hooks';
import { connect, setDisconnectInfo } from '@/features/server/actions';
import { useDisconnectInfo, useIsConnected } from '@/features/server/hooks';
import {
  getLocalStorageItem,
  getLocalStorageItemBool,
  LocalStorageKey,
  removeLocalStorageItem,
  SessionStorageKey,
  setLocalStorageItemBool,
  setSessionStorageItem
} from '@/helpers/storage';
import { DisconnectCode } from '@sharkord/shared';
import { memo, useEffect, useRef } from 'react';
import { decideAfterConnectFailure } from './auto-login-policy';

// delays between reconnection attempts, in milliseconds - the length of the
// array is also the number of attempts we make before giving up
const RECONNECT_DELAYS_MS = [1_000, 3_000, 9_000];

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// A kick or a ban means the server refused this session, so retrying it would
// only produce the same answer.
const isSessionRefused = (code: number | undefined) =>
  code === DisconnectCode.KICKED || code === DisconnectCode.BANNED;

// /info is public and needs no session, so it answers whenever the server is
// up. That is the only signal separating "the server refused our token" from
// "the server is not there right now" - the connection error itself is
// identical in both cases.
const isServerReachable = async () => Boolean(await fetchServerInfo());

const AutoLoginController = memo(() => {
  const isConnected = useIsConnected();
  const isAppLoading = useIsAppLoading();
  const isPluginsLoading = useIsPluginsLoading();
  const disconnectInfo = useDisconnectInfo();
  const autoLoginInFlight = useRef(false);

  useEffect(() => {
    if (
      isAppLoading ||
      isPluginsLoading ||
      isConnected ||
      autoLoginInFlight.current ||
      isSessionRefused(disconnectInfo?.code)
    ) {
      // ignore if the app is not done loading, if we're already connected or in
      // the process of connecting, or if the server refused this session
      return;
    }

    const autoLoginEnabled = getLocalStorageItemBool(
      LocalStorageKey.AUTO_LOGIN
    );

    if (
      !autoLoginEnabled ||
      !getLocalStorageItem(LocalStorageKey.AUTO_LOGIN_TOKEN)
    ) {
      // auto-login not enabled or no token saved, do nothing
      return;
    }

    autoLoginInFlight.current = true;
    setIsAutoConnecting(true);

    const forgetSession = () => {
      removeLocalStorageItem(LocalStorageKey.AUTO_LOGIN_TOKEN);
      setLocalStorageItemBool(LocalStorageKey.AUTO_LOGIN, false);
    };

    // A dropped connection is usually temporary (server restarting, phone
    // changing network, laptop waking up), so we retry a few times before
    // sending the user back to the login form.
    const run = async () => {
      for (let attempt = 0; attempt < RECONNECT_DELAYS_MS.length; attempt++) {
        const savedToken = getLocalStorageItem(
          LocalStorageKey.AUTO_LOGIN_TOKEN
        );

        if (!savedToken) {
          return;
        }

        setSessionStorageItem(SessionStorageKey.TOKEN, savedToken);

        try {
          await connect();
          setDisconnectInfo(undefined);

          return;
        } catch (error) {
          const decision = decideAfterConnectFailure(
            error,
            await isServerReachable()
          );

          if (decision === 'forget') {
            forgetSession();

            return;
          }

          await sleep(RECONNECT_DELAYS_MS[attempt]!);
        }
      }

      // the server stayed unreachable, so let the user log in manually
      forgetSession();
    };

    run().finally(() => {
      autoLoginInFlight.current = false;
      setIsAutoConnecting(false);
    });
  }, [isAppLoading, isPluginsLoading, isConnected, disconnectInfo]);

  return null;
});

export { AutoLoginController };
