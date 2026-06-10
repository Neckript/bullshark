import { ChannelPermission, ChannelType } from '@sharkord/shared';
import { describe, expect, test } from 'bun:test';
import { initTest } from '../../__tests__/helpers';

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

describe('category permissions — apply to channels', () => {
  test('copies category overrides onto child channels, replacing theirs', async () => {
    const { caller: owner } = await initTest(1);
    const categoryId = await owner.categories.add({ name: 'Cat' });
    const channelId = await owner.channels.add({
      type: ChannelType.TEXT,
      name: 'general',
      categoryId
    });

    // give the channel a stale override that should be wiped
    await owner.channels.updatePermissions({
      channelId,
      roleId: 2,
      permissions: []
    });
    // category allows VIEW_CHANNEL for role 2
    await owner.categories.updatePermissions({
      categoryId,
      roleId: 2,
      permissions: [ChannelPermission.VIEW_CHANNEL]
    });

    await owner.categories.applyPermissionsToChannels({ categoryId });

    const perms = await owner.channels.getPermissions({ channelId });
    const view = perms.rolePermissions.find(
      (p) => p.roleId === 2 && p.permission === ChannelPermission.VIEW_CHANNEL
    );

    expect(view?.allow).toBe(true);
  });
});

describe('category permissions — inheritance on create', () => {
  test('a channel created in a category inherits its overrides', async () => {
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
    const perms = await owner.channels.getPermissions({ channelId });

    expect(
      perms.rolePermissions.find(
        (p) =>
          p.roleId === 2 && p.permission === ChannelPermission.VIEW_CHANNEL
      )?.allow
    ).toBe(true);
  });

  test('a channel created in a category with no overrides inherits nothing', async () => {
    const { caller: owner } = await initTest(1);
    const categoryId = await owner.categories.add({ name: 'Empty' });

    const channelId = await owner.channels.add({
      type: ChannelType.TEXT,
      name: 'orphan',
      categoryId
    });
    const perms = await owner.channels.getPermissions({ channelId });

    expect(perms.rolePermissions.length).toBe(0);
  });
});
