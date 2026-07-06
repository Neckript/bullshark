import { useCustomThemeAccent, useCustomThemeBg } from '@/features/app/hooks';
import { applyCustomThemeVars } from '@/helpers/custom-theme';
import { memo, useEffect } from 'react';

// Applies the user's synced custom palette as CSS vars on <html>.
// Mounted inside the redux Provider — ThemeProvider lives outside of it
// (see main.tsx) so it cannot read the store itself.
const CustomThemeVars = memo(() => {
  const bg = useCustomThemeBg();
  const accent = useCustomThemeAccent();

  useEffect(() => {
    applyCustomThemeVars(bg, accent);
  }, [bg, accent]);

  return null;
});

export { CustomThemeVars };
