import { beforeEach, describe, expect, test } from 'bun:test';
import { migrateLegacyStorageKeys } from '../storage-migration';

// bun:test has no built-in localStorage; a minimal in-memory Storage stands
// in for it, scoped to this file.
class FakeStorage {
  private store = new Map<string, string>();

  getItem(key: string): string | null {
    return this.store.has(key) ? this.store.get(key)! : null;
  }

  setItem(key: string, value: string): void {
    this.store.set(key, value);
  }

  removeItem(key: string): void {
    this.store.delete(key);
  }

  clear(): void {
    this.store.clear();
  }
}

(globalThis as unknown as { localStorage: FakeStorage }).localStorage =
  new FakeStorage();

beforeEach(() => {
  localStorage.clear();
});

describe('migrateLegacyStorageKeys', () => {
  test('copies a lone legacy key then removes it', () => {
    localStorage.setItem('sharkord-devices-settings', 'legacy-value');

    migrateLegacyStorageKeys(['bullshark-devices-settings']);

    expect(localStorage.getItem('bullshark-devices-settings')).toBe(
      'legacy-value'
    );
    expect(localStorage.getItem('sharkord-devices-settings')).toBeNull();
  });

  test('does not overwrite a new key that is already present', () => {
    localStorage.setItem('bullshark-devices-settings', 'current-value');
    localStorage.setItem('sharkord-devices-settings', 'legacy-value');

    migrateLegacyStorageKeys(['bullshark-devices-settings']);

    expect(localStorage.getItem('bullshark-devices-settings')).toBe(
      'current-value'
    );
    expect(localStorage.getItem('sharkord-devices-settings')).toBe(
      'legacy-value'
    );
  });

  test('running twice in a row leaves the same state (idempotent)', () => {
    localStorage.setItem('sharkord-devices-settings', 'legacy-value');

    migrateLegacyStorageKeys(['bullshark-devices-settings']);
    migrateLegacyStorageKeys(['bullshark-devices-settings']);

    expect(localStorage.getItem('bullshark-devices-settings')).toBe(
      'legacy-value'
    );
    expect(localStorage.getItem('sharkord-devices-settings')).toBeNull();
  });

  test('a key absent from both sides creates nothing', () => {
    migrateLegacyStorageKeys(['bullshark-devices-settings']);

    expect(localStorage.getItem('bullshark-devices-settings')).toBeNull();
    expect(localStorage.getItem('sharkord-devices-settings')).toBeNull();
  });

  test('leaves a key without the bullshark- prefix untouched', () => {
    localStorage.setItem('vite-ui-theme', 'dark');

    migrateLegacyStorageKeys(['vite-ui-theme']);

    expect(localStorage.getItem('vite-ui-theme')).toBe('dark');
  });
});
