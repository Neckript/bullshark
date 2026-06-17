import type { TVersionInfo } from '@sharkord/shared';
import { validateReleaseMetadata } from '@sharkord/shared';

const CODEBERG_API_BASE = 'https://codeberg.org/api/v1';
const REPO_OWNER = 'The_Neckript';
const REPO_NAME = 'bullshark';

type ForgejoAsset = {
  name: string;
  browser_download_url: string;
  size?: number;
};

type ForgejoRelease = {
  tag_name: string;
  assets: ForgejoAsset[];
};

type ForgejoDeps = { fetch: typeof fetch };

const fetchLatestRelease = async (
  deps: ForgejoDeps = { fetch }
): Promise<ForgejoRelease> => {
  const url = `${CODEBERG_API_BASE}/repos/${REPO_OWNER}/${REPO_NAME}/releases/latest`;
  const res = await deps.fetch(url, {
    headers: { Accept: 'application/json' }
  });

  if (!res.ok) {
    throw new Error(`Forgejo releases/latest failed: ${res.status}`);
  }

  return (await res.json()) as ForgejoRelease;
};

const findAsset = (
  release: ForgejoRelease,
  name: string
): ForgejoAsset | undefined => release.assets.find((a) => a.name === name);

const fetchReleaseMetadata = async (
  release: ForgejoRelease,
  deps: ForgejoDeps = { fetch }
): Promise<TVersionInfo> => {
  const asset = findAsset(release, 'release.json');

  if (!asset) {
    throw new Error('release.json asset not found in the latest release');
  }

  const res = await deps.fetch(asset.browser_download_url);

  if (!res.ok) {
    throw new Error(`download release.json failed: ${res.status}`);
  }

  return validateReleaseMetadata(await res.json());
};

export {
  CODEBERG_API_BASE,
  fetchLatestRelease,
  fetchReleaseMetadata,
  findAsset,
  REPO_NAME,
  REPO_OWNER
};
export type { ForgejoAsset, ForgejoDeps, ForgejoRelease };
