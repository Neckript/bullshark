# Category → Channel Permission Sync Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give categories their own per-role/per-user permission overrides and a one-shot action that copies them onto every channel in the category, plus inheritance for newly-created channels.

**Architecture:** Two new tables (`category_role_permissions`, `category_user_permissions`) mirror the channel ones. A `categories` router gains `getPermissions` / `updatePermission` / `deletePermissions` (mirroring the channel routes) and an `applyPermissionsToChannels` action that, in a transaction, replaces each child channel's overrides with the category's. New channels created inside a category inherit the category's overrides at creation. **The runtime permission-resolution path is unchanged** — channels are still resolved from their own overrides only.

**Tech Stack:** Bun, Drizzle ORM (SQLite), tRPC, Zod, React, `bun:test`. Reference spec: `docs/superpowers/specs/2026-06-09-category-channel-permission-sync-design.md`. Reference implementation to mirror: `apps/server/src/routers/channels/update-permission.ts`, `get-permissions.ts`.

---

## File Structure

**Server**
- `apps/server/src/db/schema.ts` — add `categoryRolePermissions`, `categoryUserPermissions` (modify).
- `apps/server/src/db/migrations/00XX_*.sql` + `meta/` — generated two `CREATE TABLE`s (create).
- `apps/server/src/db/queries/categories.ts` — `getCategoryPermissions`, `copyCategoryPermissionsToChannel` (create or modify if file exists).
- `apps/server/src/routers/categories/get-permissions.ts`, `update-permission.ts`, `delete-permissions.ts`, `apply-permissions.ts` — new routes (create); wire in `categories/index.ts` (modify).
- `apps/server/src/routers/channels/add-channel.ts` — copy category overrides on create (modify).
- Tests: `apps/server/src/routers/__tests__/category-permissions.test.ts` (create).

**Client**
- Category settings UI — reuse the channel permissions component pointed at the category routes + an "Apply to channels" button with a confirm dialog (modify; find via `grep -rln "getPermissions\|updatePermissions" apps/client/src/components/server-screens`).

---

## Phase 1 — Schema & migration

### Task 1: Category permission tables

**Files:**
- Modify: `apps/server/src/db/schema.ts`

- [ ] **Step 1: Add the two tables** (mirror `channelRolePermissions` / `channelUserPermissions`)

```ts
const categoryRolePermissions = sqliteTable(
  'category_role_permissions',
  {
    categoryId: integer('category_id')
      .notNull()
      .references(() => categories.id, { onDelete: 'cascade' }),
    roleId: integer('role_id')
      .notNull()
      .references(() => roles.id, { onDelete: 'cascade' }),
    permission: text('permission').notNull(),
    allow: integer('allow', { mode: 'boolean' }).notNull(),
    createdAt: integer('created_at').notNull(),
    updatedAt: integer('updated_at')
  },
  (t) => [
    primaryKey({ columns: [t.categoryId, t.roleId, t.permission] }),
    index('category_role_permissions_category_idx').on(t.categoryId),
    index('category_role_permissions_role_idx').on(t.roleId)
  ]
);

const categoryUserPermissions = sqliteTable(
  'category_user_permissions',
  {
    categoryId: integer('category_id')
      .notNull()
      .references(() => categories.id, { onDelete: 'cascade' }),
    userId: integer('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    permission: text('permission').notNull(),
    allow: integer('allow', { mode: 'boolean' }).notNull(),
    createdAt: integer('created_at').notNull(),
    updatedAt: integer('updated_at')
  },
  (t) => [
    primaryKey({ columns: [t.categoryId, t.userId, t.permission] }),
    index('category_user_permissions_category_idx').on(t.categoryId),
    index('category_user_permissions_user_idx').on(t.userId)
  ]
);
```

Add both to the module `export { ... }` list.

- [ ] **Step 2: Generate the migration**

Run: `cd apps/server && bun run db:gen`
Expected: a new `00XX_*.sql` with **two `CREATE TABLE`s + indexes only**. Verify no existing table is rebuilt/dropped (new tables are inherently safe; confirm anyway per `drizzle-migration-cascade-gotcha`).

- [ ] **Step 3: Verify parity**

