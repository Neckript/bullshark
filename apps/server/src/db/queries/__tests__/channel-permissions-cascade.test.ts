import { ChannelPermission, ChannelType } from '@sharkord/shared';
import { describe, expect, test } from 'bun:test';
import { initTest } from '../../../__tests__/helpers';
import {
  channelUserCan,
  getAllChannelUserPermissions,
  getAffectedUserIdsForCategoryTarget
} from '../channels';

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

describe('channel permission cascade — channelUserCan (private channel)', () => {
  test('private channel is visible via inherited category VIEW_CHANNEL', async () => {
    const { caller: owner } = await initTest(1);
    const categoryId = await owner.categories.add({ name: 'Cat' });
    const channelId = await owner.channels.add({
      type: ChannelType.TEXT,
      name: 'secret',
      categoryId
    });
    await owner.channels.update({ channelId, private: true });

    // before any override: member cannot view
    expect(
      await channelUserCan(
        channelId,
        MEMBER_USER_ID,
        ChannelPermission.VIEW_CHANNEL
      )
    ).toBe(false);

    // category grants VIEW_CHANNEL to the member role
    await owner.categories.updatePermissions({
      categoryId,
      roleId: MEMBER_ROLE_ID,
      permissions: [ChannelPermission.VIEW_CHANNEL]
    });

    expect(
      await channelUserCan(
        channelId,
        MEMBER_USER_ID,
        ChannelPermission.VIEW_CHANNEL
      )
    ).toBe(true);
  });
});

describe('getAffectedUserIdsForCategoryTarget', () => {
  test('returns all members of a role', async () => {
    await initTest(1);

    const ids = await getAffectedUserIdsForCategoryTarget({
      roleId: MEMBER_ROLE_ID
    });

    // users 2, 3, 4 all have the default member role (see seed.ts)
    expect(ids.sort()).toEqual([2, 3, 4]);
  });

  test('returns the single user for a user target', async () => {
    await initTest(1);

    const ids = await getAffectedUserIdsForCategoryTarget({ userId: 4 });

    expect(ids).toEqual([4]);
  });
});
