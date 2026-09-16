import { useCan, useIsOwnUserOwner } from '@/features/server/hooks';
import { Tabs, TabsContent } from '@bullshark/ui';
import { ChevronLeft } from 'lucide-react';
import { memo, useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { TServerScreenBaseProps } from '../screens';
import { ServerScreenLayout } from '../server-screen-layout';
import { Backup } from './backup';
import { ServerSettingsDesktopNav } from './desktop-nav';
import { Emojis } from './emojis';
import { General } from './general';
import { Invites } from './invites';
import { ServerSettingsMobileNav } from './mobile-nav';
import { Plugins } from './plugins';
import { Roles } from './roles';
import {
  SERVER_SETTINGS_GROUPS,
  SERVER_SETTINGS_SECTION_LABEL_KEYS,
  SERVER_SETTINGS_SECTION_PERMISSIONS,
  type TServerSettingsSectionId
} from './sections';
import { Sounds } from './sounds';
import { Storage } from './storage';
import { Updates } from './updates';
import { Users } from './users';

type TServerSettingsProps = TServerScreenBaseProps;

const SECTION_CONTENT: Record<TServerSettingsSectionId, React.ReactNode> = {
  general: <General />,
  roles: <Roles />,
  emojis: <Emojis />,
  sounds: <Sounds />,
  users: <Users />,
  invites: <Invites />,
  storage: <Storage />,
  backup: <Backup />,
  updates: <Updates />,
  plugins: <Plugins />
};

const ServerSettings = memo(({ close }: TServerSettingsProps) => {
  const { t } = useTranslation('settings');
  const can = useCan();
  const isOwner = useIsOwnUserOwner();

  const isAccessible = useCallback(
    (section: TServerSettingsSectionId) => {
      const permission = SERVER_SETTINGS_SECTION_PERMISSIONS[section];
      return permission === 'owner' ? isOwner : can(permission);
    },
    [can, isOwner]
  );

  const accessibleSections = useMemo(
    () =>
      SERVER_SETTINGS_GROUPS.flatMap((group) => group.sections).filter(
        isAccessible
      ),
    [isAccessible]
  );

  const [activeSection, setActiveSection] = useState<TServerSettingsSectionId>(
    () => accessibleSections[0] ?? 'general'
  );
  // null = liste (mobile) ; une section = plein-ecran de cette section
  // par-dessus la liste, avec un chevron retour. Meme mecanisme que UserSettings.
  const [mobileOpenSection, setMobileOpenSection] =
    useState<TServerSettingsSectionId | null>(null);

  return (
    <ServerScreenLayout close={close} title={t('serverSettingsTitle')}>
      <Tabs
        value={activeSection}
        onValueChange={(value) =>
          setActiveSection(value as TServerSettingsSectionId)
        }
        className="h-full gap-0 md:flex-row"
      >
        <ServerSettingsDesktopNav
          activeSection={activeSection}
          onSelect={setActiveSection}
          isAccessible={isAccessible}
        />

        <div className="hidden min-w-0 flex-1 overflow-y-auto p-6 md:block">
          <div className="mx-auto max-w-4xl">
            {accessibleSections.map((section) => (
              <TabsContent key={section} value={section} className="space-y-6">
                {SECTION_CONTENT[section]}
              </TabsContent>
            ))}
          </div>
        </div>

        <div className="min-w-0 flex-1 overflow-y-auto md:hidden">
          <ServerSettingsMobileNav
            onSelect={setMobileOpenSection}
            isAccessible={isAccessible}
          />
        </div>
      </Tabs>

      {mobileOpenSection && isAccessible(mobileOpenSection) && (
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
              {t(SERVER_SETTINGS_SECTION_LABEL_KEYS[mobileOpenSection])}
            </h2>
          </div>
          <div className="flex-1 overflow-y-auto p-6">
            {SECTION_CONTENT[mobileOpenSection]}
          </div>
        </div>
      )}
    </ServerScreenLayout>
  );
});

export { ServerSettings };
