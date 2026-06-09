# Role Attributes (Hoist, Icons, Mentionable) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add three Discord-style role attributes — `hoist` (display separately, with a grouped member list), an uploaded role `icon`, and `is_mentionable` (with a per-user over-ping opt-out) — to Bullshark.

**Architecture:** One non-destructive migration adds `hoist`, `icon_file_id`, `is_mentionable` to `roles`. `update-role` accepts the three fields behind the existing rank check. The role icon reuses the avatar temp-file → `fileManager.saveFile` flow. Role mentions are a new tiptap chip + a renderer override; the existing client-side `hasMention` notification path is extended to match a user's roles, minus a server-persisted mute set (from the server-user-settings sub-project).

**Tech Stack:** Bun, Drizzle ORM (SQLite), tRPC, Zod, React, tiptap, Redux Toolkit, `bun:test`. Reference spec: `docs/superpowers/specs/2026-06-09-role-attributes-design.md`. **Depends on:** `2026-06-09-server-user-settings.md` (mute storage) — land that plan first.

---

## File Structure

**Shared**
- `packages/shared/src/.../has-mention.ts` (wherever `hasMention` is defined and exported) — extend to detect role mentions (modify).
- `FileSaveType` enum (find via `grep -rn "enum FileSaveType" packages/shared/src`) — add `ROLE_ICON` (modify).

**Server**
- `apps/server/src/db/schema.ts` — add `hoist`, `iconFileId`, `isMentionable` + `roles_hoist_idx` (modify).
- `apps/server/src/db/migrations/00XX_*.sql` + `meta/` — generated `ALTER TABLE ... ADD COLUMN` ×3 (create).
- `apps/server/src/routers/roles/update-role.ts` — accept the three fields (modify).
- `apps/server/src/routers/roles/change-icon.ts` — new icon upload route mirroring `users/change-avatar.ts` (create); wire in `roles/index.ts` (modify).
- `apps/server/src/routers/roles/apply-role-icon.ts` — helper mirroring `users/apply-profile-media.ts` (create).
- Tests: `apps/server/src/routers/__tests__/role-attributes.test.ts` (create).

**Client**
- `apps/client/src/components/right-sidebar/index.tsx` — grouped-by-hoist member list (modify).
- `apps/client/src/components/server-screens/server-settings/roles/update-role.tsx` — hoist toggle, mentionable toggle, icon upload/remove (modify).
- `apps/client/src/components/channel-view/text/overrides/mention-role.tsx` — role mention chip (create); register in `renderer/serializer.tsx` (modify).
- tiptap mention suggestion source — add roles (modify; find via `grep -rln "mention" apps/client/src/components/tiptap-input`).
- `apps/client/src/components/.../notification-settings*` — per-role mute toggles (modify; find via `grep -rln "browserNotificationsForMentions" apps/client/src/components`).
- `apps/client/src/features/server/messages/actions.ts` — pass own role ids + muted ids into `hasMention` (modify).

---

## Phase 1 — Schema & migration

### Task 1: Add the three columns

**Files:**
- Modify: `apps/server/src/db/schema.ts` (the `roles` table, ~line 117)

- [ ] **Step 1: Edit the `roles` table**

Add the three columns and an index:

```ts
color: text('color').notNull().default('#ffffff'),
position: integer('position').notNull().default(0),
hoist: integer('hoist', { mode: 'boolean' }).notNull().default(false),
iconFileId: integer('icon_file_id').references(() => files.id, {
  onDelete: 'set null'
}),
isMentionable: integer('is_mentionable', { mode: 'boolean' })
  .notNull()
  .default(false),
```

In the index list for `roles`, add:

```ts
index('roles_hoist_idx').on(t.hoist),
```

- [ ] **Step 2: Generate the migration**

Run: `cd apps/server && bun run db:gen`
Expected: a new `00XX_*.sql` with **only** `ALTER TABLE \`roles\` ADD \`hoist\` ...`, `ADD \`icon_file_id\` ...`, `ADD \`is_mentionable\` ...` and the `CREATE INDEX`. **Verify there is no table rebuild** (`CREATE TABLE __new_roles` / `DROP TABLE`). If drizzle emits a rebuild, stop and re-do as plain `ADD COLUMN` by hand — a rebuild would cascade-wipe `user_roles`/`role_permissions` (see `drizzle-migration-cascade-gotcha`).

