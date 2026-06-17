import { OWNER_ROLE_ID } from '@sharkord/shared';
import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { createWriteStream } from 'fs';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import yazl from 'yazl';
import { login } from '../../__tests__/helpers';
import { tdb, testsBaseUrl } from '../../__tests__/setup';
import { getUserByIdentity } from '../../db/queries/users';
import { userRoles } from '../../db/schema';
import {
  getLatestMigrationTag,
  RESTORE_PENDING_PATH,
  RESTORE_STAGING_PATH
} from '../../helpers/restore';
import { BACKUP_TOKEN_HEADER } from '../backup-auth';

const loginToken = async (identity: string): Promise<string> => {
  const res = await login(identity, 'password');
  const { token } = (await res.json()) as { token: string };
  return token;
};

const makeOwnerToken = async (identity: string): Promise<string> => {
  const token = await loginToken(identity);
  const user = await getUserByIdentity(identity);
  await tdb
    .insert(userRoles)
    .values({ userId: user!.id, roleId: OWNER_ROLE_ID, createdAt: Date.now() })
    .onConflictDoNothing();
  return token;
};

const buildBackupZip = async (opts: {
  manifest?: object | null;
  withDb?: boolean;
}): Promise<Buffer> => {
  const zip = new yazl.ZipFile();
  if (opts.manifest !== null) {
    zip.addBuffer(
      Buffer.from(
        JSON.stringify(
          opts.manifest ?? {
            serverVersion: '0.0.0',
            latestMigrationTag: 'PLACEHOLDER',
            createdAt: new Date().toISOString()
          }
        )
      ),
      'manifest.json'
    );
  }
  if (opts.withDb !== false) {
    zip.addBuffer(Buffer.from('SQLITEDATA'), 'db.sqlite');
  }
  zip.end();
  const tmp = path.join(os.tmpdir(), `imp-${Date.now()}-${Math.random()}.zip`);
  await new Promise<void>((resolve, reject) => {
    const out = createWriteStream(tmp);
    zip.outputStream.pipe(out);
    out.on('close', resolve);
    out.on('error', reject);
  });
  const buf = await fs.readFile(tmp);
  await fs.rm(tmp, { force: true });
  return buf;
};

const cleanup = async () => {
  await fs.rm(RESTORE_STAGING_PATH, { recursive: true, force: true });
  await fs.rm(RESTORE_PENDING_PATH, { force: true });
};

beforeEach(cleanup);
afterEach(cleanup);

describe('POST /import', () => {
  test('rejects non-owner with 403', async () => {
    const token = await loginToken('plainimport');
    const body = await buildBackupZip({});
    const res = await fetch(`${testsBaseUrl}/import`, {
      method: 'POST',
      headers: { [BACKUP_TOKEN_HEADER]: token },
      body
    });
    expect(res.status).toBe(403);
  });

  test('rejects a zip missing db.sqlite with 400', async () => {
    const token = await makeOwnerToken('ownerimporta');
    const body = await buildBackupZip({ withDb: false });
    const res = await fetch(`${testsBaseUrl}/import`, {
      method: 'POST',
      headers: { [BACKUP_TOKEN_HEADER]: token },
      body
    });
    expect(res.status).toBe(400);
    expect(await fs.exists(RESTORE_PENDING_PATH)).toBe(false);
  });

  test('rejects a backup from a newer server (unknown migration tag) with 409', async () => {
    const token = await makeOwnerToken('ownerimportb');
    const body = await buildBackupZip({
      manifest: {
        serverVersion: '99.0.0',
        latestMigrationTag: '9999_from_the_future',
        createdAt: new Date().toISOString()
      }
    });
    const res = await fetch(`${testsBaseUrl}/import`, {
      method: 'POST',
      headers: { [BACKUP_TOKEN_HEADER]: token },
      body
    });
    expect(res.status).toBe(409);
    expect(await fs.exists(RESTORE_PENDING_PATH)).toBe(false);
  });

  test('owner with a valid (current-tag) backup stages a pending restore', async () => {
    const token = await makeOwnerToken('ownerimportc');
    const body = await buildBackupZip({
      manifest: {
        serverVersion: '1.0.0',
        latestMigrationTag: await getLatestMigrationTag(),
        createdAt: new Date().toISOString()
      }
    });
    const res = await fetch(`${testsBaseUrl}/import`, {
      method: 'POST',
      headers: { [BACKUP_TOKEN_HEADER]: token },
      body
    });
    expect(res.status).toBe(200);
    expect(await fs.exists(RESTORE_PENDING_PATH)).toBe(true);
    expect(await fs.exists(path.join(RESTORE_STAGING_PATH, 'db.sqlite'))).toBe(
      true
    );
  });
});
