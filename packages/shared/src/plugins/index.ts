// Explicit import rather than the global React UMD namespace: the SDK's
// declaration bundle is built without ambient @types, so `React.ComponentType`
// resolves to nothing there.
import type { ComponentType } from 'react';
import z from 'zod';
import type { PluginSlot } from './constants';
import { zCapability } from './capability-schema';

export const zPluginId = z
  .string()
  .min(1, 'Plugin ID is required')
  .regex(
    /^[a-z0-9-]+$/,
    'Plugin ID must contain only lowercase letters, numbers, and dashes'
  );

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
  // Which entry points the plugin directory actually contains. Both are
  // optional -- a moderation plugin needs no client, a pure-UI plugin needs no
  // server -- but at least one must exist. Reported as observed file presence,
  // never inferred from the declared CLIENT_SLOTS capability: a declaration is
  // an intention and the two can disagree.
  hasServerEntry: boolean;
  hasClientEntry: boolean;
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

export type TPluginComponentsMapBySlotIdMapListByPlugin = {
  [pluginId: string]: PluginSlot[];
};

export type TPluginReactComponent = ComponentType;

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

// Re-exported so the barrel API is unchanged; they live in a zod-free module
// so the SDK can import them without pulling zod. See constants.ts.
export * from './capability-schema';
export * from './constants';
export * from './store-types';
export * from './client-sdk';
export * from './hooks';
export * from './marketplace';
