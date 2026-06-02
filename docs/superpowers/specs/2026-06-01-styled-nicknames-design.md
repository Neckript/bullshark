# Styled Nicknames — Design Spec (Issue #15)

**Date:** 2026-06-01  
**Branch:** development  
**Convention:** `feat(15): description`

---

## Overview

Users can personalise how their username is displayed: custom colour (hex free picker), font (7 bundled gaming-friendly fonts), and a role badge pill next to the name. Admins control which customisation features are available per role via the existing permission system.

---

## 1. Data Model

### 1.1 `users` table — 3 new nullable columns

| Column | SQLite type | Constraint | Notes |
|---|---|---|---|
| `nicknameColor` | `text` | nullable | Hex `#RRGGBB`; null = theme default |
| `nicknameFont` | `text` | nullable | Font key (see §1.3); null = Inter |
| `showRoleBadge` | `integer` | NOT NULL default 1 | 0/1 boolean |

### 1.2 Permissions — 3 new enum values

Added to `Permission` enum in `packages/shared/src/statics/permissions.ts`:

```
CUSTOMIZE_NICKNAME_COLOR
CUSTOMIZE_NICKNAME_FONT
CUSTOMIZE_NICKNAME_BADGE
```

All three are added to `DEFAULT_ROLE_PERMISSIONS` so they are ON by default for every role. Admins remove them to restrict a role, identical to existing permissions (`SEND_MESSAGES`, `REACT_TO_MESSAGES`, etc.).

The admin Role UI iterates the full `Permission` enum already — no UI changes needed there.

### 1.3 Bundled fonts

Seven `@fontsource/*` npm packages installed in `apps/client`. No CDN dependency.

| Key | Display name | Character |
|---|---|---|
| `inter` | Inter (default) | Clean, readable |
| `rajdhani` | Rajdhani | Military tech |
| `orbitron` | Orbitron | Sci-fi |
| `exo-2` | Exo 2 | Modern gaming |
| `bebas-neue` | Bebas Neue | Bold impact |
| `press-start-2p` | Press Start 2P | Retro 8-bit |
| `share-tech-mono` | Share Tech Mono | Terminal mono |

Imported in `apps/client/src/index.css` via `@import '@fontsource/<name>'`. Applied inline: `style={{ fontFamily: user.nicknameFont ?? 'inherit' }}`.

---

## 2. Backend

### 2.1 Extended `users.update` route (`update-user.ts`)

Three optional fields added to the Zod input:

```typescript
nicknameColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).nullable().optional()
nicknameFont: z.enum(['inter','rajdhani','orbitron','exo-2','bebas-neue',
                      'press-start-2p','share-tech-mono']).nullable().optional()
showRoleBadge: z.boolean().optional()
```

**Permission guard** (server-side, before DB write):  
- `nicknameColor` present → caller must have `CUSTOMIZE_NICKNAME_COLOR`  
- `nicknameFont` present → caller must have `CUSTOMIZE_NICKNAME_FONT`  
- `showRoleBadge` present → caller must have `CUSTOMIZE_NICKNAME_BADGE`  

Each violation returns `FORBIDDEN`. Guards applied independently so partial updates work.

### 2.2 `TJoinedPublicUser` (shared package)

Three new fields added to the type. All existing selectors, hooks, and subscription payloads propagate them automatically — the `onUpdate` subscription already broadcasts the full user object.

### 2.3 No new routes or subscriptions needed

The existing `users.update` mutation + `onUpdate` subscription covers the full lifecycle. The role permission restriction is enforced server-side at write time.

---

## 3. Frontend

### 3.1 New shared component: `NicknameBadge`

Path: `apps/client/src/components/nickname-badge/index.tsx`

Props:
```typescript
type TNicknameBadgeProps = {
  roleIds: number[];   // user's role IDs (ordered, highest priority first)
  size?: 'sm' | 'md'; // sm for sidebar, md for messages/popover
};
```

Behaviour:
- Resolves the first (highest-priority) role from the Redux roles store.
- Renders a pill: `background: role.color`, text = `role.name` (truncated to 14 chars).
- Text colour chosen for WCAG AA contrast against the role background (luminance check).
- Returns `null` if `roleIds` is empty.

### 3.2 Profile settings (`user-settings/profile/index.tsx`)

Three new controls added below the `name` field, each conditionally rendered based on the caller's permissions (checked via `useHasPermission(Permission.CUSTOMIZE_NICKNAME_*)`):

**Colour** (gated on `CUSTOMIZE_NICKNAME_COLOR`):  
- `<input type="color">` (native hex picker) synced to a text input showing the hex value.  
- Reset button (×) sets value to `null` (reverts to theme default foreground).

**Font** (gated on `CUSTOMIZE_NICKNAME_FONT`):  
- `<Select>` with 7 options. Each `<SelectItem>` rendered with its own `fontFamily` applied so users preview before selecting.  
- Live preview below: the user's current name displayed in the selected font + colour.

**Badge** (gated on `CUSTOMIZE_NICKNAME_BADGE`):  
- `<Switch>` labelled "Show role badge". Hidden entirely if the user has no roles.

All three values are saved via the existing `trpc.users.update` mutation (single call, only changed fields sent).

### 3.3 Display points

The nickname colour and font are applied wherever the username `<span>` is rendered, via inline style. The `NicknameBadge` is inserted immediately after the username span.

| File | Change |
|---|---|
| `message.tsx` (message author line) | Coloured + font username + `<NicknameBadge size="md">` |
| `messages-group.tsx` | Same (groups share the author header) |
| `user-control.tsx` (bottom sidebar) | Coloured username + `<NicknameBadge size="sm">` |
| `voice-user.tsx` (voice sidebar) | Coloured username + `<NicknameBadge size="sm">` |
| `UserPopover` | Coloured + font username + `<NicknameBadge size="md">` |

### 3.4 Font loading

```css
/* apps/client/src/index.css */
@import '@fontsource/rajdhani';
@import '@fontsource/orbitron';
@import '@fontsource/exo-2';
@import '@fontsource/bebas-neue';
@import '@fontsource/press-start-2p';
@import '@fontsource/share-tech-mono';
/* Inter is already loaded (default UI font) */
```

---

## 4. Migration

A Drizzle migration adds the three columns to `users` with safe defaults:

```sql
ALTER TABLE users ADD COLUMN nickname_color TEXT;
ALTER TABLE users ADD COLUMN nickname_font  TEXT;
ALTER TABLE users ADD COLUMN show_role_badge INTEGER NOT NULL DEFAULT 1;
```

No data backfill needed — null means "use defaults", which is correct for existing users.

---

## 5. Out of scope

- Nickname colour/font in notifications (browser notifications show plain text).
- Per-channel nickname overrides.
- Animated/gradient nicknames.
- Admin override of a specific user's nickname style (admin only manages role permissions).
