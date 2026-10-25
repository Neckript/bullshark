import type { TTempFile } from '@bullshark/shared';
import { beforeEach, describe, expect, test } from 'bun:test';
import { eq } from 'drizzle-orm';
import fs from 'fs/promises';
import { initTest, login, uploadFile } from '../../__tests__/helpers';
import { tdb } from '../../__tests__/setup';
import { settings, users } from '../../db/schema';
import { verifyFileToken } from '../../helpers/files-crypto';
import { fileManager } from '../../utils/file-manager';

describe('files router', () => {
  let tempFile: TTempFile;
  let counter = 0;

  beforeEach(async () => {
    const response = await login('testowner', 'password123');
    const data: any = await response.json();

    const res = await uploadFile(
      new File(['test'], `file-${counter++}.txt`, { type: 'text/plain' }),
      data.token
    );

    tempFile = (await res.json()) as TTempFile;
  });

  test('should check temporary file existence', async () => {
    expect(tempFile).toBeDefined();
    expect(tempFile.id).toBeDefined();

    const file = await fileManager.getTemporaryFile(tempFile.id);

    expect(file).toBeDefined();
    expect(file?.path).toBe(tempFile.path);
    expect(file?.originalName).toBe(tempFile.originalName);
    expect(file?.size).toBe(tempFile.size);

    const stat = await fs.stat(tempFile.path);

    expect(stat.size).toBe(tempFile.size);
  });

  test('should delete a temporary file', async () => {
    const { caller } = await initTest();

    expect(await fs.exists(tempFile.path)).toBe(true);

    await caller.files.deleteTemporary({
      fileId: tempFile.id
    });

    expect(await fs.exists(tempFile.path)).toBe(false);
  });

  test('should throw when deleting a non-existent temporary file', async () => {
    const { caller } = await initTest();

    await expect(
      caller.files.deleteTemporary({
        fileId: '<non-existent-file-id>' // non-existent file ID
      })
    ).rejects.toThrow('Temporary file not found');
  });

  test('should throw when deleting other users temporary file', async () => {
    const { caller } = await initTest(2);

    await expect(
      caller.files.deleteTemporary({
        fileId: tempFile.id
      })
    ).rejects.toThrow(
      'You do not have permission to delete this temporary file'
    );

    expect(await fs.exists(tempFile.path)).toBe(true);
  });
});

describe('files.refreshTokens', () => {
  const uploadAs = async (name: string) => {
    const response = await login('testowner', 'password123');
    const { token } = (await response.json()) as { token: string };
    const res = await uploadFile(
      new File(['x'], name, { type: 'text/plain' }),
      token
    );

    return (await res.json()) as TTempFile;
  };

  const enableSignedUrls = () =>
    tdb.update(settings).set({
      storageSignedUrlsEnabled: true,
      storageSignedUrlsTtlSeconds: 3600
    });

  test('returns nothing while signed URLs are disabled', async () => {
    const { caller } = await initTest();

    expect(await caller.files.refreshTokens({ fileIds: [1] })).toEqual({});
  });

  test('re-signs an avatar for any member and skips orphaned files', async () => {
    await enableSignedUrls();

    const avatar = await fileManager.saveFile(
      (await uploadAs('avatar.txt')).id,
      1
    );
    const orphan = await fileManager.saveFile(
      (await uploadAs('orphan.txt')).id,
      1
    );

    await tdb.update(users).set({ avatarId: avatar.id }).where(eq(users.id, 1));

    const { caller: member } = await initTest(2);
    const tokens = await member.files.refreshTokens({
      fileIds: [avatar.id, orphan.id]
    });

    expect(Object.keys(tokens)).toEqual([String(avatar.id)]);

    const { token, expiresAt } = tokens[avatar.id]!;

    expect(expiresAt).toBeGreaterThan(Date.now());
    expect(verifyFileToken(avatar.id, token, expiresAt)).toBe(true);
  });

  test('re-signs an attachment only for members who can view its channel', async () => {
    await enableSignedUrls();

    const { caller: owner } = await initTest(1);

    const messageId = await owner.messages.send({
      content: 'private attachment',
      channelId: 1,
      files: [(await uploadAs('secret.txt')).id]
    });
    const [file] = await (
      await import('../../db/queries/files')
    ).getFilesByMessageId(messageId);

    await owner.channels.update({
      channelId: 1,
      name: 'General',
      topic: 'General text channel',
      private: true
    });

    const { caller: member } = await initTest(2);

    expect(await member.files.refreshTokens({ fileIds: [file!.id] })).toEqual(
      {}
    );
    expect(
      Object.keys(await owner.files.refreshTokens({ fileIds: [file!.id] }))
    ).toEqual([String(file!.id)]);
  });
});
