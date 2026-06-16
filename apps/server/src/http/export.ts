import { getErrorMessage } from '@sharkord/shared';
import type { Database } from 'bun:sqlite';
import fs from 'fs/promises';
import http from 'http';
import path from 'path';
import yazl from 'yazl';
import { db } from '../db';
import { PUBLIC_PATH, TMP_PATH } from '../helpers/paths';
import { getLatestMigrationTag } from '../helpers/restore';
import { logger } from '../logger';
import { SERVER_VERSION } from '../utils/env';
import { BACKUP_TOKEN_HEADER, getOwnerFromRequest } from './backup-auth';
import { addDirToZip } from './zip';

const backupFileName = (): string => {
  const date = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  return `bullshark-backup-${date}.zip`;
};

const exportRouteHandler = async (
  req: http.IncomingMessage,
  res: http.ServerResponse
) => {
  const owner = await getOwnerFromRequest(req);

  if (!owner) {
    const status = req.headers[BACKUP_TOKEN_HEADER] ? 403 : 401;
    res.writeHead(status, { 'Content-Type': 'application/json' });
    res.end(
      JSON.stringify({ error: status === 401 ? 'Unauthorized' : 'Forbidden' })
    );
    return;
  }

  await fs.mkdir(TMP_PATH, { recursive: true });
  const snapshotPath = path.join(TMP_PATH, `export-${Date.now()}.sqlite`);

  try {
    // Consistent snapshot of the live DB (safe while the server keeps writing).
    // `$client` (the raw bun:sqlite handle) isn't part of the narrowed `BunSQLiteDatabase`
    // type that `db/index.ts` declares, but it's always present at runtime (drizzle()
    // attaches it). Cast narrowly rather than widening the shared `db` type.
    const sqliteClient = (db as unknown as { $client: Database }).$client;
    const escaped = snapshotPath.replace(/'/g, "''");
    sqliteClient.run(`VACUUM INTO '${escaped}'`);

    const manifest = {
      serverVersion: SERVER_VERSION,
      latestMigrationTag: await getLatestMigrationTag(),
      createdAt: new Date().toISOString()
    };

    const zip = new yazl.ZipFile();
    zip.addBuffer(
      Buffer.from(JSON.stringify(manifest, null, 2)),
      'manifest.json'
    );
    zip.addFile(snapshotPath, 'db.sqlite');

    if (await fs.exists(PUBLIC_PATH)) {
      await addDirToZip(zip, PUBLIC_PATH, 'public');
    }

    zip.end();

    res.writeHead(200, {
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="${backupFileName()}"`,
      'Cache-Control': 'no-store'
    });

    await new Promise<void>((resolve, reject) => {
      zip.outputStream.on('error', reject);
      res.on('error', reject);
      res.on('close', () => resolve());
      zip.outputStream.pipe(res);
    });
  } catch (error) {
    logger.error('Export failed: %s', getErrorMessage(error));
    if (!res.headersSent) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Export failed' }));
    } else {
      res.destroy();
    }
  } finally {
    await fs.rm(snapshotPath, { force: true });
  }
};

export { exportRouteHandler };
