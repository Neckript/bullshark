import type { TTempFile } from '@bullshark/shared';
import fs from 'fs/promises';
import { getGifProvider } from '../../integrations/gif';
import { fileManager } from '../../utils/file-manager';

const MAX_BYTES = 8 * 1024 * 1024; // hard cap during download
const ALLOWED_CONTENT_TYPES = [
  'image/gif',
  'image/webp',
  'image/png',
  'image/jpeg'
];

// Resolves a Klipy gifId to its media URL, downloads it into a temporary
// file the same way a regular upload would, and returns the TTempFile.
// Shared by import-to-profile (target: avatar/banner) and import-to-message
// (target: a chat message attachment).
const downloadGif = async (
  gifId: string,
  userId: number
): Promise<TTempFile> => {
  const provider = await getGifProvider();
  if (!provider) {
    throw new Error('GIF import is not configured on this server.');
  }

  const mediaUrl = await provider.resolveMediaUrl(gifId);
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
  if (!ALLOWED_CONTENT_TYPES.some((type) => contentType.startsWith(type))) {
    throw new Error('Downloaded file is not an allowed image type.');
  }

  const safeId = gifId.replace(/[^a-zA-Z0-9_-]/g, '_');
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

  return fileManager.addTemporaryFile({
    originalName: `gif-${safeId}.gif`,
    filePath: safePath,
    size: total,
    userId
  });
};

export { downloadGif };
