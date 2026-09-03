import { randomUUIDv7 } from 'bun';
import { afterEach, describe, expect, test } from 'bun:test';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import {
  assertDataDirNotShadowedByVolume,
  migrateLegacyDataDirectory
} from '../data-dir-migration';

const createdDirs: string[] = [];

const makeDirPair = () => {
  const root = path.join(os.tmpdir(), `data-dir-migration-${randomUUIDv7()}`);
  createdDirs.push(root);

  return {
    legacyDir: path.join(root, 'legacy-dir'),
    currentDir: path.join(root, 'current-dir')
  };
};

afterEach(async () => {
  await Promise.all(
    createdDirs
      .splice(0)
      .map((dir) => fs.rm(dir, { recursive: true, force: true }))
  );
});

describe('migrateLegacyDataDirectory', () => {
  test('renames a lone legacy directory and its contents', async () => {
    const { legacyDir, currentDir } = makeDirPair();

    await fs.mkdir(legacyDir, { recursive: true });
    await fs.writeFile(path.join(legacyDir, 'db.sqlite'), 'legacy-data');

    await migrateLegacyDataDirectory(legacyDir, currentDir);

    await expect(fs.stat(legacyDir)).rejects.toThrow();

    const migratedContent = await fs.readFile(
      path.join(currentDir, 'db.sqlite'),
      'utf-8'
    );

    expect(migratedContent).toBe('legacy-data');
  });

  test('when both exist, the current directory is kept and the legacy one is left intact', async () => {
    const { legacyDir, currentDir } = makeDirPair();

    await fs.mkdir(legacyDir, { recursive: true });
    await fs.writeFile(path.join(legacyDir, 'db.sqlite'), 'legacy-data');

    await fs.mkdir(currentDir, { recursive: true });
    await fs.writeFile(path.join(currentDir, 'db.sqlite'), 'current-data');

    await migrateLegacyDataDirectory(legacyDir, currentDir);

    const currentContent = await fs.readFile(
      path.join(currentDir, 'db.sqlite'),
      'utf-8'
    );
    const legacyContent = await fs.readFile(
      path.join(legacyDir, 'db.sqlite'),
      'utf-8'
    );

    expect(currentContent).toBe('current-data');
    expect(legacyContent).toBe('legacy-data');
  });

  test('when neither exists, nothing is created', async () => {
    const { legacyDir, currentDir } = makeDirPair();

    await migrateLegacyDataDirectory(legacyDir, currentDir);

    await expect(fs.stat(legacyDir)).rejects.toThrow();
    await expect(fs.stat(currentDir)).rejects.toThrow();
  });
});

describe('assertDataDirNotShadowedByVolume', () => {
  test('does not throw when the current directory already has data', async () => {
    const { legacyDir, currentDir } = makeDirPair();

    await fs.mkdir(currentDir, { recursive: true });
    await fs.writeFile(path.join(currentDir, 'db.sqlite'), 'current-data');

    await expect(
      assertDataDirNotShadowedByVolume(legacyDir, currentDir, async () => false)
    ).resolves.toBeUndefined();
  });

  test('does not throw when the legacy directory is empty or absent', async () => {
    const { legacyDir, currentDir } = makeDirPair();

    await expect(
      assertDataDirNotShadowedByVolume(legacyDir, currentDir, async () => false)
    ).resolves.toBeUndefined();
  });

  test('throws even when the legacy directory is writable: a writable bind mount still cannot be renamed', async () => {
    const { legacyDir, currentDir } = makeDirPair();

    await fs.mkdir(legacyDir, { recursive: true });
    await fs.writeFile(path.join(legacyDir, 'db.sqlite'), 'legacy-data');

    await expect(
      assertDataDirNotShadowedByVolume(legacyDir, currentDir, async () => true)
    ).rejects.toThrow(/volume/i);
  });

  test('throws a clear error for an empty current dir shadowing a non-writable legacy one', async () => {
    const { legacyDir, currentDir } = makeDirPair();

    await fs.mkdir(legacyDir, { recursive: true });
    await fs.writeFile(path.join(legacyDir, 'db.sqlite'), 'legacy-data');

    await expect(
      assertDataDirNotShadowedByVolume(legacyDir, currentDir, async () => false)
    ).rejects.toThrow(/volume/i);
  });
});
