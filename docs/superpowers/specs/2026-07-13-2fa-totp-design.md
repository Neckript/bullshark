# Two-Factor Authentication (TOTP) — Design

**Date:** 2026-07-13
**Status:** Approved

---

## Overview

Opt-in, per-user two-factor authentication using TOTP (RFC 6238), compatible
with standard authenticator apps (Google Authenticator, Authy, 1Password, …).
Any logged-in user can enable/disable it from their account settings. Enrollment
produces one-time **recovery codes** for account recovery when the authenticator
is lost.

The existing password flow (argon2, legacy SHA256 migration) is untouched. 2FA
only **gates issuance of the session JWT**: after the password step succeeds, a
second TOTP step is required before the JWT is returned.

**Scope decisions (approved):**
- Opt-in for **all users**. No "require 2FA for admins" enforcement (deferred).
- TOTP only — no SMS/email, no WebAuthn/passkeys.
- TOTP math via the **`otpauth`** library (vetted), not hand-rolled crypto.
- Login challenge is a **stateless HMAC token** (no temporary-session table),
  reusing the existing file-token pattern.
- **10** recovery codes; `regenerateRecoveryCodes` included in the MVP.

---

## Data model (Drizzle migration, backward-compatible)

All additions are nullable / additive — no backfill, no breaking change.

### `users` table (`apps/server/src/db/schema.ts`)

- `totpSecret: text('totp_secret')` — nullable. The TOTP shared secret,
  **encrypted at rest** (AES-256-GCM, key derived from `serverToken`). Present
  while pending and while enabled.
- `totpEnabledAt: integer('totp_enabled_at')` — nullable. `null` = 2FA not
  active (a pending, unconfirmed secret may exist). A non-null timestamp is the
  single source of truth for "2FA is active" — **login gates only on this**.

### New table `user_recovery_codes`

- `id` (pk, autoincrement)
- `userId` (FK → `users.id`, `onDelete: 'cascade'`)
- `codeHash: text` — sha256 of the recovery code (never stored in plaintext)
- `usedAt: integer` — nullable; set when a code is consumed (single-use)
- `createdAt: integer`
- Index on `userId`.

**Enrollment state machine:**
`totp.setup` → stores encrypted `totpSecret`, `totpEnabledAt = null` (pending,
login NOT gated). `totp.enable` (valid code) → sets `totpEnabledAt = now()`,
generates recovery codes. `totp.disable` → clears `totpSecret`, `totpEnabledAt`,
and deletes the user's recovery codes.

---

## Crypto helpers

### `apps/server/src/helpers/totp-crypto.ts` (new)

- `encryptSecret(plain: string): string` / `decryptSecret(cipher: string): string`
  - AES-256-GCM. Key = `sha256(getServerTokenSync())` (32 bytes) — same root of
    trust as `files-crypto.ts`.
  - Random 12-byte IV per encryption. Stored format: `base64(iv):base64(tag):base64(ciphertext)`.
- Rationale: the secret must be recoverable (to verify TOTP), so it is encrypted
  (reversible), not hashed. Recovery codes are one-way, so they are hashed.

### TOTP via `otpauth` (new server dependency)

- `apps/server/src/helpers/totp.ts` (new) wraps `otpauth`:
  - `generateSecret()` → new `OTPAuth.Secret` (20 bytes / base32).
  - `buildOtpauthUri(secret, { issuer, label })` → `otpauth://…` URI for the QR.
  - `verifyTotp(secret, code)` → validates a 6-digit code with `window: 1`
    (±1 time step / 30 s) for clock skew tolerance.

### Recovery codes (in `totp-crypto.ts` or `helpers/recovery-codes.ts`)

- `generateRecoveryCodes(): string[]` → 10 codes, format `xxxxx-xxxxx`
  (Crockford base32, CSPRNG).
- Stored as `sha256(code)`. Verification is constant-time; on match, the row's
  `usedAt` is set (single-use). Consuming a recovery code does not disable 2FA.

---

## Login challenge (stateless)

### `apps/server/src/helpers/totp-challenge.ts` (new)

- `signChallenge(userId, expiresAt): string` — `HMAC-SHA256(serverToken,
  "totp-challenge:{userId}:{expiresAt}")`, hex. Mirrors `files-crypto.ts`.
- `verifyChallenge(userId, expiresAt, token): boolean` — recompute + constant-time
  compare, and reject if `Date.now() > expiresAt`.
- Wire format returned to the client: `challenge = "{userId}.{expiresAt}.{hmac}"`
  (single opaque string). TTL: 5 minutes.
- Stateless: nothing persisted; the signature is unforgeable. Brute-force of the
  6-digit code is bounded by the per-IP rate limiter on `/login/2fa`.

---

## Server endpoints

### tRPC — new router group `apps/server/src/routers/security/`

Registered in `routers/index.ts` as `security`. All `protectedProcedure`
(authenticated session). All state-changing routes are rate-limited.

| Route | Input | Behavior |
|---|---|---|
| `security.totp.setup` | — | Rejects if already enabled. Generates a fresh secret, stores it encrypted with `totpEnabledAt=null`, returns `{ otpauthUri, secret }` for QR + manual entry. |
| `security.totp.enable` | `{ code }` | Verifies `code` against the pending secret. On success: `totpEnabledAt=now()`, (re)generate recovery codes, return `{ recoveryCodes }` **once**. |
| `security.totp.disable` | `{ code?: string; password?: string }` | Re-auth required: a valid current TOTP/recovery code **or** the account password. Clears secret + `totpEnabledAt` + recovery codes. |
| `security.totp.status` | — | `{ enabled: boolean; recoveryCodesRemaining: number }`. Feeds the settings UI. |
| `security.totp.regenerateRecoveryCodes` | `{ code }` | Valid current code required. Replaces the set, returns the new `{ recoveryCodes }` once. |

