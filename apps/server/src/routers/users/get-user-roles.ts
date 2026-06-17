import type { Permission, TFile, TJoinedRole } from '@sharkord/shared';
import { eq } from 'drizzle-orm';
import { alias } from 'drizzle-orm/sqlite-core';
import { db } from '../../db';
import { getSettings } from '../../db/queries/server';
import { files, rolePermissions, roles, userRoles } from '../../db/schema';
import { signFile } from '../../helpers/files-crypto';

const iconFiles = alias(files, 'iconFiles');

const getUserRoles = async (userId: number): Promise<TJoinedRole[]> => {
  const result = await db
    .select({
      role: roles,
      icon: iconFiles,
      permission: rolePermissions.permission
    })
    .from(userRoles)
    .innerJoin(roles, eq(userRoles.roleId, roles.id))
    .leftJoin(rolePermissions, eq(roles.id, rolePermissions.roleId))
    .leftJoin(iconFiles, eq(roles.iconFileId, iconFiles.id))
    .where(eq(userRoles.userId, userId));

  if (result.length === 0) return [];

  const { storageSignedUrlsEnabled, storageSignedUrlsTtlSeconds } =
    await getSettings();

  const rolesMap = new Map<number, TJoinedRole>();

  for (const row of result) {
    const roleId = row.role.id;

    if (!rolesMap.has(roleId)) {
      rolesMap.set(roleId, {
        ...row.role,
        permissions: [],
        icon: signFile(
          row.icon as TFile | null,
          storageSignedUrlsEnabled,
          storageSignedUrlsTtlSeconds
        )
      });
    }

    if (row.permission) {
      rolesMap.get(roleId)!.permissions.push(row.permission as Permission);
    }
  }

  return Array.from(rolesMap.values()).sort((a, b) => b.position - a.position);
};

export { getUserRoles };
