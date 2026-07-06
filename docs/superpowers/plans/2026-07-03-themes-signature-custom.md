# Themes: Bullshark Signature + Custom Theme Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a « Bullshark » signature theme (new default) and a server-synced one-slot custom theme derived from 2 user-picked colors.

**Architecture:** The signature theme is a standard `.dark.theme-bullshark` CSS-variable block. The custom theme stores two hex strings in the existing `user_settings` k/v store (2 new allowlisted keys, hex-validated server-side); the client hydrates them into the app slice, a tiny `CustomThemeVars` component (inside the redux Provider — `ThemeProvider` is mounted OUTSIDE it) applies them as `--custom-bg`/`--custom-accent` inline vars on `<html>`, and a `.dark.theme-custom` CSS block derives all UI variables via CSS relative color syntax (`oklch(from var(--custom-bg) …)`). No DB migration, no new dependency, no JS color math.

**Tech Stack:** Drizzle user_settings (existing), tRPC settings router, Redux Toolkit app slice, React, Tailwind CSS variables, CSS relative colors, bun test.

**Spec:** `docs/superpowers/specs/2026-07-03-themes-signature-custom-design.md`

## Global Constraints

- Repo: `C:\Users\Neckr\Documents\bullshark`, branch `development`.
- No new dependencies. No DB schema change.
- i18n: every new key must exist in ALL 7 locales: en, fr, es, it, ru, zh, cs (`apps/client/src/i18n/locales/<loc>/settings.json`).
- Custom-theme values are strict `#rrggbb` (regex `/^#[0-9a-fA-F]{6}$/`), validated server-side.
- Verification commands: `bun test` (run inside `packages/shared` and `apps/server`), and from the repo root: `bun run check-types && bun run lint && bun run format:check`. **format:check is mandatory** — CI runs prettier with `prettier-plugin-organize-imports` (import order is enforced; alphabetical within groups). On this Windows checkout format:check reports ~378 pre-existing CRLF false positives in UNTOUCHED files — only failures in files you touched count; fix those with `bunx prettier --write <file> --config apps/client/.prettierrc.json`.
- Commit trailer lines required on every commit:
  `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>` and
  `Claude-Session: https://claude.ai/code/session_01Ab6ZFXRDrHP8tBcnkoaFKe`

---

### Task 1: Shared allowlist keys + server hex validation

**Files:**
- Modify: `packages/shared/src/statics/user-settings.ts`
- Modify: `apps/server/src/routers/settings/set.ts`
- Test: `packages/shared/src/statics/__tests__/user-settings.test.ts`
- Test: `apps/server/src/routers/__tests__/user-settings.test.ts`

**Interfaces:**
- Produces: allowlisted keys `custom_theme_bg` and `custom_theme_accent` (string values, strict `#rrggbb`); `settings.set` rejects non-hex values for any key starting with `custom_theme_`. Tasks 3–4 read/write these exact key names.

- [ ] **Step 1: Write the failing tests**

Append inside the existing `describe` in `packages/shared/src/statics/__tests__/user-settings.test.ts`:

```ts
  test('accepts the custom theme keys', () => {
    expect(isAllowedUserSettingKey('custom_theme_bg')).toBe(true);
    expect(isAllowedUserSettingKey('custom_theme_accent')).toBe(true);
  });
```

Append inside the existing `describe` in `apps/server/src/routers/__tests__/user-settings.test.ts`:

```ts
  test('set accepts a valid hex value for a custom theme key', async () => {
    const { caller } = await initTest();
    await caller.settings.set({ key: 'custom_theme_bg', value: '#1a2b3c' });
    const all = await caller.settings.getAll();
    expect(all['custom_theme_bg']).toBe('#1a2b3c');
  });

  test('set rejects invalid values for custom theme keys', async () => {
    const { caller } = await initTest();
    await expect(
      caller.settings.set({ key: 'custom_theme_bg', value: 'red' })
    ).rejects.toThrow();
    await expect(
      caller.settings.set({ key: 'custom_theme_accent', value: '#12345' })
    ).rejects.toThrow();
    await expect(
      caller.settings.set({ key: 'custom_theme_bg', value: true })
    ).rejects.toThrow();
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd packages/shared && bun test statics` → the new allowlist test FAILS (keys rejected).
Run: `cd apps/server && bun test user-settings` → the hex test FAILS (key not allowlisted).

