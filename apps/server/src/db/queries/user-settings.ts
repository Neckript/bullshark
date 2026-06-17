import { and, eq } from 'drizzle-orm';
import { db } from '..';
import { userSettings } from '../schema';

const getUserSettings = async (
  userId: number
): Promise<Record<string, unknown>> => {
  const rows = await db
    .select({ key: userSettings.key, value: userSettings.value })
    .from(userSettings)
    .where(eq(userSettings.userId, userId));

  const out: Record<string, unknown> = {};
  for (const row of rows) {
    try {
      out[row.key] = JSON.parse(row.value);
    } catch {
      out[row.key] = row.value;
    }
  }
  return out;
};

const upsertUserSetting = async (
  userId: number,
  key: string,
  value: unknown
): Promise<void> => {
  await db
    .insert(userSettings)
    .values({
      userId,
      key,
      value: JSON.stringify(value),
      updatedAt: Date.now()
    })
    .onConflictDoUpdate({
      target: [userSettings.userId, userSettings.key],
      set: { value: JSON.stringify(value), updatedAt: Date.now() }
    });
};

const deleteUserSetting = async (
  userId: number,
  key: string
): Promise<void> => {
  await db
    .delete(userSettings)
    .where(and(eq(userSettings.userId, userId), eq(userSettings.key, key)));
};

export { deleteUserSetting, getUserSettings, upsertUserSetting };
