import { describe, expect, test } from 'bun:test';
import {
  assertPublicHttpsUrl,
  assertSafePushEndpoint
} from '../assert-safe-endpoint';

describe('assertPublicHttpsUrl', () => {
  test('accepts a plain https url with a public hostname', () => {
    expect(() =>
      assertPublicHttpsUrl('https://push.example.com/endpoint')
    ).not.toThrow();
  });

  test('accepts a public IP literal', () => {
    expect(() => assertPublicHttpsUrl('https://93.184.216.34/x')).not.toThrow();
  });

  test('rejects a non-https scheme', () => {
    expect(() => assertPublicHttpsUrl('http://push.example.com/x')).toThrow();
  });

  test('rejects embedded credentials', () => {
    expect(() =>
      assertPublicHttpsUrl('https://user:pass@push.example.com/x')
    ).toThrow();
  });

  test('rejects loopback, private, link-local and metadata IP literals', () => {
    expect(() => assertPublicHttpsUrl('https://127.0.0.1/x')).toThrow();
    expect(() => assertPublicHttpsUrl('https://10.0.0.5/x')).toThrow();
    expect(() => assertPublicHttpsUrl('https://192.168.1.1/x')).toThrow();
    expect(() =>
      assertPublicHttpsUrl('https://169.254.169.254/latest/meta-data/')
    ).toThrow();
    expect(() => assertPublicHttpsUrl('https://[::1]/x')).toThrow();
  });

  test('rejects an ipv4-mapped ipv6 loopback literal', () => {
    expect(() => assertPublicHttpsUrl('https://[::ffff:127.0.0.1]/x')).toThrow();
  });

  test('rejects a malformed url', () => {
    expect(() => assertPublicHttpsUrl('not-a-url')).toThrow();
  });
});

describe('assertSafePushEndpoint', () => {
  test('accepts a public IP literal without a DNS lookup', async () => {
    await expect(
      assertSafePushEndpoint('https://93.184.216.34/x')
    ).resolves.toBeUndefined();
  });

  test('rejects an internal IP literal', async () => {
    await expect(
      assertSafePushEndpoint('https://169.254.169.254/x')
    ).rejects.toThrow();
  });

  test('rejects a hostname that resolves to loopback', async () => {
    // localhost resolves to 127.0.0.1/::1 via the hosts file - no network
    await expect(
      assertSafePushEndpoint('https://localhost/push')
    ).rejects.toThrow();
  });

  test('rejects a non-https scheme before resolving', async () => {
    await expect(
      assertSafePushEndpoint('http://push.example.com/x')
    ).rejects.toThrow();
  });
});
