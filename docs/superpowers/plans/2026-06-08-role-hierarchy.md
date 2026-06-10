# Role Hierarchy Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Discord-style role hierarchy (ordered `position`) to Bullshark so roles can be ranked, with enforcement on role management and user moderation, and deterministic nickname-color resolution.

**Architecture:** Add a `position` column to `roles` (higher = higher rank; Owner pinned top, default role pinned to 0) and make `roles.color` nullable (NULL = no color). A small set of server helpers resolves a user's top rank and gates role/user mutations. A new `roles.reorder` tRPC procedure recomputes contiguous positions. The client gets drag-and-drop reordering (existing `@dnd-kit`), a "no color" affordance, and personal-color > top-role-color name resolution.

**Tech Stack:** Bun, Drizzle ORM (SQLite), tRPC, Zod, React, `@dnd-kit`, `bun:test`. Reference design: `docs/superpowers/specs/2026-06-08-role-hierarchy-design.md`.

---

## File Structure

**Server**
- `apps/server/src/db/schema.ts` — add `position`, make `color` nullable (modify).
- `apps/server/src/db/migrations/0019_*.sql` + `meta/` — generated, then hand-edited backfill (create).
- `apps/server/src/db/seed.ts` — seed positions on initial roles (modify).
- `apps/server/src/db/queries/roles.ts` — order by position; add `getRolePosition`, `getUserTopPosition` (modify).
- `apps/server/src/db/queries/get-user-roles.ts` is at `apps/server/src/routers/users/get-user-roles.ts`; ordering helper lives in queries.
- `apps/server/src/helpers/assert-rank.ts` — `assertOutranksRole`, `assertOutranksUser` (create).
- `apps/server/src/routers/roles/update-role.ts`, `delete-role.ts` — add rank checks; allow `color: null` (modify).
- `apps/server/src/routers/roles/reorder.ts` — new procedure (create); wire in `roles/index.ts` (modify).
- `apps/server/src/routers/users/add-role.ts`, `remove-role.ts` — add rank check (modify).
- `apps/server/src/routers/users/ban.ts`, `kick.ts` — add rank check (modify).
- Tests: `apps/server/src/routers/__tests__/role-hierarchy.test.ts` (create).

**Shared**
- Types `TRole`/`TJoinedRole` are inferred from schema — they pick up `position` and nullable `color` automatically. No edit needed.

**Client**
- `apps/client/src/components/server-screens/server-settings/roles/roles-list.tsx` — DnD reorder (modify).
- `apps/client/src/components/server-screens/server-settings/roles/update-role.tsx` — nullable color + disable above rank (modify).
- `apps/client/src/components/nickname-badge/index.tsx` — sort roles by position (modify).
- `apps/client/src/helpers/resolve-name-color.ts` — personal > top-role color (create).
- Apply `resolve-name-color` at name-render points that currently use `nicknameColor`.

---

## Phase 1 — Data model & migration

### Task 1: Add `position` and nullable `color` to the schema

**Files:**
- Modify: `apps/server/src/db/schema.ts:117-138` (the `roles` table)

- [ ] **Step 1: Edit the `roles` table definition**

Replace the `color` and add a `position` column:

```ts
const roles = sqliteTable(
  'roles',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    name: text('name').notNull(),
    color: text('color'),
    position: integer('position').notNull().default(0),
    isPersistent: integer('is_persistent', { mode: 'boolean' }).notNull(),
    isDefault: integer('is_default', { mode: 'boolean' }).notNull(),
    storageQuotaOverrideEnabled: integer('storage_quota_override_enabled', {
      mode: 'boolean'
    })
      .notNull()
      .default(false),
    storageSpaceQuota: integer('storage_space_quota').notNull().default(0),
    createdAt: integer('created_at').notNull(),
    updatedAt: integer('updated_at')
  },
  (t) => [
    index('roles_is_default_idx').on(t.isDefault),
    index('roles_is_persistent_idx').on(t.isPersistent),
    index('roles_position_idx').on(t.position)
  ]
);
```

