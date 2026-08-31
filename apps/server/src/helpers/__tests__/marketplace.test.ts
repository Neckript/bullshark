import { afterEach, describe, expect, mock, test } from 'bun:test';
import { config } from '../../config';
import { fetchMarketplaceRegistry } from '../marketplace';

const originalUrl = config.plugins.marketplaceRegistryUrl;
const originalFetch = globalThis.fetch;

const validEntry = {
  plugin: {
    id: 'plugin-a',
    name: 'Plugin A',
    description: 'A test plugin',
    author: 'Someone',
    logo: 'https://example.com/logo.png',
    verified: true
  },
  versions: [
    {
      version: '1.0.0',
      downloadUrl: 'https://example.com/plugin-a-1.0.0.tar.gz',
      checksum: 'deadbeef',
      sdkVersion: 1,
      size: 1000,
      timestamp: 1
    }
  ]
};

describe('fetchMarketplaceRegistry', () => {
  afterEach(() => {
    config.plugins.marketplaceRegistryUrl = originalUrl;
    globalThis.fetch = originalFetch;
  });

  test('empty URL renders [] without making a request', async () => {
    config.plugins.marketplaceRegistryUrl = '';

    const fetchMock = mock(() => Promise.resolve(new Response('[]')));
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const entries = await fetchMarketplaceRegistry({ refresh: true });

    expect(entries).toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test('non-OK response throws an explicit error', async () => {
    globalThis.fetch = mock(() =>
      Promise.resolve(new Response('nope', { status: 500 }))
    ) as unknown as typeof fetch;

    await expect(
      fetchMarketplaceRegistry({ refresh: true })
    ).rejects.toThrow('HTTP 500');
  });

  test('a body that is not an array throws an explicit error', async () => {
    globalThis.fetch = mock(() =>
      Promise.resolve(new Response(JSON.stringify({ not: 'an array' })))
    ) as unknown as typeof fetch;

    await expect(
      fetchMarketplaceRegistry({ refresh: true })
    ).rejects.toThrow();
  });

  test('invalid entries are discarded, valid entries are returned', async () => {
    globalThis.fetch = mock(() =>
      Promise.resolve(
        new Response(JSON.stringify([validEntry, { garbage: true }]))
      )
    ) as unknown as typeof fetch;

    const entries = await fetchMarketplaceRegistry({ refresh: true });

    expect(entries).toHaveLength(1);
    expect(entries[0]!.plugin.id).toBe('plugin-a');
  });

  test('two calls close together make a single HTTP request', async () => {
    const fetchMock = mock(() =>
      Promise.resolve(new Response(JSON.stringify([validEntry])))
    );
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    await fetchMarketplaceRegistry({ refresh: true });
    await fetchMarketplaceRegistry();

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  test('refresh: true issues a new request', async () => {
    const fetchMock = mock(() =>
      Promise.resolve(new Response(JSON.stringify([validEntry])))
    );
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    await fetchMarketplaceRegistry({ refresh: true });
    await fetchMarketplaceRegistry({ refresh: true });

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
