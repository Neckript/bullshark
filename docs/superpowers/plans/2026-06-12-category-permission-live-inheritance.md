# Category Permission Live Inheritance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make channel permissions live-inherit from their parent category (pure cascade), replacing the existing copy/template model.

**Architecture:** Category role/user overrides participate in runtime permission resolution. Precedence is **type-first (Discord-style)**: `channel-user > category-user > channel-role > category-role > default(false)`. The category only fills gaps the channel does not define. Copy-on-create and the destructive "Apply to channels" action are removed. Category permission mutations republish effective permissions live to the edited target's members.

**Tech Stack:** Bun + TypeScript, Drizzle ORM (bun-sqlite), tRPC, React client, `bun test`.

**Storage note (unchanged):** An override exists **per target (role/user)** and materializes **one `allow` row per permission** as soon as it exists. There is no per-permission "neutral" state. Cascade granularity is therefore *per target presence*: if a target has a channel-level override, all its permissions come from the channel; otherwise resolution falls to the category.

**Test commands run from `apps/server/`** (preloads DB mock + setup via `bunfig.toml`):
- Single file: `bun test src/routers/__tests__/category-permissions.test.ts`
- Resolver file: `bun test src/db/queries/__tests__/channel-permissions-cascade.test.ts`

**Seed facts used by tests** (`src/__tests__/seed.ts`): role 1 = Owner; role 2 = default "Member"; users 2/3/4 have role 2; user 1 is owner. New channels default `private: false`.

---

## File Structure

- `apps/server/src/db/queries/channels.ts` — resolver changes (`getAllChannelUserPermissions`, `getPermissions`) + new `getAffectedUserIdsForCategoryTarget` / `getAffectedOnlineUserIdsForCategoryTarget`.
- `apps/server/src/routers/channels/add-channel.ts` — remove copy-on-create.
- `apps/server/src/routers/categories/update-permission.ts` — publish live after mutation.
- `apps/server/src/routers/categories/delete-permissions.ts` — publish live after mutation.
- `apps/server/src/routers/categories/apply-permissions.ts` — **deleted**.
- `apps/server/src/routers/categories/index.ts` — drop `applyPermissionsToChannels`.
- `apps/server/src/db/queries/categories.ts` — remove `copyCategoryPermissionsToChannel`.
- `apps/server/src/routers/__tests__/category-permissions.test.ts` — rewrite obsolete tests, add cascade + publish tests.
- `apps/server/src/db/queries/__tests__/channel-permissions-cascade.test.ts` — **new** resolver tests.
- `apps/client/src/components/server-screens/category-settings/permissions/index.tsx` — remove "Apply to channels" button + handler.
- `apps/client/src/i18n/locales/{cs,en,es,fr,it,ru,zh}/settings.json` — remove apply keys, update `categoryPermissionsDesc`.

---

### Task 1: Cascade in `getAllChannelUserPermissions` (effective permission map)

This is the source of truth for both server enforcement (`hasChannelPermission` in `utils/wss.ts`) and the permission map pushed to clients.

**Files:**
- Modify: `apps/server/src/db/queries/channels.ts`
- Create: `apps/server/src/db/queries/__tests__/channel-permissions-cascade.test.ts`

- [ ] **Step 1: Add the schema imports**

In `apps/server/src/db/queries/channels.ts`, extend the schema import block (currently importing `channelReadStates, channelRolePermissions, channels, channelUserPermissions, messages, userRoles`) to also import the category permission tables:

```ts
import {
  categoryRolePermissions,
  categoryUserPermissions,
  channelReadStates,
  channelRolePermissions,
  channels,
  channelUserPermissions,
  messages,
  userRoles
} from '../schema';
```

- [ ] **Step 2: Write the failing resolver test**

Create `apps/server/src/db/queries/__tests__/channel-permissions-cascade.test.ts`:

