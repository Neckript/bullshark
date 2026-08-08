import { MAX_SOUND_FILE_SIZE, type TTempFile } from '@sharkord/shared';
import { describe, expect, test } from 'bun:test';
import { initTest, uploadFile } from '../../__tests__/helpers';
import { db } from '../../db';
import { sounds } from '../../db/schema';

const uploadSoundFile = async (
  mockedToken: string,
  name = 'clip.mp3',
  size = 1024
) => {
  const file = new File([new Uint8Array(size)], name, { type: 'audio/mpeg' });
  const response = await uploadFile(file, mockedToken);

  return (await response.json()) as TTempFile;
};

describe('sounds table', () => {
  test('exists and is queryable', async () => {
    const rows = await db.select().from(sounds);

    expect(Array.isArray(rows)).toBe(true);
  });
});

describe('sounds router', () => {
  test('should throw when user lacks permissions (add)', async () => {
    const { caller } = await initTest(2);

    await expect(
      caller.sounds.add([{ fileId: 'test-file-id', name: 'test_sound' }])
    ).rejects.toThrow('Insufficient permissions');
  });

  test('should throw when user lacks permissions (getAll)', async () => {
    const { caller } = await initTest(2);

    await expect(caller.sounds.getAll()).rejects.toThrow(
      'Insufficient permissions'
    );
  });

  test('should throw when user lacks permissions (update)', async () => {
    const { caller } = await initTest(2);

    await expect(
      caller.sounds.update({ soundId: 1, name: 'renamed' })
    ).rejects.toThrow('Insufficient permissions');
  });

  test('should throw when user lacks permissions (delete)', async () => {
    const { caller } = await initTest(2);

    await expect(caller.sounds.delete({ soundId: 1 })).rejects.toThrow(
      'Insufficient permissions'
    );
  });

  test('should add a sound and list it', async () => {
    const { caller, mockedToken } = await initTest();
    const uploaded = await uploadSoundFile(mockedToken);

    await caller.sounds.add([{ fileId: uploaded.id, name: 'test_sound' }]);

    const all = await caller.sounds.getAll();
    const added = all.find((s) => s.name === 'test_sound');

    expect(added).toBeDefined();
    expect(added!.userId).toBe(1);
    expect(added!.fileId).toBeDefined();
  });

  test('should reject a non-audio file', async () => {
    const { caller, mockedToken } = await initTest();
    const file = new File(['not audio'], 'image.png', { type: 'image/png' });
    const response = await uploadFile(file, mockedToken);
    const uploaded = (await response.json()) as TTempFile;

    await expect(
      caller.sounds.add([{ fileId: uploaded.id, name: 'not_a_sound' }])
    ).rejects.toThrow('Only audio files are allowed');
  });

  test('should reject a file over the size limit', async () => {
    const { caller, mockedToken } = await initTest();
    const uploaded = await uploadSoundFile(
      mockedToken,
      'big.mp3',
      MAX_SOUND_FILE_SIZE + 1
    );

    await expect(
      caller.sounds.add([{ fileId: uploaded.id, name: 'too_big' }])
    ).rejects.toThrow('Sound file is too large');
  });

  test('should de-duplicate colliding names', async () => {
    const { caller, mockedToken } = await initTest();

    const first = await uploadSoundFile(mockedToken, 'dup.mp3');
    await caller.sounds.add([{ fileId: first.id, name: 'duplicate' }]);

    const second = await uploadSoundFile(mockedToken, 'dup2.mp3');
    await caller.sounds.add([{ fileId: second.id, name: 'duplicate' }]);

    const all = await caller.sounds.getAll();
    const matches = all.filter((s) => s.name.startsWith('duplicate'));

    expect(matches.length).toBe(2);
    expect(matches.some((s) => s.name === 'duplicate_1')).toBe(true);
  });

  test('should rename and then delete a sound', async () => {
    const { caller, mockedToken } = await initTest();
    const uploaded = await uploadSoundFile(mockedToken, 'rename.mp3');

    await caller.sounds.add([{ fileId: uploaded.id, name: 'before_rename' }]);

    const created = (await caller.sounds.getAll()).find(
      (s) => s.name === 'before_rename'
    );

    expect(created).toBeDefined();

    await caller.sounds.update({ soundId: created!.id, name: 'after_rename' });

    const renamed = (await caller.sounds.getAll()).find(
      (s) => s.id === created!.id
    );

    expect(renamed!.name).toBe('after_rename');

    await caller.sounds.delete({ soundId: created!.id });

    const remaining = (await caller.sounds.getAll()).find(
      (s) => s.id === created!.id
    );

    expect(remaining).toBeUndefined();
  });

  test('join payload includes the sound library', async () => {
    const { initialData } = await initTest();

    expect(Array.isArray(initialData.sounds)).toBe(true);
  });
});
