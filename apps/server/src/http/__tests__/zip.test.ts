import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import fs from 'fs/promises';
import { createWriteStream } from 'fs';
import os from 'os';
import path from 'path';
import yazl from 'yazl';
import { addDirToZip, extractZipEntries } from '../zip';

let workDir: string;

beforeEach(async () => {
  workDir = await fs.mkdtemp(path.join(os.tmpdir(), 'zip-test-'));
});

afterEach(async () => {
  await fs.rm(workDir, { recursive: true, force: true });
});

// yazl validates metadata paths and refuses to create an entry containing
// '..' segments, so a malicious fixture can't be built through its API.
// Hand-craft a minimal (stored, uncompressed) single-entry ZIP instead.
const crc32 = (buf: Buffer): number => {
  let crc = ~0;
  for (const byte of buf) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) {
      crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
    }
  }
  return ~crc >>> 0;
};

const buildZipWithRawEntryName = (entryName: string, content: Buffer): Buffer => {
  const name = Buffer.from(entryName, 'utf8');
  const crc = crc32(content);

  const localHeader = Buffer.alloc(30);
  localHeader.writeUInt32LE(0x04034b50, 0);
  localHeader.writeUInt16LE(20, 4);
  localHeader.writeUInt16LE(0, 6);
  localHeader.writeUInt16LE(0, 8);
  localHeader.writeUInt16LE(0, 10);
  localHeader.writeUInt16LE(0, 12);
  localHeader.writeUInt32LE(crc, 14);
  localHeader.writeUInt32LE(content.length, 18);
  localHeader.writeUInt32LE(content.length, 22);
  localHeader.writeUInt16LE(name.length, 26);
  localHeader.writeUInt16LE(0, 28);
  const localRecord = Buffer.concat([localHeader, name, content]);

  const centralHeader = Buffer.alloc(46);
  centralHeader.writeUInt32LE(0x02014b50, 0);
  centralHeader.writeUInt16LE(20, 4);
  centralHeader.writeUInt16LE(20, 6);
  centralHeader.writeUInt16LE(0, 8);
  centralHeader.writeUInt16LE(0, 10);
  centralHeader.writeUInt16LE(0, 12);
  centralHeader.writeUInt16LE(0, 14);
  centralHeader.writeUInt32LE(crc, 16);
  centralHeader.writeUInt32LE(content.length, 20);
  centralHeader.writeUInt32LE(content.length, 24);
  centralHeader.writeUInt16LE(name.length, 28);
  centralHeader.writeUInt16LE(0, 30);
  centralHeader.writeUInt16LE(0, 32);
  centralHeader.writeUInt16LE(0, 34);
  centralHeader.writeUInt16LE(0, 36);
  centralHeader.writeUInt32LE(0, 38);
  centralHeader.writeUInt32LE(0, 42);
  const centralRecord = Buffer.concat([centralHeader, name]);

  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(0, 4);
  eocd.writeUInt16LE(0, 6);
  eocd.writeUInt16LE(1, 8);
  eocd.writeUInt16LE(1, 10);
  eocd.writeUInt32LE(centralRecord.length, 12);
  eocd.writeUInt32LE(localRecord.length, 16);
  eocd.writeUInt16LE(0, 20);

  return Buffer.concat([localRecord, centralRecord, eocd]);
};

describe('addDirToZip + extractZipEntries round-trip', () => {
  test('preserves nested files and contents', async () => {
    const srcDir = path.join(workDir, 'src');
    await fs.mkdir(path.join(srcDir, 'nested'), { recursive: true });
    await fs.writeFile(path.join(srcDir, 'a.txt'), 'AAA');
    await fs.writeFile(path.join(srcDir, 'nested', 'b.txt'), 'BBB');

    const zipPath = path.join(workDir, 'out.zip');
    const zip = new yazl.ZipFile();
    await addDirToZip(zip, srcDir, 'public');
    zip.end();

    await new Promise<void>((resolve, reject) => {
      const out = createWriteStream(zipPath);
      zip.outputStream.pipe(out);
      out.on('close', resolve);
      out.on('error', reject);
    });

    const destDir = path.join(workDir, 'dest');
    const entryNames = await extractZipEntries(zipPath, destDir);

    expect(entryNames.sort()).toEqual(
      ['public/a.txt', 'public/nested/b.txt'].sort()
    );
    expect(await fs.readFile(path.join(destDir, 'public', 'a.txt'), 'utf8')).toBe('AAA');
    expect(await fs.readFile(path.join(destDir, 'public', 'nested', 'b.txt'), 'utf8')).toBe('BBB');
  });

  test('extractZipEntries rejects entries that escape the destination', async () => {
    const zipPath = path.join(workDir, 'evil.zip');
    const zipBuf = buildZipWithRawEntryName('../escape.txt', Buffer.from('PWNED'));
    await fs.writeFile(zipPath, zipBuf);

    const destDir = path.join(workDir, 'dest');
    await expect(extractZipEntries(zipPath, destDir)).rejects.toThrow(/unsafe/i);
  });
});