- [ ] **Step 3: Verify parity**

Run: `cd apps/server && bun run db:check`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add apps/server/src/db/schema.ts apps/server/src/db/migrations
git commit -m "feat(roles): add hoist, icon_file_id, is_mentionable columns"
```

---

## Phase 2 — `update-role` accepts the new fields

### Task 2: Persist hoist + isMentionable via update-role

**Files:**
- Modify: `apps/server/src/routers/roles/update-role.ts`
- Test: `apps/server/src/routers/__tests__/role-attributes.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, test } from 'bun:test';
import { initTest } from '../../__tests__/helpers';

describe('role attributes — update-role', () => {
  test('owner can set hoist and isMentionable', async () => {
    const { caller: owner } = await initTest();
    const roleId = await owner.roles.add();
    await owner.roles.update({
      roleId,
      name: 'Hoisted',
      color: '#00ff00',
      hoist: true,
      isMentionable: true,
      permissions: [],
      storageQuotaOverrideEnabled: false,
      storageSpaceQuota: 0
    });
    const all = await owner.roles.getAll();
    const role = all.find((r) => r.id === roleId)!;
    expect(role.hoist).toBe(true);
    expect(role.isMentionable).toBe(true);
  });
});
```

- [ ] **Step 2: Run it to verify failure**

Run: `cd apps/server && bun test src/routers/__tests__/role-attributes.test.ts`
Expected: FAIL (zod rejects unknown `hoist`/`isMentionable`, or they are not persisted).

- [ ] **Step 3: Extend the input + the update**

In `update-role.ts`, add to the zod object:

```ts
hoist: z.boolean(),
isMentionable: z.boolean(),
```

And in the `.set({ ... })`:

```ts
.set({
  name: input.name,
  color: input.color,
  hoist: input.hoist,
  isMentionable: input.isMentionable,
  storageQuotaOverrideEnabled: input.storageQuotaOverrideEnabled,
  storageSpaceQuota: input.storageSpaceQuota
})
```

(The rank check `assertOutranksRole` already runs above — no new enforcement needed.)

- [ ] **Step 4: Run the test**

Run: `cd apps/server && bun test src/routers/__tests__/role-attributes.test.ts`
Expected: PASS.

- [ ] **Step 5: Update existing callers**

`update-role`'s input now requires `hoist` + `isMentionable`. Find existing server tests/clients that call `roles.update` (`grep -rn "roles.update(" apps/server/src apps/client/src`) and add `hoist: false, isMentionable: false` (or the role's current values) to each call so they still typecheck. The client editor is updated in Task 6.

- [ ] **Step 6: Run roles + role-hierarchy tests**

Run: `cd apps/server && bun test src/routers/__tests__/roles.test.ts src/routers/__tests__/role-hierarchy.test.ts src/routers/__tests__/role-attributes.test.ts`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add apps/server/src/routers/roles/update-role.ts apps/server/src/routers/__tests__/role-attributes.test.ts
git commit -m "feat(roles): update-role persists hoist and isMentionable"
```

---

## Phase 3 — Role icon upload

### Task 3: `FileSaveType.ROLE_ICON`

**Files:**
- Modify: the `FileSaveType` enum (`grep -rn "enum FileSaveType" packages/shared/src`)

- [ ] **Step 1: Add the enum member**

```ts
ROLE_ICON = 'role_icon',
```

- [ ] **Step 2: Handle it in the file manager**

Find where `FileSaveType` decides the save path/dir (`grep -rn "FileSaveType.AVATAR" apps/server/src`). Add a `ROLE_ICON` case mirroring `AVATAR` (same directory rules, image-only). If the switch has a `default`, ROLE_ICON can reuse the avatar branch; otherwise add an explicit case.

- [ ] **Step 3: Typecheck shared + server**

