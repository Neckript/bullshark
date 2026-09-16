import { ChevronRight } from 'lucide-react';
import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  SERVER_SETTINGS_GROUPS,
  SERVER_SETTINGS_SECTION_LABEL_KEYS,
  type TServerSettingsSectionId
} from './sections';

type TServerSettingsMobileNavProps = {
  onSelect: (section: TServerSettingsSectionId) => void;
  isAccessible: (section: TServerSettingsSectionId) => boolean;
};

// Liste plate sans en-tetes de groupe, comme la nav mobile de UserSettings.
const ServerSettingsMobileNav = memo(
  ({ onSelect, isAccessible }: TServerSettingsMobileNavProps) => {
    const { t } = useTranslation('settings');
    const sections = SERVER_SETTINGS_GROUPS.flatMap(
      (group) => group.sections
    ).filter(isAccessible);

    return (
      <div className="flex flex-col divide-y divide-border">
        {sections.map((section) => (
          <button
            key={section}
            type="button"
            onClick={() => onSelect(section)}
            className="flex items-center justify-between px-4 py-3 text-left text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
          >
            {t(SERVER_SETTINGS_SECTION_LABEL_KEYS[section])}
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </button>
        ))}
      </div>
    );
  }
);

export { ServerSettingsMobileNav };