The authenticated user's own record is always the target (`ctx.userId`); no
cross-user access.

### HTTP `/login` — two-step flow

Modify `apps/server/src/http/login.ts`:

- **Step 1** — existing `POST /login` (`identity` + `password`). After the
  password verifies:
  - If `user.totpEnabledAt == null` → **unchanged**: return `{ success: true, token }`.
  - If enabled → return `{ twoFactorRequired: true, challenge }` (HTTP 200, **no
    JWT**).
- **Step 2** — new `POST /login/2fa` handler (`apps/server/src/http/login-2fa.ts`,
  registered in `http/index.ts`):
  - Input `{ challenge, code }`. `code` is a TOTP code **or** a recovery code.
  - Verify challenge (signature + not expired) → resolve `userId`.
  - Verify the code (TOTP window ±1, else recovery-code path with single-use
    consumption). Re-check `banned`.
  - On success, issue the JWT exactly as the current `/login` does.
  - Dedicated strict per-IP rate limiter (`config.rateLimiters` entry, e.g.
    `twoFactor`). Existing `/login` rate limiter still guards step 1.

### Shared contract (`packages/shared`)

- Response type additions for the login flow (`{ twoFactorRequired, challenge }`).
- Any new enums/paths consumed by both client and server.

---

## Client (full-stack)

### Settings — "Security" section

- New 2FA card in the user account settings screen (follow the existing settings
  screen/card patterns; exact location confirmed during implementation).
- **Disabled state:** "Enable 2FA" → dialog:
  1. Calls `security.totp.setup`, renders the `otpauthUri` as a **QR code** plus
     the manual secret.
  2. 6-digit code input → `security.totp.enable`.
  3. On success, displays the **recovery codes** with copy/download and a
     "I saved them" confirmation.
- **Enabled state:** "Disable 2FA" (requires code or password) and "Regenerate
  recovery codes" (requires code).
- `security.totp.status` drives which state is shown.
- QR rendering: add a small client QR library (e.g. `qrcode.react`); confirmed
  during implementation.

### Login — `apps/client/src/screens/connect/index.tsx`

- On the `POST /login` response, branch on `twoFactorRequired`:
  - If set, render a **second step** (6-digit code input; a "use a recovery code"
    toggle switches the input/label) instead of completing the session.
  - Submit `{ challenge, code }` to `POST /login/2fa`; on `{ token }`, store it
    (respecting the existing `autoLogin` logic) and call `connect()`.
- `autoLogin` continues to persist the issued JWT (acts as an existing "trusted
  device" mechanism); no change to that behavior.

### i18n

- New keys in the `connect` and settings namespaces across all 7 locales, English
  authoritative. Non-English locales may mirror English initially; translation is
  a tracked task, and `format:check` must pass.

---

## Security considerations

- Secret **encrypted at rest** (AES-256-GCM, `serverToken`-derived key).
- Recovery codes **hashed** (sha256), **single-use**, constant-time compare.
- TOTP verified with a tight ±1-step window. (Replay within the same step is
  possible in the MVP; a `lastUsedStep` guard is noted as a future hardening.)
- Challenge is short-lived (5 min), unforgeable, and bound to a single `userId`.
- `/login/2fa` has a dedicated strict per-IP rate limiter to bound code
  brute-force.
- `disable` and `regenerateRecoveryCodes` require re-auth, so a hijacked live
  session cannot silently remove 2FA.
- No weakening of the existing password/argon2 path.

---

## Testing

**Server (bun test):**
- `totp-crypto`: encrypt/decrypt round-trip; tamper → fail.
- `totp`: known RFC 6238 vectors; window tolerance; wrong code rejected.
- recovery codes: generate → hash → verify; single-use (second use fails);
  wrong code rejected.
- `totp-challenge`: sign/verify happy path; expired → fail; tampered → fail;
  wrong userId → fail.
- tRPC routes: `setup`/`enable`/`disable`/`status`/`regenerate` happy + error
  paths (enable with wrong code, disable without re-auth, etc.).
- `/login` + `/login/2fa`: enabled user → challenge (no token) → valid code →
  token; wrong code; recovery-code path; expired challenge; rate-limit trip.

**Client (vitest):**
- Login screen renders the second step on `twoFactorRequired` and posts
  `/login/2fa`.
- Settings 2FA card state transitions (disabled → enrolling → enabled) at a
  focused level.
- Full e2e is optional for the MVP.

---

## Out of scope (YAGNI)

- SMS/email 2FA, WebAuthn/passkeys.
- "Require 2FA for admins" enforcement.
- Per-device trust beyond the existing `autoLogin`.
- Replay-within-step protection (`lastUsedStep`) — noted as future hardening.

---

## Migration & deploy notes

- Drizzle migration adds the columns + `user_recovery_codes` table (all
  additive/nullable; no backfill).
- New server dependency: `otpauth`. New client dependency: a QR library.
- CI `format:check` (prettier + organize-imports) must pass — run `bun run
  format` on changed files before commit (Windows CRLF caveat: only per-file /
  LF checks are authoritative locally).
