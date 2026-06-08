import { afterEach, describe, expect, mock, test } from 'bun:test';
import { initTest } from '../../__tests__/helpers';
import { tdb } from '../../__tests__/setup';
import { settings } from '../../db/schema';

// Minimal valid animated GIF bytes (two-frame GIF89a)
const ANIMATED_GIF_BYTES = new Uint8Array([
  0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 0x01, 0x00, 0x01, 0x00, 0x80, 0x00, 0x00,
  0x00, 0x00, 0x00, 0xff, 0xff, 0xff, 0x21, 0xff, 0x0b, 0x4e, 0x45, 0x54, 0x53,
  0x43, 0x41, 0x50, 0x45, 0x32, 0x2e, 0x30, 0x03, 0x01, 0x00, 0x00, 0x00, 0x21,
  0xf9, 0x04, 0x00, 0x00, 0x00, 0x00, 0x00, 0x2c, 0x00, 0x00, 0x00, 0x00, 0x01,
  0x00, 0x01, 0x00, 0x00, 0x02, 0x02, 0x44, 0x01, 0x00, 0x21, 0xf9, 0x04, 0x00,
  0x00, 0x00, 0x00, 0x00, 0x2c, 0x00, 0x00, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00,
  0x00, 0x02, 0x02, 0x44, 0x01, 0x00, 0x3b
]);

// Real Klipy shape: media is nested by size (hd/md/sm/xs) → format (gif/jpg/…)
const KLIPY_ITEM = {
  slug: 'abc',
  title: 'cat',
  file: {
    hd: {
      gif: {
        url: 'https://media.klipy.com/abc-hd.gif',
        width: 480,
        height: 480
      }
    },
    md: {
      gif: {
        url: 'https://media.klipy.com/abc-md.gif',
        width: 240,
        height: 240
      }
    },
    sm: {
      gif: {
        url: 'https://media.klipy.com/abc-sm.gif',
        width: 120,
        height: 120
      }
    },
    xs: {
      gif: { url: 'https://media.klipy.com/abc-xs.gif', width: 64, height: 64 },
      jpg: { url: 'https://media.klipy.com/abc-xs.jpg' }
    }
  }
};

const SEARCH_RESPONSE = {
  result: true,
  data: {
    data: [KLIPY_ITEM],
    current_page: 1,
    per_page: 24,
    has_next: false
  }
};

const RESOLVE_RESPONSE = {
  result: true,
  data: KLIPY_ITEM
};

const RESOLVE_UNTRUSTED_RESPONSE = {
  result: true,
  data: {
    slug: 'abc',
    file: {
      md: { gif: { url: 'https://evil.example.com/x.gif' } }
    }
  }
};

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

const makeFetchMock = (resolveResponse: object = RESOLVE_RESPONSE) =>
  mock(async (url: string | URL | Request) => {
    const urlStr =
      typeof url === 'string'
        ? url
        : url instanceof URL
          ? url.toString()
          : url.url;

    // Media download — Klipy CDN host (any size variant)
    if (urlStr.startsWith('https://media.klipy.com/')) {
      return new Response(ANIMATED_GIF_BYTES, {
        status: 200,
        headers: { 'content-type': 'image/gif' }
      });
    }

    // Search endpoint
    if (urlStr.includes('/gifs/search')) {
      return new Response(JSON.stringify(SEARCH_RESPONSE), {
        status: 200,
        headers: { 'content-type': 'application/json' }
      });
    }

    // Single-item resolve endpoint (e.g. /gifs/abc)
    if (urlStr.includes('/gifs/')) {
      return new Response(JSON.stringify(resolveResponse), {
        status: 200,
        headers: { 'content-type': 'application/json' }
      });
    }

    return new Response('Not found', { status: 404 });
  }) as unknown as typeof fetch;

describe('gifs router', () => {
  test('search: rejects when GIF provider not configured (klipyApiKey null)', async () => {
    // klipyApiKey is null by default in seedTestDb
    const { caller } = await initTest(1);

    await expect(caller.gifs.search({ query: 'cat' })).rejects.toThrow(
      'not configured'
    );
  });

  test('search: returns results when klipyApiKey is set', async () => {
    globalThis.fetch = makeFetchMock();

    await tdb.update(settings).set({ klipyApiKey: 'TEST_KEY' }).execute();

    const { caller } = await initTest(1);

    const result = await caller.gifs.search({ query: 'cat' });

    expect(result.results).toHaveLength(1);
    expect(result.results[0]!.id).toBe('abc');
  });

  test('importToProfile: sets avatar when gifId is valid and trusted', async () => {
    globalThis.fetch = makeFetchMock();

    await tdb.update(settings).set({ klipyApiKey: 'TEST_KEY' }).execute();

    // Use owner (userId=1) who has all permissions including MANAGE_USERS for getInfo check
    const { caller } = await initTest(1);

    await caller.gifs.importToProfile({ gifId: 'abc', target: 'avatar' });

    const info = await caller.users.getInfo({ userId: 1 });
    expect(info.user.avatarId).not.toBeNull();
  });

  test('importToProfile: rejects when resolved URL is from untrusted host', async () => {
    globalThis.fetch = makeFetchMock(RESOLVE_UNTRUSTED_RESPONSE);

    await tdb.update(settings).set({ klipyApiKey: 'TEST_KEY' }).execute();

    const { caller } = await initTest(1);

    await expect(
      caller.gifs.importToProfile({ gifId: 'abc', target: 'avatar' })
    ).rejects.toThrow('untrusted');
  });
});
