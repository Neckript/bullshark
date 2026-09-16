import { Permission } from '@bullshark/shared';
import { describe, expect, test } from 'bun:test';
import { eq } from 'drizzle-orm';
import { initTest } from '../../__tests__/helpers';
import { tdb } from '../../__tests__/setup';
import { files, rolePermissions, roles, userRoles } from '../../db/schema';

describe('roles router', () => {
  test('should throw when user lacks permissions (getAll)', async () => {
    const { caller } = await initTest(2);

    await expect(caller.roles.getAll()).rejects.toThrow(
      'Insufficient permissions'
    );
  });

  test('should throw when user lacks permissions (add)', async () => {
    const { caller } = await initTest(2);

    await expect(caller.roles.add()).rejects.toThrow(
      'Insufficient permissions'
    );
  });

  test('should throw when user lacks permissions (update)', async () => {
    const { caller } = await initTest(2);

    await expect(
      caller.roles.update({
        roleId: 2,
        name: 'Updated Role',
        color: '#ff0000',
        hoist: false,
        isMentionable: false,
        permissions: [Permission.SEND_MESSAGES],
        storageQuotaOverrideEnabled: false,
        storageSpaceQuota: 0
      })
    ).rejects.toThrow('Insufficient permissions');
  });

  test('should throw when user lacks permissions (delete)', async () => {
    const { caller } = await initTest(2);

    await expect(
      caller.roles.delete({
        roleId: 2
      })
    ).rejects.toThrow('Insufficient permissions');
  });

  test('should throw when user lacks permissions (setDefault)', async () => {
    const { caller } = await initTest(2);

    await expect(
      caller.roles.setDefault({
        roleId: 1
      })
    ).rejects.toThrow('Insufficient permissions');
  });

  test('should get all roles', async () => {
    const { caller } = await initTest();

    const roles = await caller.roles.getAll();

    expect(roles).toBeDefined();
    expect(Array.isArray(roles)).toBe(true);
    expect(roles.length).toBeGreaterThanOrEqual(2);
  });

  test('should create new role', async () => {
    const { caller } = await initTest();

    const roleId = await caller.roles.add();

    expect(roleId).toBeDefined();
    expect(typeof roleId).toBe('number');
    expect(roleId).toBeGreaterThan(0);

    const roles = await caller.roles.getAll();
    const newRole = roles.find((r) => r.id === roleId);

    expect(newRole).toBeDefined();
    expect(newRole!.name).toBe('New Role');
    expect(newRole!.color).toBe('#ffffff');
    expect(newRole!.isDefault).toBe(false);
    expect(newRole!.isPersistent).toBe(false);
    expect(newRole!.storageQuotaOverrideEnabled).toBe(false);
    expect(newRole!.storageSpaceQuota).toBe(0);
  });

  test('should update existing role', async () => {
    const { caller } = await initTest();

    const roleId = await caller.roles.add();

    await caller.roles.update({
      roleId,
      name: 'Updated Role Name',
      color: '#ff5500',
      hoist: false,
      isMentionable: false,
      permissions: [Permission.SEND_MESSAGES, Permission.UPLOAD_FILES],
      storageQuotaOverrideEnabled: false,
      storageSpaceQuota: 0
    });

    const roles = await caller.roles.getAll();
    const updatedRole = roles.find((r) => r.id === roleId);

    expect(updatedRole).toBeDefined();
    expect(updatedRole!.name).toBe('Updated Role Name');
    expect(updatedRole!.color).toBe('#ff5500');
    expect(updatedRole!.permissions).toContain(Permission.SEND_MESSAGES);
    expect(updatedRole!.permissions).toContain(Permission.UPLOAD_FILES);
    expect(updatedRole!.permissions.length).toBe(2);
    expect(updatedRole!.storageQuotaOverrideEnabled).toBe(false);
    expect(updatedRole!.storageSpaceQuota).toBe(0);
  });

  test('should update role storage override settings', async () => {
    const { caller } = await initTest();

    const roleId = await caller.roles.add();

    await caller.roles.update({
      roleId,
      name: 'Storage Role',
      color: '#336699',
      hoist: false,
      isMentionable: false,
      permissions: [Permission.UPLOAD_FILES],
      storageQuotaOverrideEnabled: true,
      storageSpaceQuota: 1024 * 1024 * 1024
    });

    const roles = await caller.roles.getAll();
    const updatedRole = roles.find((r) => r.id === roleId);

    expect(updatedRole).toBeDefined();
    expect(updatedRole!.storageQuotaOverrideEnabled).toBe(true);
    expect(updatedRole!.storageSpaceQuota).toBe(1024 * 1024 * 1024);
  });

  test('should reject invalid role storage quota', async () => {
    const { caller } = await initTest();

    const roleId = await caller.roles.add();

    await expect(
      caller.roles.update({
        roleId,
        name: 'Invalid Storage Role',
        color: '#336699',
        hoist: false,
        isMentionable: false,
        permissions: [Permission.UPLOAD_FILES],
        storageQuotaOverrideEnabled: true,
        storageSpaceQuota: -1
      })
    ).rejects.toThrow();
  });

  test('should not allow updating Owner role permissions', async () => {
    const { caller } = await initTest();

    await caller.roles.update({
      roleId: 1,
      name: 'Owner',
      color: '#ff0000',
      hoist: false,
      isMentionable: false,
      permissions: [Permission.SEND_MESSAGES],
      storageQuotaOverrideEnabled: false,
      storageSpaceQuota: 0
    });

    const roles = await caller.roles.getAll();
    const ownerRole = roles.find((r) => r.id === 1);

    expect(ownerRole).toBeDefined();
    expect(ownerRole!.permissions.length).toBeGreaterThan(1);
  });

  test('should delete non-persistent role', async () => {
    const { caller } = await initTest();

    const roleId = await caller.roles.add();

    const rolesBefore = await caller.roles.getAll();
    expect(rolesBefore.find((r) => r.id === roleId)).toBeDefined();

    await caller.roles.delete({ roleId });

    const rolesAfter = await caller.roles.getAll();
    expect(rolesAfter.find((r) => r.id === roleId)).toBeUndefined();
  });

  test('should throw when deleting persistent role', async () => {
    const { caller } = await initTest();

    await expect(
      caller.roles.delete({
        roleId: 1
      })
    ).rejects.toThrow('Cannot delete a persistent role');
  });

  test('should throw when deleting default role', async () => {
    const { caller } = await initTest();

    const newRoleId = await caller.roles.add();
    await caller.roles.setDefault({ roleId: newRoleId });

    await expect(
      caller.roles.delete({
        roleId: newRoleId
      })
    ).rejects.toThrow('Cannot delete the default role');
  });

  test('should throw when deleting non-existing role', async () => {
    const { caller } = await initTest();

    await expect(
      caller.roles.delete({
        roleId: 999999
      })
    ).rejects.toThrow('Role not found');
  });

  test('should set new default role', async () => {
    const { caller } = await initTest();

    const newRoleId = await caller.roles.add();

    await caller.roles.setDefault({ roleId: newRoleId });

    const roles = await caller.roles.getAll();
    const newDefaultRole = roles.find((r) => r.id === newRoleId);
    const oldDefaultRole = roles.find((r) => r.id === 2);

    expect(newDefaultRole!.isDefault).toBe(true);
    expect(oldDefaultRole!.isDefault).toBe(false);
  });

  test('should throw when setting non-existing role as default', async () => {
    const { caller } = await initTest();

    await expect(
      caller.roles.setDefault({
        roleId: 999999
      })
    ).rejects.toThrow('Role not found');
  });

  test('should create multiple roles', async () => {
    const { caller } = await initTest();

    const initialRoles = await caller.roles.getAll();
    const initialCount = initialRoles.length;

    await caller.roles.add();
    await caller.roles.add();
    await caller.roles.add();

    const finalRoles = await caller.roles.getAll();

    expect(finalRoles.length).toBe(initialCount + 3);
  });

  test('should update role with empty permissions array', async () => {
    const { caller } = await initTest();

    const roleId = await caller.roles.add();

    await caller.roles.update({
      roleId,
      name: 'No Permissions Role',
      color: '#000000',
      hoist: false,
      isMentionable: false,
      permissions: [],
      storageQuotaOverrideEnabled: false,
      storageSpaceQuota: 0
    });

    const roles = await caller.roles.getAll();
    const role = roles.find((r) => r.id === roleId);

    expect(role).toBeDefined();
    expect(role!.permissions.length).toBe(0);
  });

  test('should update role with multiple permissions', async () => {
    const { caller } = await initTest();

    const roleId = await caller.roles.add();

    const permissions = [
      Permission.SEND_MESSAGES,
      Permission.UPLOAD_FILES,
      Permission.MANAGE_CHANNELS,
      Permission.MANAGE_ROLES
    ];

    await caller.roles.update({
      roleId,
      name: 'Multi Permission Role',
      color: '#00ff00',
      hoist: false,
      isMentionable: false,
      permissions,
      storageQuotaOverrideEnabled: false,
      storageSpaceQuota: 0
    });

    const roles = await caller.roles.getAll();
    const role = roles.find((r) => r.id === roleId);

    expect(role).toBeDefined();
    expect(role!.permissions.length).toBe(permissions.length);
    permissions.forEach((perm) => {
      expect(role!.permissions).toContain(perm);
    });
  });
});

