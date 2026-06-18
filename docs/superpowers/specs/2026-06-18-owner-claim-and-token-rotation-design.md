# Owner Claim Banner & Token Rotation — Design

**Date:** 2026-06-18
**Status:** Approved

---

## Overview

Two complementary owner-management features:

1. **Claim Owner (Feature 1):** A sidebar banner visible to all connected users when the server has no owner, with a modal to enter the secret token and claim ownership.
2. **Rotate Owner Token (Feature 2):** An owner-only button in the Backup tab that regenerates the owner-claim token and reveals the new plaintext token once in the UI.

---

## Feature 1 — Claim Owner Banner + Modal

### Detection — "server has no owner"

**Approach:** Client-side derivation from the existing Redux store. No server changes required.

- New selector in `apps/client/src/features/server/selectors.ts`:
  ```ts
  export const serverHasOwnerSelector = createSelector(
    [usersSelector],
    (users) => users.some(u => u.roleIds.includes(OWNER_ROLE_ID))
  );
  ```
- New hook in `apps/client/src/features/server/hooks.ts`:
  ```ts
  export const useServerHasOwner = () => useSelector(serverHasOwnerSelector);
  ```

**Reactivity:** `useSecretToken` already calls `publishUser(userId, 'update')` on claim. The resulting `USER_UPDATE` WebSocket event updates the users slice, the selector recomputes, and the banner unmounts automatically — no polling, no manual refresh.

### Banner

- Location: `apps/client/src/components/left-sidebar/index.tsx`, rendered at the top of the sidebar content when `!useServerHasOwner()`.
- Uses existing UI warning/destructive styling (consistent with other system alerts).
- Contains a short translated label and a "Claim Ownership" button that opens the `ClaimOwnerDialog`.
- Disappears reactively once any user successfully claims owner.

### Modal — `apps/client/src/components/dialogs/claim-owner/index.tsx`

Pattern: identical to `components/dialogs/server-password/index.tsx`.

- Single text input for the secret token.
- Calls `trpc.others.useSecretToken.mutate({ token })` on submit.
- **Success:** closes the modal, emits a toast (translated).
- **Error (FORBIDDEN):** shows inline error "Invalid token" (translated). Does not close.
- Rate-limiting (5 requests / 60 s) is already enforced server-side — no client-side changes needed.
- Registered in the dialogs enum/factory (same pattern as all existing dialogs).

### Server changes

None. The existing `useSecretToken` route is sufficient.

---

## Feature 2 — Rotate Owner Token

### Backend — `apps/server/src/routers/others/rotate-owner-token.ts`

New mutation, owner-only:

```ts
protectedProcedure.mutation(async ({ ctx }) => {
  invariant(await isOwner(ctx.userId), { code: 'FORBIDDEN', message: 'Owner only' });
  const token = generateOwnerToken();
  await db.update(settings).set({ ownerClaimTokenHash: await hashOwnerToken(token) });
  return { token };
})
```

- Uses existing `generateOwnerToken` / `hashOwnerToken` helpers from `helpers/owner-token.ts`.
- Uses existing `isOwner` query from `db/queries/is-owner.ts`.
- No rate-limit (owner-initiated, trusted action).
- Registered in `apps/server/src/routers/others/index.ts`.

### UI — new Card in Backup tab

Location: `apps/client/src/components/server-screens/server-settings/backup/index.tsx`

The Backup tab is already gated to `isOwner`, so no additional permission check is needed in the component.

- New `Card` with title, description, and a "Regenerate Owner Token" button.
- On click: calls `trpc.others.rotateOwnerToken.mutate()`.
- **On success:** opens a **token reveal Dialog** (non-blocking, must be manually closed):
  - Displays the plaintext token in a monospace/copy-friendly box.
  - "Copy" button with confirmation feedback ("Copied!").
  - Warning text: "This token will not be shown again. Anyone with it can take over the server."
  - No auto-close — the user must explicitly dismiss.
- **On error:** toast with error message.

---

## i18n

7 locales: `cs`, `en`, `es`, `fr`, `it`, `ru`, `zh`. All locales receive full translations (no English fallback visible to end users).

### `dialogs.json` keys (Feature 1)

| Key | EN value |
|-----|----------|
| `claimOwnerBannerText` | `This server has no owner yet.` |
| `claimOwnerBannerBtn` | `Claim Ownership` |
| `claimOwnerTitle` | `Claim Server Ownership` |
| `claimOwnerDesc` | `Enter the owner token printed in the server console on first boot to claim ownership of this server.` |
| `claimOwnerTokenLabel` | `Owner Token` |
| `claimOwnerTokenPlaceholder` | `Paste your token here` |
| `claimOwnerBtn` | `Claim Ownership` |
| `claimOwnerInvalidToken` | `Invalid token.` |
| `claimOwnerSuccess` | `You are now the server owner.` |

### `settings.json` keys (Feature 2)

| Key | EN value |
|-----|----------|
| `ownerTokenTitle` | `Owner Token` |
| `ownerTokenDesc` | `Regenerate the owner-claim token. The new token will be shown once — save it somewhere safe.` |
| `ownerTokenRotateBtn` | `Regenerate Token` |
| `ownerTokenRevealTitle` | `New Owner Token` |
| `ownerTokenRevealWarning` | `This token will not be shown again. Anyone with it can take over the server.` |
| `ownerTokenCopyBtn` | `Copy` |
| `ownerTokenCopied` | `Copied!` |

---

## Files touched

### New files
- `apps/client/src/components/dialogs/claim-owner/index.tsx`
- `apps/server/src/routers/others/rotate-owner-token.ts`

### Modified files
- `apps/client/src/features/server/selectors.ts` — add `serverHasOwnerSelector`
- `apps/client/src/features/server/hooks.ts` — add `useServerHasOwner`
- `apps/client/src/components/left-sidebar/index.tsx` — add claim banner
- `apps/client/src/components/server-screens/server-settings/backup/index.tsx` — add rotate token card + reveal modal
- `apps/server/src/routers/others/index.ts` — register `rotateOwnerToken`
- `apps/client/src/i18n/locales/{cs,en,es,fr,it,ru,zh}/dialogs.json` — Feature 1 keys
- `apps/client/src/i18n/locales/{cs,en,es,fr,it,ru,zh}/settings.json` — Feature 2 keys

---

## Constraints

- Migrations: none required (no new DB columns or tables).
- No changes to `TPublicServerSettings` or the shared package.
- The existing `useSecretToken` rate-limit (5/min) covers brute-force protection for Feature 1.
- The token reveal modal (Feature 2) must never auto-close to prevent accidental token loss.
