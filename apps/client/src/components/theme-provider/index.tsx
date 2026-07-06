import {
  getLocalStorageItem,
  LocalStorageKey,
  setLocalStorageItem
} from '@/helpers/storage';
import { registerThemeSetter } from '@/helpers/theme-sync';
import { createContext, useContext, useEffect, useState } from 'react';

type Theme =
  | 'dark'
  | 'light'
  | 'gaming-red'
  | 'deep-ocean'
  | 'midnight-purple'
  | 'bullshark'
  | 'custom';

const VALID_THEMES = new Set<Theme>([
  'dark',
  'light',
  'gaming-red',
  'deep-ocean',
  'midnight-purple',
  'bullshark',
  'custom'
]);

// All classes this provider may ever add — removed together on each switch.
const ALL_THEME_CLASSES = [
  'light',
  'dark',
  'theme-gaming-red',
  'theme-deep-ocean',
  'theme-midnight-purple',
  'theme-bullshark',
  'theme-custom'
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

  // Apply a theme locally (state + persisted cache) without touching the
  // server. Used for boot and for server-driven hydration.
  const applyTheme = (next: Theme) => {
    setLocalStorageItem(storageKey, next);
    setTheme(next);
  };

  // Let settings hydration drive the live theme across devices.
  useEffect(() => {
    return registerThemeSetter((next) => {
      if (VALID_THEMES.has(next as Theme)) applyTheme(next as Theme);
    });
    // applyTheme is stable for a fixed storageKey.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey]);

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
    setTheme: applyTheme
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
