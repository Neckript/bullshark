import type { TPluginMetadata } from '.';
// Projections rather than the Drizzle row types: this is a public contract
// handed to third-party plugins. See store-types.ts for why, and
// store-types.assert.ts for the compile-time guard against drift.
import type {
  TPluginCategory,
  TPluginChannel,
  TPluginEmoji,
  TPluginRole,
  TPluginServerSettings,
  TPluginUser
} from './store-types';

export type TPluginStoreState = {
  users: TPluginUser[];
  channels: TPluginChannel[];
  categories: TPluginCategory[];
  roles: TPluginRole[];
  emojis: TPluginEmoji[];
  plugins: TPluginMetadata[];
  ownUserId: number | undefined;
  selectedChannelId: number | undefined;
  currentVoiceChannelId: number | undefined;
  publicSettings: TPluginServerSettings | undefined;
};

export type TActionContract = Record<
  string,
  { payload: unknown; response: unknown }
>;

export type TPluginActions = {
  sendMessage: (channelId: number, content: string) => Promise<void>;
  selectChannel: (channelId: number) => void;
  executePluginAction: <TResponse = unknown, TPayload = unknown>(
    actionName: string,
    payload?: TPayload
  ) => Promise<TResponse>;
};

export type TPluginStore = {
  getState: () => TPluginStoreState;
  subscribe: (listener: () => void) => () => void;
  actions: TPluginActions;
};
