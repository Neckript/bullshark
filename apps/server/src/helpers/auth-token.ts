import jwt from 'jsonwebtoken';
import { getServerToken } from '../db/queries/server';

const AUTH_TOKEN_EXPIRES_IN = '604800s'; // 7 days

// Single place where authentication tokens are minted, so login, 2FA and the
// sliding refresh all issue tokens with the same lifetime.
const signAuthToken = async (userId: number) =>
  jwt.sign({ userId }, await getServerToken(), {
    expiresIn: AUTH_TOKEN_EXPIRES_IN
  });

export { signAuthToken };