describe('roles router - permission escalation guard', () => {
  // user 2 gets a role ranked above the target holding MANAGE_ROLES but NOT
  // MANAGE_SETTINGS, so they can edit the target role yet must not be able to
  // grant themselves permissions they do not hold.
  const seedModerator = async (): Promise<{ targetRoleId: number }> => {
    const now = Date.now();

    const [modRole] = await tdb
      .insert(roles)
      .values({
        name: 'Moderator',
        color: '#123456',
        position: 100,
        isPersistent: false,
        isDefault: false,
        storageQuotaOverrideEnabled: false,
        storageSpaceQuota: 0,
        createdAt: now
      })
      .returning();

    await tdb.insert(rolePermissions).values({
      roleId: modRole!.id,
      permission: Permission.MANAGE_ROLES,
      createdAt: now
    });

    await tdb.insert(userRoles).values({
      userId: 2,
      roleId: modRole!.id,
      createdAt: now
    });

    const [targetRole] = await tdb
      .insert(roles)
      .values({
        name: 'Target',
        color: '#654321',
        position: 50,
        isPersistent: false,
        isDefault: false,
        storageQuotaOverrideEnabled: false,
        storageSpaceQuota: 0,
        createdAt: now
      })
      .returning();

    return { targetRoleId: targetRole!.id };
  };

  const readPermissions = async (roleId: number): Promise<Permission[]> =>
    (
      await tdb
        .select()
        .from(rolePermissions)
        .where(eq(rolePermissions.roleId, roleId))
    ).map((row) => row.permission as Permission);

  const updateTarget = async (
    caller: Awaited<ReturnType<typeof initTest>>['caller'],
    targetRoleId: number,
    permissions: Permission[]
  ) =>
    caller.roles.update({
      roleId: targetRoleId,
      name: 'Target',
      color: '#654321',
      hoist: false,
      isMentionable: false,
      permissions,
      storageQuotaOverrideEnabled: false,
      storageSpaceQuota: 0
    });

  test('cannot grant a permission the actor does not hold', async () => {
    const { targetRoleId } = await seedModerator();
    const { caller } = await initTest(2);

    await updateTarget(caller, targetRoleId, [Permission.MANAGE_SETTINGS]);

    const perms = await readPermissions(targetRoleId);

    expect(perms).not.toContain(Permission.MANAGE_SETTINGS);
  });

  test('can still toggle permissions the actor does hold', async () => {
    const { targetRoleId } = await seedModerator();
    const { caller } = await initTest(2);

    await updateTarget(caller, targetRoleId, [
      Permission.MANAGE_ROLES,
      Permission.MANAGE_SETTINGS
    ]);

    const perms = await readPermissions(targetRoleId);

    expect(perms).toContain(Permission.MANAGE_ROLES); // actor holds it
    expect(perms).not.toContain(Permission.MANAGE_SETTINGS); // actor lacks it
  });

  test('does not strip an unheld permission already on the role', async () => {
    const { targetRoleId } = await seedModerator();

    // a higher authority already granted MANAGE_SETTINGS to the target
    await tdb.insert(rolePermissions).values({
      roleId: targetRoleId,
      permission: Permission.MANAGE_SETTINGS,
      createdAt: Date.now()
    });

    const { caller } = await initTest(2);

    // moderator submits a set without MANAGE_SETTINGS - it must be preserved
    await updateTarget(caller, targetRoleId, [Permission.MANAGE_ROLES]);

    const perms = await readPermissions(targetRoleId);

    expect(perms).toContain(Permission.MANAGE_SETTINGS); // preserved
    expect(perms).toContain(Permission.MANAGE_ROLES); // added (actor holds it)
  });

  test('owner can grant any permission', async () => {
    const { targetRoleId } = await seedModerator();
    const { caller } = await initTest(1); // owner

    await updateTarget(caller, targetRoleId, [Permission.MANAGE_SETTINGS]);

    const perms = await readPermissions(targetRoleId);

    expect(perms).toContain(Permission.MANAGE_SETTINGS);
  });

  // Regression: icon_file_id came from an ALTER TABLE (migration 0021) so it
  // carries no ON DELETE set null; deleting the file row before nulling the
  // reference raised FOREIGN KEY constraint failed.
  test('removing a role icon does not raise a FK constraint error', async () => {
    const { caller } = await initTest(1); // owner

    const file = await tdb
      .insert(files)
      .values({
        name: 'role-icon.png',
        originalName: 'role-icon.png',
        md5: 'deadbeef',
        userId: 1,
        size: 10,
        mimeType: 'image/png',
        extension: 'png',
        createdAt: Date.now()
      })
      .returning()
      .get();

    await tdb
      .update(roles)
      .set({ iconFileId: file!.id })
      .where(eq(roles.id, 1))
      .run();

    await expect(caller.roles.changeIcon({ roleId: 1 })).resolves.toBeUndefined();

    const updatedRole = await tdb
      .select()
      .from(roles)
      .where(eq(roles.id, 1))
      .get();
    expect(updatedRole!.iconFileId).toBeNull();

    const remainingFile = await tdb
      .select()
      .from(files)
      .where(eq(files.id, file!.id))
      .get();
    expect(remainingFile).toBeUndefined();
  });
});