```ts
import { ChannelPermission, ChannelType } from '@sharkord/shared';
import { describe, expect, test } from 'bun:test';
import { initTest } from '../../../__tests__/helpers';
import { getAllChannelUserPermissions } from '../channels';

// role 2 = default "Member"; user 2 has role 2 (see seed.ts)
const MEMBER_ROLE_ID = 2;
const MEMBER_USER_ID = 2;

describe('channel permission cascade — getAllChannelUserPermissions', () => {
  test('category role override is inherited when channel has none', async () => {
    const { caller: owner } = await initTest(1);
    const categoryId = await owner.categories.add({ name: 'Cat' });
    const channelId = await owner.channels.add({
      type: ChannelType.TEXT,
      name: 'general',
      categoryId
    });

    await owner.categories.updatePermissions({
      categoryId,
      roleId: MEMBER_ROLE_ID,
      permissions: [ChannelPermission.VIEW_CHANNEL]
    });

    const perms = await getAllChannelUserPermissions(MEMBER_USER_ID);

    expect(perms[channelId]?.permissions[ChannelPermission.VIEW_CHANNEL]).toBe(
      true
    );
  });

  test('channel override beats category override (channel denies)', async () => {
    const { caller: owner } = await initTest(1);
    const categoryId = await owner.categories.add({ name: 'Cat' });
    const channelId = await owner.channels.add({
      type: ChannelType.TEXT,
      name: 'general',
      categoryId
    });

    await owner.categories.updatePermissions({
      categoryId,
      roleId: MEMBER_ROLE_ID,
      permissions: [ChannelPermission.VIEW_CHANNEL]
    });
    // channel role override with empty permissions => deny everything
    await owner.channels.updatePermissions({
      channelId,
      roleId: MEMBER_ROLE_ID,
      permissions: []
    });

    const perms = await getAllChannelUserPermissions(MEMBER_USER_ID);

    expect(perms[channelId]?.permissions[ChannelPermission.VIEW_CHANNEL]).toBe(
      false
    );
  });

  test('type-first: category USER override beats channel ROLE override', async () => {
    const { caller: owner } = await initTest(1);
    const categoryId = await owner.categories.add({ name: 'Cat' });
    const channelId = await owner.channels.add({
      type: ChannelType.TEXT,
      name: 'general',
      categoryId
    });

    // channel role override denies VIEW_CHANNEL
    await owner.channels.updatePermissions({
      channelId,
      roleId: MEMBER_ROLE_ID,
      permissions: []
    });
    // category USER override allows VIEW_CHANNEL for user 2
    await owner.categories.updatePermissions({
      categoryId,
      userId: MEMBER_USER_ID,
      permissions: [ChannelPermission.VIEW_CHANNEL]
    });

    const perms = await getAllChannelUserPermissions(MEMBER_USER_ID);

    expect(perms[channelId]?.permissions[ChannelPermission.VIEW_CHANNEL]).toBe(
      true
    );
  });

  test('no category and no channel override => default false', async () => {
    const { caller: owner } = await initTest(1);
    const categoryId = await owner.categories.add({ name: 'Empty' });
    const channelId = await owner.channels.add({
      type: ChannelType.TEXT,
      name: 'orphan',
      categoryId
    });

    const perms = await getAllChannelUserPermissions(MEMBER_USER_ID);

    expect(perms[channelId]?.permissions[ChannelPermission.VIEW_CHANNEL]).toBe(
      false
    );
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `bun test src/db/queries/__tests__/channel-permissions-cascade.test.ts`
Expected: the "category role override is inherited" and "type-first" tests FAIL (resolver ignores category overrides; inherited value is `false`). The "channel denies" and "default false" tests may already pass.

- [ ] **Step 4: Implement the cascade in `getAllChannelUserPermissions`**

Replace the body of `getAllChannelUserPermissions` (the section from the `rolePermMap` build through the `for (const channel of allChannels)` loop) so it loads category overrides and resolves type-first. The full function becomes:

```ts
const getAllChannelUserPermissions = async (
  userId: number
): Promise<TChannelUserPermissionsMap> => {
  const roleIds = await getUserRoleIds(userId);
  const allChannels = await db.select().from(channels);

  const userPermissions = await db
    .select({
      channelId: channelUserPermissions.channelId,
      permission: channelUserPermissions.permission,
      allow: channelUserPermissions.allow
    })
    .from(channelUserPermissions)
    .where(eq(channelUserPermissions.userId, userId));

  let rolePermissions: typeof userPermissions = [];

  if (roleIds.length > 0) {
    rolePermissions = await db
      .select({
        channelId: channelRolePermissions.channelId,
        permission: channelRolePermissions.permission,
        allow: channelRolePermissions.allow
      })
      .from(channelRolePermissions)
      .where(inArray(channelRolePermissions.roleId, roleIds));
  }

  // Category-level overrides (the live-inheritance source).
  const categoryUserPerms = await db
    .select({
      categoryId: categoryUserPermissions.categoryId,
      permission: categoryUserPermissions.permission,
      allow: categoryUserPermissions.allow
    })
    .from(categoryUserPermissions)
    .where(eq(categoryUserPermissions.userId, userId));

  let categoryRolePerms: typeof categoryUserPerms = [];

  if (roleIds.length > 0) {
    categoryRolePerms = await db
      .select({
        categoryId: categoryRolePermissions.categoryId,
        permission: categoryRolePermissions.permission,
        allow: categoryRolePermissions.allow
      })
      .from(categoryRolePermissions)
      .where(inArray(categoryRolePermissions.roleId, roleIds));
  }

  const userPermMap = new Map<number, Map<ChannelPermission, boolean>>();

  for (const perm of userPermissions) {
    if (!userPermMap.has(perm.channelId)) {
      userPermMap.set(perm.channelId, new Map());
    }

    userPermMap
      .get(perm.channelId)!
      .set(perm.permission as ChannelPermission, perm.allow);
  }

  const rolePermMap = new Map<number, Map<ChannelPermission, boolean>>();

  for (const perm of rolePermissions) {
    if (!rolePermMap.has(perm.channelId)) {
      rolePermMap.set(perm.channelId, new Map());
    }

    const channelMap = rolePermMap.get(perm.channelId)!;
    const existing = channelMap.get(perm.permission as ChannelPermission);

    channelMap.set(perm.permission as ChannelPermission, existing || perm.allow);
  }

  const categoryUserPermMap = new Map<
    number,
    Map<ChannelPermission, boolean>
  >();

  for (const perm of categoryUserPerms) {
    if (!categoryUserPermMap.has(perm.categoryId)) {
      categoryUserPermMap.set(perm.categoryId, new Map());
    }

    categoryUserPermMap
      .get(perm.categoryId)!
      .set(perm.permission as ChannelPermission, perm.allow);
  }

  const categoryRolePermMap = new Map<
    number,
    Map<ChannelPermission, boolean>
  >();

  for (const perm of categoryRolePerms) {
    if (!categoryRolePermMap.has(perm.categoryId)) {
      categoryRolePermMap.set(perm.categoryId, new Map());
    }

    const categoryMap = categoryRolePermMap.get(perm.categoryId)!;
    const existing = categoryMap.get(perm.permission as ChannelPermission);

    categoryMap.set(
      perm.permission as ChannelPermission,
      existing || perm.allow
    );
  }

  const allPermissionTypes = Object.values(ChannelPermission);

  const channelPermissions: Record<
    number,
    { channelId: number; permissions: Record<ChannelPermission, boolean> }
  > = {};

  for (const channel of allChannels) {
    const categoryId = channel.categoryId;
    const permissions: Record<string, boolean> = {};

    for (const permissionType of allPermissionTypes) {
      // type-first cascade:
      // channel-user > category-user > channel-role > category-role > false
      const channelUser = userPermMap.get(channel.id)?.get(permissionType);

      if (channelUser !== undefined) {
        permissions[permissionType] = channelUser;

        continue;
      }

      const categoryUser =
        categoryId != null
          ? categoryUserPermMap.get(categoryId)?.get(permissionType)
          : undefined;

      if (categoryUser !== undefined) {
        permissions[permissionType] = categoryUser;

        continue;
      }

      const channelRole = rolePermMap.get(channel.id)?.get(permissionType);

      if (channelRole !== undefined) {
        permissions[permissionType] = channelRole;

        continue;
      }

      const categoryRole =
        categoryId != null
          ? categoryRolePermMap.get(categoryId)?.get(permissionType)
          : undefined;

      if (categoryRole !== undefined) {
        permissions[permissionType] = categoryRole;

        continue;
      }

      permissions[permissionType] = false;
    }

    if (channel.isDm) {
      // for DM channels we need to check if the user is a participant, if not we set all permissions to false
      const isParticipant = await isUserDmParticipant(channel.id, userId);

      if (isParticipant) {
        // if the user is a participant in the DM channel, we set all permissions to true because DM channels don't have granular permissions
        for (const permissionType of allPermissionTypes) {
          permissions[permissionType] = true;
        }
      }
    }

    channelPermissions[channel.id] = {
      channelId: channel.id,
      permissions: permissions as Record<ChannelPermission, boolean>
    };
  }

  return channelPermissions;
};
```

- [ ] **Step 5: Run the resolver test to verify it passes**

Run: `bun test src/db/queries/__tests__/channel-permissions-cascade.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 6: Commit**

