# Expanded Channel Permissions — Design Spec

**Issue:** #7 (granular roles & permissions) — sub-project #2 of 6.
**Date:** 2026-06-08
**Status:** Approved (autonomous), implementing.
**Branch:** development

## Context

Per-channel permission overrides already exist end-to-end: `channelRolePermissions`
and `channelUserPermissions` (allow/deny per role and per user), generic
resolution, and a channel-settings overrides UI that auto-renders every
`ChannelPermission` enum value. Today the enum only covers `VIEW_CHANNEL`,
`SEND_MESSAGES`, `JOIN`, `SPEAK`, `SHARE_SCREEN`, `WEBCAM`.

Key property of the model (`hasChannelPermission`, `wss.ts`): **non-private
channels grant every channel permission automatically** (`if (!channel.private)
return true`). Granular overrides only apply in **private** channels. This makes
adding new channel permissions purely additive and low-risk: normal channels are
unaffected; private channels gain finer control.

## Decision

Add two high-value, gaming-oriented per-channel permissions with clear single
enforcement points:

- **`ADD_REACTIONS`** — react to messages in the channel.
- **`ATTACH_FILES`** — attach files to messages in the channel.

(Other candidates — embed links, manage messages, mention everyone — are out of
scope: they either lack an enforcement point today or overlap server-level
permissions. They can be added later the same way.)

## Changes

1. **Enum** (`packages/shared/src/statics/permissions.ts`): add `ADD_REACTIONS`
   and `ATTACH_FILES` to `ChannelPermission`.
2. **Enforcement:**
   - `toggle-message-reaction.ts`: after `assertChannelAccess`, require
     `needsChannelPermission(channelId, ADD_REACTIONS)`.
   - `send-message.ts`: inside the "has files" block, require
     `needsChannelPermission(channelId, ATTACH_FILES)`.
3. **UI/i18n** (`en/permissions.json`): add `channel.ADD_REACTIONS`,
   `channel.ATTACH_FILES`, and matching `channelDescriptions.*`. The permission
   list UI auto-extends from the enum.

No DB migration is required: overrides are stored as free-text permission names,
and the new values resolve through the existing generic path.

## Behaviour

- Non-private channel: `ADD_REACTIONS` / `ATTACH_FILES` always allowed.
- Private channel: denied unless an allow override exists for the user or one of
  their roles (consistent with the other channel permissions).
- Owner bypasses all channel permission checks (unchanged).

## Testing

- Private channel, no override → reacting is rejected; attaching files is
  rejected.
- Private channel, role/user override allowing the permission → action succeeds.
- Non-private channel → both actions succeed without any override.

## Out of scope

Embed links, per-channel manage-messages, mention-everyone, external emojis,
category→channel permission sync (sub-project #6).
