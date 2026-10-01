import { describe, expect, test } from 'bun:test';
import { getRole, getRoles } from '../roles';

// Both queries are prepared, and both carry a group_concat over a left join.
// That aggregation is the part a prepared statement could plausibly get wrong,
// and nothing else in the suite calls these two, so this is its only cover.
describe('roles queries', () => {
  test('getRoles returns permissions parsed into an array', async () => {
    const roles = await getRoles();

    expect(roles.length).toBeGreaterThan(0);

    const withPermissions = roles.find((r) => r.permissions.length > 0);

    expect(withPermissions).toBeDefined();
    expect(Array.isArray(withPermissions!.permissions)).toBe(true);
  });

  test('getRole agrees with getRoles for the same id', async () => {
    const roles = await getRoles();
    const expected = roles.find((r) => r.permissions.length > 0)!;

    const role = await getRole(expected.id);

    expect(role?.id).toBe(expected.id);
    expect(role?.name).toBe(expected.name);
    expect(role?.permissions).toEqual(expected.permissions);
  });

  test('getRole returns undefined for an unknown id', async () => {
    expect(await getRole(999999)).toBeUndefined();
  });
});
