export enum LocalStorageKey {
  SERVER_PASSWORD = 'bullshark-server-password',
  VITE_UI_THEME = 'vite-ui-theme',
  DEVICES_SETTINGS = 'bullshark-devices-settings',
  FLOATING_CARD_POSITION = 'bullshark-floating-card-position',
  RIGHT_SIDEBAR_STATE = 'bullshark-right-sidebar-state',
  VOICE_CHAT_SIDEBAR_STATE = 'bullshark-voice-chat-sidebar-state',
  VOICE_CHAT_SIDEBAR_CHANNEL_ID = 'bullshark-voice-chat-sidebar-channel-id',
  VOICE_CHAT_SIDEBAR_WIDTH = 'bullshark-voice-chat-sidebar-width',
  VOICE_CHAT_SHOW_USER_BANNERS = 'bullshark-voice-chat-show-user-banners',
  VOLUME_SETTINGS = 'bullshark-volume-settings',
  STREAM_QUALITY_SETTINGS = 'bullshark-stream-quality-settings',
  RECENT_EMOJIS = 'bullshark-recent-emojis',
  DEBUG = 'bullshark-debug',
  DRAFT_MESSAGES = 'bullshark-draft-messages',
  HIDE_NON_VIDEO_PARTICIPANTS = 'bullshark-hide-non-video-participants',
  THREAD_SIDEBAR_WIDTH = 'bullshark-thread-sidebar-width',
  LEFT_SIDEBAR_WIDTH = 'bullshark-left-sidebar-width',
  RIGHT_SIDEBAR_WIDTH = 'bullshark-right-sidebar-width',
  CATEGORIES_EXPANDED = 'bullshark-categories-expanded',
  AUTO_LOGIN = 'bullshark-auto-login',
  AUTO_LOGIN_TOKEN = 'bullshark-auto-login-token',
  LAST_SELECTED_CHANNEL = 'bullshark-last-selected-channel',
  AUTO_JOIN_LAST_CHANNEL = 'bullshark-auto-join-last-channel',
  BROWSER_NOTIFICATIONS = 'bullshark-browser-notifications',
  BROWSER_NOTIFICATIONS_FOR_MENTIONS = 'bullshark-browser-notifications-for-mentions',
  BROWSER_NOTIFICATIONS_FOR_DMS = 'bullshark-browser-notifications-for-dms',
  CHAT_INPUT_HEIGHT_VH = 'bullshark-chat-input-height-vh',
  THREAD_INPUT_HEIGHT_VH = 'bullshark-thread-input-height-vh',
  BROWSER_NOTIFICATIONS_FOR_REPLIES = 'bullshark-browser-notifications-for-replies',
  LANGUAGE = 'bullshark-language',
  PLUGIN_SLOT_DEBUG = 'bullshark-plugin-slot-debug',
  HIDE_OWN_SCREEN_SHARE = 'bullshark-hide-own-screen-share',
  RECENT_TARGETS = 'bullshark-recent-targets'
}

export enum SessionStorageKey {
  TOKEN = 'bullshark-token'
}

// localStorage / sessionStorage can throw SecurityError in privacy-hardened
// browsers (Librewolf, Firefox private mode) when storage access is blocked
// (issue #2). All access is wrapped in try/catch so that callers receive
// safe fallback values instead of a thrown exception.

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

// Legacy keys from the removed "remember credentials" option, which kept the
// user password in plaintext in localStorage. Nothing writes them any more,
// but a browser that stored one still holds it, so wipe them on every boot.
const LEGACY_CREDENTIAL_KEYS = [
  'sharkord-identity',
  'sharkord-remember-identity',
  'sharkord-user-password'
];

const purgeLegacyCredentials = (): void => {
  try {
    for (const key of LEGACY_CREDENTIAL_KEYS) {
      localStorage.removeItem(key);
    }
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
  purgeLegacyCredentials,
  removeLocalStorageItem,
  removeSessionStorageItem,
  setLocalStorageItem,
  setLocalStorageItemAsJSON,
  setLocalStorageItemBool,
  setSessionStorageItem
};
