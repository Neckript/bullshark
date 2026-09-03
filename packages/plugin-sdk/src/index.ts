import type {
  ActionDefinition,
  CommandDefinition,
  TActionContract,
  TBeforeFileSaveHook,
  TCommandArg,
  TCommandContract,
  TInvokerContext,
  TPluginActions,
  TPluginComponentsMapBySlotId,
  TPluginSettingDefinition,
  TPluginStore,
  TPluginStoreState
} from '@bullshark/shared/src/plugins';
// Values are imported from the zod-free modules, not the barrel: the barrel's
// runtime graph pulls zod, which put 502 KB into this bundle. Type-only imports
// above can stay on the barrel -- they erase at compile time.
import { FileSaveType } from '@bullshark/shared/src/plugins/hooks';
import {
  PLUGIN_SDK_VERSION,
  PluginCapability,
  PluginSlot
} from '@bullshark/shared/src/plugins/constants';
// The mediasoup-derived types live in './voice' so that this entry point pulls
// no compiled C++ worker on an author who never touches voice. See voice.ts.
import type {
  AppData,
  Router,
  TCreateStreamOptions,
  TExternalStreamHandle
} from './voice';

export type ServerEvent =
  | 'user:joined'
  | 'user:left'
  | 'user:joined_voice'
  | 'user:left_voice'
  | 'message:created'
  | 'message:updated'
  | 'message:deleted'
  | 'voice:runtime_initialized'
  | 'voice:runtime_closed'
  | 'setting:set';

export interface EventPayloads {
  'user:joined': {
    userId: number;
    username: string;
  };
  'user:left': {
    userId: number;
    username: string;
  };
  'user:joined_voice': {
    userId: number;
    channelId: number;
  };
  'user:left_voice': {
    userId: number;
    channelId: number;
  };
  'message:created': {
    messageId: number;
    channelId: number;
    userId: number | null;
    pluginId: string | null;
    content: string;
    textContent: string;
  };
  'message:updated': {
    messageId: number;
    channelId: number;
    userId: number | null;
    pluginId: string | null;
    content: string;
    textContent: string;
  };
  'message:deleted': {
    messageId: number;
    channelId: number;
  };
  'voice:runtime_initialized': {
    channelId: number;
  };
  'voice:runtime_closed': {
    channelId: number;
  };
  'setting:set': {
    key: string;
    value: unknown;
  };
}

// this API is probably going to change a lot in the future
// so consider it as experimental for now

type SettingValueType<T extends TPluginSettingDefinition> =
  T['type'] extends 'string'
    ? string
    : T['type'] extends 'number'
      ? number
      : T['type'] extends 'boolean'
        ? boolean
        : unknown;

export interface PluginSettings<
  T extends readonly TPluginSettingDefinition[] = TPluginSettingDefinition[]
> {
  get<K extends T[number]['key']>(
    key: K
  ): SettingValueType<Extract<T[number], { key: K }>>;
  set<K extends T[number]['key']>(
    key: K,
    value: SettingValueType<Extract<T[number], { key: K }>>
  ): void;
}

export interface PluginContext {
  path: string;
  pluginId: string;

  logger: {
    log(...args: unknown[]): void;
    debug(...args: unknown[]): void;
    error(...args: unknown[]): void;
  };

  log(...args: unknown[]): void;
  debug(...args: unknown[]): void;
  error(...args: unknown[]): void;

  events: {
    on<E extends ServerEvent>(
      event: E,
      handler: (payload: EventPayloads[E]) => void | Promise<void>
    ): () => void;
    off<E extends ServerEvent>(
      event: E,
      handler: (payload: EventPayloads[E]) => void | Promise<void>
    ): void;
  };

  actions: {
    register<TPayload = void>(action: ActionDefinition<TPayload>): void;
  };

  voice: {
    getRouter(channelId: number): Router<AppData>;
    createStream(options: TCreateStreamOptions): TExternalStreamHandle;
    getListenInfo(): {
      ip: string;
      announcedAddress: string | undefined;
    };
  };

  messages: {
    send(
      channelId: number,
      content: string,
      options?: {
        parentMessageId?: number; // used for threads
        replyToMessageId?: number; // used for inline replies
      }
    ): Promise<{ messageId: number }>;
    edit(messageId: number, content: string): Promise<void>;
    delete(messageId: number): Promise<void>;
  };

  commands: {
    register<TArgs = void>(command: CommandDefinition<TArgs>): void;
  };

  settings: {
    register<T extends readonly TPluginSettingDefinition[]>(
      definitions: T
    ): Promise<PluginSettings<T>>;
  };

  hooks: {
    onBeforeFileSave(handler: TBeforeFileSaveHook): void;
  };

  data: {
    getUser(userId: number): Promise<unknown | undefined>;
    getChannel(channelId: number): Promise<unknown | undefined>;
    getPublicUsers(): Promise<unknown[]>;
  };

  ui: {
    enable(): void;
    disable(): void;
  };
}

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface UnloadPluginContext extends Pick<
  PluginContext,
  'path' | 'logger' | 'log' | 'debug' | 'error' | 'voice' | 'messages' | 'ui'
> {}

type TBullsharkState = ReturnType<TPluginStore['getState']>;

// Kept re-exported from the main entry for source compatibility: these two are
// the shapes a voice plugin passes around, and moving them would break every
// existing import for no gain. The mediasoup types themselves are not
// re-exported here -- import them from '@bullshark/plugin-sdk/voice'.
export type { TCreateStreamOptions, TExternalStreamHandle } from './voice';

export type {
  ActionDefinition,
  CommandDefinition,
  TActionContract,
  TBeforeFileSaveHook,
  TCommandArg,
  TCommandContract,
  TInvokerContext,
  TPluginActions,
  TPluginComponentsMapBySlotId,
  TPluginStore,
  TPluginStoreState,
  TBullsharkState
};

export * from './actions';
export * from './commands';
export { FileSaveType, PLUGIN_SDK_VERSION, PluginCapability, PluginSlot };
