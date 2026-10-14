import { getErrorMessage } from '@bullshark/shared';
import chalk from 'chalk';
import { removeFile } from '../db/mutations/files';
import { getOrphanedFileIds } from '../db/queries/files';
import { sweepStaleEntries } from '../helpers/fs';
import { TMP_PATH, UPLOADS_PATH } from '../helpers/paths';
import { logger } from '../logger';

// An upload's temporary file is tracked by an in-memory timer
// (file-manager.ts, TEMP_FILE_TTL = 1 minute), so a crash or a redeploy loses
// the timer and strands the file on disk forever. This sweep is the backstop,
// and it runs at boot too because the cron is registered with runOnInit.
//
// 60x the TTL: nothing a running server still cares about in tmp/ or uploads/
// can be an hour old, so the sweep does not need to cross-check the in-memory
// list. A plugin download rebuilds tmp/downloads with ensureDir, and a restore
// stages outside both directories, so neither can be broken by this.
const STALE_FILE_MAX_AGE = 1000 * 60 * 60; // 1 hour

const sweepStagingDirs = async () => {
  const onError = (entryPath: string, error: unknown) =>
    logger.error(
      `${chalk.dim('[Cron]')} Could not sweep %s: %s`,
      entryPath,
      getErrorMessage(error)
    );

  const [tmpRemoved, uploadsRemoved] = await Promise.all([
    sweepStaleEntries(TMP_PATH, STALE_FILE_MAX_AGE, { onError }),
    sweepStaleEntries(UPLOADS_PATH, STALE_FILE_MAX_AGE, { onError })
  ]);

  const total = tmpRemoved + uploadsRemoved;

  if (total === 0) {
    logger.debug(`${chalk.dim('[Cron]')} No stale staging files found.`);

    return;
  }

  logger.info(
    `${chalk.dim('[Cron]')} Swept %d stale staging entries (tmp: %d, uploads: %d).`,
    total,
    tmpRemoved,
    uploadsRemoved
  );
};

const cleanupFiles = async () => {
  logger.debug(`${chalk.dim('[Cron]')} Starting file cleanup...`);

  await sweepStagingDirs();

  const orphanedFileIds = await getOrphanedFileIds();

  if (orphanedFileIds.length === 0) {
    logger.debug(`${chalk.dim('[Cron]')} No orphaned files found.`);
    return;
  }

  logger.info(
    `${chalk.dim('[Cron]')} Found ${orphanedFileIds.length} orphaned files. Cleaning up...`
  );

  const promises = orphanedFileIds.map(async (fileId) => {
    await removeFile(fileId);
  });

  await Promise.all(promises);

  logger.info(
    `${chalk.dim('[Cron]')} Cleaned up ${orphanedFileIds.length} orphaned files.`
  );
};

export { cleanupFiles };