```bash
git add apps/server/src/db/queries/channels.ts apps/server/src/db/queries/__tests__/channel-permissions-cascade.test.ts
git commit -m "feat(category-perms): live cascade in getAllChannelUserPermissions (type-first)"
```

---

### Task 2: Cascade in `getPermissions` (VIEW_CHANNEL visibility / `channelUserCan`)

`getPermissions` powers `getChannelsForUser` (channel list visibility) and `channelUserCan` (single-channel checks). Both read `userPermissionMap` then `rolePermissionMap` then default false. We enrich those two maps with category fallback so the existing callers get type-first cascade unchanged.

**Files:**
- Modify: `apps/server/src/db/queries/channels.ts:27-85` (the `getPermissions` function)
- Modify (add test): `apps/server/src/db/queries/__tests__/channel-permissions-cascade.test.ts`

- [ ] **Step 1: Write the failing test**

Append to `channel-permissions-cascade.test.ts`:

```ts
import { channelUserCan } from '../channels';

describe('channel permission cascade — channelUserCan (private channel)', () => {
  test('private channel is visible via inherited category VIEW_CHANNEL', async () => {
    const { caller: owner } = await initTest(1);
    const categoryId = await owner.categories.add({ name: 'Cat' });
    const channelId = await owner.channels.add({
      type: ChannelType.TEXT,
      name: 'secret',
      categoryId
    });
    await owner.channels.update({ channelId, private: true });

    // before any override: member cannot view
    expect(
      await channelUserCan(
        channelId,
        MEMBER_USER_ID,
        ChannelPermission.VIEW_CHANNEL
      )
    ).toBe(false);

    // category grants VIEW_CHANNEL to the member role
    await owner.categories.updatePermissions({
      categoryId,
      roleId: MEMBER_ROLE_ID,
      permissions: [ChannelPermission.VIEW_CHANNEL]
    });

    expect(
      await channelUserCan(
        channelId,
        MEMBER_USER_ID,
        ChannelPermission.VIEW_CHANNEL
      )
    ).toBe(true);
  });
});
```

> Add `channelUserCan` to the existing import from `../channels` rather than a second import line.

- [ ] **Step 2: Run the test to verify it fails**

Run: `bun test src/db/queries/__tests__/channel-permissions-cascade.test.ts -t "inherited category VIEW_CHANNEL"`
Expected: FAIL — after granting the category override, `channelUserCan` still returns `false` (category ignored).

- [ ] **Step 3: Implement category fallback in `getPermissions`**

Replace the `getPermissions` function (lines 27-85) with:

