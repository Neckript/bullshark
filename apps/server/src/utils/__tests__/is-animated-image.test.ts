import { randomUUIDv7 } from 'bun';
import { afterEach, describe, expect, test } from 'bun:test';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { isAnimatedImage } from '../is-animated-image';

const createdPaths: string[] = [];

const writeTemp = async (name: string, bytes: number[]): Promise<string> => {
  const p = path.join(os.tmpdir(), `${randomUUIDv7()}-${name}`);
  await fs.writeFile(p, new Uint8Array(bytes));
  createdPaths.push(p);
  return p;
};

afterEach(async () => {
  await Promise.all(
    createdPaths.splice(0).map((p) => fs.unlink(p).catch(() => undefined))
  );
});

const HEADER = [0x47, 0x49, 0x46, 0x38, 0x39, 0x61]; // GIF89a
const LSD_GCT = [0x01, 0x00, 0x01, 0x00, 0x80, 0x00, 0x00]; // 1x1, GCT present, size 0
const GCT = [0x00, 0x00, 0x00, 0xff, 0xff, 0xff]; // 2 entries
const NETSCAPE = [
  0x21, 0xff, 0x0b, 0x4e, 0x45, 0x54, 0x53, 0x43, 0x41, 0x50, 0x45, 0x32, 0x2e,
  0x30, 0x03, 0x01, 0x00, 0x00, 0x00
];
const GCE = [0x21, 0xf9, 0x04, 0x00, 0x00, 0x00, 0x00, 0x00];
const IMG_DESC = [0x2c, 0x00, 0x00, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00];
const LZW_MIN = [0x02];
const DATA_NORMAL = [0x02, 0x44, 0x01, 0x00]; // sub-block (len 2) + terminator
const DATA_WITH_2C = [0x03, 0x2c, 0x00, 0x01, 0x00]; // sub-block contains 0x2C, + terminator
const TRAILER = [0x3b];

const FRAME_NORMAL = [...GCE, ...IMG_DESC, ...LZW_MIN, ...DATA_NORMAL];
const FRAME_WITH_2C = [...GCE, ...IMG_DESC, ...LZW_MIN, ...DATA_WITH_2C];

// Two top-level image descriptors, no NETSCAPE block — exercises the grammar walk.
const ANIMATED_GIF_FRAMES = [
  ...HEADER,
  ...LSD_GCT,
  ...GCT,
  ...FRAME_NORMAL,
  ...FRAME_NORMAL,
  ...TRAILER
];

// One frame but a NETSCAPE looping extension — exercises the fast path.
const ANIMATED_GIF_NETSCAPE = [
  ...HEADER,
  ...LSD_GCT,
  ...GCT,
  ...NETSCAPE,
  ...FRAME_NORMAL,
  ...TRAILER
];

// One frame whose pixel data contains a 0x2C byte — must NOT be seen as animated.
const STATIC_GIF_WITH_2C_DATA = [
  ...HEADER,
  ...LSD_GCT,
  ...GCT,
  ...FRAME_WITH_2C,
  ...TRAILER
];

// One frame, no GCT, no animation markers.
const STATIC_GIF = [
  ...HEADER,
  0x01,
  0x00,
  0x01,
  0x00,
  0x00,
  0x00,
  0x00,
  ...FRAME_NORMAL,
  ...TRAILER
];

const ANIMATED_WEBP = [
  0x52, 0x49, 0x46, 0x46, 0x20, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50, 0x56,
  0x50, 0x38, 0x58, 0x0a, 0x00, 0x00, 0x00, 0x02, 0x00, 0x00, 0x00, 0x00, 0x00,
  0x00, 0x00, 0x00, 0x00, 0x41, 0x4e, 0x49, 0x4d
];

const APNG = [
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x08, 0x61,
  0x63, 0x54, 0x4c, 0x00, 0x00, 0x00, 0x02, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
  0x00, 0x00
];

const STATIC_PNG = [
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49,
  0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, 0x08, 0x06,
  0x00, 0x00, 0x00
];

describe('isAnimatedImage', () => {
  test('detects multi-frame animated GIF (grammar walk)', async () => {
    const p = await writeTemp('a.gif', ANIMATED_GIF_FRAMES);
    expect(await isAnimatedImage(p)).toBe(true);
  });

  test('detects animated GIF via NETSCAPE extension (fast path)', async () => {
    const p = await writeTemp('n.gif', ANIMATED_GIF_NETSCAPE);
    expect(await isAnimatedImage(p)).toBe(true);
  });

  test('static GIF is not animated', async () => {
    const p = await writeTemp('s.gif', STATIC_GIF);
    expect(await isAnimatedImage(p)).toBe(false);
  });

  test('static GIF with 0x2C in pixel data is not animated (no false positive)', async () => {
    const p = await writeTemp('s2c.gif', STATIC_GIF_WITH_2C_DATA);
    expect(await isAnimatedImage(p)).toBe(false);
  });

  test('detects animated WebP', async () => {
    const p = await writeTemp('a.webp', ANIMATED_WEBP);
    expect(await isAnimatedImage(p)).toBe(true);
  });

  test('detects APNG', async () => {
    const p = await writeTemp('a.png', APNG);
    expect(await isAnimatedImage(p)).toBe(true);
  });

  test('static PNG is not animated', async () => {
    const p = await writeTemp('s.png', STATIC_PNG);
    expect(await isAnimatedImage(p)).toBe(false);
  });
});
