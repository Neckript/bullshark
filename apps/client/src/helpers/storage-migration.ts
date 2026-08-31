import { LocalStorageKey } from './storage';

const OLD_PREFIX = 'sharkord-';
const NEW_PREFIX = 'bullshark-';

// LocalStorageKey values carry the current (bullshark-) prefix once the
// rename lands; this derives the pre-rename (sharkord-) name they replace,
// so the migration below activates on its own the moment that rename ships
// - no further change needed here.
const toLegacyKey = (key: string): string | null =>
  key.startsWith(NEW_PREFIX)
    ? `${OLD_PREFIX}${key.slice(NEW_PREFIX.length)}`
    : null;

const migrateStorageKey = (key: string): void => {
  const legacyKey = toLegacyKey(key);

  if (!legacyKey) return;

  try {
    if (localStorage.getItem(key) !== null) return;

    const legacyValue = localStorage.getItem(legacyKey);

    if (legacyValue === null) return;

    localStorage.setItem(key, legacyValue);
    localStorage.removeItem(legacyKey);
  } catch {
    /* ignore - see helpers/storage.ts for why storage access can throw */
  }
};

// Idempotent, single-pass migration of every LocalStorageKey from its
// sharkord- prefixed name to its bullshark- one. Must run once, before
// anything reads from localStorage, or a user's preferences and session
// silently reset on their first load after the rename.
const migrateLegacyStorageKeys = (
  keys: string[] = Object.values(LocalStorageKey)
): void => {
  for (const key of keys) {
    migrateStorageKey(key);
  }
};

export { migrateLegacyStorageKeys, migrateStorageKey, toLegacyKey };
