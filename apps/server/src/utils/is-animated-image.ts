import fs from 'fs/promises';

const READ_BYTES = 64 * 1024; // first 64KB is enough to detect animation markers

const PNG_SIG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const ANIM_CHUNK = Buffer.from('ANIM', 'ascii');
const NETSCAPE_EXT = Buffer.from('NETSCAPE2.0', 'ascii');
const ACTL_CHUNK = Buffer.from('acTL', 'ascii');
const IDAT_CHUNK = Buffer.from('IDAT', 'ascii');

const readHead = async (filePath: string): Promise<Buffer> => {
  const handle = await fs.open(filePath, 'r');
  try {
    const buf = Buffer.alloc(READ_BYTES);
    const { bytesRead } = await handle.read(buf, 0, READ_BYTES, 0);
    return buf.subarray(0, bytesRead);
  } finally {
    await handle.close();
  }
};

// Walk GIF sub-blocks starting at p (a series of length-prefixed chunks ending with a 0 length).
const skipSubBlocks = (buf: Buffer, p: number): number => {
  while (p < buf.length) {
    const len = buf[p] as number;
    p += 1;
    if (len === 0) break;
    p += len;
  }
  return p;
};

const isAnimatedGif = (buf: Buffer): boolean => {
  if (buf.length < 13 || buf.toString('ascii', 0, 3) !== 'GIF') return false;

  // Fast path: the looping application extension reliably marks animated GIFs and
  // sits near the start, so it is found even when frame data exceeds the sniff window.
  if (buf.includes(NETSCAPE_EXT)) return true;

  const packed = buf[10] as number;
  const gctFlag = (packed & 0x80) !== 0;
  const gctSize = packed & 0x07;
  let pos = 13;
  if (gctFlag) {
    pos += 3 * (1 << (gctSize + 1));
  }

  let frames = 0;
  while (pos < buf.length) {
    const block = buf[pos];

    if (block === 0x3b) break; // trailer

    if (block === 0x2c) {
      frames += 1;
      if (frames > 1) return true;
      const imgPacked = buf[pos + 9] as number;
      pos += 10; // image descriptor: introducer + 9 bytes
      const lctFlag = (imgPacked & 0x80) !== 0;
      const lctSize = imgPacked & 0x07;
      if (lctFlag) pos += 3 * (1 << (lctSize + 1));
      pos += 1; // LZW minimum code size
      pos = skipSubBlocks(buf, pos);
    } else if (block === 0x21) {
      pos += 2; // extension introducer + label
      pos = skipSubBlocks(buf, pos);
    } else {
      break; // malformed / unknown — stop to avoid runaway scanning
    }
  }

  return false;
};

const isAnimatedWebp = (buf: Buffer): boolean => {
  if (
    buf.length < 16 ||
    buf.toString('ascii', 0, 4) !== 'RIFF' ||
    buf.toString('ascii', 8, 12) !== 'WEBP'
  ) {
    return false;
  }
  return buf.includes(ANIM_CHUNK);
};

const isApng = (buf: Buffer): boolean => {
  if (buf.length < 8 || !buf.subarray(0, 8).equals(PNG_SIG)) return false;
  const actl = buf.indexOf(ACTL_CHUNK);
  const idat = buf.indexOf(IDAT_CHUNK);
  return actl !== -1 && (idat === -1 || actl < idat);
};

const isAnimatedImage = async (filePath: string): Promise<boolean> => {
  const buf = await readHead(filePath);
  return isAnimatedGif(buf) || isAnimatedWebp(buf) || isApng(buf);
};

export { isAnimatedImage };
