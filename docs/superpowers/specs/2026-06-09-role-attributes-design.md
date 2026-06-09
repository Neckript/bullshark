# Role Attributes — Hoist, Icons, Mentionable Roles — Design

**Issue:** #7 (Système de rôles et permissions granulaire) — sub-projects #3
(hoist + grouped member list), #4 (role icons), #5 (mentionable roles).

Builds on sub-project #1 (role hierarchy: `position`, rank enforcement,
`update-role` rank check) and depends on the `server-user-settings` foundation
for #5's opt-out.

## Summary

Three role attributes, each a Discord-style feature, sharing one migration on the
`roles` table:

- **#3 Hoist:** a role can be "displayed separately" — the member list groups its
  members under a coloured header.
- **#4 Icons:** a role can have an uploaded image icon, shown next to names.
- **#5 Mentionable:** a role can be `@`-mentioned; members of a mentioned role are
  notified, with a per-user opt-out to prevent over-pinging.

## Data model

Single migration, all non-destructive `ADD COLUMN` on `roles`
(`apps/server/src/db/schema.ts`):

```ts
hoist: integer('hoist', { mode: 'boolean' }).notNull().default(false),
iconFileId: integer('icon_file_id').references(() => files.id, {
  onDelete: 'set null'
}),
isMentionable: integer('is_mentionable', { mode: 'boolean' })
  .notNull()
  .default(false),
```

`TRole`/`TJoinedRole` pick these up automatically (inferred from schema).
Add an index on `hoist` (member-list grouping filters by it).

`update-role` (`apps/server/src/routers/roles/update-role.ts`) accepts the three
new fields (`hoist: boolean`, `iconFileId: number | null`,
`isMentionable: boolean`). They are gated by the existing
`assertOutranksRole(ctx.userId, input.roleId)` rank check — no new enforcement
path. The default role and owner role keep their current special handling.

## #3 — Hoist + grouped member list

**Server:** `hoist` exposed on role payloads (automatic). No new query; the client
already has user→roles and role data.

**Client** (`apps/client/src/components/right-sidebar/index.tsx`, currently a flat
list):
- Group members by their **highest-`position` hoisted role**. Each hoisted role
  with ≥1 member renders a section header (role name in the role's resolved
  colour, role icon if any), ordered by `position` desc.
- Members with no hoisted role fall into a default **"Members"** group at the
  bottom.
- Each member appears exactly once (under their top hoisted role).
- Preserve the existing `MAX_USERS_TO_SHOW` cap behaviour (apply across the
  flattened, grouped order).
- Role editor (`roles/update-role.tsx`): a "Display separately" toggle.

**Out of scope (YAGNI):** online/offline split — not present today.

## #4 — Role icons (uploaded image)

**Storage:** `icon_file_id → files.id`, reusing the existing avatar upload path
(generic file upload → set the id). Counts against the server storage quota like
any other file. Clearing the icon sets `icon_file_id = NULL`.

**Server:** `update-role` accepts `iconFileId: number | null`. Reuse the existing
file-upload route/flow used by avatars; the role editor uploads, then submits the
returned file id.

**Client:**
- Role editor: an icon upload + "remove" control mirroring the avatar control.
- Render the icon (small, ~16–20px) beside the role name in: member-list group
  headers, the nickname badge, and the `@role` mention chip.

## #5 — Mentionable roles + over-ping opt-out

**Server:** `is_mentionable` on `roles`, set via `update-role`.

**Mention chip:** the tiptap composer's mention autocomplete is extended to offer
roles in addition to users. A role mention serialises to
`data-type="mention-role" data-id="<roleId>"` (mirrors the existing
`data-type="mention"` user chip). A new renderer override
(`channel-view/text/overrides/`) renders it as a coloured `@RoleName` chip with the
role icon.

**Autocomplete visibility:** mentionable roles are offered to everyone;
non-mentionable roles are offered only to users with `MANAGE_ROLES` (Discord-style
— admins can always ping a role).

**Notification (client-side, extends existing logic in
`apps/client/src/features/server/messages/actions.ts`):** today
`hasMention(content, ownUserId)` scans the message for the user's own id. Extend
it to also match `mention-role` chips whose `roleId` is one of the user's roles:

```
isMentioned =
  directlyMentioned(content, ownUserId) ||
  content mentions a role in ownRoleIds that is NOT in mutedRoleMentionIds
```

This feeds the same browser-notification + sound path already used for `@user`
mentions. No server-side fan-out is added (none exists; `@user` is also
client-detected).

**Over-ping opt-out:** `mutedRoleMentionIds` is the set of roles the user has
muted. Stored server-side via the `server-user-settings` store as
`muted_role_mention:<roleId>` rows, so it follows the account across devices.
UI: a per-role "mute @mentions of this role" toggle in the user's notification
settings (alongside the existing mentions/dms/replies toggles), listing the
server's roles. Primary use case: muting the default **Member** role so an
`@Member` does not ping everyone who dislikes it.

## Migration order / dependencies

`server-user-settings` (Spec C) must land before #5's mute wiring, since the mute
list lives there. #3, #4, and the #5 chip/autocomplete are independent of it.

## Testing

- Server: `update-role` persists `hoist` / `iconFileId` / `isMentionable`; rank
  check still blocks non-outranking actors; clearing `iconFileId` to null works.
- Server: setting `iconFileId` to a non-existent file is rejected or ignored
  gracefully (decide in plan; FK is `set null` so a bad id would error on insert).
- Client: `hasMention` returns true for a role the user holds (unmuted), false
  when that role is muted, true for a direct user mention regardless of mutes.
- Client: typecheck clean (besides the two known pre-existing errors).

## Out of scope

- Online/offline member grouping.
- Server-side mention fan-out / a dedicated mention badge (kept on the existing
  client notification path).
- Emoji/unicode role icons (uploaded image only, per the approved decision).

## Self-review

- **Placeholders:** the bad-`iconFileId` handling and `delete` vs `set(false)`
  un-mute are explicitly deferred to the plan with guidance — not silent gaps.
- **Consistency:** migration is `ADD COLUMN` only; #5's mute storage matches Spec
  C; rank enforcement reuses sub-project #1's helper.
- **Scope:** three tightly-related role attributes in one `roles` migration —
  focused enough for one plan, with a clear dependency note on Spec C.
- **Ambiguity:** autocomplete visibility rule, grouping fallback, and "highest
  hoisted role" tie-break (by `position`) are stated explicitly.