```ts
const getPermissions = async (
  userId: number,
  roleIds: number[],
  permission: ChannelPermission,
  channelId?: number
) => {
  const userPermissionsQuery = db
    .select({
      channelId: channelUserPermissions.channelId,
      allow: channelUserPermissions.allow
    })
    .from(channelUserPermissions)
    .where(
      and(
        eq(channelUserPermissions.userId, userId),
        eq(channelUserPermissions.permission, permission),
        channelId ? eq(channelUserPermissions.channelId, channelId) : undefined
      )
    );

  let rolePermissionsQuery = null;

  if (roleIds.length > 0) {
    rolePermissionsQuery = db
      .select({
        channelId: channelRolePermissions.channelId,
        allow: channelRolePermissions.allow
      })
      .from(channelRolePermissions)
      .where(
        and(
          inArray(channelRolePermissions.roleId, roleIds),
          eq(channelRolePermissions.permission, permission),
          channelId
            ? eq(channelRolePermissions.channelId, channelId)
            : undefined
        )
      );
  }

  const [userPermissions, rolePermissions] = await Promise.all([
    userPermissionsQuery,
    rolePermissionsQuery || Promise.resolve([])
  ]);

  const userPermissionMap = new Map(
    userPermissions.map((p) => [p.channelId, p.allow])
  );

  const rolePermissionMap = new Map<number, boolean>();

  for (const perm of rolePermissions) {
    const existing = rolePermissionMap.get(perm.channelId);

    rolePermissionMap.set(perm.channelId, existing || perm.allow);
  }

  // Live category inheritance: fill channels that have no channel-level
  // override for this permission with their category's override.
  const channelRows = await db
    .select({ id: channels.id, categoryId: channels.categoryId })
    .from(channels)
    .where(channelId ? eq(channels.id, channelId) : undefined);

  const categoryIds = channelRows
    .map((c) => c.categoryId)
    .filter((id): id is number => id != null);

  const categoryUserMap = new Map<number, boolean>();
  const categoryRoleMap = new Map<number, boolean>();

  if (categoryIds.length > 0) {
    const categoryUserPerms = await db
      .select({
        categoryId: categoryUserPermissions.categoryId,
        allow: categoryUserPermissions.allow
      })
      .from(categoryUserPermissions)
      .where(
        and(
          eq(categoryUserPermissions.userId, userId),
          eq(categoryUserPermissions.permission, permission),
          inArray(categoryUserPermissions.categoryId, categoryIds)
        )
      );

    for (const perm of categoryUserPerms) {
      categoryUserMap.set(perm.categoryId, perm.allow);
    }

    if (roleIds.length > 0) {
      const categoryRolePerms = await db
        .select({
          categoryId: categoryRolePermissions.categoryId,
          allow: categoryRolePermissions.allow
        })
        .from(categoryRolePermissions)
        .where(
          and(
            inArray(categoryRolePermissions.roleId, roleIds),
            eq(categoryRolePermissions.permission, permission),
            inArray(categoryRolePermissions.categoryId, categoryIds)
          )
        );

      for (const perm of categoryRolePerms) {
        const existing = categoryRoleMap.get(perm.categoryId);

        categoryRoleMap.set(perm.categoryId, existing || perm.allow);
      }
    }
  }

  for (const channel of channelRows) {
    if (channel.categoryId == null) continue;

    if (
      !userPermissionMap.has(channel.id) &&
      categoryUserMap.has(channel.categoryId)
    ) {
      userPermissionMap.set(
        channel.id,
        categoryUserMap.get(channel.categoryId)!
      );
    }

    if (
      !rolePermissionMap.has(channel.id) &&
      categoryRoleMap.has(channel.categoryId)
    ) {
      rolePermissionMap.set(
        channel.id,
        categoryRoleMap.get(channel.categoryId)!
      );
    }
  }

  return { userPermissionMap, rolePermissionMap };
};
```

> Note: callers read `userPermissionMap` first, then `rolePermissionMap`, then default false — so a category-user value placed in `userPermissionMap` correctly outranks a category-role value placed in `rolePermissionMap`, preserving type-first precedence.

- [ ] **Step 4: Run the full cascade test file**

Run: `bun test src/db/queries/__tests__/channel-permissions-cascade.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/server/src/db/queries/channels.ts apps/server/src/db/queries/__tests__/channel-permissions-cascade.test.ts
git commit -m "feat(category-perms): live cascade in getPermissions (visibility/channelUserCan)"
```

---

### Task 3: Remove copy-on-create; channels inherit live

With live cascade, copying category overrides into new channels is redundant and would freeze a snapshot. Remove it. Update the obsolete "inheritance on create" tests to assert *effective* resolution instead of copied rows.

**Files:**
- Modify: `apps/server/src/routers/channels/add-channel.ts`
- Modify: `apps/server/src/routers/__tests__/category-permissions.test.ts:75-113`

- [ ] **Step 1: Update the inheritance tests to assert effective resolution**

In `apps/server/src/routers/__tests__/category-permissions.test.ts`, replace the entire `describe('category permissions — inheritance on create', ...)` block (lines 75-113) with:

