# Server-Persisted User Settings — Design

**Issue:** #7 (Système de rôles et permissions granulaire) — supporting foundation
for sub-project #5 (mentionable roles opt-out), but generally useful.

## Summary

Today, per-user preferences (browser-notification toggles, auto-join, etc.) live
only in the client `app` Redux slice, backed by `localStorage`. They do not
follow the user across browsers or devices. This sub-project moves the genuine
**user preferences** to the server so they persist per-account, and introduces a
generic key-value store that future settings can reuse without a migration.

The role-mention mute opt-out from sub-project #5 is the first new consumer.

## Data model

New table (`apps/server/src/db/schema.ts`):

```ts
const userSettings = sqliteTable(
  'user_settings',
  {
    userId: integer('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    key: text('key').notNull(),
    value: text('value').notNull(), // JSON-encoded scalar (bool/number/string/array)
    updatedAt: integer('updated_at').notNull()
  },
  (t) => [
    primaryKey({ columns: [t.userId, t.key] }),
    index('user_settings_user_idx').on(t.userId)
  ]
);
```

**Migration:** a single `CREATE TABLE` (+ index). Non-destructive — no existing
table is touched, so no cascade risk (see
`drizzle-migration-cascade-gotcha`). New installs get it from the schema; existing
installs get it from the embedded migration on container start.

`value` is JSON so the same table holds booleans, strings, and the variable-length
list implied by role-mention mutes (stored as individual rows, see below).

## Settings that migrate to the server

| Setting key                          | Type | Source today (`app` slice) |
|--------------------------------------|------|----------------------------|
| `browser_notifications`              | bool | `browserNotifications`     |
| `browser_notifications_mentions`     | bool | `browserNotificationsForMentions` |
| `browser_notifications_dms`          | bool | `browserNotificationsForDms` |
| `browser_notifications_replies`      | bool | `browserNotificationsForReplies` |
| `auto_join_last_channel`             | bool | `autoJoinLastChannel`      |
| `muted_role_mention:<roleId>`        | bool=true (presence = muted) | new (sub-project #5) |

**Stay device-local** (intentionally not migrated — they are device-specific):
sidebar widths (`RIGHT_SIDEBAR_WIDTH`, …), open/closed sidebar states,
`voiceChatSidebar*`, `pluginSlotDebug`, and all ephemeral runtime state.

## API

New router `apps/server/src/routers/users/settings/` (or `routers/settings/`),
mounted under the existing protected router:

- `userSettings.getAll` → `Record<string, unknown>` for `ctx.userId` (parsed JSON).
- `userSettings.set({ key, value })` → upsert one row (`value` JSON-encoded),
  bump `updatedAt`. Validates `key` against an allowlist of known prefixes/keys
  to prevent arbitrary writes.
- `userSettings.delete({ key })` → used to clear a `muted_role_mention:<roleId>`
  row (un-mute). Optional; `set(key,false)` is also acceptable — pick one in the
  plan and be consistent.

Browser-notification permission prompting stays client-side; the server only
stores the user's *intent* toggles.

## Client integration

- On login/app-load, call `userSettings.getAll` and seed the relevant `app`-slice
  fields from it (falling back to defaults when a key is absent). Remove the
  `localStorage` reads for the migrated keys; keep them only for device-local
  ones.
- Each migrated toggle's setter dispatches the Redux update **and** calls
  `userSettings.set`. Keep the UI optimistic; on failure, toast + revert.
- A small `useUserSetting` hook centralises read/write so feature code does not
  re-implement the round-trip.
- **One-time client migration:** on first load after the update, if a migrated
  `localStorage` key exists and no server value is present yet, push the local
  value up via `set`, then stop reading that key locally. This preserves each
  user's existing local choices instead of resetting them — consistent with the
  product principle that updates never make users start over.

## Behaviour

- Settings read at login reflect the account, not the device.
- Changing a toggle on device A is visible on device B after its next
  `getAll` (login / reconnect). Live cross-device push is out of scope.
- Owner and all users have settings; no permission gating beyond "own settings
  only" (`ctx.userId`).

## Testing

- Server: `userSettings.set` upserts and `getAll` returns parsed values for the
  caller only (not other users'); key allowlist rejects unknown keys.
- Server: deleting / setting-false a `muted_role_mention:<roleId>` round-trips.
- Client: typecheck clean (besides the two known pre-existing errors).

## Out of scope

- Live cross-device settings push (only refreshed on login/reconnect).
- Migrating device-local UI layout settings.
- Server-side enforcement of notification delivery (notifications remain a
  client concern).

## Self-review

- **Placeholders:** none. The `delete` vs `set(false)` choice is explicitly left
  to the plan with a "be consistent" instruction.
- **Consistency:** migration is `CREATE TABLE` only → matches the non-destructive
  constraint; key-value shape matches the approved storage decision.
- **Scope:** single foundational store + a defined migration list; focused enough
  for one implementation plan.
- **Ambiguity:** "settings that migrate" is an explicit table; device-local set is
  enumerated.
