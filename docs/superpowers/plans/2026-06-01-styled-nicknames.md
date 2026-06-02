# Styled Nicknames Implementation Plan (Issue #15)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let users pick a nickname colour (free hex picker), a font (7 bundled fonts), and a role badge pill; admins can restrict each customisation per role via existing permission UI.

**Architecture:** Three nullable columns on `users` + three new `Permission` enum values added to `DEFAULT_ROLE_PERMISSIONS`. The server guards each field independently. Client renders colour/font via inline `style` and a new `NicknameBadge` pill component.

**Tech Stack:** Drizzle ORM (SQLite), tRPC, React, @fontsource/* (bundled), Tailwind CSS, TypeScript

---

## File Map

| Action | Path |
|---|---|
| Modify | `packages/shared/src/statics/permissions.ts` |
| Modify | `packages/shared/src/tables.ts` |
| Modify | `apps/server/src/db/schema.ts` |
| Generate | `apps/server/src/db/migrations/0017_styled_nicknames.sql` (via drizzle-kit) |
| Modify | `apps/server/src/db/queries/users.ts` |
| Modify | `apps/server/src/routers/users/update-user.ts` |
| Install | `@fontsource/rajdhani` `@fontsource/orbitron` `@fontsource/exo-2` `@fontsource/bebas-neue` `@fontsource/press-start-2p` `@fontsource/share-tech-mono` |
| Modify | `apps/client/src/index.css` |
| Create | `apps/client/src/helpers/nickname-fonts.ts` |
| Create | `apps/client/src/components/nickname-badge/index.tsx` |
| Modify | `apps/client/src/components/server-screens/user-settings/profile/index.tsx` |
| Modify | `apps/client/src/i18n/locales/en/settings.json` |
| Modify | `apps/client/src/components/channel-view/text/messages-group.tsx` |
| Modify | `apps/client/src/components/left-sidebar/voice-user.tsx` |
| Modify | `apps/client/src/components/user-popover/index.tsx` |
| Modify | `apps/client/src/components/left-sidebar/user-control.tsx` |

---

## Task 1 — Shared: Permissions + public user type

**Files:**
- Modify: `packages/shared/src/statics/permissions.ts`
- Modify: `packages/shared/src/tables.ts`

- [ ] **Step 1: Add three Permission values and defaults**

In `packages/shared/src/statics/permissions.ts`, replace:

```typescript
export enum Permission {
  SEND_MESSAGES = 'SEND_MESSAGES',
  REACT_TO_MESSAGES = 'REACT_TO_MESSAGES',
  PIN_MESSAGES = 'PIN_MESSAGES',
  UPLOAD_FILES = 'UPLOAD_FILES',
  JOIN_VOICE_CHANNELS = 'JOIN_VOICE_CHANNELS',
  SHARE_SCREEN = 'SHARE_SCREEN',
  ENABLE_WEBCAM = 'ENABLE_WEBCAM',
  // ADMIN PERMISSIONS
```
with:
```typescript
export enum Permission {
  SEND_MESSAGES = 'SEND_MESSAGES',
  REACT_TO_MESSAGES = 'REACT_TO_MESSAGES',
  PIN_MESSAGES = 'PIN_MESSAGES',
  UPLOAD_FILES = 'UPLOAD_FILES',
  JOIN_VOICE_CHANNELS = 'JOIN_VOICE_CHANNELS',
  SHARE_SCREEN = 'SHARE_SCREEN',
  ENABLE_WEBCAM = 'ENABLE_WEBCAM',
  CUSTOMIZE_NICKNAME_COLOR = 'CUSTOMIZE_NICKNAME_COLOR',
  CUSTOMIZE_NICKNAME_FONT = 'CUSTOMIZE_NICKNAME_FONT',
  CUSTOMIZE_NICKNAME_BADGE = 'CUSTOMIZE_NICKNAME_BADGE',
  // ADMIN PERMISSIONS
```

Also replace:
```typescript
export const DEFAULT_ROLE_PERMISSIONS = [
  Permission.JOIN_VOICE_CHANNELS,
  Permission.SEND_MESSAGES,
  Permission.UPLOAD_FILES,
  Permission.SHARE_SCREEN,
  Permission.ENABLE_WEBCAM
];
```
with:
```typescript
export const DEFAULT_ROLE_PERMISSIONS = [
  Permission.JOIN_VOICE_CHANNELS,
  Permission.SEND_MESSAGES,
  Permission.UPLOAD_FILES,
  Permission.SHARE_SCREEN,
  Permission.ENABLE_WEBCAM,
  Permission.CUSTOMIZE_NICKNAME_COLOR,
  Permission.CUSTOMIZE_NICKNAME_FONT,
  Permission.CUSTOMIZE_NICKNAME_BADGE
];
```

- [ ] **Step 2: Add fields to TPublicUser**

In `packages/shared/src/tables.ts`, replace:

```typescript
type TPublicUser = Pick<
  TJoinedUser,
  | 'id'
  | 'name'
  | 'bannerColor'
  | 'bio'
  | 'avatar'
  | 'avatarId'
  | 'banner'
  | 'bannerId'
  | 'banned'
  | 'createdAt'
> & {
```
with:
```typescript
type TPublicUser = Pick<
  TJoinedUser,
  | 'id'
  | 'name'
  | 'bannerColor'
  | 'bio'
  | 'avatar'
  | 'avatarId'
  | 'banner'
  | 'bannerId'
  | 'banned'
  | 'createdAt'
  | 'nicknameColor'
  | 'nicknameFont'
  | 'showRoleBadge'
> & {
```

- [ ] **Step 3: Commit**

```bash
git add packages/shared/src/statics/permissions.ts packages/shared/src/tables.ts
git commit -m "feat(15): add CUSTOMIZE_NICKNAME_* permissions and public user type fields"
```

---

## Task 2 — Server: Schema, migration, query updates

**Files:**
- Modify: `apps/server/src/db/schema.ts`
- Generate: `apps/server/src/db/migrations/0017_*.sql` (auto)
- Modify: `apps/server/src/db/queries/users.ts`

- [ ] **Step 1: Add columns to Drizzle schema**

In `apps/server/src/db/schema.ts`, inside the `users` table definition after `bannerColor: text('banner_color'),` add:

```typescript
    nicknameColor: text('nickname_color'),
    nicknameFont: text('nickname_font'),
    showRoleBadge: integer('show_role_badge', { mode: 'boolean' })
      .notNull()
      .default(true),
```

- [ ] **Step 2: Generate migration**

```bash
cd apps/server && bun run db:gen
```

Expected: A new file `src/db/migrations/0017_*.sql` is created containing:
```sql
ALTER TABLE `users` ADD `nickname_color` text;--> statement-breakpoint
ALTER TABLE `users` ADD `nickname_font` text;--> statement-breakpoint
ALTER TABLE `users` ADD `show_role_badge` integer DEFAULT 1 NOT NULL;
```

- [ ] **Step 3: Update user queries to include new fields**

`apps/server/src/db/queries/users.ts` has ~10 locations where user fields are explicitly selected and/or mapped. At every occurrence of:
```typescript
      bannerColor: users.bannerColor,
```
add immediately after:
```typescript
      nicknameColor: users.nicknameColor,
      nicknameFont: users.nicknameFont,
      showRoleBadge: users.showRoleBadge,
```

And at every result-mapping occurrence of:
```typescript
      bannerColor: results.bannerColor,
```
or:
```typescript
      bannerColor: result.bannerColor,
```
add immediately after:
```typescript
      nicknameColor: results.nicknameColor,
      nicknameFont: results.nicknameFont,
      showRoleBadge: results.showRoleBadge,
```
(using `results` or `result` to match the variable name in context).

Verify coverage:
```bash
cd apps/server && bun run tsc --noEmit 2>&1 | grep -i nickname
```
Expected: no errors mentioning `nicknameColor`, `nicknameFont`, or `showRoleBadge`.

- [ ] **Step 4: Commit**

```bash
git add apps/server/src/db/schema.ts apps/server/src/db/migrations/ apps/server/src/db/queries/users.ts
git commit -m "feat(15): add nickname columns to schema, migration, and user queries"
```

---

## Task 3 — Server: Extend update-user route

**Files:**
- Modify: `apps/server/src/routers/users/update-user.ts`

- [ ] **Step 1: Rewrite update-user.ts**

Replace the entire file with:

```typescript
import { DELETED_USER_IDENTITY_AND_NAME, Permission } from '@sharkord/shared';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../../db';
import { publishUser } from '../../db/publishers';
import { users } from '../../db/schema';
import { protectedProcedure } from '../../utils/trpc';

const NICKNAME_FONT_VALUES = [
  'inter',
  'rajdhani',
  'orbitron',
  'exo-2',
  'bebas-neue',
  'press-start-2p',
  'share-tech-mono'
] as const;

const updateUserRoute = protectedProcedure
  .input(
    z.object({
      name: z
        .string()
        .min(1)
        .max(24)
        .refine((val) => val !== DELETED_USER_IDENTITY_AND_NAME, {
          message: 'Protected username'
        }),
      bannerColor: z
        .string()
        .regex(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/, 'Invalid hex color'),
      bio: z.string().max(160).optional(),
      nicknameColor: z
        .string()
        .regex(/^#[0-9a-fA-F]{6}$/, 'Invalid hex color')
        .nullable()
        .optional(),
      nicknameFont: z.enum(NICKNAME_FONT_VALUES).nullable().optional(),
      showRoleBadge: z.boolean().optional()
    })
  )
  .mutation(async ({ ctx, input }) => {
    if (input.nicknameColor !== undefined) {
      await ctx.needsPermission(Permission.CUSTOMIZE_NICKNAME_COLOR);
    }
    if (input.nicknameFont !== undefined) {
      await ctx.needsPermission(Permission.CUSTOMIZE_NICKNAME_FONT);
    }
    if (input.showRoleBadge !== undefined) {
      await ctx.needsPermission(Permission.CUSTOMIZE_NICKNAME_BADGE);
    }

    const updatedUser = await db
      .update(users)
      .set({
        name: input.name,
        bannerColor: input.bannerColor,
        bio: input.bio ?? null,
        ...(input.nicknameColor !== undefined && {
          nicknameColor: input.nicknameColor
        }),
        ...(input.nicknameFont !== undefined && {
          nicknameFont: input.nicknameFont
        }),
        ...(input.showRoleBadge !== undefined && {
          showRoleBadge: input.showRoleBadge
        })
      })
      .where(eq(users.id, ctx.userId))
      .returning()
      .get();

    publishUser(updatedUser.id, 'update');
  });

export { updateUserRoute };
```

- [ ] **Step 2: TypeScript check**

```bash
cd apps/server && bun run tsc --noEmit 2>&1 | head -20
```

Expected: no output (zero errors).

- [ ] **Step 3: Commit**

```bash
git add apps/server/src/routers/users/update-user.ts
git commit -m "feat(15): extend update-user route with nickname color/font/badge fields"
```

---

## Task 4 — Client: Fonts setup

**Files:**
- Install packages in `apps/client`
- Modify: `apps/client/src/index.css`
- Create: `apps/client/src/helpers/nickname-fonts.ts`

- [ ] **Step 1: Install @fontsource packages**

```bash
cd apps/client && bun add @fontsource/rajdhani @fontsource/orbitron "@fontsource/exo-2" "@fontsource/bebas-neue" "@fontsource/press-start-2p" "@fontsource/share-tech-mono"
```

Expected: packages appear in `apps/client/package.json` dependencies.

- [ ] **Step 2: Add font imports to index.css**

At the top of `apps/client/src/index.css`, after the existing `@import` lines, add:

```css
@import '@fontsource/rajdhani';
@import '@fontsource/orbitron';
@import '@fontsource/exo-2';
@import '@fontsource/bebas-neue';
@import '@fontsource/press-start-2p';
@import '@fontsource/share-tech-mono';
```

- [ ] **Step 3: Create nickname-fonts helper**

Create `apps/client/src/helpers/nickname-fonts.ts`:

```typescript
export type NicknameFontKey =
  | 'inter'
  | 'rajdhani'
  | 'orbitron'
  | 'exo-2'
  | 'bebas-neue'
  | 'press-start-2p'
  | 'share-tech-mono';

export type TNicknameFontOption = {
  key: NicknameFontKey;
  label: string;
  family: string;
};

export const NICKNAME_FONT_OPTIONS: TNicknameFontOption[] = [
  { key: 'inter', label: 'Inter', family: 'Inter, sans-serif' },
  { key: 'rajdhani', label: 'Rajdhani', family: 'Rajdhani, sans-serif' },
  { key: 'orbitron', label: 'Orbitron', family: 'Orbitron, sans-serif' },
  { key: 'exo-2', label: 'Exo 2', family: '"Exo 2", sans-serif' },
  {
    key: 'bebas-neue',
    label: 'Bebas Neue',
    family: '"Bebas Neue", sans-serif'
  },
  {
    key: 'press-start-2p',
    label: 'Press Start 2P',
    family: '"Press Start 2P", monospace'
  },
  {
    key: 'share-tech-mono',
    label: 'Share Tech Mono',
    family: '"Share Tech Mono", monospace'
  }
];

export const getNicknameFontFamily = (
  key: string | null | undefined
): string => {
  const found = NICKNAME_FONT_OPTIONS.find((f) => f.key === key);
  return found?.family ?? 'inherit';
};
```

- [ ] **Step 4: Commit**

```bash
git add apps/client/src/index.css apps/client/src/helpers/nickname-fonts.ts apps/client/package.json apps/client/bun.lock
git commit -m "feat(15): install @fontsource packages and add nickname-fonts helper"
```

---

## Task 5 — Client: NicknameBadge component

**Files:**
- Create: `apps/client/src/components/nickname-badge/index.tsx`

- [ ] **Step 1: Create NicknameBadge**

Create `apps/client/src/components/nickname-badge/index.tsx`:

```typescript
import { useUserRoles } from '@/features/server/hooks';
import { memo } from 'react';

/** Returns black or white depending on which contrasts better with `hex`. */
const getContrastColor = (hex: string): string => {
  const clean = hex.length === 4
    ? `#${hex[1]}${hex[1]}${hex[2]}${hex[2]}${hex[3]}${hex[3]}`
    : hex;
  const r = parseInt(clean.slice(1, 3), 16);
  const g = parseInt(clean.slice(3, 5), 16);
  const b = parseInt(clean.slice(5, 7), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.5 ? '#000000' : '#ffffff';
};

type TNicknameBadgeProps = {
  userId: number;
  size?: 'sm' | 'md';
};

/**
 * Pill showing the highest-priority role name next to a username.
 * Returns null when the user has no roles.
 */
const NicknameBadge = memo(({ userId, size = 'md' }: TNicknameBadgeProps) => {
  const roles = useUserRoles(userId);
  const topRole = roles[0];

  if (!topRole) return null;

  const bg = topRole.color;
  const fg = getContrastColor(bg);

  return (
    <span
      style={{
        backgroundColor: bg,
        color: fg,
        fontFamily: 'inherit',
        fontWeight: 500,
        lineHeight: 1,
        borderRadius: '0.25rem',
        whiteSpace: 'nowrap',
        display: 'inline-block',
        verticalAlign: 'middle',
        maxWidth: '80px',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        ...(size === 'sm'
          ? { fontSize: '9px', padding: '1px 4px' }
          : { fontSize: '10px', padding: '2px 6px' })
      }}
    >
      {topRole.name}
    </span>
  );
});

export { NicknameBadge };
```

- [ ] **Step 2: Verify TypeScript**

```bash
cd apps/client && bun run tsc --noEmit 2>&1 | grep nickname-badge
```

Expected: no output.

- [ ] **Step 3: Commit**

```bash
git add apps/client/src/components/nickname-badge/index.tsx
git commit -m "feat(15): add NicknameBadge pill component"
```

---

## Task 6 — Client: Profile settings UI

**Files:**
- Modify: `apps/client/src/components/server-screens/user-settings/profile/index.tsx`
- Modify: `apps/client/src/i18n/locales/en/settings.json`

- [ ] **Step 1: Rewrite profile/index.tsx**

Replace the entire file with:

```typescript
import { NicknameBadge } from '@/components/nickname-badge';
import { closeServerScreens } from '@/features/server-screens/actions';
import { useCan } from '@/features/server/hooks';
import { useOwnPublicUser } from '@/features/server/users/hooks';
import {
  getNicknameFontFamily,
  NICKNAME_FONT_OPTIONS
} from '@/helpers/nickname-fonts';
import { useForm } from '@/hooks/use-form';
import { getTRPCClient } from '@/lib/trpc';
import { Permission } from '@sharkord/shared';
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Color,
  Group,
  Input,
  Label,
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Switch,
  Textarea
} from '@sharkord/ui';
import { memo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { AvatarManager } from './avatar-manager';
import { BannerManager } from './banner-manager';

const Profile = memo(() => {
  const { t } = useTranslation('settings');
  const ownPublicUser = useOwnPublicUser();
  const can = useCan();

  const canCustomizeColor = can(Permission.CUSTOMIZE_NICKNAME_COLOR);
  const canCustomizeFont = can(Permission.CUSTOMIZE_NICKNAME_FONT);
  const canCustomizeBadge = can(Permission.CUSTOMIZE_NICKNAME_BADGE);

  const { setTrpcErrors, r, rr, values, onChange } = useForm({
    name: ownPublicUser?.name ?? '',
    bannerColor: ownPublicUser?.bannerColor ?? '#FFFFFF',
    bio: ownPublicUser?.bio ?? '',
    nicknameColor: ownPublicUser?.nicknameColor ?? null as string | null,
    nicknameFont: ownPublicUser?.nicknameFont ?? null as string | null,
    showRoleBadge: ownPublicUser?.showRoleBadge ?? true
  });

  const onUpdateUser = useCallback(async () => {
    const trpc = getTRPCClient();
    try {
      await trpc.users.update.mutate({
        name: values.name,
        bannerColor: values.bannerColor,
        bio: values.bio,
        ...(canCustomizeColor && { nicknameColor: values.nicknameColor }),
        ...(canCustomizeFont && {
          nicknameFont: values.nicknameFont as
            | 'inter'
            | 'rajdhani'
            | 'orbitron'
            | 'exo-2'
            | 'bebas-neue'
            | 'press-start-2p'
            | 'share-tech-mono'
            | null
        }),
        ...(canCustomizeBadge && { showRoleBadge: values.showRoleBadge })
      });
      toast.success(t('profileUpdated'));
    } catch (error) {
      setTrpcErrors(error);
    }
  }, [
    values,
    canCustomizeColor,
    canCustomizeFont,
    canCustomizeBadge,
    setTrpcErrors,
    t
  ]);

  if (!ownPublicUser) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('profileTitle')}</CardTitle>
        <CardDescription>{t('profileDesc')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <AvatarManager user={ownPublicUser} />

        <Group label={t('usernameLabel')}>
          <Input placeholder={t('usernamePlaceholder')} {...r('name')} />
        </Group>

        <Group label={t('bioLabel')}>
          <Textarea placeholder={t('bioPlaceholder')} {...r('bio')} />
        </Group>

        <Group label={t('bannerColorLabel')}>
          <Color {...rr('bannerColor')} defaultValue="#FFFFFF" />
        </Group>

        {(canCustomizeColor || canCustomizeFont || canCustomizeBadge) && (
          <Group
            label={t('nicknameStyleLabel')}
            description={t('nicknameStyleDesc')}
          >
            <div className="space-y-3">
              {canCustomizeColor && (
                <div className="flex items-center gap-3">
                  <Label className="w-24 text-sm text-muted-foreground">
                    {t('nicknameColorLabel')}
                  </Label>
                  <Color
                    value={values.nicknameColor ?? '#ffffff'}
                    onChange={(v) => onChange('nicknameColor', v)}
                    defaultValue="#ffffff"
                  />
                  {values.nicknameColor !== null && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => onChange('nicknameColor', null)}
                    >
                      {t('nicknameColorClear')}
                    </Button>
                  )}
                </div>
              )}

              {canCustomizeFont && (
                <div className="flex items-center gap-3">
                  <Label className="w-24 text-sm text-muted-foreground">
                    {t('nicknameFontLabel')}
                  </Label>
                  <Select
                    value={values.nicknameFont ?? 'inter'}
                    onValueChange={(v) =>
                      onChange('nicknameFont', v === 'inter' ? null : v)
                    }
                  >
                    <SelectTrigger className="w-48">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        {NICKNAME_FONT_OPTIONS.map(({ key, label, family }) => (
                          <SelectItem
                            key={key}
                            value={key}
                            style={{ fontFamily: family }}
                          >
                            {label}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </div>
              )}

              {canCustomizeBadge && (
                <div className="flex items-center gap-3">
                  <Label className="w-24 text-sm text-muted-foreground">
                    {t('nicknameBadgeLabel')}
                  </Label>
                  <Switch
                    checked={values.showRoleBadge}
                    onCheckedChange={(checked) =>
                      onChange('showRoleBadge', checked)
                    }
                  />
                </div>
              )}

              {/* Live preview */}
              <div className="flex items-center gap-2 mt-2 p-3 rounded-md bg-muted/30">
                <span className="text-xs text-muted-foreground">
                  {t('nicknamePreviewLabel')}
                </span>
                <span
                  style={{
                    color: values.nicknameColor ?? undefined,
                    fontFamily: getNicknameFontFamily(values.nicknameFont)
                  }}
                  className="font-medium"
                >
                  {values.name || ownPublicUser.name}
                </span>
                {values.showRoleBadge && (
                  <NicknameBadge userId={ownPublicUser.id} size="md" />
                )}
              </div>
            </div>
          </Group>
        )}

        <BannerManager user={ownPublicUser} />

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={closeServerScreens}>
            {t('cancel')}
          </Button>
          <Button onClick={() => void onUpdateUser()}>{t('saveChanges')}</Button>
        </div>
      </CardContent>
    </Card>
  );
});

export { Profile };
```

- [ ] **Step 2: Add i18n keys**

In `apps/client/src/i18n/locales/en/settings.json`, before the closing `}` add:

```json
  "nicknameStyleLabel": "Nickname style",
  "nicknameStyleDesc": "Customise how your name appears in messages and the sidebar.",
  "nicknameColorLabel": "Colour",
  "nicknameColorClear": "Use default",
  "nicknameFontLabel": "Font",
  "nicknameBadgeLabel": "Role badge",
  "nicknamePreviewLabel": "Preview:"
