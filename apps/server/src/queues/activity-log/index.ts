import {
  getErrorMessage,
  type ActivityLogType,
  type TActivityLogDetailsMap
} from '@bullshark/shared';
import chalk from 'chalk';
import Queue from 'queue';
import { db } from '../../db';
import { activityLog } from '../../db/schema';
import { logger } from '../../logger';
import { getUserIp } from '../../utils/wss';

const activityLogQueue = new Queue({
  concurrency: 2,
  autostart: true,
  timeout: 3000
});

activityLogQueue.autostart = true;

type TEnqueueActivityLog<T extends ActivityLogType = ActivityLogType> = {
  type: T;
  details?: TActivityLogDetailsMap[T];
  userId?: number;
  ip?: string;
};

const enqueueActivityLog = <T extends ActivityLogType>({
  type,
  details = {} as TActivityLogDetailsMap[T],
  userId = 1,
  ip
}: TEnqueueActivityLog<T>) => {
  const date = Date.now();

  activityLogQueue.push(async (callback) => {
    const start = performance.now();

    // best-effort: a background log write must never surface as an unhandled
    // rejection (e.g. a transient DB error, or the DB torn down in tests)
    try {
      await db.insert(activityLog).values({
        userId,
        type: type,
        details,
        ip: ip || getUserIp(userId) || null,
        createdAt: date
      });

      logger.debug(
        `${chalk.dim('[Activity Logger]')} Logged activity of type ${type} for user ${userId} in ${(performance.now() - start).toFixed(2)} ms`
      );
    } catch (error) {
      logger.error(
        `${chalk.dim('[Activity Logger]')} Failed to log activity of type ${type} for user ${userId}: ${getErrorMessage(error)}`
      );
    } finally {
      callback?.();
    }
  });
};

export { enqueueActivityLog };