```ts
describe('category permissions — live inheritance', () => {
  test('a channel in a category inherits effective perms without copying rows', async () => {
    const { caller: owner } = await initTest(1);
    const categoryId = await owner.categories.add({ name: 'Cat' });
    await owner.categories.updatePermissions({
      categoryId,
      roleId: 2,
      permissions: [ChannelPermission.VIEW_CHANNEL]
    });

    const channelId = await owner.channels.add({
      type: ChannelType.TEXT,
      name: 'inherits',
      categoryId
    });

    // No channel-level rows are created (inheritance is live, not copied).
    const channelPerms = await owner.channels.getPermissions({ channelId });
    expect(channelPerms.rolePermissions.length).toBe(0);

    // Effective resolution reflects the category override.
    const effective = await getAllChannelUserPermissions(2);
    expect(
      effective[channelId]?.permissions[ChannelPermission.VIEW_CHANNEL]
    ).toBe(true);
  });

  test('a channel in a category with no overrides resolves to defaults', async () => {
    const { caller: owner } = await initTest(1);
    const categoryId = await owner.categories.add({ name: 'Empty' });

    const channelId = await owner.channels.add({
      type: ChannelType.TEXT,
      name: 'orphan',
      categoryId
    });
    const channelPerms = await owner.channels.getPermissions({ channelId });

    expect(channelPerms.rolePermissions.length).toBe(0);

    const effective = await getAllChannelUserPermissions(2);
    expect(
      effective[channelId]?.permissions[ChannelPermission.VIEW_CHANNEL]
    ).toBe(false);
  });
});
```

Add this import at the top of the test file (below the existing imports):

```ts
import { getAllChannelUserPermissions } from '../../db/queries/channels';
```

- [ ] **Step 2: Run the test to verify the first one fails**

Run: `bun test src/routers/__tests__/category-permissions.test.ts -t "without copying rows"`
Expected: FAIL — `channelPerms.rolePermissions.length` is `1` (copy-on-create still copies the category override into the channel).

- [ ] **Step 3: Remove the copy-on-create logic**

Rewrite `apps/server/src/routers/channels/add-channel.ts` to drop the copy. Remove the `copyCategoryPermissionsToChannel` import and the `if (newChannel.categoryId) { ... }` block:

```ts
import { ActivityLogType, ChannelType, Permission } from '@sharkord/shared';
import { desc, eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../../db';
import { publishChannel } from '../../db/publishers';
import { channels } from '../../db/schema';
import { enqueueActivityLog } from '../../queues/activity-log';
import { VoiceRuntime } from '../../runtimes/voice';
import { protectedProcedure } from '../../utils/trpc';

const addChannelRoute = protectedProcedure
  .input(
    z.object({
      type: z.enum(ChannelType),
      name: z.string().min(1).max(27),
      categoryId: z.number()
    })
  )
  .mutation(async ({ input, ctx }) => {
    await ctx.needsPermission(Permission.MANAGE_CHANNELS);

    const channel = await db.transaction(async (tx) => {
      const maxPositionChannel = await tx
        .select()
        .from(channels)
        .orderBy(desc(channels.position))
        .where(eq(channels.categoryId, input.categoryId))
        .limit(1)
        .get();

      const now = Date.now();

      const newChannel = await tx
        .insert(channels)
        .values({
          position:
            maxPositionChannel?.position !== undefined
              ? maxPositionChannel.position + 1
              : 0,
          name: input.name,
          type: input.type,
          categoryId: input.categoryId,
          createdAt: now
        })
        .returning()
        .get();

      return newChannel;
    });

    if (channel.type === ChannelType.VOICE) {
      const runtime = new VoiceRuntime(channel.id);

      await runtime.init();
    }

    publishChannel(channel.id, 'create');
    enqueueActivityLog({
      type: ActivityLogType.CREATED_CHANNEL,
      userId: ctx.user.id,
      details: {
        channelId: channel.id,
        channelName: channel.name,
        type: channel.type as ChannelType
      }
    });

    return channel.id;
  });

export { addChannelRoute };
```

- [ ] **Step 4: Run the inheritance tests to verify they pass**

Run: `bun test src/routers/__tests__/category-permissions.test.ts -t "live inheritance"`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/server/src/routers/channels/add-channel.ts apps/server/src/routers/__tests__/category-permissions.test.ts
git commit -m "feat(category-perms): channels inherit live, drop copy-on-create"
```

---

### Task 4: Publish effective permissions live on category mutations

Editing a category override changes effective permissions for every child channel, for the members of the edited target. Add a helper to resolve those members and republish to the online subset.

**Files:**
- Modify: `apps/server/src/db/queries/channels.ts` (new helpers + exports)
- Modify: `apps/server/src/routers/categories/update-permission.ts`
- Modify: `apps/server/src/routers/categories/delete-permissions.ts`
- Modify (add test): `apps/server/src/db/queries/__tests__/channel-permissions-cascade.test.ts`

- [ ] **Step 1: Write the failing helper test**

Append to `channel-permissions-cascade.test.ts`:

```ts
import { getAffectedUserIdsForCategoryTarget } from '../channels';

