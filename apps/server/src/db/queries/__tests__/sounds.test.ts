import { describe, expect, test } from 'bun:test';
import { eq } from 'drizzle-orm';
import { db } from '../..';
import { files, sounds } from '../../schema';
import { countSounds, getUniqueSoundName, soundExists } from '../sounds';

const insertFile = (name: string) =>
  db
    .insert(files)
    .values({
      name,
      originalName: name,
      md5: 'deadbeef',
      userId: 1,
      size: 10,
      mimeType: 'audio/mpeg',
      extension: 'mp3',
      createdAt: Date.now()
    })
    .returning()
    .get();

describe('sounds queries', () => {
  // No cleanup needed: setup.ts rebuilds a fresh in-memory database before
  // every test, so rows written here cannot leak into any other test.
  test('countSounds accurately reflects the number of sounds', async () => {
    const initialCount = await countSounds();

    const file = await insertFile(`test_sound_${Date.now()}.mp3`);
    const soundName = `test_sound_${Date.now()}`;

    await db.insert(sounds).values({
      name: soundName,
      fileId: file.id,
      userId: 1,
      createdAt: Date.now()
    });

    expect(await countSounds()).toBe(initialCount + 1);

    await db.delete(sounds).where(eq(sounds.name, soundName));

    expect(await countSounds()).toBe(initialCount);
  });

  test('soundExists is false for an unknown name', async () => {
    expect(await soundExists('definitely_not_a_sound')).toBe(false);
  });

  test('getUniqueSoundName normalizes spaces and lowercases', async () => {
    expect(await getUniqueSoundName('My Sound')).toBe('my_sound');
  });
});
