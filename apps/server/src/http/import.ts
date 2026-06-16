import { getErrorMessage } from '@sharkord/shared';
import { createWriteStream } from 'fs';
import fs from 'fs/promises';
import http from 'http';
import path from 'path';
import { TMP_PATH } from '../helpers/paths';
import {
  isMigrationTagRestorable,
  RESTORE_STAGING_PATH,
  writeRestoreMarker
} from '../helpers/restore';
import { logger } from '../logger';
import { IS_TEST } from '../utils/env';
import { BACKUP_TOKEN_HEADER, getOwnerFromRequest } from './backup-auth';
import { extractZipEntries } from './zip';

// Hard ceiling on the upload, enforced on real received bytes (Content-Length is untrusted).
const MAX_IMPORT_BYTES = 20 * 1024 * 1024 * 1024; // 20 GiB

const sendJson = (res: http.ServerResponse, code: number, body: object) => {
  res.writeHead(code, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(body));
};

const streamToFileWithGuard = (
  req: http.IncomingMessage,
  destPath: string
): Promise<{ aborted: boolean }> => {
  return new Promise((resolve, reject) => {
    const out = createWriteStream(destPath);
    let received = 0;
    let aborted = false;
    let settled = false;

    const settleResolve = (value: { aborted: boolean }) => {
      if (!settled) {
        settled = true;
        resolve(value);
      }
    };
    const settleReject = (err: unknown) => {
      if (!settled) {
        settled = true;
        reject(err);
      }
    };

    req.on('data', (chunk: Buffer) => {
      received += chunk.length;
      if (received > MAX_IMPORT_BYTES && !aborted) {
        aborted = true;
        req.destroy();
        out.destroy();
        settleResolve({ aborted: true });
      }
    });

    out.on('error', settleReject);
    req.on('error', settleReject);
    req.on('end', () => {
      if (!aborted) out.end();
    });
    out.on('close', () => {
      if (!aborted) settleResolve({ aborted: false });
    });

    req.pipe(out);
  });
};

const readStagedManifest = async (): Promise<{ latestMigrationTag?: string } | null> => {
  try {
    const raw = await fs.readFile(
      path.join(RESTORE_STAGING_PATH, 'manifest.json'),
      'utf8'
    );
    return JSON.parse(raw);
  } catch {
    return null;
  }
};

const importRouteHandler = async (
  req: http.IncomingMessage,
  res: http.ServerResponse
) => {
  const owner = await getOwnerFromRequest(req);

  if (!owner) {
    req.resume();
    const hasToken = Boolean(req.headers[BACKUP_TOKEN_HEADER]);
    sendJson(res, hasToken ? 403 : 401, {
      error: hasToken ? 'Forbidden' : 'Unauthorized'
    });
    return;
  }

  await fs.mkdir(TMP_PATH, { recursive: true });
  const uploadPath = path.join(TMP_PATH, `import-${Date.now()}.zip`);

  try {
    const { aborted } = await streamToFileWithGuard(req, uploadPath);
    if (aborted) {
      sendJson(res, 413, { error: 'Backup file is too large' });
      return;
    }

    await fs.rm(RESTORE_STAGING_PATH, { recursive: true, force: true });
    await fs.mkdir(RESTORE_STAGING_PATH, { recursive: true });

    let entryNames: string[];
    try {
      entryNames = await extractZipEntries(uploadPath, RESTORE_STAGING_PATH);
    } catch (zipErr) {
      logger.warn('Import: invalid zip: %s', getErrorMessage(zipErr));
      await fs.rm(RESTORE_STAGING_PATH, { recursive: true, force: true });
      sendJson(res, 400, { error: 'Invalid backup archive' });
      return;
    }

    if (!entryNames.includes('manifest.json') || !entryNames.includes('db.sqlite')) {
      await fs.rm(RESTORE_STAGING_PATH, { recursive: true, force: true });
      sendJson(res, 400, { error: 'Backup is missing manifest.json or db.sqlite' });
      return;
    }

    const manifest = await readStagedManifest();
    const tag = manifest?.latestMigrationTag;

    if (!tag || !(await isMigrationTagRestorable(tag))) {
      await fs.rm(RESTORE_STAGING_PATH, { recursive: true, force: true });
      sendJson(res, 409, {
        error: 'This backup is from a newer server version and cannot be restored here'
      });
      return;
    }

    await writeRestoreMarker();

    sendJson(res, 200, {
      success: true,
      message: 'Restore staged. The server is restarting…'
    });

    if (!IS_TEST) {
      // let the response flush before exiting; the supervisor restarts the process
      setTimeout(() => process.exit(0), 250);
    }
  } catch (error) {
    logger.error('Import failed: %s', getErrorMessage(error));
    await fs.rm(RESTORE_STAGING_PATH, { recursive: true, force: true });
    if (!res.headersSent) {
      sendJson(res, 500, { error: 'Import failed' });
    }
  } finally {
    await fs.rm(uploadPath, { force: true });
  }
};

export { importRouteHandler, MAX_IMPORT_BYTES };
