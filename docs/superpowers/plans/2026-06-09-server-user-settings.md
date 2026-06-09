# Server-Persisted User Settings Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Persist genuine per-user preferences (notification toggles, auto-join, and role-mention mutes) on the server in a generic key-value table so they follow the account across devices.

**Architecture:** New `user_settings(user_id, key, value)` table (value = JSON-encoded scalar). A `userSettings` tRPC router exposes `getAll` / `set` / `delete`, gated to the caller's own rows and validated against a key allowlist. The client loads settings on connect, seeds the `app` Redux slice from them, writes through on every toggle change, and performs a one-time migration of existing `localStorage` values so no user's choices are reset.

**Tech Stack:** Bun, Drizzle ORM (SQLite), tRPC, Zod, React, Redux Toolkit, `bun:test`. Reference spec: `docs/superpowers/specs/2026-06-09-server-user-settings-design.md`.

---

## File Structure

**Shared**
- `packages/shared/src/statics/user-settings.ts` — create: allowlisted keys + `MUTED_ROLE_MENTION_PREFIX` + an `isAllowedUserSettingKey` validator. Export from the package index.

**Server**
- `apps/server/src/db/schema.ts` — add `userSettings` table (modify).
- `apps/server/src/db/migrations/00XX_*.sql` + `meta/` — generated `CREATE TABLE` (create).
- `apps/server/src/db/queries/user-settings.ts` — `getUserSettings`, `upsertUserSetting`, `deleteUserSetting` (create).
- `apps/server/src/routers/settings/get-all.ts`, `set.ts`, `delete.ts`, `index.ts` — new router (create).
- `apps/server/src/routers/index.ts` (or the app router file) — mount `settings` router (modify).
- Tests: `apps/server/src/routers/__tests__/user-settings.test.ts` (create).

**Client**
- `apps/client/src/features/server/user-settings/actions.ts` — `loadUserSettings`, `writeUserSetting`, `migrateLocalSettings` (create).
- `apps/client/src/features/app/slice.ts` — seed migrated fields from a payload; keep device-local reads (modify).
- `apps/client/src/features/app/actions.ts` — toggle setters also call `writeUserSetting` (modify).
- The app bootstrap (where the server connection finishes; see Task 8) — call `loadUserSettings` + `migrateLocalSettings` (modify).

---

## Phase 1 — Shared key allowlist

### Task 1: Allowlisted setting keys

**Files:**
- Create: `packages/shared/src/statics/user-settings.ts`
- Modify: `packages/shared/src/index.ts` (barrel export — match the existing export style in that file)

- [ ] **Step 1: Write the failing test**

Create `packages/shared/src/statics/__tests__/user-settings.test.ts` (if the shared package has no test dir, place it next to the file as `user-settings.test.ts`):

```ts
import { describe, expect, test } from 'bun:test';
import {
  isAllowedUserSettingKey,
  MUTED_ROLE_MENTION_PREFIX
} from '../user-settings';

describe('user setting key allowlist', () => {
  test('accepts a known fixed key', () => {
    expect(isAllowedUserSettingKey('browser_notifications')).toBe(true);
  });

  test('accepts a muted-role-mention key with numeric role id', () => {
    expect(isAllowedUserSettingKey(`${MUTED_ROLE_MENTION_PREFIX}42`)).toBe(true);
  });

  test('rejects an unknown key', () => {
    expect(isAllowedUserSettingKey('arbitrary_key')).toBe(false);
  });

  test('rejects a muted-role-mention key with non-numeric id', () => {
    expect(isAllowedUserSettingKey(`${MUTED_ROLE_MENTION_PREFIX}abc`)).toBe(
      false
    );
  });
});
```

- [ ] **Step 2: Run it to verify failure**

Run: `cd packages/shared && bun test src/statics/__tests__/user-settings.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement the allowlist**

```ts
// packages/shared/src/statics/user-settings.ts
const MUTED_ROLE_MENTION_PREFIX = 'muted_role_mention:';

