import { describe, expect, test } from 'bun:test';
import { getUserById, getUsers } from '../users';

// getUsers and getUserById build the same TJoinedUser from the same shared
// column list. Nothing else in the suite calls getUsers, and its column list
// used to be a third hand-maintained copy, so this is what catches the two
// paths drifting apart again.
describe('getUsers', () => {
  test('returns every user with roleIds populated', async () => {
    const users = await getUsers();

    expect(users.length).toBeGreaterThan(0);
    expect(users.every((u) => Array.isArray(u.roleIds))).toBe(true);

    const withRole = users.find((u) => u.roleIds.length > 0);

    expect(withRole).toBeDefined();
  });

  test('agrees field for field with getUserById', async () => {
    const users = await getUsers();

    for (const listed of users) {
      const single = await getUserById(listed.id);

      expect(single).toBeDefined();
      expect(Object.keys(listed).sort()).toEqual(Object.keys(single!).sort());
      expect(listed).toEqual(single!);
    }
  });
});
