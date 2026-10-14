import fs from 'fs/promises';
import os from 'os';
import path from 'path';

const ensureDir = async (path: string) => {
  await fs.mkdir(path, { recursive: true });
};

/**
 * Remove every top-level entry of `dir` whose mtime is older than
 * `maxAgeMs`. Returns how many were removed.
 *
 * A missing directory is not an error: it only means nothing has been written
 * there yet. A single entry that cannot be stat'ed or removed is reported by
 * `onError` and does not stop the sweep - one unreadable leftover must not
 * keep the rest of the disk filling up.
 */
const sweepStaleEntries = async (
  dir: string,
  maxAgeMs: number,
  {
    now = Date.now(),
    onError
  }: {
    now?: number;
    onError?: (entryPath: string, error: unknown) => void;
  } = {}
): Promise<number> => {
  let entries: string[];

  try {
    entries = await fs.readdir(dir);
  } catch {
    return 0;
  }

  let removed = 0;

  for (const entry of entries) {
    const entryPath = path.join(dir, entry);

    try {
      const { mtimeMs } = await fs.stat(entryPath);

      if (now - mtimeMs < maxAgeMs) continue;

      await fs.rm(entryPath, { recursive: true, force: true });

      removed += 1;
    } catch (error) {
      onError?.(entryPath, error);
    }
  }

  return removed;
};

const getAppDataPath = (): string => {
  const platform = process.platform;

  if (platform === 'win32') {
    // Windows → C:\Users\<User>\AppData\Roaming
    return process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming');
  }

  if (platform === 'darwin') {
    // macOS → ~/Library/Application Support
    return path.join(os.homedir(), 'Library', 'Application Support');
  }

  // Linux → ~/.config
  return process.env.XDG_CONFIG_HOME || path.join(os.homedir(), '.config');
};

export { ensureDir, getAppDataPath, sweepStaleEntries };
