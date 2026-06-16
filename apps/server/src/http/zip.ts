import { createWriteStream } from 'fs';
import fs from 'fs/promises';
import path from 'path';
import yauzl from 'yauzl';
import type * as yazl from 'yazl';

// Recursively add every file under `dir` to `zip` under `<zipPrefix>/<relpath>`.
// Zip entry names always use forward slashes regardless of host OS.
const addDirToZip = async (
  zip: yazl.ZipFile,
  dir: string,
  zipPrefix: string
): Promise<void> => {
  const entries = await fs.readdir(dir, { withFileTypes: true });

  for (const entry of entries) {
    const absPath = path.join(dir, entry.name);
    const entryName = `${zipPrefix}/${entry.name}`;

    if (entry.isDirectory()) {
      await addDirToZip(zip, absPath, entryName);
    } else if (entry.isFile()) {
      zip.addFile(absPath, entryName);
    }
  }
};

const isPathInside = (parent: string, child: string): boolean => {
  const rel = path.relative(parent, child);
  return !rel.startsWith('..') && !path.isAbsolute(rel);
};

// yauzl validates each entry's fileName itself (rejecting absolute paths and
// '..' segments) before ever emitting an 'entry' event, so a malicious path
// surfaces as an 'error' event rather than reaching our own guard below.
// Normalize that into the same "unsafe" vocabulary our guard uses.
const isUnsafePathError = (err: Error): boolean =>
  /absolute path|invalid relative path/i.test(err.message);

// Extract every file entry from `zipPath` into `destDir`. Returns the list of
// extracted entry names. Rejects on any entry that would escape `destDir`.
const extractZipEntries = (
  zipPath: string,
  destDir: string
): Promise<string[]> => {
  return new Promise((resolve, reject) => {
    const extracted: string[] = [];

    yauzl.open(zipPath, { lazyEntries: true }, (err, zipfile) => {
      if (err || !zipfile) {
        reject(err ?? new Error('Failed to open zip'));
        return;
      }

      zipfile.on('error', (zipErr) => {
        if (isUnsafePathError(zipErr)) {
          reject(new Error(`Unsafe zip entry path: ${zipErr.message}`));
          return;
        }
        reject(zipErr);
      });
      zipfile.on('end', () => resolve(extracted));
      zipfile.readEntry();

      zipfile.on('entry', (entry) => {
        // directory entries end with '/'
        if (/\/$/.test(entry.fileName)) {
          zipfile.readEntry();
          return;
        }

        const destPath = path.join(destDir, entry.fileName);

        if (!isPathInside(destDir, destPath)) {
          reject(new Error(`Unsafe zip entry path: ${entry.fileName}`));
          zipfile.close();
          return;
        }

        zipfile.openReadStream(entry, async (streamErr, readStream) => {
          if (streamErr || !readStream) {
            reject(streamErr ?? new Error('Failed to read zip entry'));
            return;
          }

          try {
            await fs.mkdir(path.dirname(destPath), { recursive: true });
          } catch (mkdirErr) {
            reject(mkdirErr);
            return;
          }

          const out = createWriteStream(destPath);
          readStream.pipe(out);
          out.on('error', reject);
          out.on('close', () => {
            extracted.push(entry.fileName);
            zipfile.readEntry();
          });
        });
      });
    });
  });
};

export { addDirToZip, extractZipEntries };
