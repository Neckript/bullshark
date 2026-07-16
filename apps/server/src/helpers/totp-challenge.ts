import crypto from 'crypto';
import { getServerTokenSync } from '../db/queries/server';

const DEFAULT_TTL_MS = 5 * 60 * 1000;

const sign = (userId: number, expiresAt: number): string =>
  crypto
    .createHmac('sha256', getServerTokenSync())
    .update(`totp-challenge:${userId}:${expiresAt}`)
    .digest('hex');

const createTotpChallenge = (
  userId: number,
  ttlMs: number = DEFAULT_TTL_MS
): string => {
  const expiresAt = Date.now() + ttlMs;
  return `${userId}.${expiresAt}.${sign(userId, expiresAt)}`;
};

const resolveTotpChallenge = (challenge: string): number | null => {
  const parts = challenge.split('.');
  if (parts.length !== 3) return null;

  const userId = Number(parts[0]);
  const expiresAt = Number(parts[1]);
  const providedHmac = parts[2]!;

  if (!Number.isInteger(userId) || !Number.isInteger(expiresAt)) return null;
  if (Date.now() > expiresAt) return null;

  const expectedHmac = sign(userId, expiresAt);
  if (expectedHmac.length !== providedHmac.length) return null;

  const valid = crypto.timingSafeEqual(
    Buffer.from(expectedHmac),
    Buffer.from(providedHmac)
  );

  return valid ? userId : null;
};

export { createTotpChallenge, resolveTotpChallenge };
