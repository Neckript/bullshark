import { getTRPCClient } from '@/lib/trpc';
import { store } from '../../store';
import { forEachSignedFile } from '../helpers';
import { serverSliceActions } from '../slice';

const CHECK_INTERVAL_MS = 60_000;
// Tokens with less than this left get renewed. The server's minimum TTL is
// 30 minutes, so this never turns into a refresh on every check.
const REFRESH_MARGIN_MS = 10 * 60_000;
// Matches the route's input cap; anything beyond waits for the next check.
const MAX_FILES_PER_REFRESH = 1000;

const collectExpiringFileIds = () => {
  const deadline = Date.now() + REFRESH_MARGIN_MS;
  const ids = new Set<number>();

  forEachSignedFile(store.getState().server, (file) => {
    if (file._accessTokenExpiresAt < deadline) ids.add(file.id);
  });

  return [...ids].slice(0, MAX_FILES_PER_REFRESH);
};

const refreshExpiringFileTokens = async () => {
  const fileIds = collectExpiringFileIds();

  if (fileIds.length === 0) return;

  const tokens = await getTRPCClient().files.refreshTokens.mutate({ fileIds });

  store.dispatch(serverSliceActions.refreshFileTokens(tokens));
};

// Signed file URLs expire after the storage TTL. Renew the tokens of every
// file held in the store before they run out, so an image mounted late
// (member list, scrolled-back message, overlay) never gets a 403.
// See docs/development/2026-10-25-file-token-refresh.md.
const subscribeToFileTokens = () => {
  const interval = setInterval(() => {
    refreshExpiringFileTokens().catch((err) =>
      console.error('file token refresh error:', err)
    );
  }, CHECK_INTERVAL_MS);

  return () => clearInterval(interval);
};

export { subscribeToFileTokens };
