import { ChannelPermission, Permission } from '@sharkord/shared';
import { describe, expect, test } from 'bun:test';
import { initTest } from '../../__tests__/helpers';

const makeChannelOnePrivate = async (
  owner: Awaited<ReturnType<typeof initTest>>['caller']
) => {
  await owner.channels.update({
    channelId: 1,
    name: 'General',
    topic: 'General text channel',
    private: true
  });
};

describe('expanded channel permissions — ADD_REACTIONS', () => {
  test('private channel gates reactions behind ADD_REACTIONS', async () => {
    const { caller: owner } = await initTest(1);
    const { caller: member } = await initTest(2);

    // the default role must be able to react at the server level
    await owner.roles.update({
      roleId: 2,
      name: 'Member',
      color: '#ffffff',
      hoist: false,
      isMentionable: false,
      permissions: [
        Permission.SEND_MESSAGES,
        Permission.REACT_TO_MESSAGES,
        Permission.UPLOAD_FILES
      ],
      storageQuotaOverrideEnabled: false,
      storageSpaceQuota: 0
    });

    await makeChannelOnePrivate(owner);
    await owner.channels.updatePermissions({
      channelId: 1,
      roleId: 2,
      permissions: [
        ChannelPermission.VIEW_CHANNEL,
        ChannelPermission.SEND_MESSAGES
      ]
    });

    const messageId = await owner.messages.send({
      channelId: 1,
      content: 'hi',
      files: []
    });

    // no ADD_REACTIONS override yet -> blocked
    await expect(
      member.messages.toggleReaction({ messageId, emoji: '👍' })
    ).rejects.toThrow('Insufficient channel permissions');

    // grant ADD_REACTIONS -> allowed
    await owner.channels.updatePermissions({
      channelId: 1,
      roleId: 2,
      permissions: [
        ChannelPermission.VIEW_CHANNEL,
        ChannelPermission.ADD_REACTIONS
      ]
    });

    await member.messages.toggleReaction({ messageId, emoji: '👍' });
  });
});

describe('expanded channel permissions — ATTACH_FILES', () => {
  test('private channel gates attachments behind ATTACH_FILES', async () => {
    const { caller: owner } = await initTest(1);
    const { caller: member } = await initTest(2);

    await makeChannelOnePrivate(owner);
    await owner.channels.updatePermissions({
      channelId: 1,
      roleId: 2,
      permissions: [
        ChannelPermission.VIEW_CHANNEL,
        ChannelPermission.SEND_MESSAGES
      ]
    });

    // the permission check runs before any file processing, so a bogus temp
    // file id is enough to exercise the gate.
    await expect(
      member.messages.send({
        channelId: 1,
        content: 'x',
        files: ['bogus-temp-id']
      })
    ).rejects.toThrow('Insufficient channel permissions');

    // grant ATTACH_FILES: the gate now passes (it fails later on the missing
    // temp file or disabled uploads instead, never on the permission).
    await owner.channels.updatePermissions({
      channelId: 1,
      roleId: 2,
      permissions: [
        ChannelPermission.VIEW_CHANNEL,
        ChannelPermission.SEND_MESSAGES,
        ChannelPermission.ATTACH_FILES
      ]
    });

    await expect(
      member.messages.send({
        channelId: 1,
        content: 'x',
        files: ['bogus-temp-id']
      })
    ).rejects.not.toThrow('Insufficient channel permissions');
  });
});
