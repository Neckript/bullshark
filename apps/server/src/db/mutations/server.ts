import type { TSettings } from '@bullshark/shared';
import { isNotNull } from 'drizzle-orm';
import { db } from '..';
import { settings } from '../schema';

const updateSettings = async (serverSettings: Partial<TSettings>) =>
  db
    .update(settings)
    .set(serverSettings)
    .where(isNotNull(settings.name))
    .returning()
    .get();

export { updateSettings };
