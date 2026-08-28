# Owner Claim Banner & Token Rotation — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a sidebar banner letting any user claim server ownership via token, and an owner-only button in the Backup tab to regenerate that token and reveal it once.

**Architecture:** Feature 1 derives "server has no owner" purely client-side from the existing Redux `users` slice (no server changes), surfaces it as a warning banner in the left sidebar, and opens a modal that calls the existing `useSecretToken` tRPC route. Feature 2 adds a new `rotateOwnerToken` tRPC mutation (owner-only, returns plaintext token once) and a new card in the Backup tab with an inline AlertDialog reveal.

**Tech Stack:** Bun, React 18, tRPC, Redux Toolkit + reselect, react-i18next (7 locales), Drizzle ORM (SQLite), shadcn-style `@sharkord/ui` components, Tailwind CSS.

## Global Constraints

- No new DB migrations — `ownerClaimTokenHash` column already exists in `settings` table.
- No changes to `TPublicServerSettings` or `packages/shared`.
- Token reveal modal must never auto-close.
- i18n: all 7 locales (cs, en, es, fr, it, ru, zh) must receive every new key — no English fallback visible.
- Always work on the `development` branch.
- Typecheck commands: `bun run typecheck` in `apps/client` and `apps/server`.
- Test command: `bun test` run from `apps/server`.

---

## File Map

| Action | Path | Responsibility |
|--------|------|----------------|
| Create | `apps/server/src/routers/others/rotate-owner-token.ts` | Owner-only mutation: generate token, hash+store, return plaintext |
| Modify | `apps/server/src/routers/others/index.ts` | Register `rotateOwnerToken` in `othersRouter` |
| Create | `apps/server/src/routers/others/__tests__/rotate-owner-token.test.ts` | Test helpers used by the route |
| Modify | `apps/client/src/features/server/selectors.ts` | Add `serverHasOwnerSelector` |
| Modify | `apps/client/src/features/server/hooks.ts` | Add `useServerHasOwner` hook |
| Create | `apps/client/src/components/dialogs/claim-owner/index.tsx` | Claim owner modal (token input → useSecretToken) |
| Modify | `apps/client/src/components/dialogs/dialogs.tsx` | Add `CLAIM_OWNER` enum entry |
| Modify | `apps/client/src/components/dialogs/index.tsx` | Register `ClaimOwnerDialog` in `DialogsMap` |
| Modify | `apps/client/src/components/left-sidebar/index.tsx` | Add no-owner warning banner |
| Modify | `apps/client/src/components/server-screens/server-settings/backup/index.tsx` | Add rotate-token card + reveal AlertDialog |
| Modify | `apps/client/src/i18n/locales/{cs,en,es,fr,it,ru,zh}/dialogs.json` | Feature 1 keys (9 keys × 7 locales) |
| Modify | `apps/client/src/i18n/locales/{cs,en,es,fr,it,ru,zh}/settings.json` | Feature 2 keys (7 keys × 7 locales) |

---

### Task 1: Backend — `rotateOwnerToken` route

**Files:**
- Create: `apps/server/src/routers/others/rotate-owner-token.ts`
- Create: `apps/server/src/routers/others/__tests__/rotate-owner-token.test.ts`
- Modify: `apps/server/src/routers/others/index.ts`

**Interfaces:**
- Consumes: `generateOwnerToken(): string` and `hashOwnerToken(token: string): Promise<string>` from `../../helpers/owner-token`; `isOwner(userId: number): Promise<boolean>` from `../../db/queries/is-owner`; `db`, `settings` from `../../db` / `../../db/schema`; `invariant` from `../../utils/invariant`; `protectedProcedure` from `../../utils/trpc`
- Produces: `rotateOwnerTokenRoute` — tRPC mutation returning `{ token: string }`, registered as `others.rotateOwnerToken`

- [ ] **Step 1: Write the failing test**

Create `apps/server/src/routers/others/__tests__/rotate-owner-token.test.ts`:

```ts
import { generateOwnerToken, hashOwnerToken } from '../../../helpers/owner-token';
import { describe, expect, test } from 'bun:test';

describe('rotate-owner-token helpers', () => {
  test('generateOwnerToken returns a 43-char base64url string', () => {
    const token = generateOwnerToken();
    expect(typeof token).toBe('string');
    expect(token).toHaveLength(43);
    expect(/^[A-Za-z0-9_-]+$/.test(token)).toBe(true);
  });

  test('two calls produce different tokens', () => {
    expect(generateOwnerToken()).not.toBe(generateOwnerToken());
  });

  test('hashOwnerToken returns a non-empty string that differs per token', async () => {
    const t1 = generateOwnerToken();
    const t2 = generateOwnerToken();
    const h1 = await hashOwnerToken(t1);
    const h2 = await hashOwnerToken(t2);
    expect(typeof h1).toBe('string');
    expect(h1.length).toBeGreaterThan(0);
    expect(h1).not.toBe(h2);
  });
});
```

