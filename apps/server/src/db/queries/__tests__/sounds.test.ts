import { describe, expect, test } from 'bun:test';
import { countSounds, getUniqueSoundName, soundExists } from '../sounds';

describe('sounds queries', () => {
  test('countSounds returns a number on an empty table', async () => {
    const count = await countSounds();

    expect(typeof count).toBe('number');
  });

  test('soundExists is false for an unknown name', async () => {
    expect(await soundExists('definitely_not_a_sound')).toBe(false);
  });

  test('getUniqueSoundName normalizes spaces and lowercases', async () => {
    expect(await getUniqueSoundName('My Sound')).toBe('my_sound');
  });
});
