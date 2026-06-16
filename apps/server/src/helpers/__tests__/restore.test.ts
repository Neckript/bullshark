import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import fs from 'fs/promises';
import path from 'path';
import {
  applyPendingRestore,
  getLatestMigrationTag,
  RESTORE_PENDING_PATH,
  RESTORE_STAGING_PATH
} from '../restore';
import { DATA_PATH, DB_PATH, PUBLIC_PATH } from '../paths';

describe('getLatestMigrationTag', () => {
  test('returns the last tag from the drizzle journal', async () => {
    const tag = await getLatestMigrationTag();
    expect(typeof tag).toBe('string');
    expect(tag.length).toBeGreaterThan(0);
    expect(tag.startsWith('00')).toBe(true);
  });
});

describe('applyPendingRestore', () => {
  beforeEach(async () => {
    await fs.rm(RESTORE_STAGING_PATH, { recursive: true, force: true });
    await fs.rm(RESTORE_PENDING_PATH, { force: true });
    await fs.rm(`${DB_PATH}.pre-restore`, { force: true });
    await fs.rm(`${PUBLIC_PATH}.pre-restore`, { recursive: true, force: true });
  });

  afterEach(async () => {
    await fs.rm(RESTORE_STAGING_PATH, { recursive: true, force: true });
    await fs.rm(RESTORE_PENDING_PATH, { force: true });
    await fs.rm(`${DB_PATH}.pre-restore`, { force: true });
    await fs.rm(`${PUBLIC_PATH}.pre-restore`, { recursive: true, force: true });
  });

  test('no-ops when there is no pending marker', async () => {
    await fs.mkdir(DATA_PATH, { recursive: true });
    await fs.writeFile(DB_PATH, 'LIVE_DB');
    await applyPendingRestore();
    expect(await fs.readFile(DB_PATH, 'utf8')).toBe('LIVE_DB');
  });

  test('swaps live aside to .pre-restore and moves staging into place', async () => {
    await fs.mkdir(PUBLIC_PATH, { recursive: true });
    await fs.writeFile(DB_PATH, 'LIVE_DB');
    await fs.writeFile(path.join(PUBLIC_PATH, 'live.txt'), 'LIVE_FILE');

    await fs.mkdir(path.join(RESTORE_STAGING_PATH, 'public'), { recursive: true });
    await fs.writeFile(path.join(RESTORE_STAGING_PATH, 'db.sqlite'), 'NEW_DB');
    await fs.writeFile(path.join(RESTORE_STAGING_PATH, 'public', 'new.txt'), 'NEW_FILE');
    await fs.writeFile(RESTORE_PENDING_PATH, '');

    await applyPendingRestore();

    expect(await fs.readFile(DB_PATH, 'utf8')).toBe('NEW_DB');
    expect(await fs.readFile(path.join(PUBLIC_PATH, 'new.txt'), 'utf8')).toBe('NEW_FILE');
    expect(await fs.readFile(`${DB_PATH}.pre-restore`, 'utf8')).toBe('LIVE_DB');
    expect(await fs.readFile(path.join(`${PUBLIC_PATH}.pre-restore`, 'live.txt'), 'utf8')).toBe('LIVE_FILE');
    expect(await fs.exists(RESTORE_PENDING_PATH)).toBe(false);
    expect(await fs.exists(RESTORE_STAGING_PATH)).toBe(false);
  });
});
