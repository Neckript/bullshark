import { OWNER_ROLE_ID } from '@sharkord/shared';
import { describe, expect, test } from 'bun:test';
import http from 'http';
import { login } from '../../__tests__/helpers';
import { tdb } from '../../__tests__/setup';
import { getUserByIdentity } from '../../db/queries/users';
import { userRoles } from '../../db/schema';
import { getOwnerFromRequest } from '../backup-auth';

const makeReq = (token?: string): http.IncomingMessage => {
  const req = new http.IncomingMessage(null as never);
  req.headers = token ? { 'x-backup-token': token } : {};
  return req;
};

describe('getOwnerFromRequest', () => {
  test('returns null when no token is provided', async () => {
    expect(await getOwnerFromRequest(makeReq())).toBeNull();
  });

  test('returns null for a valid token from a non-owner user', async () => {
    const response = await login('someuser', 'password123');
    const { token } = (await response.json()) as { token: string };

    expect(await getOwnerFromRequest(makeReq(token))).toBeNull();
  });

  test('returns the user when the token belongs to the owner', async () => {
    const response = await login('owneruser', 'password123');
    const { token } = (await response.json()) as { token: string };

    const loggedInUser = await getUserByIdentity('owneruser');
    expect(loggedInUser).toBeTruthy();

    await tdb
      .insert(userRoles)
      .values({
        userId: loggedInUser!.id,
        roleId: OWNER_ROLE_ID,
        createdAt: Date.now()
      })
      .onConflictDoNothing();

    const user = await getOwnerFromRequest(makeReq(token));
    expect(user?.id).toBe(loggedInUser!.id);
  });
});