- [ ] **Step 2: Generate the migration**

Run: `cd apps/server && bun run db:gen`
Expected: a new `src/db/migrations/0019_<name>.sql` and updated `meta/_journal.json` + a `0019_snapshot.json`. The SQL will recreate the `roles` table (SQLite nullability change) and add `position`.

- [ ] **Step 3: Append the data backfill to the generated migration**

Open the generated `src/db/migrations/0019_<name>.sql` and append (after the drizzle-generated statements, each separated by `--> statement-breakpoint`):

```sql
--> statement-breakpoint
UPDATE `roles` SET `color` = NULL WHERE `color` IN ('#ffffff', '#FFFFFF');--> statement-breakpoint
UPDATE `roles` SET `position` = 0 WHERE `is_default` = 1;--> statement-breakpoint
UPDATE `roles` SET `position` = (
  SELECT COUNT(*) FROM `roles` r2
  WHERE r2.`id` <= `roles`.`id` AND r2.`is_default` = 0 AND r2.`id` != 1
) WHERE `is_default` = 0 AND `id` != 1;--> statement-breakpoint
UPDATE `roles` SET `position` = (SELECT COALESCE(MAX(`position`), 0) FROM `roles`) + 1 WHERE `id` = 1;
```

(Owner is `id = 1` / `OWNER_ROLE_ID`; the default role has `is_default = 1`.)

- [ ] **Step 4: Verify migration parity**

Run: `cd apps/server && bun run db:check`
Expected: no errors (snapshot consistent with schema).

- [ ] **Step 5: Commit**

```bash
git add apps/server/src/db/schema.ts apps/server/src/db/migrations
git commit -m "feat(roles): add position column and make color nullable"
```

### Task 2: Seed initial role positions

**Files:**
- Modify: `apps/server/src/db/seed.ts:131-150`

- [ ] **Step 1: Add positions to the seeded roles**

Owner must be top, default must be 0. Update `initialRoles`:

```ts
const initialRoles: TIRole[] = [
  {
    name: 'Owner',
    color: null,
    position: 1,
    isDefault: false,
    isPersistent: true,
    storageQuotaOverrideEnabled: false,
    storageSpaceQuota: 0,
    createdAt: firstStart
  },
  {
    name: 'Member',
    color: null,
    position: 0,
    isPersistent: true,
    isDefault: true,
    storageQuotaOverrideEnabled: false,
    storageSpaceQuota: 0,
    createdAt: firstStart
  }
];
```

- [ ] **Step 2: Run the server test suite to confirm seed still loads**

Run: `cd apps/server && bun test src/routers/__tests__/roles.test.ts`
Expected: PASS (existing tests; note `should create new role` asserts `color` `'#ffffff'` — fixed in Task 5 Step 6).

- [ ] **Step 3: Commit**

```bash
git add apps/server/src/db/seed.ts
git commit -m "feat(roles): seed owner/default role positions"
```

---

## Phase 2 — Server queries & rank helpers

### Task 3: Order roles by position and expose rank queries

**Files:**
- Modify: `apps/server/src/db/queries/roles.ts`
- Modify: `apps/server/src/routers/users/get-user-roles.ts:6-37`

- [ ] **Step 1: Order `getRoles` by position (desc) and add rank queries**

In `apps/server/src/db/queries/roles.ts`, add `desc` to the import from `drizzle-orm` and add an `orderBy` to `getRoles`, then append two helpers. Add `OWNER_ROLE_ID` to the `@sharkord/shared` import.

