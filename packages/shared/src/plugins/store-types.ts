// The plugin store's public shape, written out in full rather than derived.
//
// These types used to be the Drizzle-inferred row types (`InferSelectModel<typeof
// channels>` and friends). That had two costs:
//
// 1. The SDK's generated declarations came to 2151 lines, because inferring a row
//    type forces the whole `SQLiteTableWithColumns<...>` definition to be inlined,
//    and made plugin authors depend on drizzle-orm for types they never asked for.
//
// 2. More seriously, it tied a PUBLIC contract to a private schema. The `users`
//    table carries `password`, `identity` and `totpSecret`. They were excluded by
//    a `Pick`, which protects against today's columns and nothing else: add a
//    secret column tomorrow and a `Pick` still excludes it, but any widening of
//    that list -- or a switch to Omit -- would silently publish it to every
//    installed plugin. Writing the projection out means a new column reaches
//    plugins only when someone types it here on purpose.
//
// Drift is caught at compile time by store-types.assert.ts, which checks the
// Drizzle row types are still assignable to these. If a column is renamed or its
// type changes, that file stops compiling.
import type { Permission } from '../statics/permissions';
import type { UserStatus } from '../types';

export type TPluginFile = {
  id: number;
  name: string;
  originalName: string;
  md5: string;
  userId: number;
  size: number;
  mimeType: string;
  extension: string;
  createdAt: number;
  updatedAt: number | null;
  _accessToken?: string;
  _accessTokenExpiresAt?: number;
};

export type TPluginUser = {
  id: number;
  name: string;
  bio: string | null;
  bannerColor: string | null;
  nicknameColor: string | null;
  nicknameFont: string | null;
  showRoleBadge: boolean;
  banned: boolean;
  createdAt: number;
  avatarId: number | null;
  bannerId: number | null;
  avatar: TPluginFile | null;
  banner: TPluginFile | null;
  roleIds: number[];
  status?: UserStatus;
};

export type TPluginChannel = {
  id: number;
  type: string;
  name: string;
  topic: string | null;
  private: boolean;
  isDm: boolean;
  position: number;
  categoryId: number | null;
  createdAt: number;
  updatedAt: number | null;
};

export type TPluginCategory = {
  id: number;
  name: string;
  position: number;
  createdAt: number;
  updatedAt: number | null;
};

export type TPluginRole = {
  id: number;
  name: string;
  color: string;
  position: number;
  hoist: boolean;
  iconFileId: number | null;
  isMentionable: boolean;
  isPersistent: boolean;
  isDefault: boolean;
  storageQuotaOverrideEnabled: boolean;
  storageSpaceQuota: number;
  createdAt: number;
  updatedAt: number | null;
  permissions: Permission[];
  icon: TPluginFile | null;
};

export type TPluginEmoji = {
  id: number;
  name: string;
  fileId: number;
  userId: number;
  createdAt: number;
  updatedAt: number | null;
  file: TPluginFile;
  user: Omit<TPluginUser, 'roleIds' | 'avatar' | 'banner'> & {
    avatar: TPluginFile | null;
    banner: TPluginFile | null;
  };
};

export type TPluginServerSettings = {
  name: string;
  description: string | null;
  serverId: string;
  storageUploadEnabled: boolean;
  directMessagesEnabled: boolean;
  storageQuota: number;
  storageUploadMaxFileSize: number;
  storageFileSharingInDirectMessages: boolean;
  storageMaxAvatarSize: number;
  storageMaxBannerSize: number;
  storageMaxFilesPerMessage: number;
  storageSpaceQuotaByUser: number;
  storageOverflowAction: string;
  enablePlugins: boolean;
  webRtcSimulcastEnabled: boolean;
  enableSearch: boolean;
  showWelcomeDialog: boolean;
  storageSignedUrlsEnabled: boolean;
  webRtcMaxBitrate: number;
  klipyEnabled: boolean;
};