- [ ] **Step 2: Run test — expect PASS (helpers already exist)**

```bash
cd apps/server && bun test src/routers/others/__tests__/rotate-owner-token.test.ts
```

Expected output: `3 pass, 0 fail`

- [ ] **Step 3: Create the route**

Create `apps/server/src/routers/others/rotate-owner-token.ts`:

```ts
import { db } from '../../db';
import { isOwner } from '../../db/queries/is-owner';
import { settings } from '../../db/schema';
import { generateOwnerToken, hashOwnerToken } from '../../helpers/owner-token';
import { invariant } from '../../utils/invariant';
import { protectedProcedure } from '../../utils/trpc';

const rotateOwnerTokenRoute = protectedProcedure.mutation(async ({ ctx }) => {
  invariant(await isOwner(ctx.userId), {
    code: 'FORBIDDEN',
    message: 'Owner only'
  });

  const token = generateOwnerToken();
  await db
    .update(settings)
    .set({ ownerClaimTokenHash: await hashOwnerToken(token) });

  return { token };
});

export { rotateOwnerTokenRoute };
```

- [ ] **Step 4: Register in `othersRouter`**

Edit `apps/server/src/routers/others/index.ts` — add the import and route:

```ts
import { t } from '../../utils/trpc';
import { changeLogoRoute } from './change-logo';
import { onServerSettingsUpdateRoute } from './events';
import { getSettingsRoute } from './get-settings';
import { getStorageSettingsRoute } from './get-storage-settings';
import { getUpdateRoute } from './get-update';
import { handshakeRoute } from './handshake';
import { joinServerRoute } from './join';
import { rotateOwnerTokenRoute } from './rotate-owner-token';
import { updateServerRoute } from './update-server';
import { updateSettingsRoute } from './update-settings';
import { useSecretTokenRoute } from './use-secret-token';

export const othersRouter = t.router({
  joinServer: joinServerRoute,
  handshake: handshakeRoute,
  updateSettings: updateSettingsRoute,
  changeLogo: changeLogoRoute,
  getSettings: getSettingsRoute,
  onServerSettingsUpdate: onServerSettingsUpdateRoute,
  useSecretToken: useSecretTokenRoute,
  rotateOwnerToken: rotateOwnerTokenRoute,
  getStorageSettings: getStorageSettingsRoute,
  getUpdate: getUpdateRoute,
  updateServer: updateServerRoute
});
```

- [ ] **Step 5: Typecheck server**

```bash
cd apps/server && bun run typecheck
```

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add apps/server/src/routers/others/rotate-owner-token.ts \
        apps/server/src/routers/others/__tests__/rotate-owner-token.test.ts \
        apps/server/src/routers/others/index.ts
git commit -m "feat(server): rotateOwnerToken mutation — regenerates owner-claim token, returns plaintext once"
```

---

### Task 2: Client state — `serverHasOwnerSelector` + `useServerHasOwner`

**Files:**
- Modify: `apps/client/src/features/server/selectors.ts`
- Modify: `apps/client/src/features/server/hooks.ts`

**Interfaces:**
- Consumes: `usersSelector` (already imported in selectors.ts); `OWNER_ROLE_ID` from `@sharkord/shared` (already imported); `useSelector` from `react-redux` (already imported in hooks.ts)
- Produces: `serverHasOwnerSelector` — `(state: IRootState) => boolean`; `useServerHasOwner` — `() => boolean`

- [ ] **Step 1: Add selector to `selectors.ts`**

Open `apps/client/src/features/server/selectors.ts`. After the `isOwnUserOwnerSelector` block, add:

```ts
export const serverHasOwnerSelector = createSelector(
  [usersSelector],
  (users) => users.some((u) => u.roleIds.includes(OWNER_ROLE_ID))
);
```

`OWNER_ROLE_ID` and `usersSelector` are already imported in this file.

- [ ] **Step 2: Add hook to `hooks.ts`**

Open `apps/client/src/features/server/hooks.ts`. Add the import and hook.

In the imports block, add `serverHasOwnerSelector` alongside the other selectors already imported:

```ts
import {
  // ... existing imports ...
  serverHasOwnerSelector,
  // ...
} from './selectors';
```

Then add the hook after `useIsOwnUserOwner`:

```ts
export const useServerHasOwner = () => useSelector(serverHasOwnerSelector);
```

- [ ] **Step 3: Typecheck client**

```bash
cd apps/client && bun run typecheck
```

Expected: no errors (the 2 known pre-existing errors in `messages-group.tsx` and `profile/index.tsx` are acceptable).

- [ ] **Step 4: Commit**

```bash
git add apps/client/src/features/server/selectors.ts \
        apps/client/src/features/server/hooks.ts