```ts
import {
  OWNER_ROLE_ID,
  type Permission,
  type TJoinedRole,
  type TRole
} from '@sharkord/shared';
import { and, desc, eq, getTableColumns, sql } from 'drizzle-orm';

// sentinel: owner outranks everyone
const OWNER_TOP_POSITION = Number.MAX_SAFE_INTEGER;

const getRolePosition = async (roleId: number): Promise<number> => {
  if (roleId === OWNER_ROLE_ID) return OWNER_TOP_POSITION;

  const row = await db
    .select({ position: roles.position })
    .from(roles)
    .where(eq(roles.id, roleId))
    .limit(1)
    .get();

  return row?.position ?? 0;
};

const getUserTopPosition = async (userId: number): Promise<number> => {
  const userRoleRecords = await db
    .select({ position: roles.position, id: roles.id })
    .from(userRoles)
    .innerJoin(roles, eq(userRoles.roleId, roles.id))
    .where(eq(userRoles.userId, userId));

  if (userRoleRecords.some((r) => r.id === OWNER_ROLE_ID)) {
    return OWNER_TOP_POSITION;
  }

  if (userRoleRecords.length === 0) return 0;

  return Math.max(...userRoleRecords.map((r) => r.position));
};
```

Update `getRoles` to order by position descending:

```ts
const getRoles = async (): Promise<TJoinedRole[]> => {
  const results = await db
    .select(roleSelectFields)
    .from(roles)
    .leftJoin(rolePermissions, sql`${roles.id} = ${rolePermissions.roleId}`)
    .groupBy(roles.id)
    .orderBy(desc(roles.position));

  return results.map(parseRole);
};
```

Add the new helpers and `OWNER_TOP_POSITION` to the `export { ... }` block.

- [ ] **Step 2: Order `getUserRoles` by position (desc)**

In `apps/server/src/routers/users/get-user-roles.ts`, sort the returned array before returning:

```ts
  return Array.from(rolesMap.values()).sort((a, b) => b.position - a.position);
```

- [ ] **Step 3: Write the failing test for rank queries**

Create `apps/server/src/routers/__tests__/role-hierarchy.test.ts`:

```ts
import { describe, expect, test } from 'bun:test';
import { OWNER_ROLE_ID } from '@sharkord/shared';
import { getUserTopPosition, getRolePosition } from '../../db/queries/roles';
import { initTest } from '../../__tests__/helpers';

describe('role hierarchy — rank queries', () => {
  test('owner user ranks at the top sentinel', async () => {
    await initTest(); // user 1 = owner
    const top = await getUserTopPosition(1);
    expect(top).toBe(Number.MAX_SAFE_INTEGER);
  });

  test('owner role position is the top sentinel', async () => {
    await initTest();
    expect(await getRolePosition(OWNER_ROLE_ID)).toBe(Number.MAX_SAFE_INTEGER);
  });

  test('default role (id 2) has position 0', async () => {
    await initTest();
    expect(await getRolePosition(2)).toBe(0);
  });
});
```

- [ ] **Step 4: Run the test**

Run: `cd apps/server && bun test src/routers/__tests__/role-hierarchy.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/server/src/db/queries/roles.ts apps/server/src/routers/users/get-user-roles.ts apps/server/src/routers/__tests__/role-hierarchy.test.ts
git commit -m "feat(roles): position-ordered queries and rank helpers"
```

---

## Phase 3 — Enforcement

### Task 4: Rank-assertion helpers

**Files:**
- Create: `apps/server/src/helpers/assert-rank.ts`

- [ ] **Step 1: Write the helper**

```ts
import { getRolePosition, getUserTopPosition } from '../db/queries/roles';
import { invariant } from '../utils/invariant';

/** Actor may act on a role only if their top rank is strictly higher. */
const assertOutranksRole = async (actorUserId: number, roleId: number) => {
  const [actorTop, rolePosition] = await Promise.all([
    getUserTopPosition(actorUserId),
    getRolePosition(roleId)
  ]);

  invariant(actorTop > rolePosition, {
    code: 'FORBIDDEN',
    message: 'You cannot manage a role ranked equal to or above your own'
  });
};

/** Actor may moderate a target user only if their top rank is strictly higher. */
const assertOutranksUser = async (actorUserId: number, targetUserId: number) => {
  const [actorTop, targetTop] = await Promise.all([
    getUserTopPosition(actorUserId),
    getUserTopPosition(targetUserId)
  ]);

  invariant(actorTop > targetTop, {
    code: 'FORBIDDEN',
    message: 'You cannot moderate a user ranked equal to or above your own'
  });
};

export { assertOutranksRole, assertOutranksUser };
```

