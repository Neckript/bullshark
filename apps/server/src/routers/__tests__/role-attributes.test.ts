import { describe, expect, test } from 'bun:test';
import { initTest } from '../../__tests__/helpers';

describe('role attributes — update-role', () => {
  test('owner can set hoist and isMentionable', async () => {
    const { caller: owner } = await initTest();
    const roleId = await owner.roles.add();
    await owner.roles.update({
      roleId,
      name: 'Hoisted',
      color: '#00ff00',
      hoist: true,
      isMentionable: true,
      permissions: [],
      storageQuotaOverrideEnabled: false,
      storageSpaceQuota: 0
    });
    const all = await owner.roles.getAll();
    const role = all.find((r) => r.id === roleId)!;
    expect(role.hoist).toBe(true);
    expect(role.isMentionable).toBe(true);
  });
});

describe('role attributes — icon', () => {
  test('clearing icon (no temp file) leaves icon_file_id null', async () => {
    const { caller: owner } = await initTest();
    const roleId = await owner.roles.add();
    await owner.roles.changeIcon({ roleId });
    const all = await owner.roles.getAll();
    expect(all.find((r) => r.id === roleId)!.iconFileId ?? null).toBeNull();
  });
});