- [ ] **Step 3: Implement**

In `packages/shared/src/statics/user-settings.ts`, extend the array:

```ts
const USER_SETTING_KEYS = [
  'browser_notifications',
  'browser_notifications_mentions',
  'browser_notifications_dms',
  'browser_notifications_replies',
  'auto_join_last_channel',
  'custom_theme_bg',
  'custom_theme_accent'
] as const;
```

In `apps/server/src/routers/settings/set.ts`, add the constant after the imports and the check inside the mutation, right after the existing allowlist `invariant`:

```ts
const HEX_COLOR_RE = /^#[0-9a-fA-F]{6}$/;
```

```ts
    if (input.key.startsWith('custom_theme_')) {
      invariant(
        typeof input.value === 'string' && HEX_COLOR_RE.test(input.value),
        {
          code: 'BAD_REQUEST',
          message: 'Invalid colour value'
        }
      );
    }
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd packages/shared && bun test` then `cd apps/server && bun test user-settings`
Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/shared/src/statics/user-settings.ts packages/shared/src/statics/__tests__/user-settings.test.ts apps/server/src/routers/settings/set.ts apps/server/src/routers/__tests__/user-settings.test.ts
git commit -m "feat: allowlist custom theme setting keys with hex validation"
```

---

### Task 2: Signature theme « Bullshark » (new default)

**Files:**
- Modify: `apps/client/src/index.css` (after the `.dark.theme-midnight-purple` block)
- Modify: `apps/client/src/components/theme-provider/index.tsx`
- Modify: `apps/client/src/components/theme-selector/index.tsx` (THEME_DEFS only)
- Modify: `apps/client/src/i18n/locales/<loc>/settings.json` × 7

**Interfaces:**
- Produces: theme id `'bullshark'` valid everywhere; `defaultTheme` becomes `'bullshark'`. Task 3 builds on the same provider file — keep its diff minimal and mechanical.

- [ ] **Step 1: CSS block**

Append after `.dark.theme-midnight-purple { … }` in `apps/client/src/index.css`:

```css
.dark.theme-bullshark {
  --background: oklch(0.14 0.02 235);
  --foreground: oklch(0.94 0.005 230);
  --card: oklch(0.18 0.022 235);
  --card-foreground: oklch(0.94 0.005 230);
  --popover: oklch(0.18 0.022 235);
  --popover-foreground: oklch(0.94 0.005 230);
  --primary: oklch(0.7 0.09 230);
  --primary-foreground: oklch(0.12 0.02 235);
  --secondary: oklch(0.23 0.025 235);
  --secondary-foreground: oklch(0.94 0 0);
  --muted: oklch(0.23 0.025 235);
  --muted-foreground: oklch(0.66 0.015 230);
  --accent: oklch(0.27 0.03 235);
  --accent-foreground: oklch(0.94 0 0);
  --destructive: oklch(0.704 0.191 22.216);
  --border: oklch(1 0 0 / 10%);
  --input: oklch(1 0 0 / 15%);
  --ring: oklch(0.7 0.09 230);
  --sidebar: oklch(0.16 0.021 235);
  --sidebar-foreground: oklch(0.94 0.005 230);
  --sidebar-primary: oklch(0.7 0.09 230);
  --sidebar-primary-foreground: oklch(0.12 0.02 235);
  --sidebar-accent: oklch(0.23 0.025 235);
  --sidebar-accent-foreground: oklch(0.94 0 0);
  --sidebar-border: oklch(1 0 0 / 10%);
  --sidebar-ring: oklch(0.7 0.09 230);
}
```

- [ ] **Step 2: Provider**

In `apps/client/src/components/theme-provider/index.tsx`:
- `type Theme = 'dark' | 'light' | 'gaming-red' | 'deep-ocean' | 'midnight-purple' | 'bullshark';`
- Add `'bullshark'` to `VALID_THEMES`.
- Add `'theme-bullshark'` to `ALL_THEME_CLASSES`.
- Change the prop default: `defaultTheme = 'bullshark'` (line ~47) AND the context `initialState.theme: 'bullshark'`.

- [ ] **Step 3: Selector + i18n**

In `THEME_DEFS` (`theme-selector/index.tsx`), append:

```ts
  {
    id: 'bullshark',
    labelKey: 'themeBullshark',
    bg: '#12161d',
    accent: '#7ba7cc'
  }
