import { describe, expect, test } from 'bun:test';
import { eq } from 'drizzle-orm';
import { db } from '../..';
import { files, roles } from '../../schema';
import { getOrphanedFileIds, isFileOrphaned } from '../files';

const insertFile = (name: string) =>
  db
    .insert(files)
    .values({
      name,
      originalName: name,
      md5: 'deadbeef',
      userId: 1,
      size: 10,
      mimeType: 'image/png',
      extension: 'png',
      createdAt: Date.now()
    })
    .returning()
    .get();

describe('orphaned files — references that keep a file alive', () => {
  test('a file used as a role icon is NOT considered orphaned', async () => {
    const file = await insertFile('role-icon.png');
    // role 1 = "Owner" (see seed); attach the file as its icon
    await db.update(roles).set({ iconFileId: file.id }).where(eq(roles.id, 1));

    expect(await getOrphanedFileIds()).not.toContain(file.id);
    expect(await isFileOrphaned(file.id)).toBe(false);
  });

  test('a file referenced by nothing IS considered orphaned', async () => {
    const file = await insertFile('lonely.png');

    expect(await getOrphanedFileIds()).toContain(file.id);
    expect(await isFileOrphaned(file.id)).toBe(true);
  });
});