describe('getAffectedUserIdsForCategoryTarget', () => {
  test('returns all members of a role', async () => {
    await initTest(1);

    const ids = await getAffectedUserIdsForCategoryTarget({
      roleId: MEMBER_ROLE_ID
    });

    // users 2, 3, 4 all have the default member role (see seed.ts)
    expect(ids.sort()).toEqual([2, 3, 4]);
  });

  test('returns the single user for a user target', async () => {
    await initTest(1);

    const ids = await getAffectedUserIdsForCategoryTarget({ userId: 4 });

    expect(ids).toEqual([4]);
  });
});
```

> Add `getAffectedUserIdsForCategoryTarget` to the existing `../channels` import.

- [ ] **Step 2: Run the test to verify it fails**

Run: `bun test src/db/queries/__tests__/channel-permissions-cascade.test.ts -t "getAffectedUserIdsForCategoryTarget"`
Expected: FAIL — `getAffectedUserIdsForCategoryTarget` is not exported / not defined.

- [ ] **Step 3: Implement the helpers**

In `apps/server/src/db/queries/channels.ts`, add these two functions (place them next to `getAffectedOnlineUserIdsForChannel`):

```ts
const getAffectedUserIdsForCategoryTarget = async (target: {
  userId?: number;
  roleId?: number;
}): Promise<number[]> => {
  if (target.userId) {
    return [target.userId];
  }

  if (target.roleId) {
    const rows = await db
      .select({ userId: userRoles.userId })
      .from(userRoles)
      .where(eq(userRoles.roleId, target.roleId));

    return rows.map((r) => r.userId);
  }

  return [];
};

const getAffectedOnlineUserIdsForCategoryTarget = async (target: {
  userId?: number;
  roleId?: number;
}): Promise<number[]> => {
  const affectedUserIds = await getAffectedUserIdsForCategoryTarget(target);
  const onlineUserIds = getOnlineUserIds();

  return affectedUserIds.filter((userId) => onlineUserIds.includes(userId));
};
```

Add both to the module's export block (the `export { ... }` at the bottom of the file), keeping alphabetical-ish order:

```ts
export {
  channelUserCan,
  getAffectedOnlineUserIdsForCategoryTarget,
  getAffectedOnlineUserIdsForChannel,
  getAffectedUserIdsForCategoryTarget,
  getAffectedUserIdsForChannel,
  getAllChannelUserPermissions,
  getChannelsForUser,
  getChannelsReadStatesForUser,
  getRoleChannelPermissions,
  getUserChannelPermissions
};
```

- [ ] **Step 4: Run the helper test to verify it passes**

Run: `bun test src/db/queries/__tests__/channel-permissions-cascade.test.ts -t "getAffectedUserIdsForCategoryTarget"`
Expected: PASS (2 tests).

- [ ] **Step 5: Wire publishing into the category update route**

In `apps/server/src/routers/categories/update-permission.ts`, add imports and publish after the transaction. Add to the imports:

```ts
import { publishChannelPermissions } from '../../db/publishers';
import { getAffectedOnlineUserIdsForCategoryTarget } from '../../db/queries/channels';
```

Then, immediately after the `await db.transaction(async (tx) => { ... });` block and before the function closes, add:

```ts
    const affectedUserIds = await getAffectedOnlineUserIdsForCategoryTarget({
      userId: input.userId,
      roleId: input.roleId
    });

    publishChannelPermissions(affectedUserIds);
```

- [ ] **Step 6: Wire publishing into the category delete route**

In `apps/server/src/routers/categories/delete-permissions.ts`, add the same imports:

```ts
import { publishChannelPermissions } from '../../db/publishers';
import { getAffectedOnlineUserIdsForCategoryTarget } from '../../db/queries/channels';
```

Capture the affected members **before** the deletion (target ids are independent of the override rows, so order is not critical, but compute once), then publish after the transaction. After the `await db.transaction(...)` block add:

```ts
    const affectedUserIds = await getAffectedOnlineUserIdsForCategoryTarget({
      userId: input.userId,
      roleId: input.roleId
    });

    publishChannelPermissions(affectedUserIds);
