// Sets or clears the two custom-theme CSS variables on <html>. The
// .dark.theme-custom block in index.css derives the full palette from them
// via CSS relative color syntax.
const applyCustomThemeVars = (bg: string | null, accent: string | null) => {
  const root = document.documentElement;

  if (bg) {
    root.style.setProperty('--custom-bg', bg);
  } else {
    root.style.removeProperty('--custom-bg');
  }

  if (accent) {
    root.style.setProperty('--custom-accent', accent);
  } else {
    root.style.removeProperty('--custom-accent');
  }
};

export { applyCustomThemeVars };
