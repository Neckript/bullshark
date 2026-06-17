import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { swapBinary } from '../swap';

let dir: string;
let target: string;

beforeEach(async () => {
  dir = await fs.mkdtemp(path.join(os.tmpdir(), 'swap-'));
  target = path.join(dir, 'server-bin');
  await fs.writeFile(target, 'OLD_BINARY');
});

afterEach(async () => {
  await fs.rm(dir, { recursive: true, force: true });
});

const okResponse = (bytes: string) =>
  ({ ok: true, status: 200, arrayBuffer: async () => new TextEncoder().encode(bytes).buffer }) as Response;

describe('swapBinary', () => {
  test('replaces the target when the checksum matches', async () => {
    // compute the real checksum of "NEW_BINARY" at runtime
    const tmp = path.join(dir, 'probe');
    await fs.writeFile(tmp, 'NEW_BINARY');
    const { sha256File } = await import('../verify');
    const checksum = await sha256File(tmp);
    await fs.rm(tmp);

    const fetchImpl = (async () =>
      okResponse('NEW_BINARY')) as unknown as typeof fetch;

    await swapBinary(
      {
        downloadUrl: 'https://cb/new',
        expectedChecksum: checksum,
        targetPath: target
      },
      { fetch: fetchImpl }
    );

    expect(await fs.readFile(target, 'utf8')).toBe('NEW_BINARY');
  });

  test('leaves the target intact and throws on a checksum mismatch', async () => {
    const fetchImpl = (async () =>
      okResponse('NEW_BINARY')) as unknown as typeof fetch;

    await expect(
      swapBinary(
        {
          downloadUrl: 'https://cb/new',
          expectedChecksum: 'deadbeef',
          targetPath: target
        },
        { fetch: fetchImpl }
      )
    ).rejects.toThrow(/checksum/i);

    expect(await fs.readFile(target, 'utf8')).toBe('OLD_BINARY');
    const leftovers = (await fs.readdir(dir)).filter((n) =>
      n.startsWith('.update-')
    );
    expect(leftovers).toEqual([]);
  });
});