Run: `cd packages/shared && bun run check-types && cd ../../apps/server && bun run check-types`
Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add packages/shared/src apps/server/src/utils/file-manager.ts
git commit -m "feat(roles): add ROLE_ICON file save type"
```

### Task 4: `apply-role-icon` helper + `change-icon` route

**Files:**
- Create: `apps/server/src/routers/roles/apply-role-icon.ts`
- Create: `apps/server/src/routers/roles/change-icon.ts`
- Modify: `apps/server/src/routers/roles/index.ts`
- Test: append to `apps/server/src/routers/__tests__/role-attributes.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
describe('role attributes — icon', () => {
  test('clearing icon sets icon_file_id to null', async () => {
    const { caller: owner } = await initTest();
    const roleId = await owner.roles.add();
    // no temp file => clears the icon
    await owner.roles.changeIcon({ roleId });
    const all = await owner.roles.getAll();
    expect(all.find((r) => r.id === roleId)!.iconFileId ?? null).toBeNull();
  });
});
```

- [ ] **Step 2: Run it to verify failure**

Run: `cd apps/server && bun test src/routers/__tests__/role-attributes.test.ts`
Expected: FAIL (`roles.changeIcon` undefined).

- [ ] **Step 3: Implement `apply-role-icon.ts`** (mirror `users/apply-profile-media.ts`)

```ts
import { FileSaveType, Permission, PROFILE_MEDIA_EXTENSIONS } from '@sharkord/shared';
import { eq } from 'drizzle-orm';
import { db } from '../../db';
import { removeFile } from '../../db/mutations/files';
import { publishRole } from '../../db/publishers';
import { roles } from '../../db/schema';
import { fileManager } from '../../utils/file-manager';
import { invariant } from '../../utils/invariant';
import type { Context } from '../../utils/trpc';

const applyRoleIcon = async (
  ctx: Context,
  roleId: number,
  fileId: string | undefined
): Promise<void> => {
  const role = await db
    .select()
    .from(roles)
    .where(eq(roles.id, roleId))
    .limit(1)
    .get();

  invariant(role, { code: 'NOT_FOUND', message: 'Role not found' });

  if (fileId) {
    const tempFile = fileManager.getTemporaryFile(fileId);
    invariant(tempFile, { code: 'NOT_FOUND', message: 'Temporary file not found' });
    if (!PROFILE_MEDIA_EXTENSIONS.includes(tempFile.extension)) {
      throw new Error('Invalid file type. Please try again.');
    }
    if (!fileManager.temporaryFileHasMimeType(fileId, 'image/')) {
      throw new Error('Invalid file type. Please try again.');
    }
  }

  if (role.iconFileId) {
    await removeFile(role.iconFileId);
    await db.update(roles).set({ iconFileId: null }).where(eq(roles.id, roleId)).run();
  }

  if (fileId) {
    const newFile = await fileManager.saveFile(fileId, ctx.userId, FileSaveType.ROLE_ICON);
    await db.update(roles).set({ iconFileId: newFile.id }).where(eq(roles.id, roleId)).run();
  }

  publishRole(roleId, 'update');
};

export { applyRoleIcon };
```

- [ ] **Step 4: Implement `change-icon.ts`**

```ts
import { OWNER_ROLE_ID, Permission } from '@sharkord/shared';
import { z } from 'zod';
import { assertOutranksRole } from '../../helpers/assert-rank';
import { protectedProcedure } from '../../utils/trpc';
import { applyRoleIcon } from './apply-role-icon';

const changeIconRoute = protectedProcedure
  .input(z.object({ roleId: z.number().min(1), fileId: z.string().optional() }))
  .mutation(async ({ ctx, input }) => {
    await ctx.needsPermission(Permission.MANAGE_ROLES);
    if (input.roleId !== OWNER_ROLE_ID) {
      await assertOutranksRole(ctx.userId, input.roleId);
    }
    await applyRoleIcon(ctx, input.roleId, input.fileId);
  });