- [ ] **Step 2: Commit**

```bash
git add apps/server/src/helpers/assert-rank.ts
git commit -m "feat(roles): rank assertion helpers"
```

### Task 5: Enforce rank + nullable color in role mutations

**Files:**
- Modify: `apps/server/src/routers/roles/update-role.ts`
- Modify: `apps/server/src/routers/roles/delete-role.ts:20-21`
- Modify: `apps/server/src/routers/__tests__/roles.test.ts:81` (color assertion)

- [ ] **Step 1: Write failing enforcement tests**

Append to `apps/server/src/routers/__tests__/role-hierarchy.test.ts`:

```ts
import { Permission } from '@sharkord/shared';

describe('role hierarchy — enforcement', () => {
  test('non-owner with MANAGE_ROLES cannot edit the owner role', async () => {
    const { caller: owner } = await initTest(); // user 1
    const modRoleId = await owner.roles.add();
    await owner.roles.update({
      roleId: modRoleId,
      name: 'Mod',
      color: '#00ff00',
      permissions: [Permission.MANAGE_ROLES],
      storageQuotaOverrideEnabled: false,
      storageSpaceQuota: 0
    });
    await owner.users.addRole({ userId: 2, roleId: modRoleId });

    const { caller: mod } = await initTest(2); // user 2 now has Mod
    await expect(
      mod.roles.update({
        roleId: OWNER_ROLE_ID,
        name: 'Owner',
        color: '#ff0000',
        permissions: [],
        storageQuotaOverrideEnabled: false,
        storageSpaceQuota: 0
      })
    ).rejects.toThrow('equal to or above');
  });

  test('owner can set a role color to null', async () => {
    const { caller: owner } = await initTest();
    const roleId = await owner.roles.add();
    await owner.roles.update({
      roleId,
      name: 'Colorless',
      color: null,
      permissions: [],
      storageQuotaOverrideEnabled: false,
      storageSpaceQuota: 0
    });
    const all = await owner.roles.getAll();
    expect(all.find((r) => r.id === roleId)!.color).toBeNull();
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `cd apps/server && bun test src/routers/__tests__/role-hierarchy.test.ts`
Expected: FAIL (no rank check yet; `color` rejects null in zod).

- [ ] **Step 3: Update `update-role.ts` — nullable color + rank check**

Change the `color` zod field to allow null, and add the rank check after the permission check. Add the import `import { assertOutranksRole } from '../../helpers/assert-rank';`.

```ts
      color: z
        .string()
        .regex(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/, 'Invalid hex color')
        .nullable(),
