import { OWNER_ROLE_ID } from '@sharkord/shared';
import { and, eq } from 'drizzle-orm';
import { db } from '..';
import { userRoles } from '../schema';

const isOwner = async (userId: number): Promise<boolean> => {
  const row = await db
    .select({ userId: userRoles.userId })
    .from(userRoles)
    .where(
      and(eq(userRoles.userId, userId), eq(userRoles.roleId, OWNER_ROLE_ID))
    )
    .get();

  return Boolean(row);
};

export { isOwner };