```

In each of the 7 `settings.json` files, next to `themeMidnightPurple`, add (same value everywhere — it is a brand name):

```json
  "themeBullshark": "Bullshark",
```

- [ ] **Step 4: Verify**

Run from repo root: `bun run check-types && bun run lint && bun run format:check`
Expected: no errors in touched files. Then `cd apps/client && bun run dev` — the selector shows the Bullshark swatch; selecting it turns the UI steel-blue; clearing `vite-ui-theme` from localStorage and reloading lands on the Bullshark theme (new default).

- [ ] **Step 5: Commit**

```bash
git add apps/client/src/index.css apps/client/src/components/theme-provider/index.tsx apps/client/src/components/theme-selector/index.tsx apps/client/src/i18n/locales
git commit -m "feat: add Bullshark signature theme and make it the default"
```

---

### Task 3: Custom theme plumbing (slice, hydration, actions, vars, CSS)

**Files:**
- Modify: `apps/client/src/features/app/slice.ts`
- Modify: `apps/client/src/features/app/hooks.ts` (and its selectors file if selectors live separately — follow the existing `autoJoinLastChannelSelector` pattern)
- Modify: `apps/client/src/features/server/user-settings/actions.ts`
- Create: `apps/client/src/helpers/custom-theme.ts`
- Create: `apps/client/src/components/custom-theme-vars/index.tsx`
- Modify: `apps/client/src/main.tsx`
- Modify: `apps/client/src/components/theme-provider/index.tsx`
- Modify: `apps/client/src/index.css`

**Interfaces:**
- Consumes: setting keys `custom_theme_bg`/`custom_theme_accent` (Task 1), theme id mechanics (Task 2).
- Produces (Task 4 depends on): slice fields `customThemeBg`/`customThemeAccent: string | null`; reducer `setCustomTheme({ bg, accent })`; hooks `useCustomThemeBg()`/`useCustomThemeAccent()`; actions `saveCustomTheme(bg, accent)`, `clearCustomTheme()`; helper `applyCustomThemeVars(bg: string | null, accent: string | null)`; theme id `'custom'` valid in the provider.

- [ ] **Step 1: Slice**

In `apps/client/src/features/app/slice.ts`:
- State type: add `customThemeBg: string | null;` and `customThemeAccent: string | null;`
- Initial state: `customThemeBg: null,` `customThemeAccent: null,`
- Extend the `hydrateUserSettings` payload type with `customThemeBg: string | null; customThemeAccent: string | null;` and assign both in the reducer body.
- New reducer alongside the others:

```ts
    setCustomTheme: (
      state,
      action: PayloadAction<{ bg: string | null; accent: string | null }>
    ) => {
      state.customThemeBg = action.payload.bg;
      state.customThemeAccent = action.payload.accent;
    },
```

- [ ] **Step 2: Selectors/hooks**

Following the exact pattern of `autoJoinLastChannelSelector` / `useAutoJoinLastChannel` (same files, same style):

```ts
export const useCustomThemeBg = () => useSelector(customThemeBgSelector);
export const useCustomThemeAccent = () => useSelector(customThemeAccentSelector);
```

with the two selectors reading `state.app.customThemeBg` / `state.app.customThemeAccent`.

- [ ] **Step 3: Hydration + actions**

In `apps/client/src/features/server/user-settings/actions.ts`:
- In `applyServerSettings`, extend the dispatched payload:

```ts
      customThemeBg:
        typeof settings['custom_theme_bg'] === 'string'
          ? settings['custom_theme_bg']
          : null,
      customThemeAccent:
        typeof settings['custom_theme_accent'] === 'string'
          ? settings['custom_theme_accent']
          : null
