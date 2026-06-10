import type { ChannelPermission } from '@sharkord/shared';

export type TChannelPermission = {
  permission: ChannelPermission;
  allow: boolean;
};

export type TChannelPermissionType = 'role' | 'user';

// A permission override target — either a role or a user.
export type TPermissionOverrideTarget = { roleId?: number; userId?: number };

// Source-agnostic mutations so the overrides editor can be pointed at
// either a channel or a category (see ChannelPermissions / CategoryPermissions).
export type TPermissionActions = {
  createOverride: (target: TPermissionOverrideTarget) => Promise<void>;
  updateOverride: (
    target: TPermissionOverrideTarget,
    permissions: ChannelPermission[]
  ) => Promise<void>;
  deleteOverride: (target: TPermissionOverrideTarget) => Promise<void>;
};
