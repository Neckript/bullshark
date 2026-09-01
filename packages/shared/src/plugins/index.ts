import z from 'zod';

export const zPluginId = z
  .string()
  .min(1, 'Plugin ID is required')
  .regex(
    /^[a-z0-9-]+$/,
    'Plugin ID must contain only lowercase letters, numbers, and dashes'
  );

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

export const zCapability = z.enum(PluginCapability);

export const zPluginManifest = z.object({
  id: zPluginId,
  name: z.string().min(1, 'Plugin name is required'),
  author: z.string().min(1, 'Plugin author is required'),
  description: z.string().min(1, 'Plugin description is required'),
  homepage: z.url().optional(),
  logo: z.url().optional(),
  sdkVersion: z.number().int().nonnegative(),
  capabilities: z.array(zCapability).default([]),
  version: z
    .string()
    .regex(/^\d+\.\d+\.\d+(-[a-zA-Z0-9-.]+)?$/, 'Invalid version format')
});

export type TPluginManifest = z.infer<typeof zPluginManifest>;

export type TPluginInfo = {
  id: string;
  enabled: boolean;
  loadError?: string;
  sdkVersion: TPluginManifest['sdkVersion'];
  capabilities: TPluginManifest['capabilities'];
  author: TPluginManifest['author'];
  description: TPluginManifest['description'];
  version: TPluginManifest['version'];
  logo: TPluginManifest['logo'];
  name: TPluginManifest['name'];
  homepage: TPluginManifest['homepage'];
  path: string;
};

export type TLogEntry = {
  type: 'info' | 'error' | 'debug';
  timestamp: number;
  message: string;
  pluginId: string;
};

export type TCommandArg = {
  name: string;
  description?: string;
  type: 'string' | 'number' | 'boolean';
  required?: boolean;
  sensitive?: boolean;
};

export type TInvokerContext = {
  userId: number;
  currentVoiceChannelId?: number;
};

export type TCommandContract = Record<
  string,
  { args: unknown; response: unknown }
>;

export interface CommandDefinition<TArgs = void> {
  name: string;
  description?: string;
  args?: TCommandArg[];
  execute(ctx: TInvokerContext, args: TArgs): Promise<unknown>;
}

export interface ActionDefinition<TPayload = void> {
  name: string;
  description?: string;
  execute: (ctx: TInvokerContext, payload: TPayload) => Promise<unknown>;
}

export type TPluginCommand = {
  pluginId: string;
  name: string;
  description?: string;
};

export type TCommandInfo = {
  pluginId: string;
  name: string;
  description?: string;
  args?: CommandDefinition<unknown>['args'];
};

export type TCommandsMapByPlugin = {
  [pluginId: string]: TCommandInfo[];
};

export type RegisteredCommand = {
  pluginId: string;
  name: string;
  description?: string;
  args?: CommandDefinition<unknown>['args'];
  command: CommandDefinition<unknown>;
};

export type RegisteredAction = {
  pluginId: string;
  name: string;
  description?: string;
  action: ActionDefinition<unknown>;
};

export const zParsedDomCommand = z.object({
  pluginId: zPluginId,
  commandName: z.string().min(1),
  status: z.enum(['pending', 'completed', 'failed']).default('pending'),
  response: z.string().optional(),
  logo: z.url().optional(),
  args: z.array(
    z.object({
      name: z.string(),
      value: z.unknown()
    })
  )
});

export type TParsedDomCommand = z.infer<typeof zParsedDomCommand>;

export type TCommandElement = {
  attribs: {
    'data-plugin-id'?: string;
    'data-plugin-logo'?: string;
    'data-command'?: string;
    'data-status'?: string;
    'data-args'?: string;
    'data-response'?: string;
  };
};

export type TPluginSettingType = 'string' | 'number' | 'boolean';

export type TPluginSettingDefinition = {
  key: string;
  name: string;
  description?: string;
  type: TPluginSettingType;
  defaultValue: string | number | boolean;
};

export type TPluginSettingsResponse = {
  definitions: TPluginSettingDefinition[];
  values: Record<string, unknown>;
};

export enum PluginSlot {
  CONNECT_SCREEN = 'connect_screen',
  HOME_SCREEN = 'home_screen',
  CHAT_ACTIONS = 'chat_actions',
  TOPBAR_RIGHT = 'topbar_right',
  FULL_SCREEN = 'full_screen'
}

export type TPluginComponentsMapBySlotIdMapListByPlugin = {
  [pluginId: string]: PluginSlot[];
};

export type TPluginReactComponent = React.ComponentType;

export type TPluginComponentsMapBySlotId = {
  [slot in PluginSlot]?: TPluginReactComponent[];
};

export type TPluginComponent = {
  pluginId: string;
  mod: TPluginReactComponent;
};

export type TPluginComponentsMap = {
  [pluginId: string]: TPluginComponentsMapBySlotId;
};

export type TPluginMetadata = {
  pluginId: string;
  name: string;
  description: string;
  avatarUrl?: string;
};

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

export * from './client-sdk';
export * from './hooks';
export * from './marketplace';
