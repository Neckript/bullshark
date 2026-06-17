import { describe, expect, test } from 'bun:test';
import {
  fetchLatestRelease,
  fetchReleaseMetadata,
  findAsset,
  type ForgejoRelease
} from '../forgejo';

const release: ForgejoRelease = {
  tag_name: 'v1.2.3',
  assets: [
    { name: 'release.json', browser_download_url: 'https://cb/release.json' },
    {
      name: 'bullshark-linux-x64',
      browser_download_url: 'https://cb/bullshark-linux-x64'
    }
  ]
};

const metadata = {
  version: '1.2.3',
  releaseDate: '2026-06-17T12:00:00.000Z',
  artifacts: [
    { name: 'bullshark-linux-x64', target: 'linux-x64', size: 1, checksum: 'h' }
  ]
};

const jsonResponse = (body: unknown, ok = true) =>
  ({ ok, status: ok ? 200 : 500, json: async () => body }) as Response;

describe('findAsset', () => {
  test('finds an asset by exact name', () => {
    expect(findAsset(release, 'release.json')?.browser_download_url).toBe(
      'https://cb/release.json'
    );
  });
  test('returns undefined when absent', () => {
    expect(findAsset(release, 'nope')).toBeUndefined();
  });
});

describe('fetchLatestRelease', () => {
  test('GETs the Forgejo latest-release endpoint and returns the JSON', async () => {
    let calledUrl = '';
    const fetchImpl = (async (url: string) => {
      calledUrl = url;
      return jsonResponse(release);
    }) as unknown as typeof fetch;

    const result = await fetchLatestRelease({ fetch: fetchImpl });
    expect(calledUrl).toBe(
      'https://codeberg.org/api/v1/repos/The_Neckript/bullshark/releases/latest'
    );
    expect(result.tag_name).toBe('v1.2.3');
  });

  test('throws on a non-ok response', async () => {
    const fetchImpl = (async () =>
      jsonResponse({}, false)) as unknown as typeof fetch;
    await expect(fetchLatestRelease({ fetch: fetchImpl })).rejects.toThrow();
  });
});

describe('fetchReleaseMetadata', () => {
  test('downloads + validates the release.json asset', async () => {
    const fetchImpl = (async (url: string) => {
      if (url === 'https://cb/release.json') return jsonResponse(metadata);
      throw new Error(`unexpected url ${url}`);
    }) as unknown as typeof fetch;

    const result = await fetchReleaseMetadata(release, { fetch: fetchImpl });
    expect(result.version).toBe('1.2.3');
  });

  test('throws when release.json asset is missing', async () => {
    const fetchImpl = (async () => jsonResponse({})) as unknown as typeof fetch;
    await expect(
      fetchReleaseMetadata({ tag_name: 'v1', assets: [] }, { fetch: fetchImpl })
    ).rejects.toThrow(/release\.json/);
  });
});
