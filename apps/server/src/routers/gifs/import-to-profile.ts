import fs from 'fs/promises';
import z from 'zod';
import { getGifProvider } from '../../integrations/gif';
import { fileManager } from '../../utils/file-manager';
import { protectedProcedure, rateLimitedProcedure } from '../../utils/trpc';
import { applyProfileMedia } from '../users/apply-profile-media';

const MAX_BYTES = 8 * 1024 * 1024; // hard cap during download

const importToProfileRoute = rateLimitedProcedure(protectedProcedure, {
  maxRequests: 10,
  windowMs: 60_000,
  logLabel: 'gifs.importToProfile'
})
  .input(
    z.object({
      gifId: z.string().min(1).max(200),
      target: z.enum(['avatar', 'banner'])
    })
  )
  .mutation(async ({ ctx, input }) => {
    const provider = await getGifProvider();
    if (!provider) {
      throw new Error('GIF import is not configured on this server.');
    }

    const mediaUrl = await provider.resolveMediaUrl(input.gifId);
    const parsed = new URL(mediaUrl);

    const hostAllowed = provider.allowedMediaHosts.some(
      (h) => parsed.hostname === h || parsed.hostname.endsWith(`.${h}`)
    );
    if (parsed.protocol !== 'https:' || !hostAllowed) {
      throw new Error('Refusing to download GIF from an untrusted source.');
    }

    // redirect: 'error' prevents a 3xx response from bypassing the host allowlist (SSRF).
    const res = await fetch(mediaUrl, { redirect: 'error' });
    if (!res.ok || !res.body) {
      throw new Error('Failed to download GIF.');
    }

    const contentType = res.headers.get('content-type') ?? '';
    if (!contentType.startsWith('image/')) {
      throw new Error('Downloaded file is not an image.');
    }

    const safeId = input.gifId.replace(/[^a-zA-Z0-9_-]/g, '_');
    const safePath = await fileManager.getSafeUploadPath(`gif-${safeId}.gif`);
    const handle = await fs.open(safePath, 'w');
    let total = 0;
    let succeeded = false;
    try {
      const reader = res.body.getReader();
      // eslint-disable-next-line no-constant-condition
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        total += value.byteLength;
        if (total > MAX_BYTES) {
          throw new Error('GIF exceeds the maximum allowed size.');
        }
        await handle.write(value);
      }
      succeeded = true;
    } finally {
      await handle.close().catch(() => undefined);
      if (!succeeded) {
        await fs.unlink(safePath).catch(() => undefined);
      }
    }

    const tempFile = await fileManager.addTemporaryFile({
      originalName: `gif-${safeId}.gif`,
      filePath: safePath,
      size: total,
      userId: ctx.userId
    });

    await applyProfileMedia(ctx, input.target, tempFile.id);
  });

export { importToProfileRoute };
