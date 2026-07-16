import http from 'http';
import jwt from 'jsonwebtoken';
import z from 'zod';
import { config } from '../config';
import { getServerToken } from '../db/queries/server';
import { getUserTotp } from '../db/queries/totp';
import { getUserById } from '../db/queries/users';
import { getWsInfo } from '../helpers/get-ws-info';
import { resolveTotpChallenge } from '../helpers/totp-challenge';
import { decryptTotpSecret } from '../helpers/totp-crypto';
import { verifySecondFactor } from '../helpers/verify-second-factor';
import {
  createRateLimiter,
  getClientRateLimitKey,
  getRateLimitRetrySeconds
} from '../utils/rate-limiters/rate-limiter';
import { getJsonBody, sendJsonError } from './helpers';

const zBody = z.object({
  challenge: z.string().min(1),
  code: z.string().min(6).max(11)
});

const rateLimiter = createRateLimiter({
  maxRequests: config.rateLimiters.twoFactor.maxRequests,
  windowMs: config.rateLimiters.twoFactor.windowMs
});

const login2faRouteHandler = async (
  req: http.IncomingMessage,
  res: http.ServerResponse
) => {
  const info = getWsInfo(undefined, req);

  if (info?.ip) {
    const rate = rateLimiter.consume(getClientRateLimitKey(info.ip));

    if (!rate.allowed) {
      res.setHeader('Retry-After', getRateLimitRetrySeconds(rate.retryAfterMs));
      sendJsonError(res, 429, 'Too many attempts. Please try again shortly.');
      return;
    }
  }

  const data = zBody.parse(await getJsonBody(req));
  const userId = resolveTotpChallenge(data.challenge);

  if (userId == null) {
    sendJsonError(res, 400, 'Invalid or expired challenge');
    return;
  }

  const totp = await getUserTotp(userId);

  if (!totp?.totpSecret || totp.totpEnabledAt == null) {
    sendJsonError(res, 400, 'Invalid challenge');
    return;
  }

  const ok = await verifySecondFactor(
    userId,
    decryptTotpSecret(totp.totpSecret),
    data.code
  );

  if (!ok) {
    sendJsonError(res, 400, 'Invalid code');
    return;
  }

  const user = await getUserById(userId);

  if (!user || user.banned) {
    sendJsonError(res, 400, 'Login not allowed');
    return;
  }

  const token = jwt.sign({ userId }, await getServerToken(), {
    expiresIn: '604800s' // 7 days
  });

  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ success: true, token }));
};

export { login2faRouteHandler };
