import { OWNER_ROLE_ID } from '@sharkord/shared';
import { describe, expect, test } from 'bun:test';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import yauzl from 'yauzl';
import { login } from '../../__tests__/helpers';
import { tdb, testsBaseUrl } from '../../__tests__/setup';
import { getUserByIdentity } from '../../db/queries/users';
import { userRoles } from '../../db/schema';
import { BACKUP_TOKEN_HEADER } from '../backup-auth';

const loginToken = async (identity: string): Promise<string> => {
  const res = await login(identity, 'password');
  const { token } = (await res.json()) as { token: string };
  return token;
};

const makeOwner = async (identity: string): Promise<string> => {
  const token = await loginToken(identity);
  const user = await getUserByIdentity(identity);
  await tdb
    .insert(userRoles)
    .values({ userId: user!.id, roleId: OWNER_ROLE_ID, createdAt: Date.now() })
    .onConflictDoNothing();
  return token;
};

const listZipEntries = async (buf: Buffer): Promise<string[]> => {
  const tmp = path.join(os.tmpdir(), `exp-${Date.now()}-${Math.random()}.zip`);
  await fs.writeFile(tmp, buf);
  try {
    return await new Promise<string[]>((resolve, reject) => {
      const names: string[] = [];
      yauzl.open(tmp, { lazyEntries: true }, (err, zf) => {
        if (err || !zf) return reject(err ?? new Error('open failed'));
        zf.readEntry();
        zf.on('entry', (e) => {
          names.push(e.fileName);
          zf.readEntry();
        });
        zf.on('end', () => resolve(names));
        zf.on('error', reject);
      });
    });
  } finally {
    await fs.rm(tmp, { force: true });
  }
};

describe('GET /export', () => {
  test('rejects unauthenticated requests with 401', async () => {
    const res = await fetch(`${testsBaseUrl}/export`);
    expect(res.status).toBe(401);
  });

  test('rejects non-owner with 403', async () => {
    const token = await loginToken('plainexport');
    const res = await fetch(`${testsBaseUrl}/export`, {
      headers: { [BACKUP_TOKEN_HEADER]: token }
    });
    expect(res.status).toBe(403);
  });

  test('owner gets a zip containing manifest.json and db.sqlite', async () => {
    const token = await makeOwner('ownerexport');
    const res = await fetch(`${testsBaseUrl}/export`, {
      headers: { [BACKUP_TOKEN_HEADER]: token }
    });
    expect(res.status).toBe(200);
    expect(res.headers.get('content-disposition')).toContain('attachment');

    const buf = Buffer.from(await res.arrayBuffer());
    const names = await listZipEntries(buf);
    expect(names).toContain('manifest.json');
    expect(names).toContain('db.sqlite');
  });
});
