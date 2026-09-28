import { describe, expect, test } from 'bun:test';
import { initTest } from '../../__tests__/helpers';

describe('moderation tools', () => {
  test('slow mode blocks a quick second message; moderators bypass', async () => {
    const { caller: owner } = await initTest(1);
    const { caller: user } = await initTest(2);

    await owner.channels.update({ channelId: 1, slowModeSeconds: 60 });

    await user.messages.send({ channelId: 1, content: 'first', files: [] });

    await expect(
      user.messages.send({ channelId: 1, content: 'second', files: [] })
    ).rejects.toThrow('Slow mode');

    // owner holds MANAGE_MESSAGES, so slow mode does not apply to them
    await owner.messages.send({ channelId: 1, content: 'a', files: [] });
    await owner.messages.send({ channelId: 1, content: 'b', files: [] });

    await owner.channels.update({ channelId: 1, slowModeSeconds: 0 });
  });

  test('timeout blocks sending until it is removed', async () => {
    const { caller: owner } = await initTest(1);
    const { caller: user } = await initTest(2);

    await owner.users.timeout({ userId: 2, durationSeconds: 600 });

    await expect(
      user.messages.send({ channelId: 1, content: 'hi', files: [] })
    ).rejects.toThrow('timed out');

    await owner.users.removeTimeout({ userId: 2 });

    await user.messages.send({ channelId: 1, content: 'back', files: [] });
  });

  test('a user cannot time themselves out', async () => {
    const { caller: owner } = await initTest(1);

    await expect(
      owner.users.timeout({ userId: 1, durationSeconds: 60 })
    ).rejects.toThrow('yourself');
  });

  test('server mute toggles the persistent voice-mute flag', async () => {
    const { caller: owner } = await initTest(1);

    await owner.voice.serverMute({ userId: 2, muted: true });
    let info = await owner.users.getInfo({ userId: 2 });
    expect(info.user.voiceMuted).toBe(true);

    await owner.voice.serverMute({ userId: 2, muted: false });
    info = await owner.users.getInfo({ userId: 2 });
    expect(info.user.voiceMuted).toBe(false);
  });

  test('a regular user cannot use moderation routes', async () => {
    const { caller: user } = await initTest(2);

    await expect(
      user.users.timeout({ userId: 1, durationSeconds: 60 })
    ).rejects.toThrow();

    await expect(
      user.voice.serverMute({ userId: 1, muted: true })
    ).rejects.toThrow();
  });
});
