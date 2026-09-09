import { cn } from '@/lib/utils';
import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  USER_SETTINGS_GROUPS,
  USER_SETTINGS_SECTION_LABEL_KEYS,
  type TUserSettingsSectionId
} from './sections';

type TUserSettingsDesktopNavProps = {
  activeSection: TUserSettingsSectionId;
  onSelect: (section: TUserSettingsSectionId) => void;
};

const UserSettingsDesktopNav = memo(
  ({ activeSection, onSelect }: TUserSettingsDesktopNavProps) => {
    const { t } = useTranslation('settings');

    return (
      <nav className="flex w-56 shrink-0 flex-col gap-4 overflow-y-auto border-r border-border p-4">
        {USER_SETTINGS_GROUPS.map((group) => (
          <div key={group.id} className="flex flex-col gap-0.5">
            <div className="px-2.5 pb-1 text-[0.65rem] font-medium tracking-widest text-muted-foreground uppercase">
              {t(group.labelKey)}
            </div>
            {group.sections.map((section) => (
              <button
                key={section}
                type="button"
                onClick={() => onSelect(section)}
                className={cn(
                  'rounded-md px-2.5 py-1.5 text-left text-sm text-muted-foreground transition-colors duration-fast ease-out hover:bg-accent hover:text-accent-foreground',
                  activeSection === section &&
                    'bg-accent text-accent-foreground'
                )}
              >
                {t(USER_SETTINGS_SECTION_LABEL_KEYS[section])}
              </button>
            ))}
          </div>
        ))}
      </nav>
    );
  }
);

export { UserSettingsDesktopNav };
