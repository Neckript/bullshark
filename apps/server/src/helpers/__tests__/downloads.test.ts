import { describe, expect, test } from 'bun:test';
import { downloadPlugin } from '../downloads';

describe('downloadPlugin - URL safety', () => {
  // the guard runs before any network or filesystem access, so these reject
  // without touching the disk or making a request
  test('rejects a non-https download URL', async () => {
    await expect(
      downloadPlugin('http://example.com/plugin.tar.gz', 'checksum')
    ).rejects.toThrow('URL is not allowed.');
  });

  test('rejects a download URL pointing at an internal address', async () => {
    await expect(
      downloadPlugin('https://127.0.0.1/plugin.tar.gz', 'checksum')
    ).rejects.toThrow('URL is not allowed.');

    await expect(
      downloadPlugin('https://169.254.169.254/plugin.tar.gz', 'checksum')
    ).rejects.toThrow('URL is not allowed.');
  });

  test('rejects a malformed download URL', async () => {
    await expect(downloadPlugin('not-a-url', 'checksum')).rejects.toThrow(
      'URL is not allowed.'
    );
  });
});
