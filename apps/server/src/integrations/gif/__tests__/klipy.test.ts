import { afterEach, describe, expect, mock, test } from 'bun:test';
import { createKlipyProvider } from '../klipy';

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe('KlipyProvider', () => {
  test('search maps Klipy response to normalized results', async () => {
    globalThis.fetch = mock(
      async () =>
        new Response(
          JSON.stringify({
            result: true,
            data: {
              data: [
                {
                  slug: 'abc',
                  title: 'cat',
                  file: {
                    gif: {
                      url: 'https://cdn.klipy.com/abc.gif',
                      width: 200,
                      height: 150
                    }
                  },
                  files: {
                    gif_url: 'https://cdn.klipy.com/abc.gif',
                    thumbnail_url: 'https://cdn.klipy.com/abc-thumb.gif'
                  }
                }
              ],
              current_page: 1,
              per_page: 24,
              has_next: true
            }
          }),
          { status: 200, headers: { 'content-type': 'application/json' } }
        )
    ) as unknown as typeof fetch;

    const provider = createKlipyProvider('TEST_KEY');
    const page = await provider.search({ query: 'cat', page: 1, perPage: 24 });

    expect(page.results).toHaveLength(1);
    expect(page.results[0]!.id).toBe('abc');
    expect(page.results[0]!.previewUrl).toContain('klipy.com');
    expect(page.hasNext).toBe(true);
  });

  test('search throws on non-ok response', async () => {
    globalThis.fetch = mock(
      async () => new Response('nope', { status: 500 })
    ) as unknown as typeof fetch;
    const provider = createKlipyProvider('TEST_KEY');
    await expect(
      provider.search({ query: 'cat', page: 1, perPage: 24 })
    ).rejects.toThrow();
  });
});
