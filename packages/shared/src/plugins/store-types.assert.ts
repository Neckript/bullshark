// Compile-time guard against drift between the Drizzle schema and the plugin
// store's public projections in ./store-types.
//
// This file emits nothing and is never imported at runtime. It exists so that
// renaming a column, changing its type, or making it nullable stops the build
// here -- next to an explanation -- instead of silently changing what plugins
// receive, or breaking an installed plugin at load time.
//
// The direction of the check matters: the Drizzle row must be assignable to the
// projection. That allows the schema to carry MORE than the projection exposes,
// which is the point -- `users` holds password, identity and totpSecret, and
// none of them may ever reach a plugin. It fails if the schema stops providing
// something the projection promises.
import type {
  TCategory,
  TChannel,
  TFile,
  TJoinedEmoji,
  TJoinedPublicUser,
  TJoinedRole
} from '../tables';
import type { TPublicServerSettings } from '../types';
import type {
  TPluginCategory,
  TPluginChannel,
  TPluginEmoji,
  TPluginFile,
  TPluginRole,
  TPluginServerSettings,
  TPluginUser
} from './store-types';

type AssertAssignable<TSource extends TTarget, TTarget> = [TSource, TTarget];

export type _FileMatches = AssertAssignable<TFile, TPluginFile>;
export type _UserMatches = AssertAssignable<TJoinedPublicUser, TPluginUser>;
export type _ChannelMatches = AssertAssignable<TChannel, TPluginChannel>;
export type _CategoryMatches = AssertAssignable<TCategory, TPluginCategory>;
export type _RoleMatches = AssertAssignable<TJoinedRole, TPluginRole>;
export type _EmojiMatches = AssertAssignable<TJoinedEmoji, TPluginEmoji>;
export type _SettingsMatches = AssertAssignable<
  TPublicServerSettings,
  TPluginServerSettings
>;
