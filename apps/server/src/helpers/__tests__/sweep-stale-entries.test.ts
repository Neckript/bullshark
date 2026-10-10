import { randomUUIDv7 } from 'bun';
import { afterEach, describe, expect, test } from 'bun:test';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { sweepStaleEntries } from '../fs';

const ONE_HOUR = 1000 * 60 * 60;
const createdDirs: string[] = [];

const makeDir = async () => {
  const dir = path.join(os.tmpdir(), `sweep-stale-${randomUUIDv7()}`);
  createdDirs.push(dir);

  await fs.mkdir(dir, { recursive: true });

  return dir;
};

// mtime is set explicitly instead of waiting: utimes takes seconds
const writeFileAged = async (dir: string, name: string, ageMs: number) => {
  const filePath = path.join(dir, name);
  const seconds = (Date.now() - ageMs) / 1000;

  await fs.writeFile(filePath, 'x');
  await fs.utimes(filePath, seconds, seconds);

  return filePath;
};

afterEach(async () => {
  await Promise.all(
    createdDirs
      .splice(0)
      .map((dir) => fs.rm(dir, { recursive: true, force: true }))
  );
});

describe('sweepStaleEntries', () => {
  test('supprime les entrees plus vieilles que le seuil et garde les recentes', async () => {
    const dir = await makeDir();

    await writeFileAged(dir, 'vieux.tmp', ONE_HOUR * 2);
    await writeFileAged(dir, 'recent.tmp', 1000 * 60);

    expect(await sweepStaleEntries(dir, ONE_HOUR)).toBe(1);
    expect(await fs.readdir(dir)).toEqual(['recent.tmp']);
  });

  test('supprime un sous-dossier perime en entier', async () => {
    const dir = await makeDir();
    const stale = path.join(dir, 'downloads');

    await fs.mkdir(stale);
    await fs.writeFile(path.join(stale, 'archive'), 'x');

    const seconds = (Date.now() - ONE_HOUR * 2) / 1000;
    await fs.utimes(stale, seconds, seconds);

    expect(await sweepStaleEntries(dir, ONE_HOUR)).toBe(1);
    expect(await fs.readdir(dir)).toEqual([]);
  });

  test('ne touche rien quand une entree est pile au seuil', async () => {
    const dir = await makeDir();
    const now = Date.now();

    await writeFileAged(dir, 'limite.tmp', ONE_HOUR - 1000);

    expect(await sweepStaleEntries(dir, ONE_HOUR, { now })).toBe(0);
    expect(await fs.readdir(dir)).toEqual(['limite.tmp']);
  });

  test('traite un dossier absent comme vide, sans lever', async () => {
    const missing = path.join(os.tmpdir(), `sweep-absent-${randomUUIDv7()}`);

    expect(await sweepStaleEntries(missing, ONE_HOUR)).toBe(0);
  });

  test('rend la main sur un dossier vide', async () => {
    const dir = await makeDir();

    expect(await sweepStaleEntries(dir, ONE_HOUR)).toBe(0);
  });
});
