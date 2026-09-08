import { describe, expect, test } from 'bun:test';
import fs from 'fs/promises';
import { TLS_CERT_PATH, TLS_KEY_PATH } from '../paths';
import { ensureTlsCertificate, regenerateTlsCertificate } from '../tls';

describe('tls', () => {
  test('ensureTlsCertificate returns null when tls.mode is not selfSigned', async () => {
    // The test config (config.ini in data-test) defaults to tls.mode: 'none'.
    const result = await ensureTlsCertificate();
    expect(result).toBeNull();
  });

  test('regenerateTlsCertificate generates and persists a PEM cert/key pair', async () => {
    const certificate = await regenerateTlsCertificate();

    expect(certificate.cert).toContain('-----BEGIN CERTIFICATE-----');
    expect(certificate.key).toMatch(/-----BEGIN (RSA )?PRIVATE KEY-----/);

    const [writtenCert, writtenKey] = await Promise.all([
      fs.readFile(TLS_CERT_PATH, 'utf-8'),
      fs.readFile(TLS_KEY_PATH, 'utf-8')
    ]);

    expect(writtenCert).toBe(certificate.cert);
    expect(writtenKey).toBe(certificate.key);
  });

  test('regenerateTlsCertificate produces a different key pair each time', async () => {
    const first = await regenerateTlsCertificate();
    const second = await regenerateTlsCertificate();

    expect(first.key).not.toBe(second.key);
  });
});