```

- Widen `writeUserSetting` to `(key: string, value: boolean | string)`.
- Add and export:

```ts
const saveCustomTheme = async (bg: string, accent: string): Promise<void> => {
  const trpc = getTRPCClient();
  await trpc.settings.set.mutate({ key: 'custom_theme_bg', value: bg });
  await trpc.settings.set.mutate({ key: 'custom_theme_accent', value: accent });
  store.dispatch(appSliceActions.setCustomTheme({ bg, accent }));
};

const clearCustomTheme = async (): Promise<void> => {
  const trpc = getTRPCClient();
  await trpc.settings.delete.mutate({ key: 'custom_theme_bg' });
  await trpc.settings.delete.mutate({ key: 'custom_theme_accent' });
  store.dispatch(appSliceActions.setCustomTheme({ bg: null, accent: null }));
};
```

- [ ] **Step 4: Helper + vars component**

Create `apps/client/src/helpers/custom-theme.ts`:

```ts
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
```

Create `apps/client/src/components/custom-theme-vars/index.tsx`:

```tsx
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
```

In `apps/client/src/main.tsx`, import `CustomThemeVars` and render `<CustomThemeVars />` as the first child inside `<Provider store={store}>` (next to `DevicesProvider`/`DialogsProvider`).

- [ ] **Step 5: Provider `'custom'` + CSS block**

In `theme-provider/index.tsx`: add `'custom'` to `Theme`, `VALID_THEMES`, and `'theme-custom'` to `ALL_THEME_CLASSES` (the generic `.dark` + `theme-${theme}` branch already handles the class application).

Append to `apps/client/src/index.css`, after the `.dark.theme-bullshark` block. The `var()` fallbacks make the theme render as neutral dark when no palette is stored:

```css
/* User-defined theme: everything is derived from --custom-bg / --custom-accent
   (set inline on <html> by CustomThemeVars) via CSS relative color syntax. */