```

```ts
  .mutation(async ({ ctx, input }) => {
    await ctx.needsPermission(Permission.MANAGE_ROLES);

    if (input.roleId !== OWNER_ROLE_ID) {
      await assertOutranksRole(ctx.userId, input.roleId);
    }

    const updatedRole = await db
      .update(roles)
      .set({
        name: input.name,
        color: input.color,
        storageQuotaOverrideEnabled: input.storageQuotaOverrideEnabled,
        storageSpaceQuota: input.storageSpaceQuota
      })
      .where(eq(roles.id, input.roleId))
      .returning()
      .get();
```

(The owner role keeps its existing "owner cannot be edited by non-owner" protection via `assertOutranksRole` only when not owner; the owner-editing-owner case is allowed exactly as today because `getUserTopPosition(owner)` is the sentinel — but we skip the check for `OWNER_ROLE_ID` to preserve the current behaviour where the owner may rename their own role. The non-owner case is blocked because editing owner requires outranking the sentinel, which is impossible.)

Note: to block non-owners editing the owner role, remove the `if (input.roleId !== OWNER_ROLE_ID)` guard so the check always runs — `assertOutranksRole` returns the sentinel for the owner role, so only another owner (also sentinel) passes... which still fails (`sentinel > sentinel` is false). That correctly blocks everyone including owners from editing via rank. **Decision:** keep the guard as written so owners can still edit the owner role's name/color (current behaviour), while non-owners are blocked because they don't reach the sentinel. The existing test `should not allow updating Owner role permissions` still passes (permissions are skipped for owner via existing `syncRolePermissions` guard).

- [ ] **Step 4: Add the rank check to `delete-role.ts`**

After the existing `invariant(!role.isDefault, ...)` block and before `fallbackUsersToDefaultRole`, add (import `assertOutranksRole`):

```ts
    await assertOutranksRole(ctx.userId, role.id);
```

- [ ] **Step 5: Fix the stale color assertion in the existing test**

In `apps/server/src/routers/__tests__/roles.test.ts`, the `should create new role` test asserts `newRole!.color).toBe('#ffffff')`. New roles are created with `color: '#ffffff'` in `add-role.ts`; keep that default for created roles (an explicit white) so this assertion stays valid. No change needed unless Task 6 changes `add-role.ts`. Leave `add-role.ts` color as `'#ffffff'`.

- [ ] **Step 6: Run tests**

Run: `cd apps/server && bun test src/routers/__tests__/role-hierarchy.test.ts src/routers/__tests__/roles.test.ts`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add apps/server/src/routers/roles/update-role.ts apps/server/src/routers/roles/delete-role.ts apps/server/src/routers/__tests__/role-hierarchy.test.ts
git commit -m "feat(roles): enforce rank on role edit/delete; allow null color"
```

### Task 6: `roles.reorder` procedure

**Files:**
- Create: `apps/server/src/routers/roles/reorder.ts`
- Modify: `apps/server/src/routers/roles/index.ts`

- [ ] **Step 1: Write the failing test**

Append to `role-hierarchy.test.ts`:

```ts
describe('role hierarchy — reorder', () => {
  test('owner reorders non-pinned roles into contiguous positions', async () => {
    const { caller: owner } = await initTest();
    const a = await owner.roles.add();
    const b = await owner.roles.add();

    // desired top-to-bottom order among movable roles: [b, a]
    await owner.roles.reorder({ orderedRoleIds: [b, a] });

    const all = await owner.roles.getAll(); // ordered desc by position
    const movable = all.filter((r) => r.id !== 1 && !r.isDefault);
    expect(movable[0].id).toBe(b);
    expect(movable[1].id).toBe(a);
    expect(movable[0].position).toBeGreaterThan(movable[1].position);
    // default role stays at 0
    expect(all.find((r) => r.isDefault)!.position).toBe(0);
  });

  test('reorder rejects the owner role id', async () => {
    const { caller: owner } = await initTest();
    const a = await owner.roles.add();
    await expect(
      owner.roles.reorder({ orderedRoleIds: [1, a] })
    ).rejects.toThrow();
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `cd apps/server && bun test src/routers/__tests__/role-hierarchy.test.ts`
Expected: FAIL (`roles.reorder` undefined).

- [ ] **Step 3: Implement `reorder.ts`**

```ts
import { OWNER_ROLE_ID, Permission } from '@sharkord/shared';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../../db';
import { publishRole } from '../../db/publishers';
import { getUserTopPosition } from '../../db/queries/roles';
import { roles } from '../../db/schema';
import { invariant } from '../../utils/invariant';
import { protectedProcedure } from '../../utils/trpc';

const reorderRoute = protectedProcedure
  .input(
    z.object({
      // movable roles only, ordered top (highest rank) -> bottom
      orderedRoleIds: z.number().array()
    })
  )
  .mutation(async ({ ctx, input }) => {
    await ctx.needsPermission(Permission.MANAGE_ROLES);

    const allRoles = await db.select().from(roles);
    const movable = allRoles.filter(
      (r) => r.id !== OWNER_ROLE_ID && !r.isDefault
    );

    // input must be exactly the set of movable roles
    const movableIds = new Set(movable.map((r) => r.id));
    invariant(
      input.orderedRoleIds.length === movableIds.size &&
        input.orderedRoleIds.every((id) => movableIds.has(id)) &&
        new Set(input.orderedRoleIds).size === input.orderedRoleIds.length,
      { code: 'BAD_REQUEST', message: 'Invalid role ordering' }
    );

    const actorTop = await getUserTopPosition(ctx.userId);

    // contiguous positions: default = 0, movable = 1..N (bottom of list -> 1)
    // input is top-first, so reverse to assign ascending positions.
    const bottomToTop = [...input.orderedRoleIds].reverse();

    for (let i = 0; i < bottomToTop.length; i++) {
      const roleId = bottomToTop[i]!;
      const newPosition = i + 1;
      const current = movable.find((r) => r.id === roleId)!;

      // may not move a role from at/above the actor, nor to at/above the actor
      invariant(
        actorTop > current.position && actorTop > newPosition,
        {
          code: 'FORBIDDEN',
          message: 'You cannot reorder roles at or above your own rank'
        }
      );
    }

    for (let i = 0; i < bottomToTop.length; i++) {
      await db
        .update(roles)
        .set({ position: i + 1, updatedAt: Date.now() })
        .where(eq(roles.id, bottomToTop[i]!));
    }

    for (const roleId of input.orderedRoleIds) {
      publishRole(roleId, 'update');
    }
  });

export { reorderRoute };
```

- [ ] **Step 4: Wire into `roles/index.ts`**

Add `import { reorderRoute } from './reorder';` and `reorder: reorderRoute,` to the router object.

- [ ] **Step 5: Run tests**

Run: `cd apps/server && bun test src/routers/__tests__/role-hierarchy.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/server/src/routers/roles/reorder.ts apps/server/src/routers/roles/index.ts apps/server/src/routers/__tests__/role-hierarchy.test.ts
git commit -m "feat(roles): add roles.reorder procedure with rank enforcement"
```

### Task 7: Enforce rank on role assignment and moderation

**Files:**
- Modify: `apps/server/src/routers/users/add-role.ts`
- Modify: `apps/server/src/routers/users/remove-role.ts`
- Modify: `apps/server/src/routers/users/ban.ts`
- Modify: `apps/server/src/routers/users/kick.ts`

- [ ] **Step 1: Write failing tests**

Append to `role-hierarchy.test.ts`:

```ts
describe('role hierarchy — assignment & moderation', () => {
  test('a mod cannot assign a role ranked at/above their own', async () => {
    const { caller: owner } = await initTest();
    const high = await owner.roles.add(); // position 1
    const mod = await owner.roles.add(); // position 2 (higher)
    // give user 2 the lower role only
    await owner.users.addRole({ userId: 2, roleId: high });
    await owner.roles.update({
      roleId: high,
      name: 'High',
      color: null,
      permissions: [Permission.MANAGE_USERS],
      storageQuotaOverrideEnabled: false,
      storageSpaceQuota: 0
    });

    const { caller: actor } = await initTest(2);
    await expect(
      actor.users.addRole({ userId: 1, roleId: mod })
    ).rejects.toThrow('equal to or above');
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `cd apps/server && bun test src/routers/__tests__/role-hierarchy.test.ts`
Expected: FAIL.

- [ ] **Step 3: Add rank check to `add-role.ts` and `remove-role.ts`**

In both, import `import { assertOutranksRole } from '../../helpers/assert-rank';` and add immediately after the existing `assertCanModifyOwnerRole(...)` call:

```ts
    await assertOutranksRole(ctx.userId, input.roleId);
```

- [ ] **Step 4: Add rank check to `ban.ts` and `kick.ts`**

In each, import `import { assertOutranksUser } from '../../helpers/assert-rank';` and add immediately after the existing `ctx.needsPermission(...)` line (the moderation target is `input.userId`):

```ts
    await assertOutranksUser(ctx.userId, input.userId);
```

(If a file uses a different input field for the target user id, use that field. Verify by reading the first lines of `ban.ts` / `kick.ts`.)

- [ ] **Step 5: Run tests**

Run: `cd apps/server && bun test src/routers/__tests__/role-hierarchy.test.ts src/routers/__tests__/users.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/server/src/routers/users/add-role.ts apps/server/src/routers/users/remove-role.ts apps/server/src/routers/users/ban.ts apps/server/src/routers/users/kick.ts apps/server/src/routers/__tests__/role-hierarchy.test.ts
git commit -m "feat(roles): enforce rank on role assignment and moderation"
```

---

## Phase 4 — Client

### Task 8: Name-color resolution (personal > top-role color)

**Files:**
- Create: `apps/client/src/helpers/resolve-name-color.ts`
- Modify: `apps/client/src/components/nickname-badge/index.tsx:27-32`

- [ ] **Step 1: Create the resolver**

```ts
type TColoredRole = { color: string | null; position: number };

/**
 * Displayed name color: personal nickname color wins; otherwise the colour of
 * the highest-position role that has a colour set; otherwise undefined (theme).
 */
const resolveNameColor = (
  personalColor: string | null | undefined,
  roles: TColoredRole[]
): string | undefined => {
  if (personalColor) return personalColor;

  const topColored = [...roles]
    .sort((a, b) => b.position - a.position)
    .find((r) => r.color);

  return topColored?.color ?? undefined;
};

export { resolveNameColor };
```

- [ ] **Step 2: Make the badge use the highest-position role**

In `nickname-badge/index.tsx`, replace `const topRole = roles[0];` with:

```ts
  const topRole = [...roles].sort((a, b) => b.position - a.position)[0];
```

- [ ] **Step 3: Apply `resolveNameColor` at name-render points**

Find the call sites that currently colour the username with `nicknameColor` (from feat #15) and wrap them with `resolveNameColor(user.nicknameColor, userRoles)`:

Run: `cd apps/client && grep -rn "nicknameColor" src/components | grep -v test`
For each render site (e.g. `left-sidebar/user-control.tsx`, `channel-view/text/messages-group.tsx`, `user-popover/index.tsx`), replace the direct `nicknameColor` style value with `resolveNameColor(user.nicknameColor, useUserRoles(user.id))`. Keep font/badge logic untouched.

- [ ] **Step 4: Typecheck**

Run: `cd apps/client && bun --bun run check-types`
Expected: no NEW errors in the modified files (two pre-existing errors in `messages-group.tsx:87` and `profile/index.tsx:110` are unrelated — see project notes).

- [ ] **Step 5: Commit**

```bash
git add apps/client/src/helpers/resolve-name-color.ts apps/client/src/components/nickname-badge/index.tsx
git commit -m "feat(roles): resolve name colour personal > top role"
```

### Task 9: Role list drag-and-drop reorder

**Files:**
- Modify: `apps/client/src/components/server-screens/server-settings/roles/roles-list.tsx`

Reference pattern: `apps/client/src/components/left-sidebar/categories.tsx` and `channels.tsx` already use `@dnd-kit` (`DndContext`, `SortableContext`, `useSortable`, `arrayMove`).

- [ ] **Step 1: Make movable rows sortable**

- Owner (`id === OWNER_ROLE_ID`) and the default role (`role.isDefault`) render as fixed (not draggable), pinned at the top and bottom respectively.
- Wrap the movable roles (everything else) in a `DndContext` + `SortableContext` following the `categories.tsx` pattern. Each movable row uses `useSortable({ id: role.id })`.

- [ ] **Step 2: Persist new order on drop**

On drag end, compute the new movable order with `arrayMove`, then call the reorder mutation with the **top-first** id list (the `roles-list` is rendered top = highest):

```ts
import { OWNER_ROLE_ID } from '@sharkord/shared';

const onReorder = async (orderedMovableIdsTopFirst: number[]) => {
  const trpc = getTRPCClient();
  try {
    await trpc.roles.reorder.mutate({ orderedRoleIds: orderedMovableIdsTopFirst });
    await refetch();
  } catch {
    toast.error(t('roleReorderFailed'));
    await refetch(); // revert optimistic order
  }
};
```

- [ ] **Step 3: Add the `roleReorderFailed` i18n key**

Add `"roleReorderFailed": "Failed to reorder roles"` to `apps/client/src/i18n/locales/en/settings.json` (and the other locale files, copying the English value as a placeholder translation).

- [ ] **Step 4: Typecheck**

Run: `cd apps/client && bun --bun run check-types`
Expected: no new errors.

- [ ] **Step 5: Commit**

```bash
git add apps/client/src/components/server-screens/server-settings/roles/roles-list.tsx apps/client/src/i18n/locales
git commit -m "feat(roles): drag-and-drop role reordering"
```

### Task 10: Update-role — no-color affordance + above-rank lockout

**Files:**
- Modify: `apps/client/src/components/server-screens/server-settings/roles/update-role.tsx`

- [ ] **Step 1: Support clearing the colour**

The form `color` is now `string | null`. Add a small "No colour" button next to the colour inputs that sets `onChange('color', null)`; when `values.color` is `null`, show the swatch input as empty/neutral. Pass `color: values.color` (which may be `null`) straight through to `trpc.roles.update`.

- [ ] **Step 2: Lock controls for roles at/above your rank**

Compute the current user's top position client-side (from `useUserRoles(ownUserId)` mapped to role positions, owner → `Infinity`). If `selectedRole.position >= ownTopPosition` and the selected role is not editable by the user, disable the name/color/permission inputs and the save button (mirroring the existing `isOwnerRole` disabling). Owner keeps its current special handling.

- [ ] **Step 3: Typecheck**

Run: `cd apps/client && bun --bun run check-types`
Expected: no new errors.

- [ ] **Step 4: Commit**

```bash
git add apps/client/src/components/server-screens/server-settings/roles/update-role.tsx
git commit -m "feat(roles): no-colour option and above-rank lockout in role editor"
```

---

## Phase 5 — Verification

### Task 11: Full suite, lint, typecheck

- [ ] **Step 1: Server tests**

Run: `cd apps/server && bun test`
Expected: all PASS.

- [ ] **Step 2: Server typecheck + lint**

Run: `cd apps/server && bun run check-types && bun run lint`
Expected: clean.

- [ ] **Step 3: Client typecheck**

Run: `cd apps/client && bun --bun run check-types`
Expected: only the two known pre-existing errors (`messages-group.tsx:87`, `profile/index.tsx:110`), no new ones.

- [ ] **Step 4: Final commit (if any formatting changes)**

```bash
git add -A
git commit -m "chore(roles): formatting and lint for role hierarchy"
```

---

## Notes & constraints

- **Production migrations are applied manually** and the **build is CI/Linux-only** (local Windows build fails) — see project memory. The migration in Task 1 must be applied to the prod DB at `%APPDATA%\sharkord\db.sqlite` by hand.
- Owner (`id 1`) bypasses permission checks already; the rank helpers return a sentinel for it so it always outranks.
- Branch: `development`. Commit convention: `feat(roles): …` per task.

## Self-review

- **Spec coverage:** position model + invariants (Task 1, 2, 6) ✓; nullable color + skip-uncolored (Task 1, 5, 8) ✓; rank semantics & helpers (Task 3, 4) ✓; full-Discord enforcement on edit/delete/reorder/assign/moderate (Task 5, 6, 7) ✓; personal > role colour (Task 8) ✓; badge ordering (Task 8) ✓; reorder API (Task 6) ✓; UI drag-drop + no-colour + lockout (Task 9, 10) ✓; migration & backfill (Task 1) ✓; tests (Task 3, 5, 6, 7, 11) ✓.
- **Placeholder scan:** client Tasks 9–10 describe DnD/lockout against a named reference pattern rather than full code — acceptable because the exact `@dnd-kit` wiring is copied from `categories.tsx`; all server logic and tests have complete code.
- **Type consistency:** `getUserTopPosition`/`getRolePosition`/`assertOutranksRole`/`assertOutranksUser`/`resolveNameColor`/`orderedRoleIds` are referenced consistently across tasks.
