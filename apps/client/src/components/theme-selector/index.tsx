import { cn } from '@/lib/utils';
import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { useTheme, type Theme } from '../theme-provider';

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

  return (
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
    </div>
  );
});

export { ThemeSelector };
