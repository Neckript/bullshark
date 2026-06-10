# Category → Channel Permission Sync — Design

**Issue:** #7 (Système de rôles et permissions granulaire) — sub-project #6.

## Summary

Channels already support per-role and per-user permission overrides
(`channel_role_permissions`, `channel_user_permissions`). Categories have **no**
permission overrides today. This sub-project gives categories their own overrides
and a way to push them down to their channels, so an admin can configure
permissions once at the category level and apply them to every channel inside.

The sync is a **one-shot copy** (the approved approach): applying copies the
category's current overrides into each child channel's override tables. The
runtime permission-resolution path (`channelUserCan` / `getPermissions` in
`apps/server/src/db/queries/channels.ts`) is **left unchanged** — channels are
still resolved purely from their own overrides. This keeps the
security-critical path untouched and risk low.

## Data model

Two new tables mirroring the channel ones (`apps/server/src/db/schema.ts`):

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

**Migration:** two `CREATE TABLE`s (+ indexes). Non-destructive — no existing
table is rebuilt.

## API

Mirror the channel permission routes under categories
(`apps/server/src/routers/categories/`):

- `categories.getPermissions({ categoryId })` → the category's overrides
  (mirrors `channels.get-permissions`).
- `categories.updatePermission({ categoryId, roleId|userId, permission, allow })`
  → upsert one override (mirrors `channels.update-permission`).
- `categories.deletePermissions({ categoryId, ... })` → clear overrides (mirrors
  `channels.delete-permissions`).
- `categories.applyPermissionsToChannels({ categoryId })` → **the sync action.**
  For each channel in the category: delete its existing role/user overrides and
  insert copies of the category's overrides. Wrapped in a transaction. Publishes a
  channel-permission update event per affected channel so connected clients
  refresh. Gated by `MANAGE_CHANNELS` (or the same permission the channel
  permission editor requires — match the existing channel route's guard).

All category permission routes require the same permission the channel ones do
(verify the exact `needsPermission` used in `channels/update-permission.ts` and
reuse it).

## Channel creation inheritance

When a channel is created inside a category
(`apps/server/src/routers/channels/add-channel.ts`), copy the category's current
overrides into the new channel's override tables. This makes new channels start
"in sync" with their category, matching Discord. If the channel is created with no
category, no overrides are copied (unchanged behaviour).

## Client

- The category settings UI gains a permissions editor reusing the existing
  **channel** permissions component (`server-settings` channel perms), pointed at
  the category routes.
- An "Apply to channels" button calls `applyPermissionsToChannels` with a
  confirm dialog ("This overwrites permission overrides on all channels in this
  category"). On success, toast + refetch.
- i18n keys for the editor labels, the button, and the confirm/overwrite warning.

## Behaviour

- Editing a category's overrides does **not** retroactively change channels until
  "Apply to channels" is pressed (one-shot, not live).
- "Apply to channels" replaces each child channel's overrides wholesale with the
  category's (it is a copy, not a merge).
- New channels in a category inherit the category's overrides at creation time.
- Permission resolution for messages/voice is unchanged: still channel-only.
- Owner still bypasses all channel permission checks (unchanged).

## Testing

- Server: `categories.updatePermission` upserts a category override;
  `getPermissions` returns it.
- Server: `applyPermissionsToChannels` copies category overrides onto every child
  channel, replacing pre-existing channel overrides; channels in other categories
  are untouched.
- Server: creating a channel in a category with overrides copies them; creating a
  channel with no category copies nothing.
- Server: a non-owner without the required permission is rejected on all category
  permission routes.
- Client: typecheck clean (besides the two known pre-existing errors).

## Out of scope

- Live inheritance / a `synced_with_category` flag (explicitly rejected — would
  touch the resolution path).
- Detecting/"out of sync" indicators on channels.
- Category-level *server* permissions (this is channel-permission overrides only).

## Self-review

- **Placeholders:** the exact `needsPermission` guard is to be matched from the
  existing channel route — a verification instruction, not a gap.
- **Consistency:** migration is `CREATE TABLE` only; tables mirror the channel
  ones exactly; resolution path untouched as promised by the approved one-shot
  approach.
- **Scope:** category overrides + copy action + creation inheritance — focused
  enough for one plan.
- **Ambiguity:** "copy not merge", "one-shot not live", and "no category → copy
  nothing" are stated explicitly to remove interpretation.
