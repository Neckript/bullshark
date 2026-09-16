import { Permission } from '@bullshark/shared';

type TServerSettingsSectionId =
  | 'general'
  | 'roles'
  | 'emojis'
  | 'sounds'
  | 'users'
  | 'invites'
  | 'storage'
  | 'backup'
  | 'updates'
  | 'plugins';

type TServerSettingsSectionGroup = {
  id: 'overview' | 'management' | 'technical';
  // null = pas d'en-tete (bloc du haut facon "Apercu" de Discord).
  labelKey: string | null;
  sections: TServerSettingsSectionId[];
};

const SERVER_SETTINGS_GROUPS: TServerSettingsSectionGroup[] = [
  {
    id: 'overview',
    labelKey: null,
    sections: ['general']
  },
  {
    id: 'management',
    labelKey: 'serverManagementGroup',
    sections: ['roles', 'emojis', 'sounds', 'users', 'invites']
  },
  {
    id: 'technical',
    labelKey: 'serverTechnicalGroup',
    sections: ['storage', 'backup', 'updates', 'plugins']
  }
];

// Les cles de libelle existent deja (ancienne TabsList), reprises telles quelles.
const SERVER_SETTINGS_SECTION_LABEL_KEYS: Record<
  TServerSettingsSectionId,
  string
> = {
  general: 'generalTab',
  roles: 'rolesTab',
  emojis: 'emojisTab',
  sounds: 'soundsTab',
  users: 'usersTab',
  invites: 'invitesTab',
  storage: 'storageTab',
  backup: 'backupTab',
  updates: 'updatesTab',
  plugins: 'pluginsTab'
};

// 'owner' = reserve au proprietaire (la sauvegarde), pas une permission.
const SERVER_SETTINGS_SECTION_PERMISSIONS: Record<
  TServerSettingsSectionId,
  Permission | 'owner'
> = {
  general: Permission.MANAGE_SETTINGS,
  roles: Permission.MANAGE_ROLES,
  emojis: Permission.MANAGE_EMOJIS,
  sounds: Permission.MANAGE_SOUNDS,
  users: Permission.MANAGE_USERS,
  invites: Permission.MANAGE_INVITES,
  storage: Permission.MANAGE_STORAGE,
  backup: 'owner',
  updates: Permission.MANAGE_UPDATES,
  plugins: Permission.MANAGE_PLUGINS
};

export {
  SERVER_SETTINGS_GROUPS,
  SERVER_SETTINGS_SECTION_LABEL_KEYS,
  SERVER_SETTINGS_SECTION_PERMISSIONS
};
export type { TServerSettingsSectionGroup, TServerSettingsSectionId };
