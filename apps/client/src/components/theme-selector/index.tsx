import { useCustomThemeAccent, useCustomThemeBg } from '@/features/app/hooks';
import { cn } from '@/lib/utils';
import { Button } from '@sharkord/ui';
import { memo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useTheme, type Theme } from '../theme-provider';
import { CustomThemeEditor } from './custom-theme-editor';

type TThemeDef = {
  id: Theme;
  labelKey: string;
  bg: string;
  accent: string;
};

const THEME_DEFS: TThemeDef[] = [
  { id: 'dark', labelKey: 'themeDark', bg: '#252525', accent: '#e5e5e5' },
  { id: 'light', labelKey: 'themeLight', bg: '#f5f5f5', accent: '#1a1a1a' },
  {
    id: 'gaming-red',
    labelKey: 'themeGamingRed',
    bg: '#1e0d0d',
    accent: '#c93010'
  },
  {
    id: 'deep-ocean',
    labelKey: 'themeDeepOcean',
    bg: '#0e1a2e',
    accent: '#28b3aa'
  },
  {
    id: 'midnight-purple',
    labelKey: 'themeMidnightPurple',
    bg: '#130d22',
    accent: '#8e35cc'
  },
  {
    id: 'bullshark',
    labelKey: 'themeBullshark',
    bg: '#12161d',
    accent: '#7ba7cc'
  }
];

const ThemeSelector = memo(() => {
  const { theme, setTheme } = useTheme();
  const { t } = useTranslation('settings');
  const customBg = useCustomThemeBg();
  const customAccent = useCustomThemeAccent();
  const [editing, setEditing] = useState(false);
  const hasCustom = !!customBg && !!customAccent;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-3">
        {THEME_DEFS.map(({ id, labelKey, bg, accent }) => {
          const active = theme === id;

          return (
            <button
              key={id}
              type="button"
              onClick={() => setTheme(id)}
              title={t(labelKey)}
              className={cn(
                'flex flex-col items-center gap-1.5 rounded-lg p-2 transition-all',
                'border-2 hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                active
                  ? 'border-primary scale-105'
                  : 'border-border hover:border-muted-foreground/50'
              )}
            >
              {/* Colour swatch */}
              <div
                className="w-14 h-10 rounded-md flex items-end justify-end p-1.5"
                style={{ backgroundColor: bg }}
              >
                <div
                  className="w-5 h-5 rounded-sm"
                  style={{ backgroundColor: accent }}
                />
              </div>
              <span className="text-xs text-muted-foreground font-medium">
                {t(labelKey)}
              </span>
            </button>
          );
        })}
        {hasCustom && (
          <button
            key="custom"
            type="button"
            onClick={() => setTheme('custom')}
            title={t('themeCustom')}
            className={cn(
              'flex flex-col items-center gap-1.5 rounded-lg p-2 transition-all',
              'border-2 hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              theme === 'custom'
                ? 'border-primary scale-105'
                : 'border-border hover:border-muted-foreground/50'
            )}
          >
            {/* Colour swatch */}
            <div
              className="w-14 h-10 rounded-md flex items-end justify-end p-1.5"
              style={{ backgroundColor: customBg }}
            >
              <div
                className="w-5 h-5 rounded-sm"
                style={{ backgroundColor: customAccent }}
              />
            </div>
            <span className="text-xs text-muted-foreground font-medium">
              {t('themeCustom')}
            </span>
          </button>
        )}
      </div>
      {editing ? (
        <CustomThemeEditor onClose={() => setEditing(false)} />
      ) : (
        <Button size="sm" variant="outline" onClick={() => setEditing(true)}>
          {hasCustom ? t('themeCustomEdit') : t('themeCustomCreate')}
        </Button>
      )}
    </div>
  );
});

export { ThemeSelector };
