import { describe, expect, test } from 'bun:test';
import jwt from 'jsonwebtoken';
import { getServerToken } from '../server';
import { getUserByToken } from '../users';

// getUserByToken is the single place any auth token is verified, so the
// algorithm pin lives there. These two tests are what fails if the
// `algorithms` option is ever dropped: without it, jsonwebtoken accepts every
// HMAC variant of the same secret, and the second case below starts passing
// verification instead of being rejected.
describe('getUserByToken algorithm pinning', () => {
  test('accepts a token signed with the pinned algorithm', async () => {
    const token = jwt.sign({ userId: 1 }, await getServerToken(), {
      algorithm: 'HS256'
    });

    const user = await getUserByToken(token);

    expect(user?.id).toBe(1);
  });

  test('rejects a token signed with another HMAC algorithm', async () => {
    const token = jwt.sign({ userId: 1 }, await getServerToken(), {
      algorithm: 'HS512'
    });

    expect(await getUserByToken(token)).toBeUndefined();
  });
});
