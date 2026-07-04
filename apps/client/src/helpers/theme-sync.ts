// Selected-theme sync bridge.
//
// The ThemeProvider lives outside the redux <Provider>, so settings hydration
// (in features/server/user-settings/actions.ts) cannot reach the live theme
// through the store. It reaches it through this tiny module instead: the
// provider registers a live setter on mount, and hydration calls it.

type LiveThemeSetter = (theme: string) => void;

let liveSetter: LiveThemeSetter | null = null;

// Registered by the ThemeProvider. Returns an unregister cleanup.
const registerThemeSetter = (fn: LiveThemeSetter): (() => void) => {
  liveSetter = fn;
  return () => {
    if (liveSetter === fn) liveSetter = null;
  };
};

// Apply a theme selection that came from the server, without echoing it back.
// No-op if the provider hasn't registered yet (it always mounts before the
// first settings load).
const applyServerTheme = (theme: string): void => {
  liveSetter?.(theme);
};

export { applyServerTheme, registerThemeSetter };
