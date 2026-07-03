import {
  getLocalStorageItem,
  LocalStorageKey,
  setLocalStorageItem
} from '@/helpers/storage';
import { createContext, useContext, useEffect, useState } from 'react';

type Theme =
  | 'dark'
  | 'light'
  | 'gaming-red'
  | 'deep-ocean'
  | 'midnight-purple'
  | 'bullshark';

const VALID_THEMES = new Set<Theme>([
  'dark',
  'light',
  'gaming-red',
  'deep-ocean',
  'midnight-purple',
  'bullshark'
]);

// All classes this provider may ever add — removed together on each switch.
const ALL_THEME_CLASSES = [
  'light',
  'dark',
  'theme-gaming-red',
  'theme-deep-ocean',
  'theme-midnight-purple',
  'theme-bullshark'
] as const;

type ThemeProviderProps = {
  children: React.ReactNode;
  defaultTheme?: Theme;
  storageKey?: LocalStorageKey;
};

type ThemeProviderState = {
  theme: Theme;
  setTheme: (theme: Theme) => void;
};

const initialState: ThemeProviderState = {
  theme: 'bullshark',
  setTheme: () => null
};

const ThemeProviderContext = createContext<ThemeProviderState>(initialState);

function ThemeProvider({
  children,
  defaultTheme = 'bullshark',
  storageKey = LocalStorageKey.VITE_UI_THEME,
  ...props
}: ThemeProviderProps) {
  const [theme, setTheme] = useState<Theme>(() => {
    const stored = getLocalStorageItem(storageKey) as Theme;
    return VALID_THEMES.has(stored) ? stored : defaultTheme;
  });

  useEffect(() => {
    const root = window.document.documentElement;

    root.classList.remove(...ALL_THEME_CLASSES);

    if (theme === 'light') {
      // :root already defines light variables — no extra class needed.
      return;
    }

    if (theme === 'dark') {
      root.classList.add('dark');
      return;
    }

    // Custom dark-based theme: add .dark so Tailwind dark utilities work,
    // then the theme-specific class overrides the CSS variables.
    root.classList.add('dark', `theme-${theme}`);
  }, [theme]);

  const value = {
    theme,
    setTheme: (theme: Theme) => {
      setLocalStorageItem(storageKey, theme);
      setTheme(theme);
    }
  };

  return (
    <ThemeProviderContext.Provider {...props} value={value}>
      {children}
    </ThemeProviderContext.Provider>
  );
}

const useTheme = () => {
  const context = useContext(ThemeProviderContext);

  if (context === undefined)
    throw new Error('useTheme must be used within a ThemeProvider');

  return context;
};

// eslint-disable-next-line react-refresh/only-export-components
export { ThemeProvider, useTheme, VALID_THEMES, type Theme };