git commit -m "feat(client): serverHasOwnerSelector + useServerHasOwner hook — derived from users store"
```

---

### Task 3: Feature 1 — i18n keys + claim-owner dialog + sidebar banner

**Files:**
- Modify: `apps/client/src/i18n/locales/{cs,en,es,fr,it,ru,zh}/dialogs.json` (9 keys each)
- Create: `apps/client/src/components/dialogs/claim-owner/index.tsx`
- Modify: `apps/client/src/components/dialogs/dialogs.tsx`
- Modify: `apps/client/src/components/dialogs/index.tsx`
- Modify: `apps/client/src/components/left-sidebar/index.tsx`

**Interfaces:**
- Consumes: `useServerHasOwner` from `@/features/server/hooks`; `openDialog` from `@/features/dialogs/actions`; `Dialog.CLAIM_OWNER` enum; `getTRPCClient` from `@/lib/trpc`; `useForm` from `@/hooks/use-form`; `AlertDialog*`, `AutoFocus`, `Input` from `@sharkord/ui`; `useTranslation` from `react-i18next`; `toast` from `sonner`
- Produces: `ClaimOwnerDialog` component; `Dialog.CLAIM_OWNER` entry; sidebar banner

- [ ] **Step 1: Add i18n keys to all 7 `dialogs.json` files**

Append these keys to **`apps/client/src/i18n/locales/en/dialogs.json`** (before the closing `}`):

```json
  "claimOwnerBannerText": "This server has no owner yet.",
  "claimOwnerBannerBtn": "Claim Ownership",
  "claimOwnerTitle": "Claim Server Ownership",
  "claimOwnerDesc": "Enter the owner token printed in the server console on first boot to claim ownership of this server.",
  "claimOwnerTokenLabel": "Owner Token",
  "claimOwnerTokenPlaceholder": "Paste your token here",
  "claimOwnerBtn": "Claim Ownership",
  "claimOwnerInvalidToken": "Invalid token.",
  "claimOwnerSuccess": "You are now the server owner."
```

Append to **`apps/client/src/i18n/locales/fr/dialogs.json`**:

```json
  "claimOwnerBannerText": "Ce serveur n'a pas encore de propriétaire.",
  "claimOwnerBannerBtn": "Réclamer la propriété",
  "claimOwnerTitle": "Réclamer la propriété du serveur",
  "claimOwnerDesc": "Entrez le token propriétaire affiché dans la console du serveur au premier démarrage pour revendiquer la propriété de ce serveur.",
  "claimOwnerTokenLabel": "Token propriétaire",
  "claimOwnerTokenPlaceholder": "Collez votre token ici",
  "claimOwnerBtn": "Réclamer la propriété",
  "claimOwnerInvalidToken": "Token invalide.",
  "claimOwnerSuccess": "Vous êtes maintenant propriétaire du serveur."
```

Append to **`apps/client/src/i18n/locales/cs/dialogs.json`**:

```json
  "claimOwnerBannerText": "Tento server zatím nemá vlastníka.",
  "claimOwnerBannerBtn": "Převzít vlastnictví",
  "claimOwnerTitle": "Převzít vlastnictví serveru",
  "claimOwnerDesc": "Zadejte token vlastníka zobrazený v konzoli serveru při prvním spuštění, abyste převzali vlastnictví tohoto serveru.",
  "claimOwnerTokenLabel": "Token vlastníka",
  "claimOwnerTokenPlaceholder": "Vložte svůj token zde",
  "claimOwnerBtn": "Převzít vlastnictví",
  "claimOwnerInvalidToken": "Neplatný token.",
  "claimOwnerSuccess": "Nyní jste vlastníkem serveru."
```

Append to **`apps/client/src/i18n/locales/es/dialogs.json`**:

```json
  "claimOwnerBannerText": "Este servidor todavía no tiene propietario.",
  "claimOwnerBannerBtn": "Reclamar propiedad",
  "claimOwnerTitle": "Reclamar la propiedad del servidor",
  "claimOwnerDesc": "Introduce el token de propietario impreso en la consola del servidor en el primer arranque para reclamar la propiedad de este servidor.",
  "claimOwnerTokenLabel": "Token de propietario",
  "claimOwnerTokenPlaceholder": "Pega tu token aquí",
  "claimOwnerBtn": "Reclamar propiedad",
  "claimOwnerInvalidToken": "Token inválido.",
  "claimOwnerSuccess": "Ahora eres el propietario del servidor."
