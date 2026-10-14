import type { TVersionInfo } from '@bullshark/shared';
import { validateReleaseMetadata } from '@bullshark/shared';

// Les binaires et release.json ne sont publies que sur GitHub Releases : la
// release Codeberg est volontairement sans asset (quota de stockage, voir
// .github/workflows/release.yml). L'updater lisait Codeberg et ne trouvait
// donc jamais release.json, du 2026-06-18 au 2026-10-14.
const GITHUB_API_BASE = 'https://api.github.com';
const REPO_OWNER = 'Neckript';
const REPO_NAME = 'bullshark';

type GithubAsset = {
  name: string;
  browser_download_url: string;
  size?: number;
};

type GithubRelease = {
  tag_name: string;
  assets: GithubAsset[];
};

type ReleaseDeps = { fetch: typeof fetch };

const fetchLatestRelease = async (
  deps: ReleaseDeps = { fetch }
): Promise<GithubRelease> => {
  const url = `${GITHUB_API_BASE}/repos/${REPO_OWNER}/${REPO_NAME}/releases/latest`;
  const res = await deps.fetch(url, {
    headers: {
      Accept: 'application/vnd.github+json',
      // GitHub refuse les requetes d'API sans User-Agent.
      'User-Agent': 'bullshark-server'
    }
  });

  if (!res.ok) {
    throw new Error(`GitHub releases/latest failed: ${res.status}`);
  }

  return (await res.json()) as GithubRelease;
};

const findAsset = (
  release: GithubRelease,
  name: string
): GithubAsset | undefined => release.assets.find((a) => a.name === name);

const fetchReleaseMetadata = async (
  release: GithubRelease,
  deps: ReleaseDeps = { fetch }
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
  fetchLatestRelease,
  fetchReleaseMetadata,
  findAsset,
  GITHUB_API_BASE,
  REPO_NAME,
  REPO_OWNER
};
export type { GithubAsset, GithubRelease, ReleaseDeps };
