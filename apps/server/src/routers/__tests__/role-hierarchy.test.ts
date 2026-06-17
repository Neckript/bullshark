import {
  OWNER_ROLE_ID,
  OWNER_ROLE_POSITION,
  Permission
} from '@sharkord/shared';
import { describe, expect, test } from 'bun:test';
import { initTest } from '../../__tests__/helpers';
import { getRolePosition, getUserTopPosition } from '../../db/queries/roles';

describe('role hierarchy — rank queries', () => {
  test('owner user ranks at the owner sentinel', async () => {
    await initTest(); // user 1 = owner
    expect(await getUserTopPosition(1)).toBe(OWNER_ROLE_POSITION);
  });

  test('owner role position is the owner sentinel', async () => {
    await initTest();
    expect(await getRolePosition(OWNER_ROLE_ID)).toBe(OWNER_ROLE_POSITION);
  });

  test('default role (id 2) has position 0', async () => {
    await initTest();
    expect(await getRolePosition(2)).toBe(0);
  });

  test('new roles are inserted at the bottom (position 1, others shift up)', async () => {
    const { caller } = await initTest();
    const first = await caller.roles.add();
    const second = await caller.roles.add();

    // second is created last, so it sits at the bottom (1); first shifts to 2
    expect(await getRolePosition(second)).toBe(1);
    expect(await getRolePosition(first)).toBe(2);
  });
});

describe('role hierarchy — role mutation enforcement', () => {
  test('non-owner with MANAGE_ROLES cannot edit the owner role', async () => {
    const { caller: owner } = await initTest();
    const modRoleId = await owner.roles.add();
    await owner.roles.update({
      roleId: modRoleId,
      name: 'Mod',
      color: '#00ff00',
      hoist: false,
      isMentionable: false,
      permissions: [Permission.MANAGE_ROLES],
      storageQuotaOverrideEnabled: false,
      storageSpaceQuota: 0
    });
    await owner.users.addRole({ userId: 2, roleId: modRoleId });

    const { caller: mod } = await initTest(2);
    await expect(
      mod.roles.update({
        roleId: OWNER_ROLE_ID,
        name: 'Owner',
        color: '#ff0000',
        hoist: false,
        isMentionable: false,
        permissions: [],
        storageQuotaOverrideEnabled: false,
        storageSpaceQuota: 0
      })
    ).rejects.toThrow('equal to or above');
  });

  test('owner can clear a role colour back to default white', async () => {
    const { caller: owner } = await initTest();
    const roleId = await owner.roles.add();
    await owner.roles.update({
      roleId,
      name: 'Colorless',
      color: '#ffffff',
      hoist: false,
      isMentionable: false,
      permissions: [],
      storageQuotaOverrideEnabled: false,
      storageSpaceQuota: 0
    });
    const all = await owner.roles.getAll();
    expect(all.find((r) => r.id === roleId)!.color).toBe('#ffffff');
  });
});

describe('role hierarchy — reorder', () => {
  test('owner reorders movable roles into contiguous positions', async () => {
    const { caller: owner } = await initTest();
    const a = await owner.roles.add();
    const b = await owner.roles.add();

    const before = await owner.roles.getAll(); // ordered desc by position
    const movableBefore = before
      .filter((r) => r.id !== OWNER_ROLE_ID && !r.isDefault)
      .map((r) => r.id); // top-first

    const desired = [...movableBefore].reverse(); // new top-first order
    await owner.roles.reorder({ orderedRoleIds: desired });

    const after = await owner.roles.getAll();
    const movableAfter = after.filter(
      (r) => r.id !== OWNER_ROLE_ID && !r.isDefault
    );

    expect(movableAfter.map((r) => r.id)).toEqual(desired);
    for (let i = 1; i < movableAfter.length; i++) {
      expect(movableAfter[i - 1]!.position).toBeGreaterThan(
        movableAfter[i]!.position
      );
    }
    expect(after.find((r) => r.isDefault)!.position).toBe(0);
    expect(desired).toContain(a);
    expect(desired).toContain(b);
  });

  test('reorder rejects an input containing the owner role', async () => {
    const { caller: owner } = await initTest();
    const a = await owner.roles.add();
    await expect(
      owner.roles.reorder({ orderedRoleIds: [OWNER_ROLE_ID, a] })
    ).rejects.toThrow();
  });
});

describe('role hierarchy — assignment & moderation', () => {
  test('a mod cannot assign a role ranked at/above their own', async () => {
    const { caller: owner } = await initTest();
    const high = await owner.roles.add(); // ends at position 2
    const low = await owner.roles.add(); // position 1 (mod's role)

    await owner.roles.update({
      roleId: low,
      name: 'Low',
      color: '#336699',
      hoist: false,
      isMentionable: false,
      permissions: [Permission.MANAGE_USERS],
      storageQuotaOverrideEnabled: false,
      storageSpaceQuota: 0
    });
    await owner.users.addRole({ userId: 2, roleId: low });

    const { caller: mod } = await initTest(2);
    await expect(
      mod.users.addRole({ userId: 1, roleId: high })
    ).rejects.toThrow('equal to or above');
  });
});