```

Append to **`apps/client/src/i18n/locales/it/dialogs.json`**:

```json
  "claimOwnerBannerText": "Questo server non ha ancora un proprietario.",
  "claimOwnerBannerBtn": "Rivendicare la proprietà",
  "claimOwnerTitle": "Rivendicare la proprietà del server",
  "claimOwnerDesc": "Inserisci il token del proprietario stampato nella console del server al primo avvio per rivendicare la proprietà di questo server.",
  "claimOwnerTokenLabel": "Token del proprietario",
  "claimOwnerTokenPlaceholder": "Incolla qui il tuo token",
  "claimOwnerBtn": "Rivendicare la proprietà",
  "claimOwnerInvalidToken": "Token non valido.",
  "claimOwnerSuccess": "Ora sei il proprietario del server."
```

Append to **`apps/client/src/i18n/locales/ru/dialogs.json`**:

```json
  "claimOwnerBannerText": "У этого сервера пока нет владельца.",
  "claimOwnerBannerBtn": "Стать владельцем",
  "claimOwnerTitle": "Стать владельцем сервера",
  "claimOwnerDesc": "Введите токен владельца, напечатанный в консоли сервера при первом запуске, чтобы стать владельцем этого сервера.",
  "claimOwnerTokenLabel": "Токен владельца",
  "claimOwnerTokenPlaceholder": "Вставьте ваш токен сюда",
  "claimOwnerBtn": "Стать владельцем",
  "claimOwnerInvalidToken": "Неверный токен.",
  "claimOwnerSuccess": "Теперь вы владелец сервера."
```

Append to **`apps/client/src/i18n/locales/zh/dialogs.json`**:

```json
  "claimOwnerBannerText": "此服务器尚无所有者。",
  "claimOwnerBannerBtn": "认领所有权",
  "claimOwnerTitle": "认领服务器所有权",
  "claimOwnerDesc": "输入服务器首次启动时在控制台打印的所有者令牌，以认领此服务器的所有权。",
  "claimOwnerTokenLabel": "所有者令牌",
  "claimOwnerTokenPlaceholder": "在此粘贴您的令牌",
  "claimOwnerBtn": "认领所有权",
  "claimOwnerInvalidToken": "令牌无效。",
  "claimOwnerSuccess": "您现在是服务器所有者。"
