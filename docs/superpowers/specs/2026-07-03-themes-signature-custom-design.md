# Themes: Bullshark Signature + Custom Theme — Design Spec

**Date:** 2026-07-03
**Status:** Approved (design validated in session)
**Repo:** bullshark (client + shared + server routers)

## Context

The client has 5 themes (`dark`, `light`, `gaming-red`, `deep-ocean`, `midnight-purple`). Custom dark-based themes are `.dark.theme-<id>` classes overriding ~28 oklch CSS variables in `apps/client/src/index.css`. `theme-provider/index.tsx` holds `Theme` type + `VALID_THEMES` + `ALL_THEME_CLASSES` and persists the *choice* in localStorage; `theme-selector/index.tsx` renders one swatch per `THEME_DEFS` entry with a `settings.json` i18n label (7 locales).

The server has a generic per-user key/value store (`user_settings` table, tRPC routers `settings.set/getAll/delete`, allowlist `USER_SETTING_KEYS` in `packages/shared/src/statics/user-settings.ts`, hydration via `features/server/user-settings/actions.ts` → app slice). **No DB migration is needed for this feature.**

## Decisions (made with the user)

| Question | Decision |
|---|---|
| New predefined theme | One: signature « Bullshark » (steel gray + metallic blue-gray, matches the shark logo) |
| Default theme for new users | Becomes `bullshark` (existing users keep their stored choice) |
| Custom theme control level | 2 colors only: background + accent; the rest is derived |
| Palette derivation | CSS relative colors (`oklch(from var(--custom-bg) …)`) — no JS color math, no new dependency |
| Custom theme slots | One per user (« My theme ») |
| Persistence | Server-synced via the existing `user_settings` k/v store; the *theme choice* stays per-device (localStorage), only the custom *palette* syncs |

## Part 1 — Signature theme `bullshark`

- `index.css`: new `.dark.theme-bullshark` block (same 28-variable shape as the existing custom themes). Palette: deep steel-gray background (oklch ≈ 0.13, hue ≈ 230, low chroma ≈ 0.015–0.03), metallic blue-gray primary (oklch ≈ 0.70 0.09 230), sidebar slightly darker than background, standard destructive red.
- `theme-provider`: add `'bullshark'` to `Theme`, `VALID_THEMES`, and `theme-bullshark` to `ALL_THEME_CLASSES`; change `defaultTheme` from `'dark'` to `'bullshark'`. Users with a stored valid theme are unaffected (localStorage wins).
- `theme-selector`: `THEME_DEFS` entry `{ id: 'bullshark', labelKey: 'themeBullshark', bg, accent }` with swatch hexes matching the palette.
- i18n: `themeBullshark` in `settings.json` for all 7 locales (en, fr, es, it, ru, zh, cs).

## Part 2 — Custom theme « My theme »

### Storage (server/shared — no migration)

- Two new allowlisted keys in `USER_SETTING_KEYS`: `custom_theme_bg`, `custom_theme_accent`. Values are strict `#rrggbb` hex strings.
- `routers/settings/set.ts`: add per-key value validation — when the key starts with `custom_theme_`, the value must match `/^#[0-9a-fA-F]{6}$/` (reject otherwise with BAD_REQUEST). Other keys keep today's behavior.
- Deletion via the existing `settings.delete` route resets the custom theme (both keys).

### CSS (`index.css`)

- New `.dark.theme-custom` block deriving all ~28 variables from two custom properties with CSS relative color syntax, e.g.:
  - `--background: oklch(from var(--custom-bg) l c h);`
  - `--card: oklch(from var(--custom-bg) calc(l + 0.05) c h);`
  - `--primary: oklch(from var(--custom-accent) l c h);`
  - `--sidebar: oklch(from var(--custom-bg) calc(l + 0.03) c h);`
  - muted/secondary/accent = graded lightness steps on the bg hue; foregrounds fixed near-white; `--destructive` keeps the standard red; borders/inputs keep the standard translucent white.
- Browser support: Chrome/Edge 119+, Firefox 128+, Safari 16.4+ (Electron is always recent). On unsupported browsers the derived values are invalid and the base `.dark` variables apply — degraded but usable (standard dark), no breakage.

### Client behavior

- `theme-provider`: add `'custom'` to `Theme`/`VALID_THEMES`/`ALL_THEME_CLASSES` (`theme-custom`). When active, the provider also sets inline custom properties `--custom-bg` / `--custom-accent` on `<html>` from the hydrated user settings, and removes them when switching away. If the user has no stored custom palette, selecting `custom` falls back to plain dark (class applied, vars absent → base `.dark` values).
- Hydration: `features/server/user-settings/actions.ts` `applyServerSettings` also carries `custom_theme_bg`/`custom_theme_accent` into the app slice (new fields `customThemeBg`/`customThemeAccent`, string | null). The provider subscribes to those values so a change syncs live.
- `theme-selector`: adds a « My theme » swatch **only when a custom palette exists** (swatch shows the two real colors), plus an « Edit » affordance (button/pencil) that opens the editor. When no palette exists, the selector shows a « Create my theme » button instead of the swatch.
- **Editor** (new component under the appearance/settings screen that hosts `ThemeSelector`): two native `<input type="color">` fields (background, accent), live preview (writes `--custom-bg`/`--custom-accent` inline while editing, without persisting), Save (two `settings.set` mutations, then switches the theme to `custom`), Cancel (restores the previous inline vars/theme). A Reset/Delete action calls `settings.delete` for both keys and reverts to the default theme if `custom` was active.
- i18n: `themeCustom`, `themeCustomCreate`, `themeCustomEdit`, `themeCustomBg`, `themeCustomAccent`, `themeCustomSave`, `themeCustomCancel`, `themeCustomReset` in `settings.json` × 7 locales.

## Error handling

| Case | Behavior |
|---|---|
| Non-hex value sent to `settings.set` for a `custom_theme_*` key | BAD_REQUEST (zod/invariant server-side) |
| `custom` selected but no palette stored | Plain dark fallback, no crash |
| Browser without relative color support | Base `.dark` variables apply (standard dark) |
| Settings hydration not yet loaded at first paint | Provider applies `custom` class; vars arrive with hydration (brief dark flash acceptable) |

## Testing

- **Shared** (`bun test`): `user-settings.test.ts` — new keys are allowed, unknown keys still rejected.
- **Server** (`bun test`): `settings.set` accepts `#1a2b3c` for `custom_theme_bg`, rejects `red`, `#12345`, `javascript:…`.
- **Client**: no test infra (known) — `bun run check-types`, `bun run lint`, `bun run format:check` (CI runs prettier with organize-imports), manual pass: create/edit/cancel/reset custom theme, live preview, second device sync, new-user default = bullshark.

## Out of scope (YAGNI)

Multiple named custom themes, theme sharing/import/export, light-based custom themes, per-variable advanced editor.