```

- [ ] **Step 3: TypeScript check**

```bash
cd apps/client && bun run tsc --noEmit 2>&1 | head -20
```

Expected: no output.

- [ ] **Step 4: Commit**

```bash
git add apps/client/src/components/server-screens/user-settings/profile/index.tsx apps/client/src/i18n/locales/en/settings.json
git commit -m "feat(15): add nickname colour/font/badge controls to profile settings"
```

---

## Task 7 — Client: Apply styles at display points

**Files:**
- Modify: `apps/client/src/components/channel-view/text/messages-group.tsx`
- Modify: `apps/client/src/components/left-sidebar/voice-user.tsx`
- Modify: `apps/client/src/components/user-popover/index.tsx`
- Modify: `apps/client/src/components/left-sidebar/user-control.tsx`

### 7a — messages-group.tsx

- [ ] **Step 1: Add imports**

At the top of `messages-group.tsx`, add:
```typescript
import { NicknameBadge } from '@/components/nickname-badge';
import { getNicknameFontFamily } from '@/helpers/nickname-fonts';
```

- [ ] **Step 2: Style the author span**

Find this block (around line 66):
```tsx
            <span
              className={cn(
                isOwnUser && 'font-bold',
                isDeletedUser && 'line-through text-muted-foreground',
                isPluginMessage && 'text-primary/80'
              )}
            >
              {authorName}
            </span>
            {isPluginMessage && (
```

Replace with:
```tsx
            <span
              className={cn(
                isOwnUser && 'font-bold',
                isDeletedUser && 'line-through text-muted-foreground',
                isPluginMessage && 'text-primary/80'
              )}
              style={
                !isDeletedUser && !isPluginMessage
                  ? {
                      color: user?.nicknameColor ?? undefined,
                      fontFamily: getNicknameFontFamily(user?.nicknameFont)
                    }
                  : undefined
              }
            >
              {authorName}
            </span>
            {!isDeletedUser && !isPluginMessage && user?.showRoleBadge !== false && (
              <NicknameBadge userId={firstMessage.userId} size="md" />
            )}
            {isPluginMessage && (
```

### 7b — voice-user.tsx

- [ ] **Step 3: Add imports to voice-user.tsx**

```typescript
import { NicknameBadge } from '@/components/nickname-badge';
import { getNicknameFontFamily } from '@/helpers/nickname-fonts';
```

- [ ] **Step 4: Style the voice user name span**

Find:
```tsx
      <span className="flex-1 text-muted-foreground truncate text-xs">
        {user.name}
      </span>
```

Replace with:
```tsx
      <span
        className="flex-1 truncate text-xs"
        style={{
          color: user.nicknameColor ?? undefined,
          fontFamily: getNicknameFontFamily(user.nicknameFont)
        }}
      >
        {user.name}
      </span>
      {user.showRoleBadge !== false && (
        <NicknameBadge userId={user.id} size="sm" />
      )}
```

### 7c — user-popover/index.tsx

- [ ] **Step 5: Add imports to user-popover/index.tsx**

```typescript
import { NicknameBadge } from '@/components/nickname-badge';
import { getNicknameFontFamily } from '@/helpers/nickname-fonts';
```

- [ ] **Step 6: Style the popover username**

Find:
```tsx
            <span className="text-lg font-semibold text-foreground truncate mb-1">
              {getRenderedUsername(user)}
            </span>
```

Replace with:
```tsx
            <div className="flex items-center gap-1.5 mb-1">
              <span
                className="text-lg font-semibold truncate"
                style={{
                  color: user.nicknameColor ?? undefined,
                  fontFamily: getNicknameFontFamily(user.nicknameFont)
                }}
              >
                {getRenderedUsername(user)}
              </span>
              {user.showRoleBadge !== false && (
                <NicknameBadge userId={userId} size="md" />
              )}
            </div>
```

### 7d — user-control.tsx

- [ ] **Step 7: Add imports to user-control.tsx**

```typescript
import { NicknameBadge } from '@/components/nickname-badge';
import { getNicknameFontFamily } from '@/helpers/nickname-fonts';
```

- [ ] **Step 8: Style the sidebar username**

Find:
```tsx
            <span className="text-sm font-medium text-foreground truncate">
              {ownPublicUser.name}
            </span>
```

Replace with:
```tsx
            <span
              className="text-sm font-medium truncate"
              style={{
                color: ownPublicUser.nicknameColor ?? undefined,
                fontFamily: getNicknameFontFamily(ownPublicUser.nicknameFont)
              }}
            >
              {ownPublicUser.name}
            </span>
            {ownPublicUser.showRoleBadge !== false && (
              <NicknameBadge userId={ownPublicUser.id} size="sm" />
            )}
```

- [ ] **Step 9: Final TypeScript check (both packages)**

```bash
cd apps/client && bun run tsc --noEmit 2>&1 | head -30
cd apps/server && bun run tsc --noEmit 2>&1 | head -30
```

Expected: no output from either command.

- [ ] **Step 10: Commit**

```bash
git add \
  apps/client/src/components/channel-view/text/messages-group.tsx \
  apps/client/src/components/left-sidebar/voice-user.tsx \
  apps/client/src/components/user-popover/index.tsx \
  apps/client/src/components/left-sidebar/user-control.tsx
git commit -m "feat(15): apply nickname colour/font/badge at all display points"
```

---

## Self-Review Checklist

- [x] Spec §1 (3 DB columns) → Task 2 Step 1
- [x] Spec §1.2 (3 permissions + defaults) → Task 1 Step 1
- [x] Spec §1.3 (7 bundled fonts) → Task 4
- [x] Spec §2.1 (Zod guards, independent per field) → Task 3
- [x] Spec §2.2 (TJoinedPublicUser) → Task 1 Step 2; propagates to TVoiceUser automatically
- [x] Spec §3.1 (NicknameBadge, WCAG contrast, size sm/md, null if no roles) → Task 5
- [x] Spec §3.2 (Profile: 3 gated controls, live preview, permission-conditional submit) → Task 6
- [x] Spec §3.3 (Display: messages-group, voice-user, UserPopover, user-control) → Task 7
- [x] Spec §4 (migration via drizzle-kit) → Task 2 Step 2
- [x] No TBD or placeholder steps — all code is complete
- [x] `NicknameBadge` uses `userId` prop consistently across all call sites
- [x] `getNicknameFontFamily` imported from same path everywhere
- [x] Font key `'inter'` maps to null in form (null = no custom font = inherit) → consistent with server enum allowing null
