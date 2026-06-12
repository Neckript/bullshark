import { eq } from 'drizzle-orm';
import { db } from '..';
import { categoryRolePermissions, categoryUserPermissions } from '../schema';

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

export { getCategoryPermissions };
