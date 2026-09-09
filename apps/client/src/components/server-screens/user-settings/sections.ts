type TUserSettingsSectionId =
  | 'profile'
  | 'password'
  | 'security'
  | 'devices'
  | 'notifications'
  | 'others';

type TUserSettingsSectionGroup = {
  id: 'account' | 'preferences';
  labelKey: string;
  sections: TUserSettingsSectionId[];
};

// Regroupement tranche par l.user le 2026-09-09 (voir la spec) : Bullshark
// n'a pas de Nitro/Facturation a mapper sur les categories de Discord, donc
// ce regroupement est propre a Bullshark plutot qu'un calque 1:1.
const USER_SETTINGS_GROUPS: TUserSettingsSectionGroup[] = [
  {
    id: 'account',
    labelKey: 'accountSectionGroup',
    sections: ['profile', 'password', 'security', 'devices']
  },
  {
    id: 'preferences',
    labelKey: 'preferencesSectionGroup',
    sections: ['notifications', 'others']
  }
];

// Les cles existent deja (utilisees par l'ancienne TabsList) : reprises
// telles quelles, pas de nouvelle traduction pour les libelles de section.
const USER_SETTINGS_SECTION_LABEL_KEYS: Record<TUserSettingsSectionId, string> =
  {
    profile: 'profileTab',
    password: 'passwordTab',
    security: 'securityTab',
    devices: 'devicesTab',
    notifications: 'notificationsTab',
    others: 'othersTab'
  };

export { USER_SETTINGS_GROUPS, USER_SETTINGS_SECTION_LABEL_KEYS };
export type { TUserSettingsSectionGroup, TUserSettingsSectionId };
