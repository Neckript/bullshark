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
  test('countSounds accurately reflects the number of sounds', async () => {
    const initialCount = await countSounds();

    // Insert a test file and sound
    const file = await insertFile(`test_sound_${Date.now()}.mp3`);
    const soundName = `test_sound_${Date.now()}`;
    await db.insert(sounds).values({
      name: soundName,
      fileId: file.id,
      userId: 1,
      createdAt: Date.now()
    });

    const countAfterInsert = await countSounds();

    // Assert the count increased by exactly 1
    expect(countAfterInsert).toBe(initialCount + 1);

    // Clean up: delete the sound and file we just inserted
    await db.delete(sounds).where(eq(sounds.name, soundName));
    await db.delete(files).where(eq(files.id, file.id));

    const countAfterDelete = await countSounds();
    expect(countAfterDelete).toBe(initialCount);
  });

  test('soundExists is false for an unknown name', async () => {
    expect(await soundExists('definitely_not_a_sound')).toBe(false);
  });

  test('getUniqueSoundName normalizes spaces and lowercases', async () => {
    expect(await getUniqueSoundName('My Sound')).toBe('my_sound');
  });
});
