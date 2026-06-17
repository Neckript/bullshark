import fs from 'fs/promises';
import path from 'path';
import type { ForgejoDeps } from './forgejo';
import { verifyChecksum } from './verify';

type SwapArgs = {
  downloadUrl: string;
  expectedChecksum: string;
  targetPath: string;
};

const downloadToTemp = async (
  downloadUrl: string,
  targetPath: string,
  deps: ForgejoDeps
): Promise<string> => {
  const tempPath = path.join(
    path.dirname(targetPath),
    `.update-${Date.now()}.tmp`
  );
  const res = await deps.fetch(downloadUrl);

  if (!res.ok) {
    throw new Error(`download binary failed: ${res.status}`);
  }

  const bytes = new Uint8Array(await res.arrayBuffer());
  await fs.writeFile(tempPath, bytes);
  return tempPath;
};

const swapBinary = async (
  args: SwapArgs,
  deps: ForgejoDeps = { fetch }
): Promise<void> => {
  const tempPath = await downloadToTemp(
    args.downloadUrl,
    args.targetPath,
    deps
  );

  try {
    if (!(await verifyChecksum(tempPath, args.expectedChecksum))) {
      throw new Error('checksum mismatch — refusing to install update');
    }

    await fs.chmod(tempPath, 0o755);
    await fs.rename(tempPath, args.targetPath);
  } catch (error) {
    await fs.rm(tempPath, { force: true });
    throw error;
  }
};

export { swapBinary };
export type { SwapArgs };
