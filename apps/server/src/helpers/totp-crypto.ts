import crypto from 'crypto';
import { getServerTokenSync } from '../db/queries/server';

const deriveKey = (): Buffer =>
  crypto.createHash('sha256').update(getServerTokenSync()).digest();

const encryptTotpSecret = (plain: string): string => {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', deriveKey(), iv);
  const ciphertext = Buffer.concat([
    cipher.update(plain, 'utf8'),
    cipher.final()
  ]);
  const tag = cipher.getAuthTag();

  return [
    iv.toString('base64'),
    tag.toString('base64'),
    ciphertext.toString('base64')
  ].join(':');
};

const decryptTotpSecret = (payload: string): string => {
  const [ivB64, tagB64, ctB64] = payload.split(':');

  if (!ivB64 || !tagB64 || !ctB64) {
    throw new Error('Invalid encrypted TOTP secret payload');
  }

  const decipher = crypto.createDecipheriv(
    'aes-256-gcm',
    deriveKey(),
    Buffer.from(ivB64, 'base64')
  );
  decipher.setAuthTag(Buffer.from(tagB64, 'base64'));

  return Buffer.concat([
    decipher.update(Buffer.from(ctB64, 'base64')),
    decipher.final()
  ]).toString('utf8');
};

export { decryptTotpSecret, encryptTotpSecret };
