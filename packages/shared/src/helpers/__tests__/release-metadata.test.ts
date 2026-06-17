import { describe, expect, test } from 'bun:test';
import { validateReleaseMetadata } from '../release-metadata';

const valid = {
  version: '1.2.3',
  releaseDate: '2026-06-17T12:00:00.000Z',
  artifacts: [
    { name: 'bullshark-linux-x64', target: 'linux-x64', size: 123, checksum: 'abc' }
  ]
};

describe('validateReleaseMetadata', () => {
  test('returns the parsed metadata for a valid manifest', () => {
    expect(validateReleaseMetadata(valid)).toEqual(valid);
  });

  test('throws when version is missing', () => {
    const { version: _omit, ...bad } = valid;
    expect(() => validateReleaseMetadata(bad)).toThrow();
  });

  test('throws when an artifact is missing checksum', () => {
    const bad = {
      ...valid,
      artifacts: [{ name: 'x', target: 'linux-x64', size: 1 }]
    };
    expect(() => validateReleaseMetadata(bad)).toThrow();
  });
});
