import { ChevronRight } from 'lucide-react';
import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  USER_SETTINGS_GROUPS,
  USER_SETTINGS_SECTION_LABEL_KEYS,
  type TUserSettingsSectionId
} from './sections';

type TUserSettingsMobileNavProps = {
  onSelect: (section: TUserSettingsSectionId) => void;
};

// Pas de regroupement ici, contrairement au desktop (tache 2) : la capture
// mobile de Discord partagee par l.user n'a pas de sections a en-tetes,
// juste une liste plate — voir "Perimetre mobile" de la spec.
const UserSettingsMobileNav = memo(
  ({ onSelect }: TUserSettingsMobileNavProps) => {
    const { t } = useTranslation('settings');
    const sections = USER_SETTINGS_GROUPS.flatMap((group) => group.sections);

    return (
      <div className="flex flex-col divide-y divide-border">
        {sections.map((section) => (
          <button
            key={section}
            type="button"
            onClick={() => onSelect(section)}
            className="flex items-center justify-between px-4 py-3 text-left text-sm text-foreground"
          >
            {t(USER_SETTINGS_SECTION_LABEL_KEYS[section])}
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </button>
        ))}
      </div>
    );
  }
);

export { UserSettingsMobileNav };