Run: `cd apps/server && bun run db:check`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add apps/server/src/db/schema.ts apps/server/src/db/migrations
git commit -m "feat(category-perms): add category permission tables + migration"
```

---

## Phase 2 — Queries

### Task 2: Category permission queries

**Files:**
- Create/modify: `apps/server/src/db/queries/categories.ts`

- [ ] **Step 1: Implement helpers**

```ts
import { eq } from 'drizzle-orm';
import { db } from '..';
import {
  categoryRolePermissions,
  categoryUserPermissions,
  channelRolePermissions,
  channelUserPermissions
} from '../schema';

const getCategoryPermissions = async (categoryId: number) => {
  const [rolePermissions, userPermissions] = await Promise.all([
    db
      .select()
      .from(categoryRolePermissions)
      .where(eq(categoryRolePermissions.categoryId, categoryId)),
    db
      .select()
      .from(categoryUserPermissions)
      .where(eq(categoryUserPermissions.categoryId, categoryId))
  ]);
  return { rolePermissions, userPermissions };
};

// Replace a channel's overrides with the category's current overrides.
// Runs inside the caller's transaction (`tx`).
const copyCategoryPermissionsToChannel = async (
  tx: typeof db,
  categoryId: number,
  channelId: number
) => {
  const { rolePermissions, userPermissions } =
    await getCategoryPermissions(categoryId);

  await tx
    .delete(channelRolePermissions)
    .where(eq(channelRolePermissions.channelId, channelId));
  await tx
    .delete(channelUserPermissions)
    .where(eq(channelUserPermissions.channelId, channelId));

  if (rolePermissions.length > 0) {
    await tx.insert(channelRolePermissions).values(
      rolePermissions.map((p) => ({
        channelId,
        roleId: p.roleId,
        permission: p.permission,
        allow: p.allow,
        createdAt: Date.now()
      }))
    );
  }
  if (userPermissions.length > 0) {
    await tx.insert(channelUserPermissions).values(
      userPermissions.map((p) => ({
        channelId,
        userId: p.userId,
        permission: p.permission,
        allow: p.allow,
        createdAt: Date.now()
      }))
    );
  }
};

export { getCategoryPermissions, copyCategoryPermissionsToChannel };
```

> Note: `getCategoryPermissions` reads via the top-level `db`; that is fine inside a transaction for reads. The deletes/inserts use the passed `tx`.

- [ ] **Step 2: Commit**

```bash
git add apps/server/src/db/queries/categories.ts
git commit -m "feat(category-perms): category permission queries + copy helper"
```

---

## Phase 3 — Routes

### Task 3: get / update / delete category permissions

**Files:**
- Create: `apps/server/src/routers/categories/get-permissions.ts`, `update-permission.ts`, `delete-permissions.ts`
- Modify: `apps/server/src/routers/categories/index.ts`
- Test: `apps/server/src/routers/__tests__/category-permissions.test.ts`

> Mirror `channels/get-permissions.ts`, `channels/update-permission.ts`, `channels/delete-permissions.ts` exactly, swapping `channel*Permissions` → `category*Permissions`, `channelId` → `categoryId`, and dropping the DM guard (categories are never DMs). Use the **same** `ctx.needsPermission(Permission.MANAGE_CHANNEL_PERMISSIONS)` guard the channel routes use.

- [ ] **Step 1: Write the failing test**

```ts
import { ChannelPermission, Permission } from '@sharkord/shared';
import { describe, expect, test } from 'bun:test';
import { initTest } from '../../__tests__/helpers';

describe('category permissions', () => {
  test('updatePermission then getPermissions round-trips for a role', async () => {
    const { caller: owner } = await initTest();
    const categoryId = await owner.categories.add({ name: 'Cat' }); // match the real add signature
    await owner.categories.updatePermissions({
      categoryId,
      roleId: 2,
      permissions: [ChannelPermission.VIEW_CHANNEL]
    });
    const perms = await owner.categories.getPermissions({ categoryId });
    const view = perms.rolePermissions.find(
      (p) => p.roleId === 2 && p.permission === ChannelPermission.VIEW_CHANNEL
    );
    expect(view?.allow).toBe(true);
  });
});
```

> Adjust `categories.add` args to the real route's input (check `categories/add-category.ts`).

- [ ] **Step 2: Run it to verify failure**

Run: `cd apps/server && bun test src/routers/__tests__/category-permissions.test.ts`
Expected: FAIL (`categories.getPermissions`/`updatePermissions` undefined).

- [ ] **Step 3: Implement the three routes** (mirroring the channel versions)

`update-permission.ts` (key body — same delete-then-insert-all-permissions shape as the channel route):

```ts
import { ChannelPermission, Permission } from '@sharkord/shared';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../../db';
import {
  categoryRolePermissions,
  categoryUserPermissions
} from '../../db/schema';
import { protectedProcedure } from '../../utils/trpc';

