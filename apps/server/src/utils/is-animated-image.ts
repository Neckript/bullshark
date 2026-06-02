import fs from 'fs/promises';

const READ_BYTES = 64 * 1024; // first 64KB is enough to detect animation markers

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

const isAnimatedGif = (buf: Buffer): boolean => {
  if (buf.length < 6 || buf.toString('ascii', 0, 3) !== 'GIF') return false;
  let frames = 0;
  for (let i = 0; i < buf.length - 1; i++) {
    if (buf[i] === 0x2c) frames++;
    if (frames > 1) return true;
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
  return buf.includes(Buffer.from('ANIM', 'ascii'));
};

const isApng = (buf: Buffer): boolean => {
  const PNG_SIG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  if (buf.length < 8 || !buf.subarray(0, 8).equals(PNG_SIG)) return false;
  const actl = buf.indexOf(Buffer.from('acTL', 'ascii'));
  const idat = buf.indexOf(Buffer.from('IDAT', 'ascii'));
  return actl !== -1 && (idat === -1 || actl < idat);
};

const isAnimatedImage = async (filePath: string): Promise<boolean> => {
  const buf = await readHead(filePath);
  return isAnimatedGif(buf) || isAnimatedWebp(buf) || isApng(buf);
};

export { isAnimatedImage };