```

- [ ] **Step 7: Run the full server test suite to confirm no regressions**

Run: `bun test`
Expected: PASS (all suites). In unit tests there are no live WS connections, so `getOnlineUserIds()` is empty and `publishChannelPermissions([])` is a no-op — the routes still succeed.

- [ ] **Step 8: Commit**

```bash
git add apps/server/src/db/queries/channels.ts apps/server/src/routers/categories/update-permission.ts apps/server/src/routers/categories/delete-permissions.ts apps/server/src/db/queries/__tests__/channel-permissions-cascade.test.ts
git commit -m "feat(category-perms): republish effective perms live on category mutations"
```

---

### Task 5: Client — remove "Apply to channels" button and obsolete i18n

The button performed the destructive copy that no longer exists. Remove it and the unused i18n keys; reword the category permissions description.

**Files:**
- Modify: `apps/client/src/components/server-screens/category-settings/permissions/index.tsx`
- Modify: `apps/client/src/i18n/locales/{cs,en,es,fr,it,ru,zh}/settings.json`

- [ ] **Step 1: Remove the button, handler, and now-unused imports**

Rewrite `apps/client/src/components/server-screens/category-settings/permissions/index.tsx` so it no longer references the apply action. Remove `requestConfirmation`, `getTrpcError`, `toast`, `useCallback`, `Button` if unused, and the `onApplyToChannels` callback. The component becomes:

```tsx
import { Override } from '@/components/server-screens/channel-settings/permissions/override';
import { OverridesList } from '@/components/server-screens/channel-settings/permissions/overrides-list';
import type {
  TChannelPermission,
  TPermissionActions
} from '@/components/server-screens/channel-settings/permissions/types';
import { useAdminCategoryPermissions } from '@/features/server/admin/hooks';
import { getTRPCClient } from '@/lib/trpc';
import { ChannelPermission } from '@sharkord/shared';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  LoadingCard
} from '@sharkord/ui';
import { memo, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

type TCategoryPermissionsProps = {
  categoryId: number;
};

const CategoryPermissions = memo(
  ({ categoryId }: TCategoryPermissionsProps) => {
    const { t } = useTranslation('settings');
    const [selectedOverrideId, setSelectedOverrideId] = useState<
      string | undefined
    >();
    const { rolePermissions, userPermissions, loading, refetch } =
      useAdminCategoryPermissions(categoryId);

    const actions = useMemo<TPermissionActions>(
      () => ({
        createOverride: async (target) => {
          await getTRPCClient().categories.updatePermissions.mutate({
            categoryId,
            ...target,
            isCreate: true
          });
        },
        updateOverride: async (target, permissions) => {
          await getTRPCClient().categories.updatePermissions.mutate({
            categoryId,
            ...target,
            permissions
          });
        },
        deleteOverride: async (target) => {
          await getTRPCClient().categories.deletePermissions.mutate({
            categoryId,
            ...target
          });
        }
      }),
      [categoryId]
    );

    const selectedPermissions = useMemo<TChannelPermission[]>(() => {
      if (!selectedOverrideId) return [];

      const [type, idStr] = selectedOverrideId.split('-');
      const id = parseInt(idStr);

      if (type === 'role') {
        return rolePermissions
          .filter((perm) => perm.roleId === id)
          .map((perm) => ({
            permission: perm.permission as ChannelPermission,
            allow: perm.allow
          }));
      }

      return userPermissions
        .filter((perm) => perm.userId === id)
        .map((perm) => ({
          permission: perm.permission as ChannelPermission,
          allow: perm.allow
        }));
    }, [selectedOverrideId, rolePermissions, userPermissions]);

    if (loading) {
      return <LoadingCard className="h-[600px]" />;
    }

    return (
      <Card>
        <CardHeader>
          <div className="space-y-1.5">
            <CardTitle>{t('permissionsTitle')}</CardTitle>
            <CardDescription>{t('categoryPermissionsDesc')}</CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex gap-6">
            <OverridesList
              actions={actions}
              rolePermissions={rolePermissions}
              userPermissions={userPermissions}
              selectedOverrideId={selectedOverrideId}
              setSelectedOverrideId={setSelectedOverrideId}
              refetch={refetch}
            />

            {selectedOverrideId ? (
              <Override
                key={selectedOverrideId}
                actions={actions}
                overrideId={selectedOverrideId}
                permissions={selectedPermissions}
                setSelectedOverrideId={setSelectedOverrideId}
                refetch={refetch}
              />
            ) : (
              <Card className="flex flex-1 items-center justify-center">
                <CardContent className="py-12 text-center text-muted-foreground text-sm">
                  {t('selectRoleOrUser')}
                </CardContent>
              </Card>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }
);

export { CategoryPermissions };
```

- [ ] **Step 2: Remove obsolete i18n keys and reword the description (all 7 locales)**

In each of `apps/client/src/i18n/locales/{cs,en,es,fr,it,ru,zh}/settings.json`:

1. Delete these five keys: `applyCategoryPermsButton`, `applyCategoryPermsConfirmTitle`, `applyCategoryPermsConfirmBody`, `applyCategoryPermsSuccess`, `applyCategoryPermsFailed`.
2. Reword `categoryPermissionsDesc` to drop the "apply" wording. For English (`en/settings.json`):

```json
  "categoryPermissionsDesc": "Set permission overrides that channels in this category inherit.",
```

For the other locales, translate the same meaning ("Set permission overrides that channels in this category inherit."):
- `fr`: `"Définissez les overrides de permissions hérités par les canaux de cette catégorie."`
- `es`: `"Define las anulaciones de permisos que heredan los canales de esta categoría."`
- `it`: `"Imposta le sovrascritture dei permessi ereditate dai canali di questa categoria."`
- `cs`: `"Nastavte výjimky oprávnění, které zdědí kanály v této kategorii."`
- `ru`: `"Задайте переопределения прав, которые наследуют каналы этой категории."`
- `zh`: `"设置此分类下频道继承的权限覆盖。"`

> Make sure the line *before* the removed keys keeps/loses its trailing comma so each JSON file stays valid (the last key in an object must not have a trailing comma).

- [ ] **Step 3: Type-check the client**

Run (from repo root): `bun run --filter '@sharkord/client' typecheck` (if a `typecheck` script exists; otherwise `cd apps/client && bunx tsc --noEmit`).
Expected: PASS — no references to removed keys/handlers remain. (`categories.applyPermissionsToChannels` is still defined on the server router at this point, so the client type still resolves.)

- [ ] **Step 4: Commit**

```bash
git add apps/client/src/components/server-screens/category-settings/permissions/index.tsx apps/client/src/i18n/locales
git commit -m "feat(category-perms): remove Apply-to-channels button + obsolete i18n"
```

---

### Task 6: Remove the server `applyPermissionsToChannels` route and dead copy helper

Now that the client no longer calls it and inheritance is live, delete the route, its router entry, and the now-unused `copyCategoryPermissionsToChannel`. Replace the obsolete "apply to channels" test.

**Files:**
- Delete: `apps/server/src/routers/categories/apply-permissions.ts`
- Modify: `apps/server/src/routers/categories/index.ts`
- Modify: `apps/server/src/db/queries/categories.ts`
- Modify: `apps/server/src/routers/__tests__/category-permissions.test.ts:41-73`

- [ ] **Step 1: Remove the obsolete "apply to channels" test block**

In `apps/server/src/routers/__tests__/category-permissions.test.ts`, delete the entire `describe('category permissions — apply to channels', ...)` block (lines 41-73). It tests a route that is being removed.

- [ ] **Step 2: Delete the route file and its router registration**

Delete `apps/server/src/routers/categories/apply-permissions.ts`.

In `apps/server/src/routers/categories/index.ts`, remove the import line `import { applyPermissionsRoute } from './apply-permissions';` and the router entry `applyPermissionsToChannels: applyPermissionsRoute,`. The file becomes:

```ts
import { t } from '../../utils/trpc';
import { addCategoryRoute } from './add-category';
import { deleteCategoryRoute } from './delete-category';
import { deletePermissionsRoute } from './delete-permissions';
import {
  onCategoryCreateRoute,
  onCategoryDeleteRoute,
  onCategoryUpdateRoute
} from './events';
import { getCategoryRoute } from './get-category';
import { getPermissionsRoute } from './get-permissions';
import { reorderCategoriesRoute } from './reorder-categories';
import { updateCategoryRoute } from './update-category';
import { updatePermissionsRoute } from './update-permission';

export const categoriesRouter = t.router({
  add: addCategoryRoute,
  update: updateCategoryRoute,
  delete: deleteCategoryRoute,
  get: getCategoryRoute,
  reorder: reorderCategoriesRoute,
  updatePermissions: updatePermissionsRoute,
  getPermissions: getPermissionsRoute,
  deletePermissions: deletePermissionsRoute,
  onCreate: onCategoryCreateRoute,
  onDelete: onCategoryDeleteRoute,
  onUpdate: onCategoryUpdateRoute
});
```

- [ ] **Step 3: Remove the dead `copyCategoryPermissionsToChannel` helper**

In `apps/server/src/db/queries/categories.ts`, delete `copyCategoryPermissionsToChannel` and the now-unused imports (`channelRolePermissions`, `channelUserPermissions`, and the `Tx` type if unused). Keep `getCategoryPermissions` (still used by `categories/get-permissions.ts`). The file becomes:

```ts
import { eq } from 'drizzle-orm';
import { db } from '..';
import { categoryRolePermissions, categoryUserPermissions } from '../schema';

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

export { getCategoryPermissions };
```

- [ ] **Step 4: Type-check and run the full server suite**

Run (from `apps/server/`): `bunx tsc --noEmit` then `bun test`
Expected: PASS. No remaining references to `applyPermissionsRoute`, `applyPermissionsToChannels`, or `copyCategoryPermissionsToChannel`.

- [ ] **Step 5: Verify no dangling references remain**

Run (from repo root): `grep -rn "applyPermissionsToChannels\|copyCategoryPermissionsToChannel\|applyCategoryPerms" apps/`
Expected: no matches.

- [ ] **Step 6: Commit**

```bash
git add apps/server/src/routers/categories apps/server/src/db/queries/categories.ts apps/server/src/routers/__tests__/category-permissions.test.ts
git commit -m "feat(category-perms): remove applyPermissionsToChannels route + dead copy helper"
```

---

## Self-Review

**Spec coverage:**
- Resolver cascade type-first → Tasks 1 (`getAllChannelUserPermissions`) + 2 (`getPermissions`). ✓
- Remove copy-on-create → Task 3. ✓
- Remove "Apply to channels" route + UI → Tasks 5 (UI/i18n) + 6 (route + helper). ✓
- Live republish on category mutation → Task 4. ✓
- Leave existing copied overrides as-is (no migration) → no migration task; channel-level rows naturally outrank category (Task 1 precedence). ✓
- Tests: resolver unit tests, type-first edge case, VIEW_CHANNEL visibility, affected-users helper, updated inheritance tests. ✓
- i18n cleanup across 7 locales → Task 5. ✓

**Placeholder scan:** No TBD/TODO; every code step contains complete code. ✓

**Type consistency:** `getAffectedUserIdsForCategoryTarget` / `getAffectedOnlineUserIdsForCategoryTarget` accept `{ userId?: number; roleId?: number }` consistently across definition (Task 4 Step 3) and call sites (Task 4 Steps 5-6). `getAllChannelUserPermissions(userId: number)` signature unchanged; imported in tests (Tasks 1, 3) and used as `effective[channelId]?.permissions[...]` matching its `Record<number, { channelId; permissions }>` return. `publishChannelPermissions(affectedUserIds: number[])` matches Task 4 call sites. ✓

**Sequencing:** Client stops calling `applyPermissionsToChannels` (Task 5) before the server route is removed (Task 6), avoiding a transient client type break. Cascade lands (Tasks 1-2) before copy-on-create removal (Task 3) so effective resolution is correct when tests assert it. ✓
