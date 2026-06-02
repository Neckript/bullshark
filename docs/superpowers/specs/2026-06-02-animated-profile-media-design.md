# Animated Profile Media (animated avatars + banners) — Design Spec

- **Issue:** #42
- **Branch:** `development`
- **Commit convention:** `feat(42): description`
- **Date:** 2026-06-02

## 1. Goal

Add Discord-style animated profile media:

- **Animated avatars** — GIF avatars that play everywhere the avatar is shown (sidebar, messages, popover, voice channel), in addition to static images.
- **Profile banners** — static or animated, shown in `UserPopover` above the avatar/username.
- **Upload sources** — (A) direct file upload from disk and (B) a Klipy GIF picker (search + select) integrated into the upload UI.
- **Storage** — same local pipeline as existing uploads. No external CDN dependency for stored/displayed media (sovereignty).
- **Size limits** — 8 MB max for animated, 4 MB for static, validated server-side.
- **Permissions** — a new `ANIMATED_AVATAR` permission lets admins restrict animated profile media per role.

## 2. What already exists (no rebuild)

Reading the current pipeline showed most of the spec is already implemented:

- **Upload pipeline** (`apps/server/src/http/upload.ts` → `apps/server/src/utils/file-manager.ts`): HTTP upload → managed temp file (1-min TTL) → `saveFile()` moves to `PUBLIC_PATH` + DB row. Quotas, md5 dedup, and the `beforeFileSave` plugin hook already run here.
- **Avatars** (`apps/server/src/routers/users/change-avatar.ts`): accepts any `image/*` temp file. Client `uploadImage()` sends the **raw File** (no canvas re-encode). `UserAvatar` renders via an `<img>` (Radix `AvatarImage`). GIF is **excluded** from the server WebP optimizer (`OPTIMIZABLE_IMAGE_EXTENSIONS`). → Animated GIF avatars already play everywhere.
- **Banners** — already fully implemented: `users.bannerId` + `users.bannerColor` columns, `change-banner.ts` route, `BannerManager` UI, and `UserPopover` renders the banner above the avatar (with `bannerColor` fallback). Accepts `image/*`, so GIF banners already work.
- **Settings**: `storageMaxAvatarSize` (default 3 MB) and `storageMaxBannerSize` (default 3 MB) exist, admin-editable, validated in `file-manager.validateFinalFileSize`.
- **Permissions**: enforced via `ctx.needsPermission(Permission.X)`; `Permission` enum + `DEFAULT_ROLE_PERMISSIONS` in `packages/shared/src/statics/permissions.ts`.

**No Klipy / Tenor / Giphy integration exists** in `bullshark` or upstream `Sharkord/sharkord` (`main` and `development`). The GIF picker is greenfield.

## 3. Scope

Build the four real gaps + Klipy + targeted hardening (no UX overhaul):

1. Klipy GIF picker (search + select), sovereign (download & store locally).
2. `ANIMATED_AVATAR` permission gating animated **avatar and banner**, granted by default.
3. Split size limits: 8 MB animated / 4 MB static, server-validated.
4. Extension allowlist for profile media (`.gif, .jpg, .jpeg, .png, .webp`).
5. Hardening: never flatten an animated WebP during optimization.

## 4. Key technical decisions (validated)

- **Animated detection (A):** lightweight binary sniffer (no full decode).
- **Klipy import (B):** client sends only the Klipy `id`; the server re-resolves the media URL via the Klipy API, then downloads it (server keeps control of the fetched URL — anti-SSRF). A host allowlist is an additional defense.
- **`ANIMATED_AVATAR`:** single permission covering animated avatar **and** banner; **granted by default** (added to `DEFAULT_ROLE_PERMISSIONS`) so existing animated avatars do not regress.
- **Size limits:** one new global setting `storageMaxAnimatedImageSize` (default 8 MB) for animated avatar+banner; existing `storageMaxAvatarSize` / `storageMaxBannerSize` are the static limits (defaults raised 3 MB → 4 MB).
- **Klipy key + thumbnails:** API key stored as an admin DB setting (`klipyApiKey`), never exposed to the client; search proxied through the server; picker preview thumbnails loaded from the Klipy CDN in the ephemeral picker only; the selected GIF is downloaded and stored locally.

## 5. Architecture

### 5.1 Animated detection (new server util)

`apps/server/src/utils/is-animated-image.ts` → `isAnimatedImage(filePath: string): Promise<boolean>`.

- Reads only the first few KB.
- **GIF:** animated if ≥ 2 frames (multiple Graphic Control Extensions / `NETSCAPE2.0` loop block).
- **Animated WebP:** RIFF container → `VP8X` chunk with the animation flag bit set, or presence of an `ANIM` chunk.
- **APNG hardening:** `.png` containing an `acTL` chunk is treated as animated.

Called in two places, each layer self-contained (two reads of a small temp file — negligible cost):
- the change-avatar/banner apply path (for the permission check),
- `file-manager.saveFile` (for the size limit and the optimization skip).

### 5.2 Permission `ANIMATED_AVATAR`

- Add to `Permission` enum and to `DEFAULT_ROLE_PERMISSIONS` (`packages/shared/src/statics/permissions.ts`).
- Covers animated avatar **and** banner. Name kept as `ANIMATED_AVATAR` (matches spec), documented as "animated profile media".
- Enforced in the shared apply helper: if `isAnimatedImage` → `await ctx.needsPermission(Permission.ANIMATED_AVATAR)`.
- i18n: add label + description to `apps/client/src/i18n/locales/en/permissions.json` (other locales fall back to `en`).

