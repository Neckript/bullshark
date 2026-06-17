import { describe, expect, test } from 'bun:test';
import { selectUpdate } from '../updater';

const meta = (version: string) => ({
  version,
  releaseDate: '2026-06-17T00:00:00.000Z',
  artifacts: [
    { name: 'bullshark-linux-x64', target: 'linux-x64', size: 1, checksum: 'h' },
    { name: 'bullshark-linux-arm64', target: 'linux-arm64', size: 1, checksum: 'h' }
  ]
});

describe('selectUpdate', () => {
  test('returns the matching artifact when the version is newer', () => {
    const a = selectUpdate(meta('9.9.9'), 'linux-x64', '1.0.0');
    expect(a?.name).toBe('bullshark-linux-x64');
  });

  test('returns null when the version is not newer', () => {
    expect(selectUpdate(meta('1.0.0'), 'linux-x64', '1.0.0')).toBeNull();
  });

  test('returns null when no artifact matches the arch', () => {
    const noArm = {
      ...meta('9.9.9'),
      artifacts: meta('9.9.9').artifacts.filter((x) => x.target !== 'linux-arm64')
    };
    expect(selectUpdate(noArm, 'linux-arm64', '1.0.0')).toBeNull();
  });
});
