import { ChannelPermission, ChannelType } from '@sharkord/shared';
import { describe, expect, test } from 'bun:test';
import { initTest } from '../../__tests__/helpers';
import { getAllChannelUserPermissions } from '../../db/queries/channels';

describe('category permissions', () => {
  test('updatePermissions then getPermissions round-trips for a role', async () => {
    const { caller: owner } = await initTest(1);
    const categoryId = await owner.categories.add({ name: 'Cat' });

    await owner.categories.updatePermissions({
      categoryId,
      roleId: 2,
      permissions: [ChannelPermission.VIEW_CHANNEL]
    });

    const perms = await owner.categories.getPermissions({ categoryId });
    const view = perms.rolePermissions.find(
      (p) => p.roleId === 2 && p.permission === ChannelPermission.VIEW_CHANNEL
    );

    expect(view?.allow).toBe(true);
  });

  test('deletePermissions removes a role override', async () => {
    const { caller: owner } = await initTest(1);
    const categoryId = await owner.categories.add({ name: 'Cat' });

    await owner.categories.updatePermissions({
      categoryId,
      roleId: 2,
      permissions: [ChannelPermission.VIEW_CHANNEL]
    });
    await owner.categories.deletePermissions({ categoryId, roleId: 2 });

    const perms = await owner.categories.getPermissions({ categoryId });

    expect(perms.rolePermissions.length).toBe(0);
  });
});

describe('category permissions — live inheritance', () => {
  test('a channel in a category inherits effective perms without copying rows', async () => {
    const { caller: owner } = await initTest(1);
    const categoryId = await owner.categories.add({ name: 'Cat' });
    await owner.categories.updatePermissions({
      categoryId,
      roleId: 2,
      permissions: [ChannelPermission.VIEW_CHANNEL]
    });

    const channelId = await owner.channels.add({
      type: ChannelType.TEXT,
      name: 'inherits',
      categoryId
    });

    // No channel-level rows are created (inheritance is live, not copied).
    const channelPerms = await owner.channels.getPermissions({ channelId });
    expect(channelPerms.rolePermissions.length).toBe(0);

    // Effective resolution reflects the category override.
    const effective = await getAllChannelUserPermissions(2);
    expect(
      effective[channelId]?.permissions[ChannelPermission.VIEW_CHANNEL]
    ).toBe(true);
  });

  test('a channel in a category with no overrides resolves to defaults', async () => {
    const { caller: owner } = await initTest(1);
    const categoryId = await owner.categories.add({ name: 'Empty' });

    const channelId = await owner.channels.add({
      type: ChannelType.TEXT,
      name: 'orphan',
      categoryId
    });
    const channelPerms = await owner.channels.getPermissions({ channelId });

    expect(channelPerms.rolePermissions.length).toBe(0);

    const effective = await getAllChannelUserPermissions(2);
    expect(
      effective[channelId]?.permissions[ChannelPermission.VIEW_CHANNEL]
    ).toBe(false);
  });
});
