import fs from 'fs/promises';
import path from 'path';
import { generate } from 'selfsigned';
import { config, SERVER_PRIVATE_IP, SERVER_PUBLIC_IP } from '../config';
import { logger } from '../logger';
import { ensureDir } from './fs';
import { TLS_CERT_PATH, TLS_KEY_PATH } from './paths';

type TTlsCertificate = { cert: string; key: string };

// DNS/IP entries the browser will accept as matching the address bar.
// Covers the ways this server is realistically reached: loopback, the
// detected LAN IP, and the detected public IP (both already computed by
// config.ts - reused as-is, no new network detection here).
const buildSubjectAltNames = () => {
  const ips = [SERVER_PRIVATE_IP, SERVER_PUBLIC_IP].filter(
    (ip): ip is string => !!ip
  );

  return [
    { type: 2 as const, value: 'localhost' },
    { type: 7 as const, ip: '127.0.0.1' },
    ...ips.map((ip) => ({ type: 7 as const, ip }))
  ];
};

const generateSelfSignedCertificate = async (): Promise<TTlsCertificate> => {
  const tenYearsFromNow = new Date();
  tenYearsFromNow.setFullYear(tenYearsFromNow.getFullYear() + 10);

  const pems = await generate([{ name: 'commonName', value: 'bullshark' }], {
    algorithm: 'sha256',
    keyType: 'ec',
    curve: 'P-256',
    notAfterDate: tenYearsFromNow,
    extensions: [
      { name: 'basicConstraints', cA: false },
      { name: 'keyUsage', digitalSignature: true, keyEncipherment: true },
      { name: 'extKeyUsage', serverAuth: true },
      { name: 'subjectAltName', altNames: buildSubjectAltNames() }
    ]
  });

  return { cert: pems.cert, key: pems.private };
};

const writeTlsCertificate = async (
  certificate: TTlsCertificate
): Promise<void> => {
  await ensureDir(path.dirname(TLS_CERT_PATH));
  await fs.writeFile(TLS_CERT_PATH, certificate.cert, { mode: 0o600 });
  await fs.writeFile(TLS_KEY_PATH, certificate.key, { mode: 0o600 });
};

// Only called when tls.mode is 'selfSigned'. Reuses the existing cert/key
// pair from disk if present - never regenerated on its own, since that
// would invalidate the browser's memorized "proceed anyway" exception on
// every restart. Manual regeneration goes through --regenerate-tls-cert.
const ensureTlsCertificate = async (): Promise<TTlsCertificate | null> => {
  if (config.tls.mode !== 'selfSigned') return null;

  const [certExists, keyExists] = await Promise.all([
    fs.exists(TLS_CERT_PATH),
    fs.exists(TLS_KEY_PATH)
  ]);

  if (certExists && keyExists) {
    const [cert, key] = await Promise.all([
      fs.readFile(TLS_CERT_PATH, 'utf-8'),
      fs.readFile(TLS_KEY_PATH, 'utf-8')
    ]);

    return { cert, key };
  }

  const certificate = await generateSelfSignedCertificate();
  await writeTlsCertificate(certificate);

  logger.info('[TLS] Self-signed certificate generated');

  return certificate;
};

const regenerateTlsCertificate = async (): Promise<TTlsCertificate> => {
  const certificate = await generateSelfSignedCertificate();
  await writeTlsCertificate(certificate);

  return certificate;
};

export { ensureTlsCertificate, regenerateTlsCertificate };
export type { TTlsCertificate };
