import jwt from 'jsonwebtoken';
import { getServerToken } from '../db/queries/server';

const AUTH_TOKEN_EXPIRES_IN = '604800s'; // 7 days

// Pinned on both sign and verify so the accepted algorithm never widens by
// default. jsonwebtoken 9 already limits a string secret to the HMAC family,
// so this is not closing a reachable hole today - it is what keeps the
// confusion attack out if the key material ever becomes asymmetric.
const AUTH_TOKEN_ALGORITHM = 'HS256' as const;

// Single place where authentication tokens are minted, so login, 2FA and the
// sliding refresh all issue tokens with the same lifetime.
//
// tokenVersion is passed in rather than looked up here: all three call sites
// already hold the user they are minting for, so a lookup would be a second
// read of a row they just read.
const signAuthToken = async (userId: number, tokenVersion: number) =>
  jwt.sign({ userId, tokenVersion }, await getServerToken(), {
    algorithm: AUTH_TOKEN_ALGORITHM,
    expiresIn: AUTH_TOKEN_EXPIRES_IN
  });

export { AUTH_TOKEN_ALGORITHM, signAuthToken };