export { changeIconRoute };
```

- [ ] **Step 5: Wire into `roles/index.ts`**

Add `import { changeIconRoute } from './change-icon';` and `changeIcon: changeIconRoute,` to the router object.

- [ ] **Step 6: Run the test**

Run: `cd apps/server && bun test src/routers/__tests__/role-attributes.test.ts`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add apps/server/src/routers/roles/apply-role-icon.ts apps/server/src/routers/roles/change-icon.ts apps/server/src/routers/roles/index.ts apps/server/src/routers/__tests__/role-attributes.test.ts
git commit -m "feat(roles): role icon upload route"
```

---

## Phase 4 — Mentionable roles (shared detection)

### Task 5: Extend `hasMention` for role mentions

**Files:**
- Modify: the `hasMention` definition in `@sharkord/shared` (`grep -rn "export.*hasMention\|const hasMention" packages/shared/src`)
- Test: the shared test file next to it (create if absent)

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, test } from 'bun:test';
import { hasMention } from '../has-mention'; // adjust path to the actual file

const userChip = (id: number) =>
  `<span data-type="mention" data-id="${id}">@x</span>`;
const roleChip = (id: number) =>
  `<span data-type="mention-role" data-id="${id}">@r</span>`;

describe('hasMention with roles', () => {
  test('direct user mention still matches', () => {
    expect(hasMention(userChip(1), 1, [], [])).toBe(true);
  });
  test('role mention matches when user holds the role and it is not muted', () => {
    expect(hasMention(roleChip(5), 1, [5], [])).toBe(true);
  });
  test('role mention does not match when the role is muted', () => {
    expect(hasMention(roleChip(5), 1, [5], [5])).toBe(false);
  });
  test('role mention does not match a role the user lacks', () => {
    expect(hasMention(roleChip(5), 1, [9], [])).toBe(false);
  });
});
```

- [ ] **Step 2: Run it to verify failure**

Run: `cd packages/shared && bun test` (target the new test file)
Expected: FAIL (signature mismatch — `hasMention` currently takes `(content, ownUserId)`).

- [ ] **Step 3: Extend the signature**

Change `hasMention` to:

```ts
const hasMention = (
  content: string | null | undefined,
  ownUserId: number | undefined,
  ownRoleIds: number[] = [],
  mutedRoleMentionIds: number[] = []
): boolean => {
  if (!content || ownUserId === undefined) return false;

  // existing user-mention detection (keep the current regex/parse):
  const directlyMentioned = /* existing logic matching data-type="mention" data-id={ownUserId} */;
  if (directlyMentioned) return true;

  if (ownRoleIds.length === 0) return false;
  const muted = new Set(mutedRoleMentionIds);
  const roleMentionRegex = /data-type="mention-role"[^>]*data-id="(\d+)"/g;
  let m: RegExpExecArray | null;
  while ((m = roleMentionRegex.exec(content)) !== null) {
    const roleId = Number(m[1]);
    if (ownRoleIds.includes(roleId) && !muted.has(roleId)) return true;
  }
  return false;
};
```

> Implementer note: preserve the **exact** existing user-mention matching (copy the current body into `directlyMentioned`). The default params keep existing 2-arg callers working.

- [ ] **Step 4: Run the test**

Run: `cd packages/shared && bun test` (the new file)
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/shared/src
git commit -m "feat(roles): hasMention detects unmuted role mentions"
```

### Task 6: Feed roles + mutes into the notification path

**Files:**
- Modify: `apps/client/src/features/server/messages/actions.ts` (the `hasMention(targetMessage.content, ownUserId)` call ~line 162)
- Modify: `apps/client/src/features/server/helpers.ts` (the `hasMention(message.content, ownUserId)` call ~line 38)

- [ ] **Step 1: Pass own role ids + muted ids**

At each call site, gather the current user's role ids (reuse the existing user-roles selector/hook used elsewhere — `grep -rn "useUserRoles\|getUserRoleIds\|userRoles" apps/client/src/features`) and the muted ids from `mutedRoleMentionIdsSelector` (added in the server-user-settings plan). Update the calls:

```ts
const ownRoleIds = /* current user's role ids from the store */;
const mutedRoleIds = mutedRoleMentionIdsSelector(state);
const isMentioned = hasMention(
  targetMessage.content ?? null,
  ownUserId,
  ownRoleIds,
  mutedRoleIds
);
```

- [ ] **Step 2: Typecheck**