// Fixed, server-persisted preference keys.
const USER_SETTING_KEYS = [
  'browser_notifications',
  'browser_notifications_mentions',
  'browser_notifications_dms',
  'browser_notifications_replies',
  'auto_join_last_channel'
] as const;

type TUserSettingKey = (typeof USER_SETTING_KEYS)[number];

const isAllowedUserSettingKey = (key: string): boolean => {
  if ((USER_SETTING_KEYS as readonly string[]).includes(key)) return true;

  if (key.startsWith(MUTED_ROLE_MENTION_PREFIX)) {
    const id = key.slice(MUTED_ROLE_MENTION_PREFIX.length);
    return id.length > 0 && /^\d+$/.test(id);
  }

  return false;
};

export {
  USER_SETTING_KEYS,
  MUTED_ROLE_MENTION_PREFIX,
  isAllowedUserSettingKey,
  type TUserSettingKey
};
```

- [ ] **Step 4: Export from the package barrel**

In `packages/shared/src/index.ts`, add (matching the file's existing `export * from './statics/...'` style):

```ts
export * from './statics/user-settings';
```

- [ ] **Step 5: Run the test**

Run: `cd packages/shared && bun test src/statics/__tests__/user-settings.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/shared/src/statics/user-settings.ts packages/shared/src/statics/__tests__/user-settings.test.ts packages/shared/src/index.ts
git commit -m "feat(user-settings): allowlisted user setting keys in shared"
```

---

## Phase 2 — Schema & migration

### Task 2: `user_settings` table

**Files:**
- Modify: `apps/server/src/db/schema.ts`
- Create (generated): `apps/server/src/db/migrations/00XX_*.sql` + `meta/`

- [ ] **Step 1: Add the table to the schema**

After the `channelReadStates` table (or alongside the other tables — placement is cosmetic), add:

```ts
const userSettings = sqliteTable(
  'user_settings',
  {
    userId: integer('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    key: text('key').notNull(),
    value: text('value').notNull(),
    updatedAt: integer('updated_at').notNull()
  },
  (t) => [
    primaryKey({ columns: [t.userId, t.key] }),
    index('user_settings_user_idx').on(t.userId)
  ]
);
```

Add `userSettings` to the module's `export { ... }` list (match how the other tables are exported in this file).

- [ ] **Step 2: Generate the migration**

Run: `cd apps/server && bun run db:gen`
Expected: a new `src/db/migrations/00XX_*.sql` containing a single `CREATE TABLE \`user_settings\`` + the index, and updated `meta/_journal.json` + snapshot. **Verify the SQL is `CREATE TABLE` only — no `DROP`/rebuild of any existing table.** (Per `drizzle-migration-cascade-gotcha`, a rebuild would be unacceptable here; a brand-new table never triggers it, but confirm.)

- [ ] **Step 3: Verify migration parity**

Run: `cd apps/server && bun run db:check`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add apps/server/src/db/schema.ts apps/server/src/db/migrations
git commit -m "feat(user-settings): add user_settings table + migration"
```

---

## Phase 3 — Server queries & router

### Task 3: Query helpers

**Files:**
- Create: `apps/server/src/db/queries/user-settings.ts`

- [ ] **Step 1: Implement the helpers**

```ts
import { and, eq } from 'drizzle-orm';
import { db } from '..';
import { userSettings } from '../schema';

const getUserSettings = async (
  userId: number
): Promise<Record<string, unknown>> => {
  const rows = await db
    .select({ key: userSettings.key, value: userSettings.value })
    .from(userSettings)
    .where(eq(userSettings.userId, userId));

  const out: Record<string, unknown> = {};
  for (const row of rows) {
    try {
      out[row.key] = JSON.parse(row.value);
    } catch {
      out[row.key] = row.value;
    }
  }
  return out;
};

const upsertUserSetting = async (
  userId: number,
  key: string,
  value: unknown
): Promise<void> => {
  await db
    .insert(userSettings)
    .values({
      userId,
      key,
      value: JSON.stringify(value),
      updatedAt: Date.now()
    })
    .onConflictDoUpdate({
      target: [userSettings.userId, userSettings.key],
      set: { value: JSON.stringify(value), updatedAt: Date.now() }
    });
};

const deleteUserSetting = async (userId: number, key: string): Promise<void> => {
  await db
    .delete(userSettings)
    .where(and(eq(userSettings.userId, userId), eq(userSettings.key, key)));
};

export { getUserSettings, upsertUserSetting, deleteUserSetting };
```

- [ ] **Step 2: Commit**

```bash
git add apps/server/src/db/queries/user-settings.ts
git commit -m "feat(user-settings): query helpers"
```

### Task 4: `settings` tRPC router

**Files:**
- Create: `apps/server/src/routers/settings/get-all.ts`, `set.ts`, `delete.ts`, `index.ts`
- Test: `apps/server/src/routers/__tests__/user-settings.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, test } from 'bun:test';
import { initTest } from '../../__tests__/helpers';