const allPermissions = Object.values(ChannelPermission);

const updatePermissionsRoute = protectedProcedure
  .input(
    z
      .object({
        categoryId: z.number(),
        userId: z.number().optional(),
        roleId: z.number().optional(),
        permissions: z.array(z.enum(ChannelPermission)).default([])
      })
      .refine((d) => !!(d.userId || d.roleId), {
        message: 'Either userId or roleId must be provided'
      })
      .refine((d) => !(d.userId && d.roleId), {
        message: 'Cannot specify both userId and roleId'
      })
  )
  .mutation(async ({ ctx, input }) => {
    await ctx.needsPermission(Permission.MANAGE_CHANNEL_PERMISSIONS);

    await db.transaction(async (tx) => {
      if (input.userId) {
        await tx
          .delete(categoryUserPermissions)
          .where(
            and(
              eq(categoryUserPermissions.categoryId, input.categoryId),
              eq(categoryUserPermissions.userId, input.userId)
            )
          );
        await tx.insert(categoryUserPermissions).values(
          allPermissions.map((perm) => ({
            categoryId: input.categoryId,
            userId: input.userId!,
            permission: perm,
            allow: input.permissions.includes(perm),
            createdAt: Date.now()
          }))
        );
      } else if (input.roleId) {
        await tx
          .delete(categoryRolePermissions)
          .where(
            and(
              eq(categoryRolePermissions.categoryId, input.categoryId),
              eq(categoryRolePermissions.roleId, input.roleId)
            )
          );
        await tx.insert(categoryRolePermissions).values(
          allPermissions.map((perm) => ({
            categoryId: input.categoryId,
            roleId: input.roleId!,
            permission: perm,
            allow: input.permissions.includes(perm),
            createdAt: Date.now()
          }))
        );
      }
    });
  });

export { updatePermissionsRoute };
```

`get-permissions.ts`:

```ts
import { Permission } from '@sharkord/shared';
import { z } from 'zod';
import { getCategoryPermissions } from '../../db/queries/categories';
import { protectedProcedure } from '../../utils/trpc';

const getPermissionsRoute = protectedProcedure
  .input(z.object({ categoryId: z.number() }))
  .mutation(async ({ ctx, input }) => {
    await ctx.needsPermission(Permission.MANAGE_CHANNEL_PERMISSIONS);
    return getCategoryPermissions(input.categoryId);
  });

export { getPermissionsRoute };
```

`delete-permissions.ts` — mirror `channels/delete-permissions.ts`, swapping the tables/ids and using the same guard.

- [ ] **Step 4: Wire into `categories/index.ts`**

Add imports + `getPermissions`, `updatePermissions`, `deletePermissions` entries to the router object (match the channel router key names so the client component can be reused with minimal change).

- [ ] **Step 5: Run the test**

Run: `cd apps/server && bun test src/routers/__tests__/category-permissions.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/server/src/routers/categories apps/server/src/routers/__tests__/category-permissions.test.ts
git commit -m "feat(category-perms): get/update/delete category permission routes"
```

### Task 4: `applyPermissionsToChannels`

**Files:**
- Create: `apps/server/src/routers/categories/apply-permissions.ts`
- Modify: `apps/server/src/routers/categories/index.ts`
- Test: append to `category-permissions.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
describe('category permissions — apply to channels', () => {
  test('copies category overrides onto child channels, replacing theirs', async () => {
    const { caller: owner } = await initTest();
    const categoryId = await owner.categories.add({ name: 'Cat' });
    const channelId = await owner.channels.add({
      name: 'general',
      type: 'TEXT',
      categoryId,
      private: true
    }); // match the real add signature

    // give the channel a stale override that should be wiped
    await owner.channels.updatePermissions({
      channelId,
      roleId: 2,
      permissions: [] // deny VIEW_CHANNEL
    });
    // category allows VIEW_CHANNEL for role 2
    await owner.categories.updatePermissions({
      categoryId,
      roleId: 2,
      permissions: ['VIEW_CHANNEL']
    });

    await owner.categories.applyPermissionsToChannels({ categoryId });

    const perms = await owner.channels.getPermissions({ channelId });
    const view = perms.rolePermissions.find(
      (p) => p.roleId === 2 && p.permission === 'VIEW_CHANNEL'
    );
    expect(view?.allow).toBe(true);
  });
});
```

> Adjust `channels.add` / `categories.add` args to the real route signatures.

- [ ] **Step 2: Run it to verify failure**

Run: `cd apps/server && bun test src/routers/__tests__/category-permissions.test.ts`
Expected: FAIL (`applyPermissionsToChannels` undefined).

- [ ] **Step 3: Implement `apply-permissions.ts`**

```ts
import { Permission } from '@sharkord/shared';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../../db';
import { copyCategoryPermissionsToChannel } from '../../db/queries/categories';
import { publishChannelPermissions } from '../../db/publishers';
import { getAffectedOnlineUserIdsForChannel } from '../../db/queries/channels';
import { channels } from '../../db/schema';
import { protectedProcedure } from '../../utils/trpc';

