# Animated Profile Media Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Klipy GIF picker, an `ANIMATED_AVATAR` permission, split 8 MB animated / 4 MB static size limits, and an extension allowlist for profile avatars/banners — reusing the existing local upload pipeline.

**Architecture:** Server-side animated-image detection (binary sniffer) drives a per-role `ANIMATED_AVATAR` permission and animated-aware size limits inside the existing `file-manager.saveFile` flow. A generic `GifProvider` adapter (Klipy impl) proxies search through the server and imports a selected GIF by downloading it server-side (anti-SSRF) into the same pipeline. A shared apply helper guarantees identical enforcement for disk upload and GIF import.

**Tech Stack:** Bun, TypeScript, Drizzle (SQLite), tRPC, React, `@sharkord/ui`, Bun test.

**Reference spec:** `docs/superpowers/specs/2026-06-02-animated-profile-media-design.md`

**Conventions:**
- Branch `development`. Commit format `feat(42): description` (docs commits use `docs:`).
- Run a single server test file: `cd apps/server && bun test src/path/to/file.test.ts`
- Run a single shared test file: `cd packages/shared && bun test src/path/to/file.test.ts`
- After server changes run `cd apps/server && bun run check-types`; after shared changes `cd packages/shared && bun run check-types`.
- `cwd` resets between shell calls — always `cd` first.

---

## File Structure

**Shared (`packages/shared/src/`)**
- `statics/permissions.ts` — add `ANIMATED_AVATAR` to `Permission` + `DEFAULT_ROLE_PERMISSIONS`.
- `statics/storage.ts` — add animated-size constants; raise avatar/banner defaults to 4 MB.
- `extensions.ts` — add `PROFILE_MEDIA_EXTENSIONS`.
- `tables.ts` — add `storageMaxAnimatedImageSize` to `TStorageSettings`; add `klipyEnabled` to public settings type.
- `gif.ts` (new) — `TGifSearchResult`, `TGifSearchResponse` shared types for the picker.

**Server (`apps/server/src/`)**
- `utils/is-animated-image.ts` (new) — `isAnimatedImage(path)`.
- `utils/file-manager.ts` — animated-aware size limit + skip optimization for animated.
- `db/schema.ts` — `storage_max_animated_image_size`, `klipy_api_key` columns + migration.
- `db/seed.ts`, `__tests__/seed.ts` — seed new settings.
- `db/queries/server.ts` — map new settings; expose `klipyEnabled` in public settings.
- `routers/others/get-storage-settings.ts`, `routers/others/update-settings.ts` — new settings.
- `routers/users/apply-profile-media.ts` (new) — shared `applyAvatar`/`applyBanner`.
- `routers/users/change-avatar.ts`, `change-banner.ts` — call shared helper.
- `integrations/gif/types.ts`, `integrations/gif/klipy.ts`, `integrations/gif/index.ts` (new) — provider adapter.
- `routers/gifs/index.ts`, `routers/gifs/search.ts`, `routers/gifs/import-to-profile.ts` (new) — tRPC router.
- `routers/index.ts` — register `gifs` router.

**Client (`apps/client/src/`)**
- `components/gif-picker/gif-picker-dialog.tsx` (new) — search + grid picker.
- `components/server-screens/user-settings/profile/avatar-manager.tsx`, `banner-manager.tsx` — add GIF button + allowlist.
- `components/server-screens/server-settings/storage/index.tsx`, `presets.ts` — animated-size control + Klipy key input.
- `features/server/admin/hooks.ts` — include new settings.
- `i18n/locales/en/permissions.json`, `i18n/locales/en/settings.json` — labels.

---

## Task 1: `ANIMATED_AVATAR` permission

**Files:**
- Modify: `packages/shared/src/statics/permissions.ts`
- Modify: `apps/client/src/i18n/locales/en/permissions.json`

- [ ] **Step 1: Add the permission to the enum and defaults**

In `packages/shared/src/statics/permissions.ts`, add to the `Permission` enum after `CUSTOMIZE_NICKNAME_BADGE`:

```ts
  CUSTOMIZE_NICKNAME_BADGE = 'CUSTOMIZE_NICKNAME_BADGE',
  ANIMATED_AVATAR = 'ANIMATED_AVATAR',
```

Add to `DEFAULT_ROLE_PERMISSIONS` (granted by default — no regression):

```ts
export const DEFAULT_ROLE_PERMISSIONS = [
  Permission.JOIN_VOICE_CHANNELS,
  Permission.SEND_MESSAGES,
  Permission.UPLOAD_FILES,
  Permission.SHARE_SCREEN,
  Permission.ENABLE_WEBCAM,
  Permission.CUSTOMIZE_NICKNAME_COLOR,
  Permission.CUSTOMIZE_NICKNAME_FONT,
  Permission.CUSTOMIZE_NICKNAME_BADGE,
  Permission.ANIMATED_AVATAR
];
```

- [ ] **Step 2: Add i18n label + description**

In `apps/client/src/i18n/locales/en/permissions.json`, add to the labels object (next to `CUSTOMIZE_NICKNAME_BADGE`) and the descriptions object respectively:

```json
"ANIMATED_AVATAR": "Use animated profile media",
```
```json
"ANIMATED_AVATAR": "Grants the ability to use animated (GIF/animated WebP) avatars and banners.",
```

