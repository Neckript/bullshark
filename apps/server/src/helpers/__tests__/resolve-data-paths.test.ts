import { describe, expect, mock, test } from 'bun:test';
import path from 'path';
import { resolveDataPaths } from '../paths';

const baseContext = {
  isTest: false,
  isDevelopment: false,
  cwd: '/cwd',
  appDataPath: '/app-data'
};

describe('resolveDataPaths', () => {
  test('BULLSHARK_DATA_PATH takes precedence over everything, including SHARKORD_DATA_PATH', () => {
    const warn = mock(() => {});

    const result = resolveDataPaths(
      {
        BULLSHARK_DATA_PATH: '/custom/path',
        SHARKORD_DATA_PATH: '/legacy/path'
      },
      { ...baseContext, warn }
    );

    expect(result.dataPath).toBe(path.resolve('/custom/path'));
    expect(result.legacyDataDirCandidate).toBeNull();
    expect(warn).not.toHaveBeenCalled();
  });

  test('SHARKORD_DATA_PATH is still honored, with a warning', () => {
    const warn = mock(() => {});

    const result = resolveDataPaths(
      { SHARKORD_DATA_PATH: '/legacy/path' },
      { ...baseContext, warn }
    );

    expect(result.dataPath).toBe(path.resolve('/legacy/path'));
    expect(result.legacyDataDirCandidate).toBeNull();
    expect(warn).toHaveBeenCalledTimes(1);
  });

  test('test mode uses ./data-test relative to cwd, no migration candidate', () => {
    const result = resolveDataPaths(
      {},
      { ...baseContext, isTest: true, warn: mock(() => {}) }
    );

    expect(result.dataPath).toBe(path.resolve('/cwd', './data-test'));
    expect(result.legacyDataDirCandidate).toBeNull();
  });

  test('development mode uses ./data relative to cwd, no migration candidate', () => {
    const result = resolveDataPaths(
      {},
      { ...baseContext, isDevelopment: true, warn: mock(() => {}) }
    );

    expect(result.dataPath).toBe(path.resolve('/cwd', './data'));
    expect(result.legacyDataDirCandidate).toBeNull();
  });

  test('production default lands under the app data root and exposes a migration candidate', () => {
    const result = resolveDataPaths({}, { ...baseContext, warn: mock(() => {}) });

    expect(result.dataPath).toBe(path.join('/app-data', 'bullshark'));
    expect(result.legacyDataDirCandidate).toBe(path.join('/app-data', 'sharkord'));
  });
});
