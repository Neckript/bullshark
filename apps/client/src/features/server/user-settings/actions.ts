import { appSliceActions } from '@/features/app/slice';
import { store } from '@/features/store';
import {
  getLocalStorageItemBool,
  LocalStorageKey
} from '@/helpers/storage';
import { getTRPCClient } from '@/lib/trpc';
import { MUTED_ROLE_MENTION_PREFIX } from '@sharkord/shared';

// Apply a server settings payload into the app slice.
const applyServerSettings = (settings: Record<string, unknown>) => {
  store.dispatch(
    appSliceActions.hydrateUserSettings({
      browserNotifications: !!settings['browser_notifications'],
      browserNotificationsForMentions:
        !!settings['browser_notifications_mentions'],
      browserNotificationsForDms: !!settings['browser_notifications_dms'],
      browserNotificationsForReplies:
        !!settings['browser_notifications_replies'],
      autoJoinLastChannel: !!settings['auto_join_last_channel'],
      mutedRoleMentionIds: Object.keys(settings)
        .filter((k) => k.startsWith(MUTED_ROLE_MENTION_PREFIX) && settings[k])
        .map((k) => Number(k.slice(MUTED_ROLE_MENTION_PREFIX.length)))
    })
  );
};

const loadUserSettings = async (): Promise<Record<string, unknown>> => {
  const trpc = getTRPCClient();
  const settings = await trpc.settings.getAll.query();
  applyServerSettings(settings);
  return settings;
};

const writeUserSetting = async (key: string, value: boolean): Promise<void> => {
  const trpc = getTRPCClient();
  await trpc.settings.set.mutate({ key, value });
};

const clearUserSetting = async (key: string): Promise<void> => {
  const trpc = getTRPCClient();
  await trpc.settings.delete.mutate({ key });
};

// One-time: push pre-existing localStorage prefs to the server if the server
// has no value yet, so updating never resets a user's choices.
const migrateLocalSettings = async (
  existing: Record<string, unknown>
): Promise<void> => {
  const pairs: [string, LocalStorageKey][] = [
    ['browser_notifications', LocalStorageKey.BROWSER_NOTIFICATIONS],
    [
      'browser_notifications_mentions',
      LocalStorageKey.BROWSER_NOTIFICATIONS_FOR_MENTIONS
    ],
    ['browser_notifications_dms', LocalStorageKey.BROWSER_NOTIFICATIONS_FOR_DMS],
    [
      'browser_notifications_replies',
      LocalStorageKey.BROWSER_NOTIFICATIONS_FOR_REPLIES
    ],
    ['auto_join_last_channel', LocalStorageKey.AUTO_JOIN_LAST_CHANNEL]
  ];

  for (const [serverKey, lsKey] of pairs) {
    const localValue = getLocalStorageItemBool(lsKey, false);
    if (existing[serverKey] === undefined && localValue) {
      await writeUserSetting(serverKey, true);
      store.dispatch(serverKeyToSliceUpdate(serverKey, true));
    }
  }
};

// Reflect a migrated value locally without another server round-trip.
const serverKeyToSliceUpdate = (serverKey: string, value: boolean) => {
  switch (serverKey) {
    case 'browser_notifications':
      return appSliceActions.setBrowserNotifications(value);
    case 'browser_notifications_mentions':
      return appSliceActions.setBrowserNotificationsForMentions(value);
    case 'browser_notifications_dms':
      return appSliceActions.setBrowserNotificationsForDms(value);
    case 'browser_notifications_replies':
      return appSliceActions.setBrowserNotificationsForReplies(value);
    default:
      return appSliceActions.setAutoJoinLastChannel(value);
  }
};

export {
  loadUserSettings,
  writeUserSetting,
  clearUserSetting,
  migrateLocalSettings
};