describe('userSettings router', () => {
  test('set then getAll returns the parsed value for the caller', async () => {
    const { caller } = await initTest(); // user 1
    await caller.settings.set({ key: 'browser_notifications', value: true });
    const all = await caller.settings.getAll();
    expect(all['browser_notifications']).toBe(true);
  });

  test('getAll is scoped to the caller', async () => {
    const { caller: u1 } = await initTest(); // user 1
    await u1.settings.set({ key: 'auto_join_last_channel', value: true });
    const { caller: u2 } = await initTest(2); // user 2
    const all = await u2.settings.getAll();
    expect(all['auto_join_last_channel']).toBeUndefined();
  });

  test('set rejects a key not on the allowlist', async () => {
    const { caller } = await initTest();
    await expect(
      caller.settings.set({ key: 'not_allowed', value: 1 })
    ).rejects.toThrow();
  });

  test('delete removes a muted-role-mention key', async () => {
    const { caller } = await initTest();
    await caller.settings.set({ key: 'muted_role_mention:2', value: true });
    await caller.settings.delete({ key: 'muted_role_mention:2' });
    const all = await caller.settings.getAll();
    expect(all['muted_role_mention:2']).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run it to verify failure**

Run: `cd apps/server && bun test src/routers/__tests__/user-settings.test.ts`
Expected: FAIL (`caller.settings` undefined).

- [ ] **Step 3: Implement `get-all.ts`**

```ts
import { protectedProcedure } from '../../utils/trpc';
import { getUserSettings } from '../../db/queries/user-settings';

const getAllRoute = protectedProcedure.query(async ({ ctx }) => {
  return getUserSettings(ctx.userId);
});

export { getAllRoute };
```

- [ ] **Step 4: Implement `set.ts`**

```ts
import { isAllowedUserSettingKey } from '@sharkord/shared';
import { z } from 'zod';
import { upsertUserSetting } from '../../db/queries/user-settings';
import { invariant } from '../../utils/invariant';
import { protectedProcedure } from '../../utils/trpc';

const setRoute = protectedProcedure
  .input(
    z.object({
      key: z.string().min(1).max(100),
      // JSON-serialisable scalar; the persisted preferences are bool today.
      value: z.union([z.boolean(), z.number(), z.string()])
    })
  )
  .mutation(async ({ ctx, input }) => {
    invariant(isAllowedUserSettingKey(input.key), {
      code: 'BAD_REQUEST',
      message: 'Unknown setting key'
    });
    await upsertUserSetting(ctx.userId, input.key, input.value);
  });

export { setRoute };
```

- [ ] **Step 5: Implement `delete.ts`**

```ts
import { isAllowedUserSettingKey } from '@sharkord/shared';
import { z } from 'zod';
import { deleteUserSetting } from '../../db/queries/user-settings';
import { invariant } from '../../utils/invariant';
import { protectedProcedure } from '../../utils/trpc';

const deleteRoute = protectedProcedure
  .input(z.object({ key: z.string().min(1).max(100) }))
  .mutation(async ({ ctx, input }) => {
    invariant(isAllowedUserSettingKey(input.key), {
      code: 'BAD_REQUEST',
      message: 'Unknown setting key'
    });
    await deleteUserSetting(ctx.userId, input.key);
  });

export { deleteRoute };
```

- [ ] **Step 6: Implement `index.ts`**

```ts
import { t } from '../../utils/trpc';
import { deleteRoute } from './delete';
import { getAllRoute } from './get-all';
import { setRoute } from './set';

export const settingsRouter = t.router({
  getAll: getAllRoute,
  set: setRoute,
  delete: deleteRoute
});
```

- [ ] **Step 7: Mount the router**

Find the root app router (the file that combines `usersRouter`, `channelsRouter`, etc. — search: `cd apps/server && grep -rn "usersRouter" src/routers/index.ts` or the `appRouter` definition). Add:

```ts
import { settingsRouter } from './settings';
// ... in the router object:
settings: settingsRouter,
```

- [ ] **Step 8: Run the test**

Run: `cd apps/server && bun test src/routers/__tests__/user-settings.test.ts`
Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add apps/server/src/routers/settings apps/server/src/routers/index.ts apps/server/src/routers/__tests__/user-settings.test.ts
git commit -m "feat(user-settings): settings tRPC router (getAll/set/delete)"
```

---

## Phase 4 — Client integration

### Task 5: Client settings actions

**Files:**
- Create: `apps/client/src/features/server/user-settings/actions.ts`

Reference the existing tRPC-client call style used in other `features/server/**/actions.ts` (e.g. how `messages/actions.ts` or role actions obtain the client). Use the same client accessor.

- [ ] **Step 1: Implement the actions**

```ts
import { store } from '@/features/store';
import { appSliceActions } from '@/features/app/slice';
import { getTRPCClient } from '@/features/<existing-trpc-client-path>'; // match other actions files
import {
  LocalStorageKey,
  getLocalStorageItemBool
} from '@/helpers/storage';
import { MUTED_ROLE_MENTION_PREFIX } from '@sharkord/shared';

// server key -> how to apply it into the app slice
const applyServerSettings = (settings: Record<string, unknown>) => {
  store.dispatch(
    appSliceActions.hydrateUserSettings({
      browserNotifications: !!settings['browser_notifications'],
      browserNotificationsForMentions:
        !!settings['browser_notifications_mentions'],
      browserNotificationsForDms: !!settings['browser_notifications_dms'],
      browserNotificationsForReplies: !!settings['browser_notifications_replies'],
      autoJoinLastChannel: !!settings['auto_join_last_channel'],
      mutedRoleMentionIds: Object.keys(settings)
        .filter((k) => k.startsWith(MUTED_ROLE_MENTION_PREFIX) && settings[k])
        .map((k) => Number(k.slice(MUTED_ROLE_MENTION_PREFIX.length)))
    })
  );
};

const loadUserSettings = async () => {
  const trpc = getTRPCClient();
  const settings = await trpc.settings.getAll.query();
  applyServerSettings(settings);
  return settings;
};

const writeUserSetting = async (key: string, value: boolean) => {
  const trpc = getTRPCClient();
  await trpc.settings.set.mutate({ key, value });
};

const clearUserSetting = async (key: string) => {
  const trpc = getTRPCClient();
  await trpc.settings.delete.mutate({ key });
};

// One-time: push pre-existing localStorage prefs to the server if the server
// has no value yet, so updating never resets a user's choices.
const migrateLocalSettings = async (existing: Record<string, unknown>) => {
  const pairs: [string, boolean][] = [
    ['browser_notifications', LocalStorageKey.BROWSER_NOTIFICATIONS],
    ['browser_notifications_mentions', LocalStorageKey.BROWSER_NOTIFICATIONS_FOR_MENTIONS],
    ['browser_notifications_dms', LocalStorageKey.BROWSER_NOTIFICATIONS_FOR_DMS],
    ['browser_notifications_replies', LocalStorageKey.BROWSER_NOTIFICATIONS_FOR_REPLIES],
    ['auto_join_last_channel', LocalStorageKey.AUTO_JOIN_LAST_CHANNEL]
  ].map(([serverKey, lsKey]) => [serverKey, getLocalStorageItemBool(lsKey as LocalStorageKey, false)]);

  for (const [serverKey, localValue] of pairs) {
    if (existing[serverKey] === undefined && localValue) {
      await writeUserSetting(serverKey, true);
    }
  }
};

export { loadUserSettings, writeUserSetting, clearUserSetting, migrateLocalSettings };
```

> Implementer note: resolve the two `<...>` placeholders by copying the import path used in a sibling `features/server/**/actions.ts` file. Do not invent a new client accessor.

- [ ] **Step 2: Typecheck**

Run: `cd apps/client && bun --bun run check-types`
Expected: errors only about `hydrateUserSettings` (added next task) + the two known pre-existing errors.

- [ ] **Step 3: Commit**

```bash
git add apps/client/src/features/server/user-settings/actions.ts
git commit -m "feat(user-settings): client load/write/migrate actions"
```

### Task 6: Slice hydration + muted role ids

**Files:**
- Modify: `apps/client/src/features/app/slice.ts`

- [ ] **Step 1: Add `mutedRoleMentionIds` to state + a hydrate reducer**

In `TAppState` add: `mutedRoleMentionIds: number[];` and initialise to `[]`.

Add reducers:

```ts
hydrateUserSettings: (
  state,
  action: PayloadAction<{
    browserNotifications: boolean;
    browserNotificationsForMentions: boolean;
    browserNotificationsForDms: boolean;
    browserNotificationsForReplies: boolean;
    autoJoinLastChannel: boolean;
    mutedRoleMentionIds: number[];
  }>
) => {
  state.browserNotifications = action.payload.browserNotifications;
  state.browserNotificationsForMentions =
    action.payload.browserNotificationsForMentions;
  state.browserNotificationsForDms = action.payload.browserNotificationsForDms;
  state.browserNotificationsForReplies =
    action.payload.browserNotificationsForReplies;
  state.autoJoinLastChannel = action.payload.autoJoinLastChannel;
  state.mutedRoleMentionIds = action.payload.mutedRoleMentionIds;
},
setMutedRoleMention: (
  state,
  action: PayloadAction<{ roleId: number; muted: boolean }>
) => {
  const { roleId, muted } = action.payload;
  const set = new Set(state.mutedRoleMentionIds);
  if (muted) set.add(roleId);
  else set.delete(roleId);
  state.mutedRoleMentionIds = Array.from(set);
}
```

- [ ] **Step 2: Add a selector** in `apps/client/src/features/app/selectors.ts`:

```ts
export const mutedRoleMentionIdsSelector = (state: IRootState) =>
  state.app.mutedRoleMentionIds;
```

- [ ] **Step 3: Typecheck**

Run: `cd apps/client && bun --bun run check-types`
Expected: only the two known pre-existing errors.

- [ ] **Step 4: Commit**

```bash
git add apps/client/src/features/app/slice.ts apps/client/src/features/app/selectors.ts
git commit -m "feat(user-settings): app slice hydration + muted role mentions"
```

### Task 7: Toggle setters write through to the server

**Files:**
- Modify: `apps/client/src/features/app/actions.ts`

- [ ] **Step 1: Make each notification/auto-join setter also persist**

For each existing setter that wraps `appSliceActions.setBrowserNotifications` etc. (and `setAutoJoinLastChannel`), after dispatching, call `writeUserSetting(<serverKey>, value)`. Example:

```ts
import { writeUserSetting } from '@/features/server/user-settings/actions';

const setBrowserNotifications = (value: boolean) => {
  store.dispatch(appSliceActions.setBrowserNotifications(value));
  void writeUserSetting('browser_notifications', value);
};
```

Apply the same pattern to: `browser_notifications_mentions`, `browser_notifications_dms`, `browser_notifications_replies`, `auto_join_last_channel`. Keep (do not remove) any `localStorage` writes for now — they act as the migration source and a logged-out fallback; the server value wins on next load.

- [ ] **Step 2: Typecheck**

Run: `cd apps/client && bun --bun run check-types`
Expected: only the two known pre-existing errors.

- [ ] **Step 3: Commit**

```bash
git add apps/client/src/features/app/actions.ts
git commit -m "feat(user-settings): persist notification/auto-join toggles to server"
```

### Task 8: Load settings on connect

**Files:**
- Modify: the post-authentication bootstrap. Find it with `cd apps/client && grep -rn "getAll" src/features/server/**/actions.ts` and locate where users/channels are first fetched after the socket authenticates (the same place that loads initial server data).

- [ ] **Step 1: Call load + migrate during bootstrap**

In that bootstrap function, after the connection is authenticated and alongside the other initial `getAll` fetches, add:

```ts
import { loadUserSettings, migrateLocalSettings } from '@/features/server/user-settings/actions';

const settings = await loadUserSettings();
await migrateLocalSettings(settings);
```

Order: `loadUserSettings` first (seeds the slice from the server), then `migrateLocalSettings` (pushes any local-only prefs up). If `migrateLocalSettings` wrote anything, the values are already reflected locally because `migrateLocalSettings` only pushes `true` values that match the local choice.

- [ ] **Step 2: Typecheck**

Run: `cd apps/client && bun --bun run check-types`
Expected: only the two known pre-existing errors.

- [ ] **Step 3: Commit**

```bash
git add apps/client/src/features/<bootstrap-file>
git commit -m "feat(user-settings): load + migrate settings on connect"
```

---

## Phase 5 — Verification

### Task 9: Suite, typecheck, lint

- [ ] **Step 1:** `cd packages/shared && bun test` → PASS.
- [ ] **Step 2:** `cd apps/server && bun test` → all PASS.
- [ ] **Step 3:** `cd apps/server && bun run check-types && bun run lint` → clean.
- [ ] **Step 4:** `cd apps/client && bun --bun run check-types` → only the two known pre-existing errors (`messages-group.tsx`, `profile/index.tsx`).
- [ ] **Step 5 (if formatting changed):**

```bash
git add -A && git commit -m "chore(user-settings): lint/format"
```

---

## Notes & constraints

- Migration is `CREATE TABLE` only — non-destructive, the project's hard requirement (see `drizzle-migration-cascade-gotcha`). The real server auto-applies it on container start; no manual DB step.
- Branch: `development`.
- Sub-project #5 (role-attributes plan) consumes `setMutedRoleMention` + `mutedRoleMentionIdsSelector` + `writeUserSetting`/`clearUserSetting` with `muted_role_mention:<roleId>` keys.

## Self-review

- **Spec coverage:** table (Task 2) ✓; getAll/set/delete + allowlist (Tasks 1,4) ✓; migrate list (Task 5) ✓; load-on-connect (Task 8) ✓; one-time local migration preserving choices (Task 5/8) ✓; device-local set untouched (Tasks 7 keeps localStorage) ✓.
- **Placeholders:** two explicit `<...>` import-path resolutions in Task 5 + the bootstrap-file location in Task 8 are verification instructions (the exact path is environment-specific) — flagged, not silent gaps.
- **Type consistency:** `hydrateUserSettings` / `setMutedRoleMention` / `mutedRoleMentionIdsSelector` / `writeUserSetting` / `clearUserSetting` are defined where introduced and reused consistently; server keys match the shared allowlist strings exactly.
