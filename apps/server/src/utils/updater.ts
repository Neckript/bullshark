import type { TArtifact, TVersionInfo } from '@sharkord/shared';
import { getErrorMessage } from '@sharkord/shared';
import semver from 'semver';
import { config } from '../config';
import { logger } from '../logger';
import { IS_DOCKER, IS_PRODUCTION, IS_TEST, SERVER_VERSION } from './env';
import {
  fetchLatestRelease,
  fetchReleaseMetadata,
  findAsset
} from './updater/forgejo';
import { swapBinary } from './updater/swap';

const UPDATE_CHECK_INTERVAL_MS = 60 * 60 * 1000; // 1 hour

type ServerArch = 'linux-x64' | 'linux-arm64';

const getCurrentArch = (): ServerArch => {
  if (process.platform === 'linux' && process.arch === 'x64')
    return 'linux-x64';
  if (process.platform === 'linux' && process.arch === 'arm64')
    return 'linux-arm64';
  throw new Error(
    `Unsupported server platform/arch for auto-update: ${process.platform}-${process.arch}`
  );
};

// Pure decision: the artifact to install, or null if no applicable newer build.
const selectUpdate = (
  metadata: TVersionInfo,
  arch: ServerArch,
  currentVersion: string
): TArtifact | null => {
  if (!semver.gt(metadata.version, currentVersion)) return null;
  return metadata.artifacts.find((a) => a.target === arch) ?? null;
};

class Updater {
  private isUpdating = false;

  constructor() {
    if (this.canUpdate()) {
      void this.setupAutoUpdater();
    }
  }

  public canUpdate = (): boolean => IS_PRODUCTION && !IS_DOCKER;

  public getLatestVersion = async (): Promise<string> => {
    const release = await fetchLatestRelease();
    const metadata = await fetchReleaseMetadata(release);
    return metadata.version;
  };

  public hasUpdates = async (): Promise<boolean> => {
    const release = await fetchLatestRelease();
    const metadata = await fetchReleaseMetadata(release);
    const artifact = selectUpdate(metadata, getCurrentArch(), SERVER_VERSION);
    return artifact !== null && findAsset(release, artifact.name) !== undefined;
  };

  public update = async (): Promise<void> => {
    if (!this.canUpdate() || this.isUpdating) return;

    this.isUpdating = true;

    try {
      logger.info('Checking for updates...');

      const release = await fetchLatestRelease();
      const metadata = await fetchReleaseMetadata(release);
      const artifact = selectUpdate(metadata, getCurrentArch(), SERVER_VERSION);

      if (!artifact) {
        logger.debug('No update available');
        return;
      }

      const asset = findAsset(release, artifact.name);

      if (!asset) {
        logger.warn(
          'Update metadata references a missing asset: %s',
          artifact.name
        );
        return;
      }

      logger.info('Update %s available, downloading...', metadata.version);

      await swapBinary({
        downloadUrl: asset.browser_download_url,
        expectedChecksum: artifact.checksum,
        targetPath: process.execPath
      });

      logger.info('Update installed, restarting...');

      if (!IS_TEST) {
        const child = Bun.spawn([process.execPath, ...process.argv.slice(2)], {
          stdio: ['inherit', 'inherit', 'inherit'],
          detached: true
        });
        child.unref();
        process.exit(0);
      }
    } catch (error) {
      logger.error('Auto-update failed: %s', getErrorMessage(error));
    } finally {
      this.isUpdating = false;
    }
  };

  private setupAutoUpdater = async (): Promise<void> => {
    if (!config.server.autoupdate) {
      return;
    }

    logger.info(
      `Auto-updater enabled, checking every ${UPDATE_CHECK_INTERVAL_MS / 1000 / 60} minutes`
    );

    await this.update();

    setInterval(this.update, UPDATE_CHECK_INTERVAL_MS);
  };
}

const updater = new Updater();

export { selectUpdate, updater };