.dark.theme-custom {
  --background: oklch(from var(--custom-bg, #181818) l c h);
  --foreground: oklch(0.94 0 0);
  --card: oklch(from var(--custom-bg, #181818) calc(l + 0.05) c h);
  --card-foreground: oklch(0.94 0 0);
  --popover: oklch(from var(--custom-bg, #181818) calc(l + 0.05) c h);
  --popover-foreground: oklch(0.94 0 0);
  --primary: oklch(from var(--custom-accent, #7ba7cc) l c h);
  --primary-foreground: oklch(0.98 0 0);
  --secondary: oklch(from var(--custom-bg, #181818) calc(l + 0.1) c h);
  --secondary-foreground: oklch(0.94 0 0);
  --muted: oklch(from var(--custom-bg, #181818) calc(l + 0.1) c h);
  --muted-foreground: oklch(0.65 0 0);
  --accent: oklch(from var(--custom-bg, #181818) calc(l + 0.14) c h);
  --accent-foreground: oklch(0.94 0 0);
  --destructive: oklch(0.704 0.191 22.216);
  --border: oklch(1 0 0 / 10%);
  --input: oklch(1 0 0 / 15%);
  --ring: oklch(from var(--custom-accent, #7ba7cc) l c h);
  --sidebar: oklch(from var(--custom-bg, #181818) calc(l + 0.02) c h);
  --sidebar-foreground: oklch(0.94 0 0);
  --sidebar-primary: oklch(from var(--custom-accent, #7ba7cc) l c h);
  --sidebar-primary-foreground: oklch(0.98 0 0);
  --sidebar-accent: oklch(from var(--custom-bg, #181818) calc(l + 0.1) c h);
  --sidebar-accent-foreground: oklch(0.94 0 0);
  --sidebar-border: oklch(1 0 0 / 10%);
  --sidebar-ring: oklch(from var(--custom-accent, #7ba7cc) l c h);
}
```

- [ ] **Step 6: Verify**

Run from repo root: `bun run check-types && bun run lint && bun run format:check`
Expected: no errors in touched files. (The `'custom'` theme has no UI entry yet — that is Task 4; nothing user-visible changes in this task.)

- [ ] **Step 7: Commit**

```bash
git add apps/client/src/features/app apps/client/src/features/server/user-settings/actions.ts apps/client/src/helpers/custom-theme.ts apps/client/src/components/custom-theme-vars apps/client/src/main.tsx apps/client/src/components/theme-provider/index.tsx apps/client/src/index.css
git commit -m "feat: custom theme plumbing — synced palette vars and derived CSS"
```

---

### Task 4: Custom theme UI (selector vignette + editor)

**Files:**
- Modify: `apps/client/src/components/theme-selector/index.tsx`
- Create: `apps/client/src/components/theme-selector/custom-theme-editor.tsx`
- Modify: `apps/client/src/i18n/locales/<loc>/settings.json` × 7

**Interfaces:**
- Consumes: everything Task 3 produces, `useTheme()`/`setTheme` from the provider, `Button` from `@sharkord/ui`.

- [ ] **Step 1: Editor component**

Create `apps/client/src/components/theme-selector/custom-theme-editor.tsx`:

```tsx
import { useCustomThemeAccent, useCustomThemeBg } from '@/features/app/hooks';
import {
  clearCustomTheme,
  saveCustomTheme
} from '@/features/server/user-settings/actions';
import { applyCustomThemeVars } from '@/helpers/custom-theme';
import { Button } from '@sharkord/ui';
import { memo, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../theme-provider';

const DEFAULT_BG = '#12161d';
const DEFAULT_ACCENT = '#7ba7cc';

type TCustomThemeEditorProps = {
  onClose: () => void;
};

const CustomThemeEditor = memo(({ onClose }: TCustomThemeEditorProps) => {
  const { t } = useTranslation('settings');
  const { theme, setTheme } = useTheme();
  const savedBg = useCustomThemeBg();
  const savedAccent = useCustomThemeAccent();
  const previousThemeRef = useRef(theme);
  const [bg, setBg] = useState(savedBg ?? DEFAULT_BG);
  const [accent, setAccent] = useState(savedAccent ?? DEFAULT_ACCENT);
  const [saving, setSaving] = useState(false);

  // Live preview: activate the custom theme with the edited colours.
  useEffect(() => {
    setTheme('custom');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    applyCustomThemeVars(bg, accent);
  }, [bg, accent]);

  const cancel = () => {
    applyCustomThemeVars(savedBg, savedAccent);
    setTheme(
      savedBg && savedAccent ? previousThemeRef.current : 'bullshark'
    );
    onClose();
  };

  const save = async () => {
    setSaving(true);
    try {
      await saveCustomTheme(bg, accent);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const reset = async () => {
    setSaving(true);
    try {
      await clearCustomTheme();
      applyCustomThemeVars(null, null);
      setTheme('bullshark');
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-3 rounded-lg border border-border p-3">
      <div className="flex flex-wrap gap-6">
        <label className="flex items-center gap-2 text-sm">
          {t('themeCustomBg')}
          <input
            type="color"
            value={bg}
            onChange={(e) => setBg(e.target.value)}
            className="h-8 w-12 cursor-pointer rounded border border-border bg-transparent"
          />
        </label>
        <label className="flex items-center gap-2 text-sm">
          {t('themeCustomAccent')}
          <input
            type="color"
            value={accent}
            onChange={(e) => setAccent(e.target.value)}
            className="h-8 w-12 cursor-pointer rounded border border-border bg-transparent"
          />
        </label>
      </div>
      <div className="flex gap-2">
        <Button size="sm" onClick={save} disabled={saving}>
          {t('themeCustomSave')}
        </Button>
        <Button size="sm" variant="outline" onClick={cancel} disabled={saving}>
          {t('themeCustomCancel')}
        </Button>
        {savedBg && savedAccent && (
          <Button
            size="sm"
            variant="destructive"
            onClick={reset}
            disabled={saving}
          >
            {t('themeCustomReset')}
          </Button>
        )}
      </div>
    </div>
  );
});

export { CustomThemeEditor };
```

- [ ] **Step 2: Selector rework**

Rework `apps/client/src/components/theme-selector/index.tsx`: keep `THEME_DEFS` and the existing swatch button rendering exactly as they are, and wrap them so the component becomes:

```tsx
import { useCustomThemeAccent, useCustomThemeBg } from '@/features/app/hooks';
import { cn } from '@/lib/utils';
import { Button } from '@sharkord/ui';
import { memo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useTheme, type Theme } from '../theme-provider';
import { CustomThemeEditor } from './custom-theme-editor';
```

Inside the component:

```tsx
  const customBg = useCustomThemeBg();
  const customAccent = useCustomThemeAccent();
  const [editing, setEditing] = useState(false);
  const hasCustom = !!customBg && !!customAccent;
```

Render, after the `THEME_DEFS.map(...)` swatches and inside the same flex container, a custom swatch shown only when `hasCustom` — identical button markup to the predefined swatches with `id = 'custom'`, `bg = customBg`, `accent = customAccent`, label `t('themeCustom')`.

Below the flex container (wrap everything in a `<div className="space-y-3">`):

```tsx
      {editing ? (
        <CustomThemeEditor onClose={() => setEditing(false)} />
      ) : (
        <Button size="sm" variant="outline" onClick={() => setEditing(true)}>
          {hasCustom ? t('themeCustomEdit') : t('themeCustomCreate')}
        </Button>
      )}
```

- [ ] **Step 3: i18n (7 locales)**

Add next to `themeBullshark` in each `settings.json`:

| key | en | fr | es | it | ru | zh | cs |
|---|---|---|---|---|---|---|---|
| `themeCustom` | My theme | Mon thème | Mi tema | Il mio tema | Моя тема | 我的主题 | Můj motiv |
| `themeCustomCreate` | Create my theme | Créer mon thème | Crear mi tema | Crea il mio tema | Создать мою тему | 创建我的主题 | Vytvořit můj motiv |
| `themeCustomEdit` | Edit my theme | Modifier mon thème | Editar mi tema | Modifica il mio tema | Изменить мою тему | 编辑我的主题 | Upravit můj motiv |
| `themeCustomBg` | Background colour | Couleur de fond | Color de fondo | Colore di sfondo | Цвет фона | 背景颜色 | Barva pozadí |
| `themeCustomAccent` | Accent colour | Couleur d'accent | Color de acento | Colore d'accento | Акцентный цвет | 强调色 | Barva zvýraznění |
| `themeCustomSave` | Save | Enregistrer | Guardar | Salva | Сохранить | 保存 | Uložit |
| `themeCustomCancel` | Cancel | Annuler | Cancelar | Annulla | Отмена | 取消 | Zrušit |
| `themeCustomReset` | Delete my theme | Supprimer mon thème | Eliminar mi tema | Elimina il mio tema | Удалить мою тему | 删除我的主题 | Smazat můj motiv |

- [ ] **Step 4: Verify**

Run from repo root: `bun run check-types && bun run lint && bun run format:check`
Expected: no errors in touched files.

Manual (`cd apps/client && bun run dev` against a dev server): Settings → Appearance shows « Create my theme »; opening it live-previews color changes; Save persists (reload keeps it, second browser session gets it after login); Cancel restores the previous theme; Delete removes the swatch and falls back to Bullshark.

- [ ] **Step 5: Commit**

```bash
git add apps/client/src/components/theme-selector apps/client/src/i18n/locales
git commit -m "feat: custom theme editor and selector entry"
```

---

### Task 5: Verification + ship (controller + user — not a subagent task)

- [ ] **Step 1:** Full suite: `cd packages/shared && bun test`, `cd apps/server && bun test`, root `bun run check-types && bun run lint && bun run format:check`.
- [ ] **Step 2:** Final whole-branch review (subagent-driven-development flow).
- [ ] **Step 3:** Push `development`; user deploys on his server (build recipe: `/opt/bullshark`, `bunx tsc -b && bun ./build/build.ts --all-targets`, `docker build -t bullshark:latest /opt/bullshark`, `docker compose up -d` from `/opt/sharkord`) and walks the manual checklist (both themes, sync across two sessions, new-user default).
- [ ] **Step 4:** With user approval: merge `development` → `main`, push Codeberg + GitHub.
