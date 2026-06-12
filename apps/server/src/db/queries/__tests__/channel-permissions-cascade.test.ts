import { ChannelPermission, ChannelType } from '@sharkord/shared';
import { describe, expect, test } from 'bun:test';
import { initTest } from '../../../__tests__/helpers';
import { getAllChannelUserPermissions } from '../channels';

// role 2 = default "Member"; user 2 has role 2 (see seed.ts)
const MEMBER_ROLE_ID = 2;
const MEMBER_USER_ID = 2;

describe('channel permission cascade — getAllChannelUserPermissions', () => {
  test('category role override is inherited when channel has none', async () => {
    const { caller: owner } = await initTest(1);
    const categoryId = await owner.categories.add({ name: 'Cat' });
    const channelId = await owner.channels.add({
      type: ChannelType.TEXT,
      name: 'general',
      categoryId
    });

    await owner.categories.updatePermissions({
      categoryId,
      roleId: MEMBER_ROLE_ID,
      permissions: [ChannelPermission.VIEW_CHANNEL]
    });

    const perms = await getAllChannelUserPermissions(MEMBER_USER_ID);

    expect(perms[channelId]?.permissions[ChannelPermission.VIEW_CHANNEL]).toBe(
      true
    );
  });

  test('channel override beats category override (channel denies)', async () => {
    const { caller: owner } = await initTest(1);
    const categoryId = await owner.categories.add({ name: 'Cat' });
    const channelId = await owner.channels.add({
      type: ChannelType.TEXT,
      name: 'general',
      categoryId
    });

    await owner.categories.updatePermissions({
      categoryId,
      roleId: MEMBER_ROLE_ID,
      permissions: [ChannelPermission.VIEW_CHANNEL]
    });
    // channel role override with empty permissions => deny everything
    await owner.channels.updatePermissions({
      channelId,
      roleId: MEMBER_ROLE_ID,
      permissions: []
    });

    const perms = await getAllChannelUserPermissions(MEMBER_USER_ID);

    expect(perms[channelId]?.permissions[ChannelPermission.VIEW_CHANNEL]).toBe(
      false
    );
  });

  test('type-first: category USER override beats channel ROLE override', async () => {
    const { caller: owner } = await initTest(1);
    const categoryId = await owner.categories.add({ name: 'Cat' });
    const channelId = await owner.channels.add({
      type: ChannelType.TEXT,
      name: 'general',
      categoryId
    });

    // channel role override denies VIEW_CHANNEL
    await owner.channels.updatePermissions({
      channelId,
      roleId: MEMBER_ROLE_ID,
      permissions: []
    });
    // category USER override allows VIEW_CHANNEL for user 2
    await owner.categories.updatePermissions({
      categoryId,
      userId: MEMBER_USER_ID,
      permissions: [ChannelPermission.VIEW_CHANNEL]
    });

    const perms = await getAllChannelUserPermissions(MEMBER_USER_ID);

    expect(perms[channelId]?.permissions[ChannelPermission.VIEW_CHANNEL]).toBe(
      true
    );
  });

  test('no category and no channel override => default false', async () => {
    const { caller: owner } = await initTest(1);
    const categoryId = await owner.categories.add({ name: 'Empty' });
    const channelId = await owner.channels.add({
      type: ChannelType.TEXT,
      name: 'orphan',
      categoryId
    });

    const perms = await getAllChannelUserPermissions(MEMBER_USER_ID);

    expect(perms[channelId]?.permissions[ChannelPermission.VIEW_CHANNEL]).toBe(
      false
    );
  });
});
