export enum LocalStorageKey {
  IDENTITY = 'sharkord-identity',
  REMEMBER_CREDENTIALS = 'sharkord-remember-identity',
  USER_PASSWORD = 'sharkord-user-password',
  SERVER_PASSWORD = 'sharkord-server-password',
  VITE_UI_THEME = 'vite-ui-theme',
  DEVICES_SETTINGS = 'sharkord-devices-settings',
  FLOATING_CARD_POSITION = 'sharkord-floating-card-position',
  RIGHT_SIDEBAR_STATE = 'sharkord-right-sidebar-state',
  VOICE_CHAT_SIDEBAR_STATE = 'sharkord-voice-chat-sidebar-state',
  VOICE_CHAT_SIDEBAR_CHANNEL_ID = 'sharkord-voice-chat-sidebar-channel-id',
  VOICE_CHAT_SIDEBAR_WIDTH = 'sharkord-voice-chat-sidebar-width',
  VOICE_CHAT_SHOW_USER_BANNERS = 'sharkord-voice-chat-show-user-banners',
  VOLUME_SETTINGS = 'sharkord-volume-settings',
  STREAM_QUALITY_SETTINGS = 'sharkord-stream-quality-settings',
  RECENT_EMOJIS = 'sharkord-recent-emojis',
  DEBUG = 'sharkord-debug',
  DRAFT_MESSAGES = 'sharkord-draft-messages',
  HIDE_NON_VIDEO_PARTICIPANTS = 'sharkord-hide-non-video-participants',
  THREAD_SIDEBAR_WIDTH = 'sharkord-thread-sidebar-width',
  LEFT_SIDEBAR_WIDTH = 'sharkord-left-sidebar-width',
  RIGHT_SIDEBAR_WIDTH = 'sharkord-right-sidebar-width',
  CATEGORIES_EXPANDED = 'sharkord-categories-expanded',
  AUTO_LOGIN = 'sharkord-auto-login',
  AUTO_LOGIN_TOKEN = 'sharkord-auto-login-token',
  LAST_SELECTED_CHANNEL = 'sharkord-last-selected-channel',
  AUTO_JOIN_LAST_CHANNEL = 'sharkord-auto-join-last-channel',
  BROWSER_NOTIFICATIONS = 'sharkord-browser-notifications',
  BROWSER_NOTIFICATIONS_FOR_MENTIONS = 'sharkord-browser-notifications-for-mentions',
  BROWSER_NOTIFICATIONS_FOR_DMS = 'sharkord-browser-notifications-for-dms',
  CHAT_INPUT_HEIGHT_VH = 'sharkord-chat-input-height-vh',
  THREAD_INPUT_HEIGHT_VH = 'sharkord-thread-input-height-vh',
  BROWSER_NOTIFICATIONS_FOR_REPLIES = 'sharkord-browser-notifications-for-replies',
  LANGUAGE = 'sharkord-language',
  PLUGIN_SLOT_DEBUG = 'sharkord-plugin-slot-debug',
  HIDE_OWN_SCREEN_SHARE = 'sharkord-hide-own-screen-share'
}

export enum SessionStorageKey {
  TOKEN = 'sharkord-token'
}

// localStorage / sessionStorage can throw SecurityError in privacy-hardened
// browsers (Librewolf, Firefox private mode) when storage access is blocked
// (issue #2 / upstream Sharkord#728). All access is wrapped in try/catch so
// that callers receive safe fallback values instead of a thrown exception.

const getLocalStorageItem = (key: LocalStorageKey): string | null => {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
};

const getLocalStorageItemBool = (
  key: LocalStorageKey,
  defaultValue: boolean = false
): boolean => {
  try {
    const item = localStorage.getItem(key);

    if (item === null) {
      return defaultValue;
    }

    return item === 'true';
  } catch {
    return defaultValue;
  }
};

const setLocalStorageItemBool = (
  key: LocalStorageKey,
  value: boolean
): void => {
  try {
    localStorage.setItem(key, value.toString());
  } catch {
    /* ignore */
  }
};

const getLocalStorageItemAsNumber = (
  key: LocalStorageKey,
  defaultValue?: number
): number | undefined => {
  try {
    const item = localStorage.getItem(key);

    if (item === null) {
      return defaultValue;
    }

    const parsed = parseInt(item, 10);

    return Number.isNaN(parsed) ? defaultValue : parsed;
  } catch {
    return defaultValue;
  }
};

const getLocalStorageItemAsJSON = <T>(
  key: LocalStorageKey,
  defaultValue: T | undefined = undefined
): T | undefined => {
  try {
    const item = localStorage.getItem(key);

    if (item) {
      return JSON.parse(item) as T;
    }

    return defaultValue;
  } catch {
    return defaultValue;
  }
};

const setLocalStorageItemAsJSON = <T>(key: LocalStorageKey, value: T): void => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* ignore */
  }
};

const setLocalStorageItem = (key: LocalStorageKey, value: string): void => {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* ignore */
  }
};

const removeLocalStorageItem = (key: LocalStorageKey): void => {
  try {
    localStorage.removeItem(key);
  } catch {
    /* ignore */
  }
};

const getSessionStorageItem = (key: SessionStorageKey): string | null => {
  try {
    return sessionStorage.getItem(key);
  } catch {
    return null;
  }
};

const setSessionStorageItem = (key: SessionStorageKey, value: string): void => {
  try {
    sessionStorage.setItem(key, value);
  } catch {
    /* ignore */
  }
};

const removeSessionStorageItem = (key: SessionStorageKey): void => {
  try {
    sessionStorage.removeItem(key);
  } catch {
    /* ignore */
  }
};

export {
  getLocalStorageItem,
  getLocalStorageItemAsJSON,
  getLocalStorageItemAsNumber,
  getLocalStorageItemBool,
  getSessionStorageItem,
  removeLocalStorageItem,
  removeSessionStorageItem,
  setLocalStorageItem,
  setLocalStorageItemAsJSON,
  setLocalStorageItemBool,
  setSessionStorageItem
};