Run: `cd apps/client && bun --bun run check-types`
Expected: only the two known pre-existing errors.

- [ ] **Step 3: Commit**

```bash
git add apps/client/src/features/server/messages/actions.ts apps/client/src/features/server/helpers.ts
git commit -m "feat(roles): role mentions trigger notifications unless muted"
```

---

## Phase 5 — Client UI

### Task 7: Role editor — hoist, mentionable, icon

**Files:**
- Modify: `apps/client/src/components/server-screens/server-settings/roles/update-role.tsx`

- [ ] **Step 1: Add the two toggles + icon control**

- A "Display separately (hoist)" switch bound to `values.hoist`.
- An "Allow anyone to @mention this role" switch bound to `values.isMentionable`.
- An icon upload + remove control mirroring the avatar control (find the avatar upload component via `grep -rln "changeAvatar\|temporaryFile\|upload" apps/client/src/components/server-screens/user-settings`). On select, upload the temp file and call `trpc.roles.changeIcon.mutate({ roleId, fileId })`; on remove, call `trpc.roles.changeIcon.mutate({ roleId })`.
- Include `hoist` and `isMentionable` in the `roles.update` payload (the input now requires them).
- Keep the existing `lockedByRank` disabling on all three new controls.

- [ ] **Step 2: i18n keys**

Add to `apps/client/src/i18n/locales/en/settings.json` (and copy the English value into the other locale files as placeholders): `roleHoistLabel`, `roleMentionableLabel`, `roleIconLabel`, `roleIconRemove`.

- [ ] **Step 3: Typecheck**

Run: `cd apps/client && bun --bun run check-types`
Expected: only the two known pre-existing errors.

- [ ] **Step 4: Commit**

```bash
git add apps/client/src/components/server-screens/server-settings/roles/update-role.tsx apps/client/src/i18n/locales
git commit -m "feat(roles): hoist/mentionable toggles + icon upload in role editor"
```

### Task 8: Grouped member list

**Files:**
- Modify: `apps/client/src/components/right-sidebar/index.tsx`

- [ ] **Step 1: Group members by highest hoisted role**

