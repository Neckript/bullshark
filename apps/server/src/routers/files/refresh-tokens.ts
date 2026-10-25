import { z } from 'zod';
import { isFileOrphaned } from '../../db/queries/files';
import { getMessageByFileId } from '../../db/queries/messages';
import { getSettings } from '../../db/queries/server';
import { assertChannelAccess } from '../../helpers/assert-channel-access';
import { generateFileToken } from '../../helpers/files-crypto';
import { protectedProcedure, type Context } from '../../utils/trpc';

type TFileTokens = Record<number, { token: string; expiresAt: number }>;

// Message attachments follow their channel's access; every other referenced
// file (avatars, banners, emojis, role icons, server logo, sounds) is visible
// to all members. Orphaned files are never re-signed.
const canReadFile = async (ctx: Context, fileId: number) => {
  const message = await getMessageByFileId(fileId);

  if (message) {
    return assertChannelAccess(ctx, message.channelId).then(
      () => true,
      () => false
    );
  }

  return !(await isFileOrphaned(fileId));
};

// Signed file URLs expire after the storage TTL and the client signs nothing
// itself, so it asks for fresh tokens for the files it still holds before
// they run out. See docs/development/2026-10-25-file-token-refresh.md.
const refreshTokensRoute = protectedProcedure
  .input(z.object({ fileIds: z.array(z.number()).max(1000) }))
  .mutation(async ({ input, ctx }) => {
    const { storageSignedUrlsEnabled, storageSignedUrlsTtlSeconds } =
      await getSettings();
    const tokens: TFileTokens = {};

    if (!storageSignedUrlsEnabled) return tokens;

    const expiresAt = Date.now() + storageSignedUrlsTtlSeconds * 1000;

    for (const fileId of new Set(input.fileIds)) {
      if (!(await canReadFile(ctx, fileId))) continue;

      tokens[fileId] = {
        token: generateFileToken(fileId, expiresAt),
        expiresAt
      };
    }

    return tokens;
  });

export { refreshTokensRoute };
export type { TFileTokens };
