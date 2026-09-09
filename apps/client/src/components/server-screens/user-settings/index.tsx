import { Tabs, TabsContent } from '@bullshark/ui';
import { ChevronLeft } from 'lucide-react';
import { memo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { TServerScreenBaseProps } from '../screens';
import { ServerScreenLayout } from '../server-screen-layout';
import { UserSettingsDesktopNav } from './desktop-nav';
import { Devices } from './devices';
import { UserSettingsMobileNav } from './mobile-nav';
import { Notifications } from './notifications';
import { Others } from './others';
import { Password } from './password';
import { Profile } from './profile';
import { UserSettingsProfileCard } from './profile-card';
import {
  USER_SETTINGS_SECTION_LABEL_KEYS,
  type TUserSettingsSectionId
} from './sections';
import { Security } from './security';

type TUserSettingsProps = TServerScreenBaseProps;

const UserSettings = memo(({ close }: TUserSettingsProps) => {
  const { t } = useTranslation('settings');
  const [activeSection, setActiveSection] =
    useState<TUserSettingsSectionId>('profile');
  // null = carte de profil + liste (mobile) ; une section = plein-ecran de
  // cette section par-dessus la carte, avec un chevron retour. Le meme
  // mecanisme sert a "Modifier le profil" qu'aux 5 autres sections : la
  // spec ne demandait un overlay que pour l'edition du profil, generalise
  // ici plutot que d'ecrire un second mecanisme de navigation mobile.
  const [mobileOpenSection, setMobileOpenSection] =
    useState<TUserSettingsSectionId | null>(null);

  return (
    <ServerScreenLayout close={close} title={t('userSettingsTitle')}>
      <Tabs
        value={activeSection}
        onValueChange={(value) =>
          setActiveSection(value as TUserSettingsSectionId)
        }
        className="h-full gap-0 md:flex-row"
      >
        <UserSettingsDesktopNav
          activeSection={activeSection}
          onSelect={setActiveSection}
        />

        <div className="hidden min-w-0 flex-1 overflow-y-auto p-6 md:block">
          <div className="mx-auto max-w-2xl">
            <TabsContent value="profile" className="space-y-6">
              <Profile />
            </TabsContent>
            <TabsContent value="devices" className="space-y-6">
              <Devices />
            </TabsContent>
            <TabsContent value="password" className="space-y-6">
              <Password />
            </TabsContent>
            <TabsContent value="security" className="space-y-6">
              <Security />
            </TabsContent>
            <TabsContent value="notifications" className="space-y-6">
              <Notifications />
            </TabsContent>
            <TabsContent value="others" className="space-y-6">
              <Others />
            </TabsContent>
          </div>
        </div>

        <div className="min-w-0 flex-1 overflow-y-auto md:hidden">
          <UserSettingsProfileCard
            onEditProfile={() => setMobileOpenSection('profile')}
          />
          <UserSettingsMobileNav onSelect={setMobileOpenSection} />
        </div>
      </Tabs>

      {mobileOpenSection && (
        <div className="absolute inset-0 flex flex-col bg-background md:hidden">
          <div className="flex h-14 shrink-0 items-center gap-4 border-b border-border px-4">
            <button
              type="button"
              onClick={() => setMobileOpenSection(null)}
              className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground outline-none hover:bg-accent hover:text-accent-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <h2 className="text-base font-semibold">
              {t(USER_SETTINGS_SECTION_LABEL_KEYS[mobileOpenSection])}
            </h2>
          </div>
          <div className="flex-1 overflow-y-auto p-6">
            {mobileOpenSection === 'profile' && <Profile />}
            {mobileOpenSection === 'devices' && <Devices />}
            {mobileOpenSection === 'password' && <Password />}
            {mobileOpenSection === 'security' && <Security />}
            {mobileOpenSection === 'notifications' && <Notifications />}
            {mobileOpenSection === 'others' && <Others />}
          </div>
        </div>
      )}
    </ServerScreenLayout>
  );
});

export { UserSettings };
