import path from 'path';
import { migrateLegacyDataDirectory } from './data-dir-migration';
import { ensureDir } from './fs';
import * as serverPaths from './paths';

const ensureServerDirs = async () => {
  // Must run before the directory-creation loop below, and before anything
  // else reads from DATA_PATH: once that loop (or any reader) creates the
  // current directory, it's no longer empty and the migration below treats
  // it as authoritative, leaving the legacy directory - and the data in it
  // - behind untouched.
  const legacyDataDirCandidate = serverPaths.LEGACY_DATA_DIR_CANDIDATE;

  if (legacyDataDirCandidate) {
    await migrateLegacyDataDirectory(
      legacyDataDirCandidate,
      serverPaths.DATA_PATH
    );
  }

  const pathsList = Object.values(serverPaths);
  const IGNORE_LIST = [
    serverPaths.SRC_MIGRATIONS_PATH,
    serverPaths.MEDIASOUP_BINARY_PATH,
    serverPaths.LEGACY_DATA_DIR_CANDIDATE
  ];

  const promises = pathsList.map(async (dir) => {
    if (!dir || typeof dir !== 'string') return;

    const resolvedPath = path.resolve(process.cwd(), dir);
    const extension = path.extname(resolvedPath);

    if (extension || IGNORE_LIST.includes(resolvedPath)) return;

    await ensureDir(resolvedPath);
  });

  await Promise.all(promises);
};

export { ensureServerDirs };
