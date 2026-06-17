import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { sha256File, verifyChecksum } from '../verify';

// sha256 of the bytes "hello"
const HELLO_SHA256 =
  '2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824';

let dir: string;
let file: string;

beforeEach(async () => {
  dir = await fs.mkdtemp(path.join(os.tmpdir(), 'verify-'));
  file = path.join(dir, 'f.bin');
  await fs.writeFile(file, 'hello');
});

afterEach(async () => {
  await fs.rm(dir, { recursive: true, force: true });
});

describe('sha256File', () => {
  test('computes the sha256 hex of a file', async () => {
    expect(await sha256File(file)).toBe(HELLO_SHA256);
  });
});

describe('verifyChecksum', () => {
  test('true on a matching checksum', async () => {
    expect(await verifyChecksum(file, HELLO_SHA256)).toBe(true);
  });
  test('false on a mismatch', async () => {
    expect(await verifyChecksum(file, 'deadbeef')).toBe(false);
  });
});