```

- [ ] **Step 2: Add `CLAIM_OWNER` to Dialog enum**

Edit `apps/client/src/components/dialogs/dialogs.tsx` — add the new entry:

```ts
export enum Dialog {
  CONFIRM_ACTION = 'CONFIRM_ACTION',
  CREATE_CHANNEL = 'CREATE_CHANNEL',
  TEXT_INPUT = 'TEXT_INPUT',
  SERVER_PASSWORD = 'SERVER_PASSWORD',
  SOUNDS = 'SOUNDS',
  ASSIGN_ROLE = 'ASSIGN_ROLE',
  CREATE_INVITE = 'CREATE_INVITE',
  CREATE_CATEGORY = 'CREATE_CATEGORY',
  PLUGIN_LOGS = 'PLUGIN_LOGS',
  PLUGIN_COMMANDS = 'PLUGIN_COMMANDS',
  PLUGIN_SETTINGS = 'PLUGIN_SETTINGS',
  PLUGIN_INSTALL_CONFIRM = 'PLUGIN_INSTALL_CONFIRM',
  DELETE_USER = 'DELETE_USER',
  SEARCH = 'SEARCH',
  WELCOME_PROFILE_SETUP = 'WELCOME_PROFILE_SETUP',
  CLAIM_OWNER = 'CLAIM_OWNER'
}
```

- [ ] **Step 3: Create `ClaimOwnerDialog`**

Create `apps/client/src/components/dialogs/claim-owner/index.tsx`:

```tsx
import { getTRPCClient } from '@/lib/trpc';
import { useForm } from '@/hooks/use-form';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AutoFocus,
  Input
} from '@sharkord/ui';
import { memo, useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import type { TDialogBaseProps } from '../types';

const ClaimOwnerDialog = memo(({ isOpen, close }: TDialogBaseProps) => {
  const { t } = useTranslation('dialogs');
  const { r, values, setTrpcErrors, errors } = useForm({ token: '' });
  const [loading, setLoading] = useState(false);

  const onSubmit = useCallback(async () => {
    try {
      setLoading(true);
      const trpc = getTRPCClient();
      await trpc.others.useSecretToken.mutate({ token: values.token });
      toast.success(t('claimOwnerSuccess'));
      close();
    } catch (error) {
      setTrpcErrors(error);
    } finally {
      setLoading(false);
    }
  }, [values.token, close, setTrpcErrors, t]);

  return (
    <AlertDialog open={isOpen}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t('claimOwnerTitle')}</AlertDialogTitle>
          <AlertDialogDescription>{t('claimOwnerDesc')}</AlertDialogDescription>
        </AlertDialogHeader>
        <div className="flex flex-col gap-2">
          <AutoFocus>
            <Input
              {...r('token')}
              className="mt-2 font-mono"
              placeholder={t('claimOwnerTokenPlaceholder')}
              error={errors._general ?? (errors.token ? t('claimOwnerInvalidToken') : undefined)}
            />
          </AutoFocus>
        </div>
        <AlertDialogFooter className="gap-2">
          <AlertDialogCancel onClick={close}>{t('cancel')}</AlertDialogCancel>
          <AutoFocus>
            <AlertDialogAction
              onClick={onSubmit}
              disabled={!values.token || loading}
            >
              {t('claimOwnerBtn')}
            </AlertDialogAction>
          </AutoFocus>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
});

export { ClaimOwnerDialog };
```

- [ ] **Step 4: Register `ClaimOwnerDialog` in `DialogsProvider`**

Edit `apps/client/src/components/dialogs/index.tsx` — add import and map entry:

```tsx
import { closeDialogs } from '@/features/dialogs/actions';
import { useDialogInfo } from '@/features/dialogs/hooks';
import { createElement, memo } from 'react';
import { AssignRoleDialog } from './assign-role';
import { ClaimOwnerDialog } from './claim-owner';   // ← add
import ConfirmActionDialog from './confirm-action';
import { CreateCategoryDialog } from './create-category';
import { CreateChannelDialog } from './create-channel';
import { CreateInviteDialog } from './create-invite-dialog';
import { DeleteUserDialog } from './delete-user';
import { Dialog } from './dialogs';
import { PluginCommandsDialog } from './plugin-commands';
import { PluginInstallConfirmDialog } from './plugin-install-confirm';
import { PluginLogsDialog } from './plugin-logs';
import { PluginSettingsDialog } from './plugin-settings';
import { SearchDialog } from './search';
import { ServerPasswordDialog } from './server-password';
import { SoundsDialog } from './sounds';
import { TextInputDialog } from './text-input';
import { WelcomeProfileSetupDialog } from './welcome-profile-setup';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const DialogsMap: any = {
  [Dialog.CONFIRM_ACTION]: ConfirmActionDialog,
  [Dialog.CREATE_CHANNEL]: CreateChannelDialog,
  [Dialog.TEXT_INPUT]: TextInputDialog,
  [Dialog.SERVER_PASSWORD]: ServerPasswordDialog,
  [Dialog.SOUNDS]: SoundsDialog,
  [Dialog.ASSIGN_ROLE]: AssignRoleDialog,
  [Dialog.CREATE_INVITE]: CreateInviteDialog,
  [Dialog.CREATE_CATEGORY]: CreateCategoryDialog,
  [Dialog.PLUGIN_LOGS]: PluginLogsDialog,
  [Dialog.PLUGIN_COMMANDS]: PluginCommandsDialog,
  [Dialog.PLUGIN_SETTINGS]: PluginSettingsDialog,
  [Dialog.PLUGIN_INSTALL_CONFIRM]: PluginInstallConfirmDialog,
  [Dialog.DELETE_USER]: DeleteUserDialog,
  [Dialog.SEARCH]: SearchDialog,
  [Dialog.WELCOME_PROFILE_SETUP]: WelcomeProfileSetupDialog,
  [Dialog.CLAIM_OWNER]: ClaimOwnerDialog   // ← add
};

const DialogsProvider = memo(() => {
  const { isOpen, openDialog, props, closing } = useDialogInfo();

  if (!openDialog || !DialogsMap[openDialog]) return null;

  const realIsOpen = isOpen && !closing;

  return createElement(DialogsMap[openDialog], {
    ...props,
    isOpen: realIsOpen,
    close: closeDialogs
  });
});

export { DialogsProvider };
```

- [ ] **Step 5: Add no-owner banner to `LeftSidebar`**

Edit `apps/client/src/components/left-sidebar/index.tsx`:

```tsx
import { ResizableSidebar } from '@/components/resizable-sidebar';
import { setSelectedChannelId } from '@/features/server/channels/actions';
import { openDialog } from '@/features/dialogs/actions';
import {
  useDmsOpen,
  usePublicServerSettings,
  useServerHasOwner,
  useServerName
} from '@/features/server/hooks';
import { LocalStorageKey } from '@/helpers/storage';
import { cn } from '@/lib/utils';
import { TestId } from '@sharkord/shared';
import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { Dialog } from '../dialogs/dialogs';
import { Categories } from './categories';
import { DirectMessages } from './direct-messages';
import { DmButton } from './direct-messages/dm-button';
import { PluginButtons } from './plugin-buttons';
import { ServerDropdownMenu } from './server-dropdown';
import { UserControl } from './user-control';
import { VoiceControl } from './voice-control';

const MIN_WIDTH = 200;
const MAX_WIDTH = 400;
const DEFAULT_WIDTH = 288;

type TLeftSidebarProps = {
  className?: string;
};

const LeftSidebar = memo(({ className }: TLeftSidebarProps) => {
  const { t } = useTranslation('dialogs');
  const serverName = useServerName();
  const dmsOpen = useDmsOpen();
  const publicSettings = usePublicServerSettings();
  const serverHasOwner = useServerHasOwner();

  return (
    <ResizableSidebar
      storageKey={LocalStorageKey.LEFT_SIDEBAR_WIDTH}
      minWidth={MIN_WIDTH}
      maxWidth={MAX_WIDTH}
      defaultWidth={DEFAULT_WIDTH}
      edge="right"
      className={cn('h-full', className)}
      data-testid={TestId.LEFT_SIDEBAR}
    >
      <div className="flex w-full justify-between h-12 items-center border-b border-border px-4">
        <h2
          className="font-semibold text-foreground truncate cursor-pointer"
          onClick={() => setSelectedChannelId(undefined)}
          data-testid={TestId.LEFT_SIDEBAR_SERVER_NAME}
        >
          {serverName}
        </h2>
        <div>
          <ServerDropdownMenu />
        </div>
      </div>
      {!serverHasOwner && (
        <div className="flex items-center justify-between gap-2 border-b border-destructive/20 bg-destructive/10 px-4 py-2">
          <p className="text-xs text-destructive">{t('claimOwnerBannerText')}</p>
          <button
            className="shrink-0 text-xs font-medium text-destructive underline"
            onClick={() => openDialog(Dialog.CLAIM_OWNER)}
          >
            {t('claimOwnerBannerBtn')}
          </button>
        </div>
      )}
      {publicSettings?.directMessagesEnabled && <DmButton />}
      <PluginButtons />
      <div className="flex-1 overflow-y-auto">
        {dmsOpen ? <DirectMessages /> : <Categories />}
      </div>
      <VoiceControl />
      <UserControl />
    </ResizableSidebar>
  );
});

export { LeftSidebar };
```

- [ ] **Step 6: Typecheck client**

```bash
cd apps/client && bun run typecheck
```

Expected: no new errors (the 2 known pre-existing errors in `messages-group.tsx` and `profile/index.tsx` are acceptable).

- [ ] **Step 7: Commit**

```bash
git add \
  apps/client/src/i18n/locales/en/dialogs.json \
  apps/client/src/i18n/locales/fr/dialogs.json \
  apps/client/src/i18n/locales/cs/dialogs.json \
  apps/client/src/i18n/locales/es/dialogs.json \
  apps/client/src/i18n/locales/it/dialogs.json \
  apps/client/src/i18n/locales/ru/dialogs.json \
  apps/client/src/i18n/locales/zh/dialogs.json \
  apps/client/src/components/dialogs/claim-owner/index.tsx \
  apps/client/src/components/dialogs/dialogs.tsx \
  apps/client/src/components/dialogs/index.tsx \
  apps/client/src/components/left-sidebar/index.tsx
git commit -m "feat(client): claim-owner dialog + no-owner sidebar banner (Feature 1)"
```

---

### Task 4: Feature 2 — i18n keys + rotate-token card in Backup tab

**Files:**
- Modify: `apps/client/src/i18n/locales/{cs,en,es,fr,it,ru,zh}/settings.json` (7 keys each)
- Modify: `apps/client/src/components/server-screens/server-settings/backup/index.tsx`

**Interfaces:**
- Consumes: `trpc.others.rotateOwnerToken.mutate()` → `Promise<{ token: string }>`; `AlertDialog*`, `Button`, `Card*`, `Group` from `@sharkord/ui`; `useTranslation('settings')`; `toast` from `sonner`
- Produces: New "Owner Token" card in the Backup tab with a one-time token reveal AlertDialog

- [ ] **Step 1: Add i18n keys to all 7 `settings.json` files**

Append to **`apps/client/src/i18n/locales/en/settings.json`**:

```json
  "ownerTokenTitle": "Owner Token",
  "ownerTokenDesc": "Regenerate the owner-claim token. The new token will be shown once — save it somewhere safe.",
  "ownerTokenRotateBtn": "Regenerate Token",
  "ownerTokenRevealTitle": "New Owner Token",
  "ownerTokenRevealWarning": "This token will not be shown again. Anyone with it can take over the server.",
  "ownerTokenCopyBtn": "Copy",
  "ownerTokenCopied": "Copied!"
```

Append to **`apps/client/src/i18n/locales/fr/settings.json`**:

```json
  "ownerTokenTitle": "Token propriétaire",
  "ownerTokenDesc": "Régénérez le token de revendication de propriété. Le nouveau token s'affichera une seule fois — conservez-le en lieu sûr.",
  "ownerTokenRotateBtn": "Régénérer le token",
  "ownerTokenRevealTitle": "Nouveau token propriétaire",
  "ownerTokenRevealWarning": "Ce token ne sera plus affiché. Quiconque le possède peut prendre le contrôle du serveur.",
  "ownerTokenCopyBtn": "Copier",
  "ownerTokenCopied": "Copié !"
```

Append to **`apps/client/src/i18n/locales/cs/settings.json`**:

```json
  "ownerTokenTitle": "Token vlastníka",
  "ownerTokenDesc": "Obnovte token pro převzetí vlastnictví. Nový token se zobrazí pouze jednou — uložte jej na bezpečné místo.",
  "ownerTokenRotateBtn": "Obnovit token",
  "ownerTokenRevealTitle": "Nový token vlastníka",
  "ownerTokenRevealWarning": "Tento token nebude znovu zobrazen. Kdokoli s ním může převzít kontrolu nad serverem.",
  "ownerTokenCopyBtn": "Kopírovat",
  "ownerTokenCopied": "Zkopírováno!"
```

Append to **`apps/client/src/i18n/locales/es/settings.json`**:

```json
  "ownerTokenTitle": "Token de propietario",
  "ownerTokenDesc": "Regenera el token de reclamación de propiedad. El nuevo token se mostrará una vez — guárdalo en un lugar seguro.",
  "ownerTokenRotateBtn": "Regenerar token",
  "ownerTokenRevealTitle": "Nuevo token de propietario",
  "ownerTokenRevealWarning": "Este token no se mostrará de nuevo. Cualquiera que lo tenga puede tomar el control del servidor.",
  "ownerTokenCopyBtn": "Copiar",
  "ownerTokenCopied": "¡Copiado!"
```

Append to **`apps/client/src/i18n/locales/it/settings.json`**:

```json
  "ownerTokenTitle": "Token del proprietario",
  "ownerTokenDesc": "Rigenera il token di rivendicazione della proprietà. Il nuovo token verrà mostrato una volta sola — salvalo in un posto sicuro.",
  "ownerTokenRotateBtn": "Rigenera token",
  "ownerTokenRevealTitle": "Nuovo token del proprietario",
  "ownerTokenRevealWarning": "Questo token non verrà mostrato di nuovo. Chiunque lo possegga può prendere il controllo del server.",
  "ownerTokenCopyBtn": "Copia",
  "ownerTokenCopied": "Copiato!"
```

Append to **`apps/client/src/i18n/locales/ru/settings.json`**:

```json
  "ownerTokenTitle": "Токен владельца",
  "ownerTokenDesc": "Сгенерируйте новый токен для получения прав владельца. Новый токен будет показан один раз — сохраните его в надёжном месте.",
  "ownerTokenRotateBtn": "Обновить токен",
  "ownerTokenRevealTitle": "Новый токен владельца",
  "ownerTokenRevealWarning": "Этот токен больше не будет показан. Любой, у кого он есть, может взять контроль над сервером.",
  "ownerTokenCopyBtn": "Копировать",
  "ownerTokenCopied": "Скопировано!"
```

Append to **`apps/client/src/i18n/locales/zh/settings.json`**:

```json
  "ownerTokenTitle": "所有者令牌",
  "ownerTokenDesc": "重新生成所有权认领令牌。新令牌将只显示一次——请妥善保存。",
  "ownerTokenRotateBtn": "重新生成令牌",
  "ownerTokenRevealTitle": "新的所有者令牌",
  "ownerTokenRevealWarning": "此令牌将不再显示。任何持有该令牌的人都可以接管服务器。",
  "ownerTokenCopyBtn": "复制",
  "ownerTokenCopied": "已复制！"
```

- [ ] **Step 2: Add rotate-token card + reveal dialog to Backup component**

Replace the full content of `apps/client/src/components/server-screens/server-settings/backup/index.tsx`:

```tsx
import { downloadBackup, uploadBackup } from '@/helpers/backup';
import { getTRPCClient } from '@/lib/trpc';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Group
} from '@sharkord/ui';
import { memo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';

const Backup = memo(() => {
  const { t } = useTranslation('settings');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [rotating, setRotating] = useState(false);
  const [revealToken, setRevealToken] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const onExport = async () => {
    setExporting(true);
    try {
      await downloadBackup();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : String(error));
    } finally {
      setExporting(false);
    }
  };

  const onPickFile = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (file) setPendingFile(file);
  };

  const onConfirmImport = async () => {
    if (!pendingFile) return;
    setImporting(true);
    try {
      await uploadBackup(pendingFile);
      toast.success(t('backupImportStarted'));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : String(error));
    } finally {
      setImporting(false);
      setPendingFile(null);
    }
  };

  const onRotateToken = async () => {
    setRotating(true);
    try {
      const trpc = getTRPCClient();
      const { token } = await trpc.others.rotateOwnerToken.mutate();
      setRevealToken(token);
      setCopied(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : String(error));
    } finally {
      setRotating(false);
    }
  };

  const onCopyToken = async () => {
    if (!revealToken) return;
    await navigator.clipboard.writeText(revealToken);
    setCopied(true);
  };

  const onCloseReveal = () => {
    setRevealToken(null);
    setCopied(false);
  };

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>{t('backupTitle')}</CardTitle>
          <CardDescription>{t('backupDesc')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-destructive">{t('backupSecurityWarning')}</p>

          <Group
            label={t('backupExportLabel')}
            description={t('backupExportDesc')}
          >
            <Button onClick={onExport} disabled={exporting}>
              {exporting ? t('backupExporting') : t('backupExportButton')}
            </Button>
          </Group>

          <Group
            label={t('backupImportLabel')}
            description={t('backupImportDesc')}
          >
            <Button
              variant="destructive"
              disabled={importing}
              onClick={() => fileInputRef.current?.click()}
            >
              {importing ? t('backupImporting') : t('backupImportButton')}
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".zip,application/zip"
              className="hidden"
              onChange={onPickFile}
            />
          </Group>
        </CardContent>

        <AlertDialog
          open={!!pendingFile}
          onOpenChange={(open) => !open && setPendingFile(null)}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{t('backupImportConfirmTitle')}</AlertDialogTitle>
              <AlertDialogDescription>
                {t('backupImportConfirmDesc')}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>{t('cancel')}</AlertDialogCancel>
              <AlertDialogAction onClick={onConfirmImport} disabled={importing}>
                {t('backupImportConfirmAction')}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('ownerTokenTitle')}</CardTitle>
          <CardDescription>{t('ownerTokenDesc')}</CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            variant="destructive"
            onClick={onRotateToken}
            disabled={rotating}
          >
            {t('ownerTokenRotateBtn')}
          </Button>
        </CardContent>

        <AlertDialog open={!!revealToken}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{t('ownerTokenRevealTitle')}</AlertDialogTitle>
              <AlertDialogDescription className="text-destructive">
                {t('ownerTokenRevealWarning')}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <div className="rounded-md bg-muted px-4 py-3">
              <p className="break-all font-mono text-sm select-all">
                {revealToken}
              </p>
            </div>
            <AlertDialogFooter className="gap-2">
              <AlertDialogCancel onClick={onCopyToken}>
                {copied ? t('ownerTokenCopied') : t('ownerTokenCopyBtn')}
              </AlertDialogCancel>
              <AlertDialogAction onClick={onCloseReveal}>
                {t('close')}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </Card>
    </>
  );
});

export { Backup };
```

- [ ] **Step 3: Typecheck client**

```bash
cd apps/client && bun run typecheck
```

Expected: no new errors.

- [ ] **Step 4: Commit**

```bash
git add \
  apps/client/src/i18n/locales/en/settings.json \
  apps/client/src/i18n/locales/fr/settings.json \
  apps/client/src/i18n/locales/cs/settings.json \
  apps/client/src/i18n/locales/es/settings.json \
  apps/client/src/i18n/locales/it/settings.json \
  apps/client/src/i18n/locales/ru/settings.json \
  apps/client/src/i18n/locales/zh/settings.json \
  apps/client/src/components/server-screens/server-settings/backup/index.tsx
git commit -m "feat(client): rotate-owner-token card in Backup tab + token reveal dialog (Feature 2)"
```

---

### Final: Push

- [ ] **Push `development` to origin**

```bash
git push origin development
```

Expected: branch updated on GitHub.