### 5.3 Size limits + admin settings

- New global setting `storageMaxAnimatedImageSize` (default 8 MB) applied to animated avatars and banners.
- Static defaults `storageMaxAvatarSize` / `storageMaxBannerSize` raised 3 MB → 4 MB (`packages/shared/src/statics/storage.ts`).
- Propagation: `schema.ts` (+ Drizzle migration for `storage_max_animated_image_size`), `seed.ts`, `__tests__/seed.ts`, `db/queries/server.ts`, `get-storage-settings.ts`, `update-settings.ts`, `TStorageSettings`, and the admin storage form.
- Validation in `file-manager.validateFinalFileSize`: if animated → animated limit; else the static limit for the type (avatar/banner).
- **Dependency:** the global HTTP cap `storageUploadMaxFileSize` must remain ≥ 8 MB or animated uploads are rejected before our logic runs; verify/raise its default if needed.

### 5.4 Klipy integration (sovereign)

- **Generic adapter** in `apps/server/src/integrations/gif/`: a `GifProvider` interface (`search()`, `resolveMediaUrl(id)`), with a `klipy.ts` implementation. The key is read from DB settings.
- **Klipy API shape** (reference): `GET https://api.klipy.com/api/v1/{API_KEY}/gifs/search?q=&page=&per_page=&locale=&rating=`; response `{ result, data: { data: [{ files: { gif_url, thumbnail_url } }], current_page, per_page, has_next } }`. Exact field paths confirmed during implementation against a live test key (100 calls/min).
- **Admin setting:** `klipyApiKey` (text) in settings + admin UI; never sent to the client.
- **Search proxy:** new tRPC router `gifs.search` (protected, rate-limited) returning normalized results `{ id, title, previewUrl, width, height }` + pagination; key stays server-side.
- **Sovereign import:** mutation `gifs.importToProfile({ gifId, target: 'avatar' | 'banner' })`:
  1. re-resolve media URL via Klipy (id → url),
  2. stream-download with an 8 MB cap + content-type check (gif/webp) + host allowlist,
  3. create a temp file via `fileManager.addTemporaryFile`,
  4. reuse the shared apply helper (same animated detection → permission → `saveFile`).
- **DRY refactor:** extract "apply a temp file as avatar/banner" from the current `change-avatar` / `change-banner` routes into a shared helper used by both direct upload and Klipy import, so enforcement is identical.

### 5.5 Client UI

- `AvatarManager` / `BannerManager`: add a "GIF" button opening a **Klipy picker dialog** (search field + thumbnail grid + paged scroll), built with existing `@sharkord/ui` primitives. Selection → `gifs.importToProfile`.
- The existing disk upload stays as-is; the file picker `accept` is set to the allowlist `.gif,.jpg,.jpeg,.png,.webp`.
- **Server-side allowlist (authority):** new shared constant `PROFILE_MEDIA_EXTENSIONS`; the apply helper rejects svg/bmp/ico/tiff (svg is an XSS vector, intentionally excluded).

### 5.6 Hardening

- `file-manager.optimizeImageIfEnabled` skips optimization when `isAnimatedImage` is true → an animated WebP is **never flattened** (applies everywhere: messages, emojis, profile).

## 6. Data flow (Klipy import)

1. Client picker → `gifs.search` (tRPC, key hidden) → list with Klipy thumbnail URLs.
2. User clicks a GIF → `gifs.importToProfile({ gifId, target })`.
3. Server re-resolves the media URL via Klipy → stream-downloads (8 MB cap, content-type + host allowlist) → temp file.
4. Shared apply helper: detect animated → `ANIMATED_AVATAR` permission → `saveFile(AVATAR|BANNER)` → store locally → `publishUser`.
5. Displayed via the existing `<img>`. No external CDN for stored media.

## 7. Testing

Bun tests, following existing `__tests__` patterns:

- `isAnimatedImage`: animated/static GIF, animated WebP, APNG, non-image.
- Permission enforcement: animated upload denied without `ANIMATED_AVATAR`, allowed with it.
- Size limits: 8 MB animated / 4 MB static boundaries for avatar and banner.
- Extension allowlist: svg/bmp/ico/tiff rejected; allowlist accepted.
- Klipy import flow with mocked fetch (no real network): id → resolve → download cap → apply.
- Optimization skip: animated WebP is not flattened.

## 8. Migration

- One Drizzle migration adding `storage_max_animated_image_size` to `settings`.
- `users.bannerId` / `users.bannerColor` already exist — no users-table change.

## 9. Commit breakdown (`feat(42): ...`)

1. `ANIMATED_AVATAR` permission (enum + default + i18n).
2. `isAnimatedImage` util + tests.
3. Split size limits + `storageMaxAnimatedImageSize` setting (schema/migration/seed/queries/routes/admin UI).
4. Hardening: skip optimization for animated images.
5. Shared apply-avatar/banner helper + extension allowlist; wire `change-avatar` / `change-banner` to it.
6. Klipy server adapter + `klipyApiKey` setting + admin UI.
7. `gifs` tRPC router (`search`, `importToProfile`).
8. Client Klipy picker in `AvatarManager` / `BannerManager` + file `accept` allowlist.
9. Tests across the above.

## 10. Out of scope

- GIF picker in the message composer (this spec is profile media only).
- Animated emojis.
- Tenor/Giphy implementations (the adapter makes them cheap to add later).
- UX overhaul / unifying avatar+banner+picker into one shared component.
