import { cn } from '@/lib/utils';
import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  SERVER_SETTINGS_GROUPS,
  SERVER_SETTINGS_SECTION_LABEL_KEYS,
  type TServerSettingsSectionId
} from './sections';

type TServerSettingsDesktopNavProps = {
  activeSection: TServerSettingsSectionId;
  onSelect: (section: TServerSettingsSectionId) => void;
  isAccessible: (section: TServerSettingsSectionId) => boolean;
};

const ServerSettingsDesktopNav = memo(
  ({ activeSection, onSelect, isAccessible }: TServerSettingsDesktopNavProps) => {
    const { t } = useTranslation('settings');

    return (
      <nav className="hidden w-56 shrink-0 flex-col gap-4 overflow-y-auto border-r border-border p-4 md:flex">
        {SERVER_SETTINGS_GROUPS.map((group) => {
          const sections = group.sections.filter(isAccessible);

          if (sections.length === 0) return null;

          return (
            <div key={group.id} className="flex flex-col gap-0.5">
              {group.labelKey && (
                <div className="px-2.5 pb-1 text-[0.65rem] font-medium tracking-widest text-muted-foreground uppercase">
                  {t(group.labelKey)}
                </div>
              )}
              {sections.map((section) => (
                <button
                  key={section}
                  type="button"
                  onClick={() => onSelect(section)}
                  className={cn(
                    'rounded-md px-2.5 py-1.5 text-left text-sm text-muted-foreground outline-none transition-colors duration-fast ease-out hover:bg-accent hover:text-accent-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50',
                    activeSection === section &&
                      'bg-accent text-accent-foreground'
                  )}
                >
                  {t(SERVER_SETTINGS_SECTION_LABEL_KEYS[section])}
                </button>
              ))}
            </div>
          );
        })}
      </nav>
    );
  }
);

export { ServerSettingsDesktopNav };
