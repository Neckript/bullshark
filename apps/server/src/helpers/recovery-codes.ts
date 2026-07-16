import { sha256 } from '@sharkord/shared';
import crypto from 'crypto';

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'; // Crockford-ish base32, no ambiguous chars

const randomGroup = (length: number): string => {
  const bytes = crypto.randomBytes(length);
  let out = '';
  for (let i = 0; i < length; i++) out += ALPHABET[bytes[i]! % ALPHABET.length];
  return out;
};

const generateRecoveryCodes = (count = 10): string[] => {
  const codes = new Set<string>();
  while (codes.size < count) codes.add(`${randomGroup(5)}-${randomGroup(5)}`);
  return [...codes];
};

const normalizeRecoveryCode = (code: string): string =>
  code.trim().toUpperCase().replace(/\s+/g, '');

const hashRecoveryCode = (code: string): Promise<string> =>
  sha256(normalizeRecoveryCode(code));

export { generateRecoveryCodes, hashRecoveryCode, normalizeRecoveryCode };