- For each shown user, resolve their roles (reuse the user-roles hook used by the nickname badge from sub-project #1). Their group = the hoisted role with the highest `position`; if none, the default "Members" group.
- Build an ordered list of groups: hoisted roles that have ≥1 member, sorted by `position` desc, each rendered with a header (role name in the role's resolved colour + role icon if `iconFileId`), followed by the default "Members" group.
- Render each user once under their group, preserving the `MAX_USERS_TO_SHOW` cap across the flattened order.
- Add an i18n key `membersDefaultGroup` ("Members") in `en/sidebar.json` (+ other locales).

- [ ] **Step 2: Typecheck**

Run: `cd apps/client && bun --bun run check-types`
Expected: only the two known pre-existing errors.

- [ ] **Step 3: Commit**

```bash
git add apps/client/src/components/right-sidebar/index.tsx apps/client/src/i18n/locales
git commit -m "feat(roles): group member list by hoisted role"
```

### Task 9: `@role` mention chip + autocomplete

**Files:**
- Create: `apps/client/src/components/channel-view/text/overrides/mention-role.tsx`
- Modify: `apps/client/src/components/channel-view/text/renderer/serializer.tsx`
- Modify: the tiptap mention suggestion source (`grep -rln "mention" apps/client/src/components/tiptap-input`)

- [ ] **Step 1: Role mention chip override** (mirror `overrides/mention.tsx`)

```tsx
import { memo } from 'react';

type TMentionRoleOverrideProps = { roleId: number };

const MentionRoleOverride = memo(({ roleId }: TMentionRoleOverrideProps) => {
  // resolve the role from the store (reuse the roles selector used elsewhere);
  // render @name in the role's resolved colour with its icon, styled like the
  // user mention chip. Fall back to "@unknown-role" if the role is gone.
  return /* chip JSX mirroring MentionChip */;
});

export { MentionRoleOverride };
```

- [ ] **Step 2: Register in the serializer**

In `serializer.tsx`, alongside the existing `data-type === 'mention'` branch, add a branch for `data-type === 'mention-role'` that reads `data-id` and renders `<MentionRoleOverride roleId={Number(id)} />`.

- [ ] **Step 3: Add roles to the mention autocomplete**

In the tiptap mention suggestion source, in addition to users, list roles:
- Show roles where `isMentionable === true` to everyone.
- Show non-mentionable roles only when the current user has `MANAGE_ROLES` (reuse the existing permission check used elsewhere in settings).
- On select, insert a node serialising to `data-type="mention-role" data-id="<roleId>"`.

- [ ] **Step 4: Typecheck**

Run: `cd apps/client && bun --bun run check-types`
Expected: only the two known pre-existing errors.

- [ ] **Step 5: Commit**

```bash
git add apps/client/src/components/channel-view/text/overrides/mention-role.tsx apps/client/src/components/channel-view/text/renderer/serializer.tsx apps/client/src/components/tiptap-input
git commit -m "feat(roles): @role mention chip and autocomplete"
```

### Task 10: Per-role mute toggles in notification settings

**Files:**
- Modify: the notification settings UI (`grep -rln "browserNotificationsForMentions" apps/client/src/components`)

- [ ] **Step 1: Add a "mute @mentions of this role" list**

- List the server's roles (reuse the roles selector). For each, a switch reflecting whether its id is in `mutedRoleMentionIdsSelector`.
- On toggle ON: `store.dispatch(appSliceActions.setMutedRoleMention({ roleId, muted: true }))` then `writeUserSetting(\`muted_role_mention:${roleId}\`, true)`.
- On toggle OFF: dispatch `{ muted: false }` then `clearUserSetting(\`muted_role_mention:${roleId}\`)`.
- Add i18n keys `mutedRoleMentionsLabel` / `mutedRoleMentionsHint`.

- [ ] **Step 2: Typecheck**

Run: `cd apps/client && bun --bun run check-types`
Expected: only the two known pre-existing errors.

- [ ] **Step 3: Commit**

```bash
git add apps/client/src/components apps/client/src/i18n/locales
git commit -m "feat(roles): per-role @mention mute toggles in notification settings"
```

---

## Phase 6 — Verification

### Task 11: Suite, typecheck, lint

- [ ] **Step 1:** `cd packages/shared && bun test` → PASS.
- [ ] **Step 2:** `cd apps/server && bun test` → all PASS.
- [ ] **Step 3:** `cd apps/server && bun run check-types && bun run lint` → clean.
- [ ] **Step 4:** `cd apps/client && bun --bun run check-types` → only the two known pre-existing errors.
- [ ] **Step 5 (if formatting changed):** `git add -A && git commit -m "chore(roles): lint/format for role attributes"`

---

## Notes & constraints

- Migration is `ADD COLUMN` ×3 — non-destructive (hard requirement; see `drizzle-migration-cascade-gotcha`). Verify no table rebuild in Task 1 Step 2.
- The mute set is stored server-side via the server-user-settings sub-project — land that plan first.
- Branch: `development`. Role icon reuses the avatar temp-file upload flow (`fileManager.saveFile`).

## Self-review

- **Spec coverage:** columns (Task 1) ✓; hoist persist + grouped list (Tasks 2, 8) ✓; icon upload + render (Tasks 3, 4, 7, 8, 9) ✓; mentionable persist + chip + autocomplete visibility (Tasks 2, 9) ✓; hasMention role detection + mute (Tasks 5, 6) ✓; per-role mute UI (Task 10) ✓.
- **Placeholders:** the chip JSX (Task 9), the existing user-mention body in `hasMention` (Task 5), and several "find via grep" file locations are reference-pattern instructions against named existing components (mirroring how the role-hierarchy plan handled client/tiptap work) — not silent TODOs. All server logic and tests are complete code.
- **Type consistency:** `changeIcon({ roleId, fileId })`, `applyRoleIcon`, `FileSaveType.ROLE_ICON`, `hasMention(content, ownUserId, ownRoleIds, mutedRoleMentionIds)`, `setMutedRoleMention`, `mutedRoleMentionIdsSelector` are used consistently across tasks and match the server-user-settings plan.
