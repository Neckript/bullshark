const MUTED_ROLE_MENTION_PREFIX = 'muted_role_mention:';

// Fixed, server-persisted preference keys.
const USER_SETTING_KEYS = [
  'browser_notifications',
  'browser_notifications_mentions',
  'browser_notifications_dms',
  'browser_notifications_replies',
  'auto_join_last_channel'
] as const;

type TUserSettingKey = (typeof USER_SETTING_KEYS)[number];

const isAllowedUserSettingKey = (key: string): boolean => {
  if ((USER_SETTING_KEYS as readonly string[]).includes(key)) return true;

  if (key.startsWith(MUTED_ROLE_MENTION_PREFIX)) {
    const id = key.slice(MUTED_ROLE_MENTION_PREFIX.length);
    return id.length > 0 && /^\d+$/.test(id);
  }

  return false;
};

export {
  MUTED_ROLE_MENTION_PREFIX,
  USER_SETTING_KEYS,
  isAllowedUserSettingKey,
  type TUserSettingKey
};
