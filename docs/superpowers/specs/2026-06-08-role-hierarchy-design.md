# Role Hierarchy — Design Spec

**Issue:** #7 (Système de rôles et permissions granulaire) — sub-project #1 of 6.
**Date:** 2026-06-08
**Status:** Approved design, pending implementation plan.
**Branch:** development

## Context

Issue #7 asks for a granular role & permission system. An architecture review
showed Bullshark/Sharkord already has more than expected:

- **Server-level roles**: `roles` table (`name`, `color`, `isPersistent`,
  `isDefault`, storage quota override), M:N `userRoles`, `rolePermissions`, a
  24-value `Permission` enum, and a full roles admin UI (color picker,
  permission toggles, default role, delete). Resolution is additive (OR across a
  user's roles); `OWNER_ROLE_ID` (id 1) bypasses everything.
- **Channel-level permissions already exist and are wired**: `channelRolePermissions`
  and `channelUserPermissions` (allow/deny per role and per user), a
  `ChannelPermission` enum, precedence (user override > role override, private
  channels gated by `VIEW_CHANNEL`), and a complete channel-settings overrides UI.

The one **structural** gap is **role hierarchy**: there is no `position` column,
so roles are a flat list. Consequences today:

- Nothing stops a moderator from editing/deleting an admin role or moderating a
  higher-ranked user.
- The displayed nickname color / role badge already assumes a "top role"
  (`nickname-badge` uses `roles[0]`), but the order is currently arbitrary.

This sub-project introduces a Discord-style role hierarchy. The other five
sub-projects (expanded channel permissions, hoist + grouped member list, role
icons, mentionable roles, category permission sync) are tracked separately and
out of scope here.

## Decisions (locked during brainstorming)

1. **Enforcement surface:** full Discord model — hierarchy gates both role
   management AND user moderation.
2. **Nickname color precedence:** personal color (feat #15) wins; role color is
   the fallback.
3. **Role color resolution:** use the highest role with an explicitly-set color;
   roles left at the default are skipped. To distinguish "no color" from white,
   `roles.color` becomes nullable (`NULL` = no color).

## Data model

### `roles.position`
- New column `position integer NOT NULL`.
- Convention: **higher number = higher rank**. Positions are contiguous and
  unique across the roles table.
- Invariants:
  - **Owner** (id `OWNER_ROLE_ID` = 1): always the maximum position,
    **not movable**. (Already bypasses all permission checks.)
  - **Default role** (`isDefault`, seeded as "Member"): always **position 0**,
    not movable. Equivalent to Discord `@everyone`.
  - All other roles occupy `1 … N`.

### `roles.color`
- Becomes **nullable**. `NULL` means "no color set" and is skipped during color
  resolution. A non-null value is an explicit color.

## Semantics & resolution

- **Member rank** = `max(position)` across the user's roles. A user with the
  owner role ranks above everyone (treated as top / `+∞`).
- **Displayed nickname color** (in order):
  1. Personal nickname color (feat #15 `users.nicknameColor`) if set → wins.
  2. Else the color of the **highest-position role whose `color` is non-NULL**
     (lower, uncolored roles are skipped).
  3. Else the theme default.
- **Role badge** (`nickname-badge` `roles[0]`): `roles[0]` is now defined as the
  highest-position role. `getUserRoleIds` / `getUserRoles` / the client
  `useUserRoles` hook return roles **ordered by `position` desc**, making the
  previously-arbitrary order deterministic.

## Enforcement (full Discord model)

A server helper `getActorTopPosition(userId)` returns the actor's rank (owner →
top sentinel). All checks below are bypassed when the actor has the owner role.
Comparisons are **strict** (equal rank is denied).

| Action | Rule |
|---|---|
| Edit / delete / reorder a role | `actorTop > role.position` |
| Assign / remove a role to/from a member | `actorTop > role.position` |
| Moderate a member (ban / kick / manage, remove their roles) | `actorTop > targetTop` |
| Reorder | may not place a role at a position `>= actorTop` |

- The default role cannot be deleted (already enforced) nor moved.
- Owner role cannot be edited away from the top nor deleted (already persistent).

**Application points** (return `FORBIDDEN` on failure):
`roles/update`, `roles/delete`, new `roles/reorder`, `users/add-role`,
`users/remove-role`, and the ban/kick moderation mutations in the users router.
These complement the existing `MANAGE_ROLES` / `MANAGE_USERS` permission checks —
the actor still needs the permission AND must outrank the target.

## API

- `position` is included in the role payload (automatic via `getTableColumns`).
- New **`roles.reorder`** procedure: accepts the desired ordering, recomputes
  contiguous positions, validates enforcement (cannot move at/above own rank,
  owner/default stay pinned), and publishes the existing roles-update event.
- `roles.update`: no longer changes position (delegated to `reorder`); accepts
  `color = null`.

## UI

- `roles-list.tsx`: drag-and-drop reordering. Owner and default roles are
  pinned; drag handles are disabled for roles at or above the actor's rank.
- `update-role.tsx`: a "no color" affordance (sets `color` to `NULL`); all
  controls disabled when the role is at or above the actor's rank.
- Role-assignment UI (users): hide/disable roles at or above the actor's rank.
- Member list / badge: order by `position`.

## Migration & backfill

- Drizzle migration: `ALTER TABLE roles ADD COLUMN position`; make `color`
  nullable.
- Backfill:
  - Owner → max position; default role → 0; remaining existing roles → `1 … N`
    by creation order (`id`).
  - `color` equal to `#ffffff` / `#FFFFFF` (the old default) → `NULL`.
- Production note: prod migrations are applied manually and the build is
  CI/Linux-only (local Windows build fails) — see project memory.

## Testing

- Rank resolution: multi-role users, owner sentinel.
- Enforcement: edit/assign/reorder/moderation denied at equal or higher rank;
  owner bypass; permission-present-but-outranked is denied.
- Color resolution: personal color wins; highest non-null role color otherwise;
  uncolored roles skipped; falls back to theme default.
- Position invariants: owner stays top, default stays 0, positions remain
  contiguous and unique after create/delete/reorder.

## Out of scope (other #7 sub-projects)

Expanded `ChannelPermission` set, hoist + grouped member list, role icons,
mentionable roles (`@role`), category→channel permission sync.