(Match the file's existing two-object structure — one entry in the labels map, one in the descriptions map.)

- [ ] **Step 3: Verify types**

Run: `cd packages/shared && bun run check-types`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
cd /c/Users/Neckr/Documents/bullshark
git add packages/shared/src/statics/permissions.ts apps/client/src/i18n/locales/en/permissions.json
git commit -m "feat(42): add ANIMATED_AVATAR permission"
```

---

## Task 2: `isAnimatedImage` sniffer util

**Files:**
- Create: `apps/server/src/utils/is-animated-image.ts`
- Test: `apps/server/src/utils/__tests__/is-animated-image.test.ts`

- [ ] **Step 1: Write the failing test**

Create `apps/server/src/utils/__tests__/is-animated-image.test.ts`:

```ts
import { describe, expect, test } from 'bun:test';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { randomUUIDv7 } from 'bun';
import { isAnimatedImage } from '../is-animated-image';

const writeTemp = async (name: string, bytes: Uint8Array): Promise<string> => {
  const p = path.join(os.tmpdir(), `${randomUUIDv7()}-${name}`);
  await fs.writeFile(p, bytes);
  return p;
};

// Minimal static GIF: header + logical screen descriptor + one image descriptor + trailer.
const STATIC_GIF = new Uint8Array([
  0x47, 0x49, 0x46, 0x38, 0x39, 0x61, // GIF89a
  0x01, 0x00, 0x01, 0x00, 0x00, 0x00, 0x00, // screen desc (no GCT)
  0x2c, 0x00, 0x00, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00, // image descriptor
  0x3b // trailer
]);

// Animated GIF: two Graphic Control Extensions, each followed by an image descriptor.
const GCE = [0x21, 0xf9, 0x04, 0x00, 0x00, 0x00, 0x00, 0x00];
const IMG_DESC = [0x2c, 0x00, 0x00, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00];
const ANIMATED_GIF = new Uint8Array([
  0x47, 0x49, 0x46, 0x38, 0x39, 0x61,
  0x01, 0x00, 0x01, 0x00, 0x00, 0x00, 0x00,
  ...GCE, ...IMG_DESC,
  ...GCE, ...IMG_DESC,
  0x3b
]);

// Animated WebP: RIFF....WEBP VP8X with animation flag bit (0x02) set, plus ANIM chunk fourcc.
const ANIMATED_WEBP = new Uint8Array([
  0x52, 0x49, 0x46, 0x46, // RIFF
  0x20, 0x00, 0x00, 0x00, // size (placeholder)
  0x57, 0x45, 0x42, 0x50, // WEBP
  0x56, 0x50, 0x38, 0x58, // VP8X
  0x0a, 0x00, 0x00, 0x00, // VP8X chunk size
  0x02, 0x00, 0x00, 0x00, // flags: animation bit set
  0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
  0x41, 0x4e, 0x49, 0x4d // ANIM
]);

// APNG: PNG signature + acTL chunk type somewhere in the header region.
const APNG = new Uint8Array([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, // PNG sig
  0x00, 0x00, 0x00, 0x08, 0x61, 0x63, 0x54, 0x4c, // length + acTL
  0x00, 0x00, 0x00, 0x02, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00
]);

const STATIC_PNG = new Uint8Array([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
  0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52, // IHDR
  0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, 0x08, 0x06, 0x00, 0x00, 0x00
]);

describe('isAnimatedImage', () => {
  test('detects animated GIF', async () => {
    const p = await writeTemp('a.gif', ANIMATED_GIF);
    expect(await isAnimatedImage(p)).toBe(true);
  });

  test('static GIF is not animated', async () => {
    const p = await writeTemp('s.gif', STATIC_GIF);
    expect(await isAnimatedImage(p)).toBe(false);
  });

  test('detects animated WebP', async () => {
    const p = await writeTemp('a.webp', ANIMATED_WEBP);
    expect(await isAnimatedImage(p)).toBe(true);
  });

  test('detects APNG', async () => {
    const p = await writeTemp('a.png', APNG);
    expect(await isAnimatedImage(p)).toBe(true);
  });

  test('static PNG is not animated', async () => {
    const p = await writeTemp('s.png', STATIC_PNG);
    expect(await isAnimatedImage(p)).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/server && bun test src/utils/__tests__/is-animated-image.test.ts`
Expected: FAIL (`Cannot find module '../is-animated-image'`)

- [ ] **Step 3: Write the implementation**

Create `apps/server/src/utils/is-animated-image.ts`:

```ts
import fs from 'fs/promises';

const READ_BYTES = 64 * 1024; // first 64KB is enough to detect animation markers

const readHead = async (filePath: string): Promise<Buffer> => {
  const handle = await fs.open(filePath, 'r');
  try {
    const buf = Buffer.alloc(READ_BYTES);
    const { bytesRead } = await handle.read(buf, 0, READ_BYTES, 0);
    return buf.subarray(0, bytesRead);
  } finally {
    await handle.close();
  }
};

const isAnimatedGif = (buf: Buffer): boolean => {
  // GIF87a / GIF89a
  if (buf.length < 6 || buf.toString('ascii', 0, 3) !== 'GIF') return false;
  // Count image descriptors (0x2C). More than one frame => animated.
  let frames = 0;
  for (let i = 0; i < buf.length - 1; i++) {
    if (buf[i] === 0x2c) frames++;
    if (frames > 1) return true;
  }
  return false;
};

const isAnimatedWebp = (buf: Buffer): boolean => {
  if (
    buf.length < 16 ||
    buf.toString('ascii', 0, 4) !== 'RIFF' ||
    buf.toString('ascii', 8, 12) !== 'WEBP'
  ) {
    return false;
  }
  // Presence of an ANIM chunk indicates animation.
  return buf.includes(Buffer.from('ANIM', 'ascii'));
};

const isApng = (buf: Buffer): boolean => {
  const PNG_SIG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  if (buf.length < 8 || !buf.subarray(0, 8).equals(PNG_SIG)) return false;
  // acTL chunk present before IDAT => animated PNG.
  const actl = buf.indexOf(Buffer.from('acTL', 'ascii'));
  const idat = buf.indexOf(Buffer.from('IDAT', 'ascii'));
  return actl !== -1 && (idat === -1 || actl < idat);
};

const isAnimatedImage = async (filePath: string): Promise<boolean> => {
  const buf = await readHead(filePath);
  return isAnimatedGif(buf) || isAnimatedWebp(buf) || isApng(buf);
};

export { isAnimatedImage };
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/server && bun test src/utils/__tests__/is-animated-image.test.ts`
Expected: PASS (5 tests)

- [ ] **Step 5: Commit**

```bash
cd /c/Users/Neckr/Documents/bullshark
git add apps/server/src/utils/is-animated-image.ts apps/server/src/utils/__tests__/is-animated-image.test.ts
git commit -m "feat(42): add isAnimatedImage sniffer util"
```

---

## Task 3: Storage constants + extension allowlist (shared)

**Files:**
- Modify: `packages/shared/src/statics/storage.ts`
- Modify: `packages/shared/src/extensions.ts`
- Modify: `packages/shared/src/tables.ts`

- [ ] **Step 1: Add storage constants**

In `packages/shared/src/statics/storage.ts`, change the avatar/banner defaults to 4 MB and add animated constants:

```ts
export const STORAGE_DEFAULT_MAX_AVATAR_SIZE = 4 * 1024 * 1024; // 4MB
export const STORAGE_DEFAULT_MAX_BANNER_SIZE = 4 * 1024 * 1024; // 4MB
export const STORAGE_DEFAULT_MAX_ANIMATED_IMAGE_SIZE = 8 * 1024 * 1024; // 8MB
export const STORAGE_MAX_ANIMATED_IMAGE_SIZE = 100 * 1024 * 1024; // 100MB (admin slider cap)
```

(Add the two new lines directly after the existing `STORAGE_MAX_BANNER_SIZE` line.)

- [ ] **Step 2: Add profile-media extension allowlist**

In `packages/shared/src/extensions.ts`, add after `imageExtensions`:

```ts
export const PROFILE_MEDIA_EXTENSIONS = [
  '.gif',
  '.jpg',
  '.jpeg',
  '.png',
  '.webp'
];
```

- [ ] **Step 3: Add settings fields to shared types**

In `packages/shared/src/tables.ts`, add `'storageMaxAnimatedImageSize'` to the `TStorageSettings` `Pick` union (after `'storageMaxBannerSize'`):

```ts
  | 'storageMaxBannerSize'
  | 'storageMaxAnimatedImageSize'
```

Find the public server settings type (the one mapped in `db/queries/server.ts:getPublicSettings`, returning fields like `storageMaxAvatarSize`) and add a boolean `klipyEnabled: boolean;` field to it.

- [ ] **Step 4: Verify types**

Run: `cd packages/shared && bun run check-types`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
cd /c/Users/Neckr/Documents/bullshark
git add packages/shared/src/statics/storage.ts packages/shared/src/extensions.ts packages/shared/src/tables.ts
git commit -m "feat(42): add animated-size constants, profile-media allowlist, settings types"
```

---

## Task 4: DB schema + migration + seed

**Files:**
- Modify: `apps/server/src/db/schema.ts`
- Modify: `apps/server/src/db/seed.ts`
- Modify: `apps/server/src/__tests__/seed.ts`
- Create: migration via drizzle-kit

- [ ] **Step 1: Add columns to schema**

In `apps/server/src/db/schema.ts`, inside the `settings` table after `storageMaxBannerSize`:

```ts
    storageMaxBannerSize: integer('storage_max_banner_size').notNull(),
    storageMaxAnimatedImageSize: integer('storage_max_animated_image_size')
      .notNull()
      .default(8 * 1024 * 1024),
    klipyApiKey: text('klipy_api_key'),
```

- [ ] **Step 2: Generate the migration**

Run: `cd apps/server && bun run db:generate` (use the script defined in `apps/server/package.json` for drizzle-kit generate; check its exact name first with `cat apps/server/package.json`).
Expected: a new `src/db/migrations/00NN_*.sql` adding the two columns. Inspect it to confirm it only alters `settings`.

- [ ] **Step 3: Seed the new value**

In `apps/server/src/db/seed.ts`, import the constant and add to `initialSettings` after `storageMaxBannerSize`:

```ts
import {
  // ...existing...
  STORAGE_DEFAULT_MAX_ANIMATED_IMAGE_SIZE,
} from '@sharkord/shared';
```
```ts
    storageMaxBannerSize: STORAGE_DEFAULT_MAX_BANNER_SIZE,
    storageMaxAnimatedImageSize: STORAGE_DEFAULT_MAX_ANIMATED_IMAGE_SIZE,
    klipyApiKey: null,
```

Apply the same two additions to `apps/server/src/__tests__/seed.ts` (it mirrors the seed object).

- [ ] **Step 4: Run the server test suite to confirm seed/migration integrity**

Run: `cd apps/server && bun test src/routers/__tests__/others.test.ts`
Expected: PASS (existing tests still green; they touch settings).

- [ ] **Step 5: Commit**

```bash
cd /c/Users/Neckr/Documents/bullshark
git add apps/server/src/db/schema.ts apps/server/src/db/seed.ts apps/server/src/__tests__/seed.ts apps/server/src/db/migrations
git commit -m "feat(42): add storageMaxAnimatedImageSize + klipyApiKey settings columns"
```

---

## Task 5: Settings plumbing (queries + routes)

**Files:**
- Modify: `apps/server/src/db/queries/server.ts`
- Modify: `apps/server/src/routers/others/get-storage-settings.ts`
- Modify: `apps/server/src/routers/others/update-settings.ts`
- Test: `apps/server/src/routers/__tests__/others.test.ts`

- [ ] **Step 1: Write the failing test**

In `apps/server/src/routers/__tests__/others.test.ts`, extend the settings round-trip test object (around line 133 where `storageMaxAvatarSize`/`storageMaxBannerSize` are set) to include the new field, and assert it persists. Add within the existing update test:

```ts
      storageMaxAnimatedImageSize: 8 * 1024 * 1024,
```
and an assertion mirroring the existing ones:
```ts
    expect(settings.storageMaxAnimatedImageSize).toBe(
      newSettings.storageMaxAnimatedImageSize
    );
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/server && bun test src/routers/__tests__/others.test.ts`
Expected: FAIL (field not accepted/returned yet).

- [ ] **Step 3: Wire the settings through**

In `apps/server/src/db/queries/server.ts`, add to the `getSettings` mapping is automatic (spreads `serverSettings`). Add to `getPublicSettings` return object:

```ts
    storageSignedUrlsEnabled: settings.storageSignedUrlsEnabled,
    klipyEnabled: !!settings.klipyApiKey
```

In `apps/server/src/routers/others/get-storage-settings.ts`, add to the `storageSettings` object:

```ts
    storageMaxBannerSize: settings.storageMaxBannerSize,
    storageMaxAnimatedImageSize: settings.storageMaxAnimatedImageSize,
```

In `apps/server/src/routers/others/update-settings.ts`, add to the zod input object:

```ts
      storageMaxBannerSize: z.number().min(0).optional(),
      storageMaxAnimatedImageSize: z.number().min(0).optional(),
      klipyApiKey: z.string().max(256).nullable().optional(),
```
and to the `updateSettings({ ... })` call:
```ts
      storageMaxBannerSize: input.storageMaxBannerSize,
      storageMaxAnimatedImageSize: input.storageMaxAnimatedImageSize,
      klipyApiKey: input.klipyApiKey,
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/server && bun test src/routers/__tests__/others.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
cd /c/Users/Neckr/Documents/bullshark
git add apps/server/src/db/queries/server.ts apps/server/src/routers/others/get-storage-settings.ts apps/server/src/routers/others/update-settings.ts apps/server/src/routers/__tests__/others.test.ts
git commit -m "feat(42): plumb animated-size + klipy settings through queries and routes"
```

---

## Task 6: Animated-aware size limit + skip optimization (file-manager)

**Files:**
- Modify: `apps/server/src/utils/file-manager.ts`
- Test: `apps/server/src/utils/__tests__/file-manager.test.ts`

- [ ] **Step 1: Write the failing test**

In `apps/server/src/utils/__tests__/file-manager.test.ts`, add a test that an animated file is checked against `storageMaxAnimatedImageSize` rather than the static avatar limit. Use the `ANIMATED_GIF` byte pattern from Task 2 (copy the constant into this test file) written to a temp upload, saved as `FileSaveType.AVATAR`, with `storageMaxAvatarSize` tiny but `storageMaxAnimatedImageSize` large — expect success; then with `storageMaxAnimatedImageSize` tiny — expect throw `Animated image exceeds`. Follow the file's existing harness for constructing a temp file and calling `fileManager.saveFile` (mirror the pattern near line 336).

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/server && bun test src/utils/__tests__/file-manager.test.ts`
Expected: FAIL (animated limit not applied / message differs).

- [ ] **Step 3: Implement animated-aware logic**

In `apps/server/src/utils/file-manager.ts`:

Import the util at the top:
```ts
import { isAnimatedImage } from './is-animated-image';
```

Change `validateFinalFileSize` to accept and use an `isAnimated` flag:
```ts
  private validateFinalFileSize = (
    tempFile: TTempFile,
    type: FileSaveType | undefined,
    settings: TJoinedSettings,
    isAnimated: boolean
  ) => {
    if (isAnimated && (type === FileSaveType.AVATAR || type === FileSaveType.BANNER)) {
      if (tempFile.size > settings.storageMaxAnimatedImageSize) {
        throw new Error(
          `Animated image exceeds the configured maximum size of ${settings.storageMaxAnimatedImageSize / (1024 * 1024)} MB`
        );
      }
      return;
    }

    if (
      type === FileSaveType.AVATAR &&
      tempFile.size > settings.storageMaxAvatarSize
    ) {
      throw new Error(
        `Avatar file exceeds the configured maximum size of ${settings.storageMaxAvatarSize / (1024 * 1024)} MB`
      );
    }

    if (
      type === FileSaveType.BANNER &&
      tempFile.size > settings.storageMaxBannerSize
    ) {
      throw new Error(
        `Banner file exceeds the configured maximum size of ${settings.storageMaxBannerSize / (1024 * 1024)} MB`
      );
    }
  };
```

Change `optimizeImageIfEnabled` to early-return when animated. Add `isAnimated` param and guard at the top of the method body:
```ts
  private optimizeImageIfEnabled = async (
    tempFile: TTempFile,
    settings: TJoinedSettings,
    isAnimated: boolean
  ) => {
    if (isAnimated) {
      return; // never flatten animated images (gif / animated webp)
    }
    if (
      !settings.storageImageOptimizationEnabled ||
      !OPTIMIZABLE_IMAGE_EXTENSIONS.has(tempFile.extension)
    ) {
      return;
    }
    // ...rest unchanged...
```

In `saveFile`, compute `isAnimated` once on the original temp path (after the `beforeFileSave` hooks, before optimization) and thread it through:
```ts
    const settings = await getSettings();

    const isAnimated = await isAnimatedImage(tempFile.path);

    await this.optimizeImageIfEnabled(tempFile, settings, isAnimated);

    // check for file size after optimization but before moving to final destination
    this.validateFinalFileSize(tempFile, type, settings, isAnimated);
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/server && bun test src/utils/__tests__/file-manager.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
cd /c/Users/Neckr/Documents/bullshark
git add apps/server/src/utils/file-manager.ts apps/server/src/utils/__tests__/file-manager.test.ts
git commit -m "feat(42): animated-aware size limit and skip optimization for animated images"
```

---

## Task 7: Shared apply-profile-media helper (permission + allowlist + detection)

**Files:**
- Create: `apps/server/src/routers/users/apply-profile-media.ts`
- Modify: `apps/server/src/routers/users/change-avatar.ts`
- Modify: `apps/server/src/routers/users/change-banner.ts`
- Test: `apps/server/src/routers/__tests__/users.test.ts`

- [ ] **Step 1: Write the failing tests**

In `apps/server/src/routers/__tests__/users.test.ts`, add tests (mirroring the existing `changeAvatar` upload pattern at lines 401–454):
1. uploading a `.svg` named file rejected with `Invalid file type`;
2. uploading an animated GIF (use the `ANIMATED_GIF` bytes from Task 2) as avatar **succeeds** for the default role (has `ANIMATED_AVATAR`);
3. after removing `ANIMATED_AVATAR` from the user's role permissions, uploading the animated GIF avatar rejects with a permission error.

For (3), follow how other tests manipulate role permissions (see `roles.test.ts` patterns for removing a permission), or directly delete the `role_permissions` row for the default role + `ANIMATED_AVATAR` via `tdb`.

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd apps/server && bun test src/routers/__tests__/users.test.ts`
Expected: FAIL (no allowlist/permission enforcement yet).

- [ ] **Step 3: Create the shared helper**

Create `apps/server/src/routers/users/apply-profile-media.ts`:

```ts
import {
  FileSaveType,
  Permission,
  PROFILE_MEDIA_EXTENSIONS
} from '@sharkord/shared';
import { eq } from 'drizzle-orm';
import { db } from '../../db';
import { removeFile } from '../../db/mutations/files';
import { publishUser } from '../../db/publishers';
import { getUserById } from '../../db/queries/users';
import { users } from '../../db/schema';
import { fileManager } from '../../utils/file-manager';
import { invariant } from '../../utils/invariant';
import { isAnimatedImage } from '../../utils/is-animated-image';
import type { Context } from '../../utils/trpc';

type TProfileMediaTarget = 'avatar' | 'banner';

const COLUMN_BY_TARGET = {
  avatar: 'avatarId',
  banner: 'bannerId'
} as const;

const SAVE_TYPE_BY_TARGET = {
  avatar: FileSaveType.AVATAR,
  banner: FileSaveType.BANNER
} as const;

const applyProfileMedia = async (
  ctx: Context,
  target: TProfileMediaTarget,
  fileId: string | undefined
): Promise<void> => {
  const user = await getUserById(ctx.userId);

  invariant(user, { code: 'NOT_FOUND', message: 'User not found' });

  const column = COLUMN_BY_TARGET[target];

  if (fileId) {
    const tempFile = fileManager.getTemporaryFile(fileId);

    invariant(tempFile, {
      code: 'NOT_FOUND',
      message: 'Temporary file not found'
    });

    if (!PROFILE_MEDIA_EXTENSIONS.includes(tempFile.extension)) {
      throw new Error('Invalid file type. Please try again.');
    }

    if (!fileManager.temporaryFileHasMimeType(fileId, 'image/')) {
      throw new Error('Invalid file type. Please try again.');
    }

    if (await isAnimatedImage(tempFile.path)) {
      await ctx.needsPermission(Permission.ANIMATED_AVATAR);
    }
  }

  const currentFileId = user[column];

  if (currentFileId) {
    await removeFile(currentFileId);
    await db
      .update(users)
      .set({ [column]: null })
      .where(eq(users.id, ctx.userId))
      .run();
  }

  if (fileId) {
    const newFile = await fileManager.saveFile(
      fileId,
      ctx.userId,
      SAVE_TYPE_BY_TARGET[target]
    );

    await db
      .update(users)
      .set({ [column]: newFile.id })
      .where(eq(users.id, ctx.userId))
      .run();
  }

  publishUser(ctx.userId, 'update');
};

export { applyProfileMedia, type TProfileMediaTarget };
```

> Note: confirm `getUserById` returns `avatarId`/`bannerId` typed fields; if the indexed access `user[column]` complains, narrow with `target === 'avatar' ? user.avatarId : user.bannerId`.

- [ ] **Step 4: Rewrite the two routes to use the helper**

Replace the body of `apps/server/src/routers/users/change-avatar.ts`:

```ts
import z from 'zod';
import { protectedProcedure } from '../../utils/trpc';
import { applyProfileMedia } from './apply-profile-media';

const changeAvatarRoute = protectedProcedure
  .input(z.object({ fileId: z.string().optional() }))
  .mutation(async ({ ctx, input }) => {
    await applyProfileMedia(ctx, 'avatar', input.fileId);
  });

export { changeAvatarRoute };
```

Replace the body of `apps/server/src/routers/users/change-banner.ts` identically with `'banner'`.

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd apps/server && bun test src/routers/__tests__/users.test.ts`
Expected: PASS (including the existing avatar/banner tests, which still go through the helper).

- [ ] **Step 6: Type-check + commit**

```bash
cd apps/server && bun run check-types
cd /c/Users/Neckr/Documents/bullshark
git add apps/server/src/routers/users/apply-profile-media.ts apps/server/src/routers/users/change-avatar.ts apps/server/src/routers/users/change-banner.ts apps/server/src/routers/__tests__/users.test.ts
git commit -m "feat(42): shared profile-media apply helper with allowlist + ANIMATED_AVATAR enforcement"
```

---

## Task 8: Klipy GIF provider adapter

**Files:**
- Create: `apps/server/src/integrations/gif/types.ts`
- Create: `apps/server/src/integrations/gif/klipy.ts`
- Create: `apps/server/src/integrations/gif/index.ts`
- Test: `apps/server/src/integrations/gif/__tests__/klipy.test.ts`

- [ ] **Step 1: Define the provider interface**

Create `apps/server/src/integrations/gif/types.ts`:

```ts
export type TGifSearchResult = {
  id: string;
  title: string;
  previewUrl: string;
  width: number;
  height: number;
};

export type TGifSearchPage = {
  results: TGifSearchResult[];
  page: number;
  hasNext: boolean;
};

export type TGifSearchParams = {
  query: string;
  page: number;
  perPage: number;
  locale?: string;
};

export interface GifProvider {
  search(params: TGifSearchParams): Promise<TGifSearchPage>;
  resolveMediaUrl(id: string): Promise<string>;
  /** Hostnames allowed for server-side media download (anti-SSRF). */
  readonly allowedMediaHosts: string[];
}
```

- [ ] **Step 2: Write the failing test (mocked fetch)**

Create `apps/server/src/integrations/gif/__tests__/klipy.test.ts`:

```ts
import { afterEach, describe, expect, mock, test } from 'bun:test';
import { createKlipyProvider } from '../klipy';

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe('KlipyProvider', () => {
  test('search maps Klipy response to normalized results', async () => {
    globalThis.fetch = mock(async () =>
      new Response(
        JSON.stringify({
          result: true,
          data: {
            data: [
              {
                slug: 'abc',
                title: 'cat',
                file: {
                  gif: { url: 'https://cdn.klipy.com/abc.gif', width: 200, height: 150 }
                },
                files: {
                  gif_url: 'https://cdn.klipy.com/abc.gif',
                  thumbnail_url: 'https://cdn.klipy.com/abc-thumb.gif'
                }
              }
            ],
            current_page: 1,
            per_page: 24,
            has_next: true
          }
        }),
        { status: 200, headers: { 'content-type': 'application/json' } }
      )
    ) as unknown as typeof fetch;

    const provider = createKlipyProvider('TEST_KEY');
    const page = await provider.search({ query: 'cat', page: 1, perPage: 24 });

    expect(page.results).toHaveLength(1);
    expect(page.results[0].id).toBe('abc');
    expect(page.results[0].previewUrl).toContain('klipy.com');
    expect(page.hasNext).toBe(true);
  });

  test('search throws on non-ok response', async () => {
    globalThis.fetch = mock(async () => new Response('nope', { status: 500 })) as unknown as typeof fetch;
    const provider = createKlipyProvider('TEST_KEY');
    await expect(provider.search({ query: 'cat', page: 1, perPage: 24 })).rejects.toThrow();
  });
});
```

> The exact Klipy JSON field paths (`file.gif.url` vs `files.gif_url`, slug field name) are confirmed against a live test key during this task; the mapping function isolates them. Update the mapping + this fixture together if the live shape differs.

- [ ] **Step 3: Run test to verify it fails**

Run: `cd apps/server && bun test src/integrations/gif/__tests__/klipy.test.ts`
Expected: FAIL (`Cannot find module '../klipy'`)

- [ ] **Step 4: Implement the Klipy provider**

Create `apps/server/src/integrations/gif/klipy.ts`:

```ts
import { logger } from '../../logger';
import type {
  GifProvider,
  TGifSearchPage,
  TGifSearchParams,
  TGifSearchResult
} from './types';

const KLIPY_BASE = 'https://api.klipy.com/api/v1';
const ALLOWED_MEDIA_HOSTS = ['klipy.com'];

type TKlipyItem = {
  slug?: string;
  id?: string | number;
  title?: string;
  file?: { gif?: { url?: string; width?: number; height?: number } };
  files?: { gif_url?: string; thumbnail_url?: string };
  width?: number;
  height?: number;
};

const mapItem = (item: TKlipyItem): TGifSearchResult | null => {
  const id = String(item.slug ?? item.id ?? '');
  const previewUrl = item.files?.thumbnail_url ?? item.file?.gif?.url ?? item.files?.gif_url;
  if (!id || !previewUrl) return null;
  return {
    id,
    title: item.title ?? '',
    previewUrl,
    width: item.file?.gif?.width ?? item.width ?? 0,
    height: item.file?.gif?.height ?? item.height ?? 0
  };
};

const createKlipyProvider = (apiKey: string): GifProvider => ({
  allowedMediaHosts: ALLOWED_MEDIA_HOSTS,

  async search({ query, page, perPage, locale }: TGifSearchParams): Promise<TGifSearchPage> {
    const url = new URL(`${KLIPY_BASE}/${apiKey}/gifs/search`);
    url.searchParams.set('q', query);
    url.searchParams.set('page', String(page));
    url.searchParams.set('per_page', String(perPage));
    url.searchParams.set('rating', 'pg-13');
    if (locale) url.searchParams.set('locale', locale);

    const res = await fetch(url.toString());
    if (!res.ok) {
      logger.error('Klipy search failed: %s', res.status);
      throw new Error('GIF search failed');
    }

    const body = (await res.json()) as {
      data?: { data?: TKlipyItem[]; current_page?: number; has_next?: boolean };
    };

    const items = body.data?.data ?? [];
    const results = items.map(mapItem).filter((r): r is TGifSearchResult => r !== null);

    return {
      results,
      page: body.data?.current_page ?? page,
      hasNext: Boolean(body.data?.has_next)
    };
  },

  async resolveMediaUrl(id: string): Promise<string> {
    const url = `${KLIPY_BASE}/${apiKey}/gifs/${encodeURIComponent(id)}`;
    const res = await fetch(url);
    if (!res.ok) {
      logger.error('Klipy resolve failed: %s', res.status);
      throw new Error('GIF not found');
    }
    const body = (await res.json()) as { data?: TKlipyItem };
    const mediaUrl = body.data?.file?.gif?.url ?? body.data?.files?.gif_url;
    if (!mediaUrl) throw new Error('GIF media URL not found');
    return mediaUrl;
  }
});

export { createKlipyProvider };
```

> During implementation, confirm the single-item resolve endpoint path (`/gifs/{id}` vs a `view` endpoint) against the live API and adjust `resolveMediaUrl` + its mapping accordingly.

- [ ] **Step 5: Create the provider factory**

Create `apps/server/src/integrations/gif/index.ts`:

```ts
import { getSettings } from '../../db/queries/server';
import { createKlipyProvider } from './klipy';
import type { GifProvider } from './types';

const getGifProvider = async (): Promise<GifProvider | null> => {
  const settings = await getSettings();
  if (!settings.klipyApiKey) return null;
  return createKlipyProvider(settings.klipyApiKey);
};

export { getGifProvider };
export type { GifProvider } from './types';
```

- [ ] **Step 6: Run test to verify it passes**

Run: `cd apps/server && bun test src/integrations/gif/__tests__/klipy.test.ts`
Expected: PASS (2 tests)

- [ ] **Step 7: Commit**

```bash
cd /c/Users/Neckr/Documents/bullshark
git add apps/server/src/integrations/gif
git commit -m "feat(42): add generic GifProvider adapter with Klipy implementation"
```

---

## Task 9: `gifs` tRPC router (search + sovereign import)

**Files:**
- Create: `apps/server/src/routers/gifs/search.ts`
- Create: `apps/server/src/routers/gifs/import-to-profile.ts`
- Create: `apps/server/src/routers/gifs/index.ts`
- Modify: `apps/server/src/routers/index.ts`
- Test: `apps/server/src/routers/__tests__/gifs.test.ts`

- [ ] **Step 1: Write the failing test**

Create `apps/server/src/routers/__tests__/gifs.test.ts` modeled on the other router tests (`initTest` harness from `src/__tests__/helpers.ts`). Cover:
1. `gifs.search` throws a friendly error when `klipyApiKey` is unset;
2. with `klipyApiKey` set and `globalThis.fetch` mocked (search shape from Task 8), `gifs.search` returns mapped results;
3. `gifs.importToProfile` with mocked `fetch` (resolve → media bytes = the `ANIMATED_GIF` from Task 2, served from a `https://cdn.klipy.com/...` URL, `content-type: image/gif`) sets the user's `avatarId`;
4. `importToProfile` rejects when the resolved media host is not in the allowlist.

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/server && bun test src/routers/__tests__/gifs.test.ts`
Expected: FAIL (router missing).

- [ ] **Step 3: Implement search route**

Create `apps/server/src/routers/gifs/search.ts`:

```ts
import z from 'zod';
import { getGifProvider } from '../../integrations/gif';
import { protectedProcedure, rateLimitedProcedure } from '../../utils/trpc';

const searchGifsRoute = rateLimitedProcedure(protectedProcedure, {
  maxRequests: 30,
  windowMs: 10_000,
  logLabel: 'gifs.search'
})
  .input(
    z.object({
      query: z.string().min(1).max(100),
      page: z.number().int().min(1).default(1),
      perPage: z.number().int().min(8).max(50).default(24),
      locale: z.string().max(10).optional()
    })
  )
  .query(async ({ input }) => {
    const provider = await getGifProvider();
    if (!provider) {
      throw new Error('GIF search is not configured on this server.');
    }
    return provider.search(input);
  });

export { searchGifsRoute };
```

> Confirm `rateLimitedProcedure` usage signature by checking another router that uses it; the `utils/trpc.ts` export exists. If no other caller exists, fall back to plain `protectedProcedure`.

- [ ] **Step 4: Implement sovereign import route**

Create `apps/server/src/routers/gifs/import-to-profile.ts`:

```ts
import { getErrorMessage } from '@sharkord/shared';
import { randomUUIDv7 } from 'bun';
import fs from 'fs/promises';
import path from 'path';
import z from 'zod';
import { TMP_PATH } from '../../helpers/paths';
import { getGifProvider } from '../../integrations/gif';
import { fileManager } from '../../utils/file-manager';
import { protectedProcedure, rateLimitedProcedure } from '../../utils/trpc';
import { applyProfileMedia } from '../users/apply-profile-media';

const MAX_BYTES = 8 * 1024 * 1024; // hard cap during download

const importToProfileRoute = rateLimitedProcedure(protectedProcedure, {
  maxRequests: 10,
  windowMs: 60_000,
  logLabel: 'gifs.importToProfile'
})
  .input(
    z.object({
      gifId: z.string().min(1).max(200),
      target: z.enum(['avatar', 'banner'])
    })
  )
  .mutation(async ({ ctx, input }) => {
    const provider = await getGifProvider();
    if (!provider) {
      throw new Error('GIF import is not configured on this server.');
    }

    const mediaUrl = await provider.resolveMediaUrl(input.gifId);
    const parsed = new URL(mediaUrl);

    const hostAllowed = provider.allowedMediaHosts.some(
      (h) => parsed.hostname === h || parsed.hostname.endsWith(`.${h}`)
    );
    if (parsed.protocol !== 'https:' || !hostAllowed) {
      throw new Error('Refusing to download GIF from an untrusted source.');
    }

    const res = await fetch(mediaUrl);
    if (!res.ok || !res.body) {
      throw new Error('Failed to download GIF.');
    }

    const contentType = res.headers.get('content-type') ?? '';
    if (!contentType.startsWith('image/')) {
      throw new Error('Downloaded file is not an image.');
    }

    const tmpPath = path.join(TMP_PATH, `${randomUUIDv7()}.gif`);
    const handle = await fs.open(tmpPath, 'w');
    let total = 0;
    try {
      const reader = res.body.getReader();
      // eslint-disable-next-line no-constant-condition
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        total += value.byteLength;
        if (total > MAX_BYTES) {
          throw new Error('GIF exceeds the maximum allowed size.');
        }
        await handle.write(value);
      }
    } catch (error) {
      await handle.close();
      await fs.unlink(tmpPath).catch(() => undefined);
      throw new Error(getErrorMessage(error));
    }
    await handle.close();

    const tempFile = await fileManager.addTemporaryFile({
      originalName: `gif-${input.gifId}.gif`,
      filePath: tmpPath,
      size: total,
      userId: ctx.userId
    });

    await applyProfileMedia(ctx, input.target, tempFile.id);
  });

export { importToProfileRoute };
```

> Verify `TMP_PATH` is exported from `apps/server/src/helpers/paths.ts` (used by `file-manager.ts`) and that `addTemporaryFile` accepts a `.gif` source path outside `UPLOADS_PATH` (it moves the file into `TMP_PATH`; passing a path already in `TMP_PATH` performs a rename to a managed name — confirm no conflict, otherwise write the download into `UPLOADS_PATH` via `fileManager.getSafeUploadPath('x.gif')`).

- [ ] **Step 5: Register the router**

Create `apps/server/src/routers/gifs/index.ts`:

```ts
import { t } from '../../utils/trpc';
import { importToProfileRoute } from './import-to-profile';
import { searchGifsRoute } from './search';

export const gifsRouter = t.router({
  search: searchGifsRoute,
  importToProfile: importToProfileRoute
});
```

In `apps/server/src/routers/index.ts`, import and add to `appRouter`:
```ts
import { gifsRouter } from './gifs';
```
```ts
  plugins: pluginsRouter,
  gifs: gifsRouter
```

- [ ] **Step 6: Run test to verify it passes**

Run: `cd apps/server && bun test src/routers/__tests__/gifs.test.ts`
Expected: PASS

- [ ] **Step 7: Type-check + commit**

```bash
cd apps/server && bun run check-types
cd /c/Users/Neckr/Documents/bullshark
git add apps/server/src/routers/gifs apps/server/src/routers/index.ts apps/server/src/routers/__tests__/gifs.test.ts
git commit -m "feat(42): add gifs tRPC router (search + sovereign importToProfile)"
```

---

## Task 10: Client GIF picker dialog

**Files:**
- Create: `apps/client/src/components/gif-picker/gif-picker-dialog.tsx`
- Test: (UI — covered by the e2e package later; no unit test here)

- [ ] **Step 1: Implement the picker dialog**

Create `apps/client/src/components/gif-picker/gif-picker-dialog.tsx`:

```tsx
import { getTRPCClient } from '@/lib/trpc';
import type { TGifSearchResult } from '@sharkord/shared';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  Input
} from '@sharkord/ui';
import { memo, useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';

type TGifPickerDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (gifId: string) => void;
};

const GifPickerDialog = memo(
  ({ open, onOpenChange, onSelect }: TGifPickerDialogProps) => {
    const { t } = useTranslation();
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<TGifSearchResult[]>([]);
    const [loading, setLoading] = useState(false);

    const runSearch = useCallback(async (q: string) => {
      if (!q.trim()) {
        setResults([]);
        return;
      }
      setLoading(true);
      try {
        const trpc = getTRPCClient();
        const page = await trpc.gifs.search.query({ query: q, page: 1, perPage: 24 });
        setResults(page.results);
      } catch {
        toast.error(t('gifSearchFailed'));
      } finally {
        setLoading(false);
      }
    }, [t]);

    useEffect(() => {
      const id = setTimeout(() => void runSearch(query), 350);
      return () => clearTimeout(id);
    }, [query, runSearch]);

    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{t('gifPickerTitle')}</DialogTitle>
          </DialogHeader>
          <Input
            autoFocus
            placeholder={t('gifSearchPlaceholder')}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <div className="grid grid-cols-3 gap-2 max-h-96 overflow-y-auto mt-3">
            {results.map((gif) => (
              <button
                key={gif.id}
                type="button"
                className="overflow-hidden rounded-md hover:opacity-80 focus:ring-2 focus:ring-ring"
                onClick={() => {
                  onSelect(gif.id);
                  onOpenChange(false);
                }}
              >
                <img
                  src={gif.previewUrl}
                  alt={gif.title}
                  loading="lazy"
                  className="h-full w-full object-cover"
                />
              </button>
            ))}
          </div>
          {loading && (
            <p className="text-xs text-muted-foreground mt-2">{t('loading')}</p>
          )}
        </DialogContent>
      </Dialog>
    );
  }
);

GifPickerDialog.displayName = 'GifPickerDialog';

export { GifPickerDialog };
```

> Verify `Dialog`/`DialogContent`/`DialogHeader`/`DialogTitle` are exported from `@sharkord/ui` (search for an existing dialog usage in the client; if names differ, match the existing component). `TGifSearchResult` must be re-exported from `@sharkord/shared` — add it to the shared package's public exports (see Step 2).

- [ ] **Step 2: Export the shared GIF result type**

In `packages/shared/src` index/barrel (wherever `extensions.ts` and types are re-exported — match the existing export style), re-export `TGifSearchResult` so the client can import it. If the server's `integrations/gif/types.ts` is server-only, instead define `TGifSearchResult` in a new `packages/shared/src/gif.ts` and import it from there in both the server provider and the client. Prefer the shared `gif.ts` location.

- [ ] **Step 3: Add i18n keys**

In `apps/client/src/i18n/locales/en/common.json` add: `gifPickerTitle`, `gifSearchPlaceholder`, `gifSearchFailed`, `loading` (if missing). Use plain English values.

- [ ] **Step 4: Type-check**

Run: `cd apps/client && bun run check-types`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
cd /c/Users/Neckr/Documents/bullshark
git add apps/client/src/components/gif-picker packages/shared/src apps/client/src/i18n/locales/en/common.json
git commit -m "feat(42): add client GIF picker dialog + shared TGifSearchResult"
```

---

## Task 11: Wire the picker into Avatar/Banner managers + allowlist accept

**Files:**
- Modify: `apps/client/src/components/server-screens/user-settings/profile/avatar-manager.tsx`
- Modify: `apps/client/src/components/server-screens/user-settings/profile/banner-manager.tsx`
- Modify (read): `apps/client/src/features/server/hooks.ts` (for the `klipyEnabled` public setting)

- [ ] **Step 1: Add a GIF button + accept allowlist to AvatarManager**

In `avatar-manager.tsx`:
- change the file picker call to `openFilePicker('.gif,.jpg,.jpeg,.png,.webp')`;
- read `const settings = usePublicServerSettings();` (same hook used in `user-popover/index.tsx`);
- add local state `const [gifOpen, setGifOpen] = useState(false);`
- render, only when `settings?.klipyEnabled`, a small button under the avatar: `GIF` → `onClick={() => setGifOpen(true)}`;
- render `<GifPickerDialog open={gifOpen} onOpenChange={setGifOpen} onSelect={onSelectGif} />`;
- add the handler:

```tsx
  const onSelectGif = useCallback(async (gifId: string) => {
    const trpc = getTRPCClient();
    try {
      await trpc.gifs.importToProfile.mutate({ gifId, target: 'avatar' });
      toast.success('Avatar updated successfully!');
    } catch (error) {
      toast.error(getTrpcError(error, 'Failed to update avatar'));
    }
  }, []);
```

- [ ] **Step 2: Mirror in BannerManager**

Apply the same three changes to `banner-manager.tsx` with `target: 'banner'` and the banner success/error copy, and `openFilePicker('.gif,.jpg,.jpeg,.png,.webp')`.

- [ ] **Step 3: Type-check**

Run: `cd apps/client && bun run check-types`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
cd /c/Users/Neckr/Documents/bullshark
git add apps/client/src/components/server-screens/user-settings/profile/avatar-manager.tsx apps/client/src/components/server-screens/user-settings/profile/banner-manager.tsx
git commit -m "feat(42): add GIF picker + extension allowlist to avatar/banner managers"
```

---

## Task 12: Admin UI — animated size control + Klipy API key

**Files:**
- Modify: `apps/client/src/components/server-screens/server-settings/storage/index.tsx`
- Modify: `apps/client/src/components/server-screens/server-settings/storage/presets.ts`
- Modify: `apps/client/src/features/server/admin/hooks.ts`
- Modify: `apps/client/src/i18n/locales/en/settings.json`

- [ ] **Step 1: Add an animated-size preset**

In `storage/presets.ts`, add `MAX_ANIMATED_IMAGE_SIZE_PRESETS` mirroring `MAX_AVATAR_SIZE_PRESETS` (e.g. 4 MB / 8 MB / 16 MB entries in the same `{ label, value }` shape).

- [ ] **Step 2: Surface new fields in the admin storage hook**

In `apps/client/src/features/server/admin/hooks.ts` (`useAdminStorage`), ensure `storageMaxAnimatedImageSize` and `klipyApiKey` are included in the editable `values` (they already flow from `getStorageSettings` once added there; if the hook whitelists fields, add both).

- [ ] **Step 3: Add the controls to the storage form**

In `storage/index.tsx`:
- import `STORAGE_MAX_ANIMATED_IMAGE_SIZE`, `STORAGE_MIN_FILE_SIZE`, and `MAX_ANIMATED_IMAGE_SIZE_PRESETS`;
- after the banner-size `Group`, add an animated-size `StorageSizeControl` Group bound to `values.storageMaxAnimatedImageSize` / `onChange('storageMaxAnimatedImageSize', ...)`, `max={STORAGE_MAX_ANIMATED_IMAGE_SIZE}`, `presets={MAX_ANIMATED_IMAGE_SIZE_PRESETS}`, with `labels.storageMaxAnimatedImageSize` preview;
- after the `Separator` near signed-urls, add a Klipy `Group` with an `Input` bound to `values.klipyApiKey` (`type="password"`), `onChange('klipyApiKey', e.target.value)`, label `t('klipyApiKeyLabel')`, description `t('klipyApiKeyDesc')`.

> If `labels.storageMaxAnimatedImageSize` is produced by the hook's label formatter, confirm the hook computes labels for all numeric size fields generically; if it's an explicit list, add the field there too.

- [ ] **Step 4: Add settings i18n keys**

In `apps/client/src/i18n/locales/en/settings.json` add: `maxAnimatedImageSizeLabel`, `maxAnimatedImageSizeDesc`, `klipyApiKeyLabel`, `klipyApiKeyDesc` with plain English values.

- [ ] **Step 5: Type-check + commit**

```bash
cd apps/client && bun run check-types
cd /c/Users/Neckr/Documents/bullshark
git add apps/client/src/components/server-screens/server-settings/storage apps/client/src/features/server/admin/hooks.ts apps/client/src/i18n/locales/en/settings.json
git commit -m "feat(42): admin controls for animated image size limit and Klipy API key"
```

---

## Task 13: Full verification pass

- [ ] **Step 1: Run the whole server test suite**

Run: `cd apps/server && bun test`
Expected: PASS (all suites, including new `is-animated-image`, `file-manager`, `users`, `others`, `gifs`).

- [ ] **Step 2: Run shared + client type checks and lint**

Run from repo root: `bun run check-types` then `bun run lint`
Expected: PASS. Fix any issues, then re-run.

- [ ] **Step 3: Manual smoke (documented, not automated)**

With a Klipy test API key set in admin storage settings: upload an animated GIF avatar (plays in sidebar/messages/popover/voice); upload a static PNG avatar; pick a GIF via the picker and confirm it is stored locally (served from the app, not Klipy); set a role without `ANIMATED_AVATAR` and confirm animated upload is rejected while static still works; confirm an 8.5 MB GIF is rejected and a 4.5 MB static image is rejected.

- [ ] **Step 4: Final commit (if any fixes were needed)**

```bash
cd /c/Users/Neckr/Documents/bullshark
git add -A
git commit -m "feat(42): fixes from full verification pass"
```

---

## Self-Review Notes (coverage vs spec)

- Animated avatars play everywhere — already true (existing `<img>` rendering); hardened by never flattening animated WebP (Task 6). ✓
- Banner static/animated — already implemented; now governed by the same allowlist/limits/permission via the shared helper (Task 7). ✓
- Upload sources A (disk) — allowlist `accept` + server allowlist (Tasks 7, 11). ✓
- Upload source B (Klipy picker) — Tasks 8–11. ✓
- Sovereign storage — server-side download into existing pipeline (Task 9). ✓
- 8 MB animated / 4 MB static, server-validated — Tasks 3, 5, 6. ✓
- `ANIMATED_AVATAR` per-role, default granted, covers avatar + banner — Tasks 1, 7. ✓
- Migration — Task 4. ✓

**Known live-API confirmations deferred to implementation (isolated in one mapping function each):** exact Klipy search item field paths and the single-GIF resolve endpoint (Task 8); `rateLimitedProcedure` call signature and `Dialog` export names (Tasks 9, 10). Each has a written fallback.