const applyPermissionsRoute = protectedProcedure
  .input(z.object({ categoryId: z.number() }))
  .mutation(async ({ ctx, input }) => {
    await ctx.needsPermission(Permission.MANAGE_CHANNEL_PERMISSIONS);

    const childChannels = await db
      .select({ id: channels.id })
      .from(channels)
      .where(eq(channels.categoryId, input.categoryId));

    await db.transaction(async (tx) => {
      for (const ch of childChannels) {
        await copyCategoryPermissionsToChannel(tx, input.categoryId, ch.id);
      }
    });

    // notify affected clients per channel
    const affected = new Set<number>();
    for (const ch of childChannels) {
      const ids = await getAffectedOnlineUserIdsForChannel(ch.id);
      ids.forEach((id) => affected.add(id));
    }
    publishChannelPermissions(Array.from(affected));
  });

export { applyPermissionsRoute };
```

> Verify `publishChannelPermissions` accepts a user-id array (it does in `channels/update-permission.ts`). If `db.transaction`'s `tx` type does not match `copyCategoryPermissionsToChannel`'s `typeof db` param, type the param as `Parameters<Parameters<typeof db.transaction>[0]>[0]` or `any` consistent with the codebase's existing transaction-helper typing.

- [ ] **Step 4: Wire into `categories/index.ts`**

Add `applyPermissionsToChannels: applyPermissionsRoute,`.

- [ ] **Step 5: Run the test**

Run: `cd apps/server && bun test src/routers/__tests__/category-permissions.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/server/src/routers/categories/apply-permissions.ts apps/server/src/routers/categories/index.ts apps/server/src/routers/__tests__/category-permissions.test.ts
git commit -m "feat(category-perms): applyPermissionsToChannels action"
```

### Task 5: New channels inherit category overrides

**Files:**
- Modify: `apps/server/src/routers/channels/add-channel.ts`
- Test: append to `category-permissions.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
describe('category permissions — inheritance on create', () => {
  test('a channel created in a category inherits its overrides', async () => {
    const { caller: owner } = await initTest();
    const categoryId = await owner.categories.add({ name: 'Cat' });
    await owner.categories.updatePermissions({
      categoryId,
      roleId: 2,
      permissions: ['VIEW_CHANNEL']
    });
    const channelId = await owner.channels.add({
      name: 'inherits',
      type: 'TEXT',
      categoryId,
      private: true
    });
    const perms = await owner.channels.getPermissions({ channelId });
    expect(
      perms.rolePermissions.find(
        (p) => p.roleId === 2 && p.permission === 'VIEW_CHANNEL'
      )?.allow
    ).toBe(true);
  });

  test('a channel created with no category inherits nothing', async () => {
    const { caller: owner } = await initTest();
    const channelId = await owner.channels.add({
      name: 'orphan',
      type: 'TEXT',
      private: true
    });
    const perms = await owner.channels.getPermissions({ channelId });
    expect(perms.rolePermissions.length).toBe(0);
  });
});
```

- [ ] **Step 2: Run it to verify failure**

Run: `cd apps/server && bun test src/routers/__tests__/category-permissions.test.ts`
Expected: FAIL (no inheritance yet).

- [ ] **Step 3: Copy overrides after channel insert**

In `add-channel.ts`, after the new channel row is created and its `id` is known, if `input.categoryId` (or whatever the field is called) is set, copy the category overrides. If the insert is already inside a transaction, reuse that `tx`; otherwise wrap the insert + copy in `db.transaction`:

```ts
import { copyCategoryPermissionsToChannel } from '../../db/queries/categories';
// after creating `newChannel` with a categoryId:
if (newChannel.categoryId) {
  await copyCategoryPermissionsToChannel(db, newChannel.categoryId, newChannel.id);
}
```

> Match the existing transaction style of `add-channel.ts`. If it already uses a `tx`, pass `tx` instead of `db`.

- [ ] **Step 4: Run the test + the channels suite**

Run: `cd apps/server && bun test src/routers/__tests__/category-permissions.test.ts src/routers/__tests__/channels.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/server/src/routers/channels/add-channel.ts apps/server/src/routers/__tests__/category-permissions.test.ts
git commit -m "feat(category-perms): new channels inherit category overrides"
```

---

## Phase 4 — Client

### Task 6: Category permissions UI + apply button

**Files:**
- Modify: the category settings screen (find via `grep -rln "categories.update\|category" apps/client/src/components/server-screens`)
- Reuse: the channel permissions editor component (find via `grep -rln "channels.getPermissions\|updatePermissions" apps/client/src/components/server-screens`)

- [ ] **Step 1: Mount the permissions editor on the category**

Render the existing channel permissions editor component, but pointed at `trpc.categories.getPermissions` / `categories.updatePermissions` / `categories.deletePermissions` with `categoryId`. If the component hardcodes channel routes, parametrise it with a small adapter (pass the three mutation callbacks as props) rather than duplicating the UI.

- [ ] **Step 2: Add the "Apply to channels" button + confirm dialog**

A button that opens a confirm dialog ("This overwrites permission overrides on every channel in this category"). On confirm: `await trpc.categories.applyPermissionsToChannels.mutate({ categoryId })`, then toast success. Add i18n keys: `applyCategoryPermsButton`, `applyCategoryPermsConfirmTitle`, `applyCategoryPermsConfirmBody`, `applyCategoryPermsSuccess`.

- [ ] **Step 3: Typecheck**

Run: `cd apps/client && bun --bun run check-types`
Expected: only the two known pre-existing errors.

- [ ] **Step 4: Commit**

```bash
git add apps/client/src/components apps/client/src/i18n/locales
git commit -m "feat(category-perms): category permission editor + apply-to-channels"
```

---

## Phase 5 — Verification

### Task 7: Suite, typecheck, lint

- [ ] **Step 1:** `cd apps/server && bun test` → all PASS.
- [ ] **Step 2:** `cd apps/server && bun run check-types && bun run lint` → clean.
- [ ] **Step 3:** `cd apps/client && bun --bun run check-types` → only the two known pre-existing errors.
- [ ] **Step 4 (if formatting changed):** `git add -A && git commit -m "chore(category-perms): lint/format"`

---

## Notes & constraints

- Migration is two `CREATE TABLE`s — non-destructive (hard requirement; see `drizzle-migration-cascade-gotcha`).
- **Resolution path untouched:** do not modify `channelUserCan` / `getPermissions` in `db/queries/channels.ts`. The whole feature works by copying into channel override tables. This is the agreed one-shot (not live) approach.
- Sync is copy-not-merge: it deletes the channel's existing overrides before inserting the category's.
- Branch: `development`.

## Self-review

- **Spec coverage:** category tables (Task 1) ✓; get/update/delete category perms (Task 3) ✓; one-shot apply (copy-not-merge) (Task 4) ✓; creation inheritance, incl. "no category → nothing" (Task 5) ✓; resolution unchanged (Notes + no task touches it) ✓; client editor + apply button + confirm (Task 6) ✓.
- **Placeholders:** route bodies are full code; the `delete-permissions.ts` body and the client editor reuse say "mirror the channel version" against a named, existing file (the channel route was read in full during planning) — a copy instruction, not a TODO. Real `add`-route input shapes are flagged "match the real signature" because they are environment-specific.
- **Type consistency:** `getCategoryPermissions` / `copyCategoryPermissionsToChannel(tx, categoryId, channelId)` / `applyPermissionsToChannels({ categoryId })` / table names (`category_role_permissions`, `category_user_permissions`) are used consistently across tasks; router key names mirror the channel router so the client editor can be reused.
