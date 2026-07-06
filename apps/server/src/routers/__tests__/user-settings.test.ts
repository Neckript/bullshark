import { describe, expect, test } from 'bun:test';
import { initTest } from '../../__tests__/helpers';

describe('userSettings router', () => {
  test('set then getAll returns the parsed value for the caller', async () => {
    const { caller } = await initTest(); // user 1
    await caller.settings.set({ key: 'browser_notifications', value: true });
    const all = await caller.settings.getAll();
    expect(all['browser_notifications']).toBe(true);
  });

  test('getAll is scoped to the caller', async () => {
    const { caller: u1 } = await initTest(); // user 1
    await u1.settings.set({ key: 'auto_join_last_channel', value: true });
    const { caller: u2 } = await initTest(2); // user 2
    const all = await u2.settings.getAll();
    expect(all['auto_join_last_channel']).toBeUndefined();
  });

  test('set rejects a key not on the allowlist', async () => {
    const { caller } = await initTest();
    await expect(
      caller.settings.set({ key: 'not_allowed', value: 1 })
    ).rejects.toThrow();
  });

  test('delete removes a muted-role-mention key', async () => {
    const { caller } = await initTest();
    await caller.settings.set({ key: 'muted_role_mention:2', value: true });
    await caller.settings.delete({ key: 'muted_role_mention:2' });
    const all = await caller.settings.getAll();
    expect(all['muted_role_mention:2']).toBeUndefined();
  });

  test('set accepts a valid hex value for a custom theme key', async () => {
    const { caller } = await initTest();
    await caller.settings.set({ key: 'custom_theme_bg', value: '#1a2b3c' });
    const all = await caller.settings.getAll();
    expect(all['custom_theme_bg']).toBe('#1a2b3c');
  });

  test('set rejects invalid values for custom theme keys', async () => {
    const { caller } = await initTest();
    await expect(
      caller.settings.set({ key: 'custom_theme_bg', value: 'red' })
    ).rejects.toThrow();
    await expect(
      caller.settings.set({ key: 'custom_theme_accent', value: '#12345' })
    ).rejects.toThrow();
    await expect(
      caller.settings.set({ key: 'custom_theme_bg', value: true })
    ).rejects.toThrow();
  });
});
