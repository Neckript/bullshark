// Plugin constants, deliberately free of any runtime dependency.
//
// These are the only runtime values the plugin SDK needs. They used to live in
// `./index.ts`, which imports zod at module level for the manifest and registry
// schemas -- so importing a single enum pulled the whole of zod into the SDK
// bundle (502 KB measured). Keeping them here lets the SDK import values from a
// module with no runtime graph at all, while `./index.ts` re-exports everything
// so the barrel API is unchanged.
//
// Rule: nothing in this file may import anything but types.

// What a plugin is allowed to ask the host for. These mirror the namespaces of
// PluginContext, which is already the right granularity: a plugin declares what
// it needs, the server hands it a context containing only that, and a change to
// one namespace cannot invalidate plugins that never touched it.
//
// VOICE is separated because it is the only namespace pulling a heavy optional
// dependency (mediasoup). HOOKS_BEFORE_FILE_SAVE is named per-hook rather than
// as a `hooks` group so that adding a hook later cannot retroactively widen what
// an existing plugin may intercept. CLIENT_SLOTS is the only client-side one.
//
// `path`, `pluginId`, `logger`, `log`, `debug` and `error` are deliberately not
// capabilities: they are always provided, grant access to nothing, and requiring
// them would add noise to every manifest.
export enum PluginCapability {
  EVENTS = 'events',
  ACTIONS = 'actions',
  COMMANDS = 'commands',
  MESSAGES = 'messages',
  SETTINGS = 'settings',
  DATA = 'data',
  UI = 'ui',
  VOICE = 'voice',
  HOOKS_BEFORE_FILE_SAVE = 'hooks.onBeforeFileSave',
  CLIENT_SLOTS = 'client.slots'
}

export enum PluginSlot {
  CONNECT_SCREEN = 'connect_screen',
  HOME_SCREEN = 'home_screen',
  CHAT_ACTIONS = 'chat_actions',
  TOPBAR_RIGHT = 'topbar_right',
  FULL_SCREEN = 'full_screen'
}

// The plugin FORMAT version -- not the API surface version.
//
// It covers only what every plugin shares regardless of what it does: the
// manifest filename, the `server/index.js` + `client/index.js` layout, and the
// `window.__BULLSHARK_*` global names the client bundle resolves against.
// Bumping it invalidates every plugin at once, which is correct for a format
// break and wrong for anything else -- the rename of those globals in chantier A
// would have been such a break, had any plugin existed.
//
// API compatibility is carried by PluginCapability, which fails a plugin only
// when the specific capability it declared is unavailable.
export const PLUGIN_SDK_VERSION = 1;

export const SERVER_ENTRY_FILE = 'server/index.js';
export const CLIENT_ENTRY_FILE = 'client/index.js';
