import { eq } from 'drizzle-orm';
import { db } from '..';
import {
  categoryRolePermissions,
  categoryUserPermissions,
  channelRolePermissions,
  channelUserPermissions
} from '../schema';

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

const getCategoryPermissions = async (categoryId: number) => {
  const [rolePermissions, userPermissions] = await Promise.all([
    db
      .select()
      .from(categoryRolePermissions)
      .where(eq(categoryRolePermissions.categoryId, categoryId)),
    db
      .select()
      .from(categoryUserPermissions)
      .where(eq(categoryUserPermissions.categoryId, categoryId))
  ]);

  return { rolePermissions, userPermissions };
};

// Replace a channel's overrides with the category's current overrides.
// Runs inside the caller's transaction (`tx`); category reads use the
// top-level `db`, which is fine for reads.
const copyCategoryPermissionsToChannel = async (
  tx: Tx,
  categoryId: number,
  channelId: number
) => {
  const { rolePermissions, userPermissions } =
    await getCategoryPermissions(categoryId);

  await tx
    .delete(channelRolePermissions)
    .where(eq(channelRolePermissions.channelId, channelId));
  await tx
    .delete(channelUserPermissions)
    .where(eq(channelUserPermissions.channelId, channelId));

  if (rolePermissions.length > 0) {
    await tx.insert(channelRolePermissions).values(
      rolePermissions.map((p) => ({
        channelId,
        roleId: p.roleId,
        permission: p.permission,
        allow: p.allow,
        createdAt: Date.now()
      }))
    );
  }

  if (userPermissions.length > 0) {
    await tx.insert(channelUserPermissions).values(
      userPermissions.map((p) => ({
        channelId,
        userId: p.userId,
        permission: p.permission,
        allow: p.allow,
        createdAt: Date.now()
      }))
    );
  }
};

export { copyCategoryPermissionsToChannel, getCategoryPermissions };
