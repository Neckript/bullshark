# Soundboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the server a shared library of short sound clips that any member with `SPEAK` can play into a voice channel.

**Architecture:** The library is server-wide and managed like custom emojis — a `sounds` table, a `sounds` tRPC router gated on a new `MANAGE_SOUNDS` permission, distributed to members through the existing join bootstrap and pubsub subscriptions. Playback transmits the clip as its **own** mediasoup audio producer (`StreamKind.SOUNDBOARD`), reusing the path `SCREEN_AUDIO` already takes. The microphone WebAudio chain is not modified at all.

**Tech Stack:** Bun, TypeScript, tRPC, Drizzle (SQLite), mediasoup, React 19, Redux Toolkit, Tailwind, i18next.

## Global Constraints

- Spec: `docs/superpowers/specs/2026-08-08-soundboard-design.md`. Read it before starting.
- Branch: `feat/soundboard` (already created from `development`). Do not merge or push.
- **Every commit must pass all three:** `bun run format:check`, `bun run check-types`, `bun run lint`, run from the repo root. CI gates on Prettier and it is the usual cause of red builds. Fix formatting with `bun run format`.
- Server tests run with `cd apps/server && bun test`.
- Naming is fixed by this plan. Do not rename anything defined in an earlier task.
- Limits, defined once in `packages/shared/src/statics/sounds.ts` (Task 1) and imported everywhere else — never re-declare them:
  - `MAX_SOUND_FILE_SIZE = 524288` (512 KB)
  - `MAX_SOUND_DURATION_SECONDS = 10`
  - `MAX_SOUNDS_PER_SERVER = 50`
  - `SOUND_TRIGGER_COOLDOWN_MS = 500`
  - `MAX_SOUND_NAME_LENGTH = 32`
- New user-facing strings must be added to **all 7 locales**: `en`, `fr`, `es`, `it`, `cs`, `ru`, `zh` under `apps/client/src/i18n/locales/<locale>/`. Use English text as the placeholder for locales you cannot translate confidently — never leave a key missing.
- The desktop and mobile repos need no changes; they render this client.

---

### Task 1: Shared foundation — permission, enums, limits, table, migration

**Files:**

- Create: `packages/shared/src/statics/sounds.ts`
- Modify: `packages/shared/src/statics/index.ts`
- Modify: `packages/shared/src/statics/permissions.ts:14-27`
- Modify: `packages/shared/src/types.ts:8-15`
- Modify: `packages/shared/src/helpers/get-mediasoup-kind.ts:6-15`
- Modify: `packages/shared/src/plugins/hooks.ts:3-10`
- Modify: `packages/shared/src/events.ts:28-30`
- Modify: `packages/shared/src/logs.ts` (enum near line 35, payload map near line 144)
- Modify: `packages/shared/src/tables.ts:2-22, 39, 139-142`
- Modify: `apps/server/src/db/schema.ts:366-385` (add `sounds` after `emojis`; export it)
- Test: `apps/server/src/routers/__tests__/sounds.test.ts` (created here, extended in Task 3)

**Interfaces:**

- Consumes: nothing.
- Produces: `Permission.MANAGE_SOUNDS`, `StreamKind.SOUNDBOARD`, `FileSaveType.SOUND`, `ServerEvents.SOUND_CREATE|SOUND_UPDATE|SOUND_DELETE`, `ActivityLogType.CREATED_SOUND|UPDATED_SOUND|DELETED_SOUND`, the `sounds` Drizzle table, types `TSound` / `TJoinedSound`, and the five limit constants.

- [ ] **Step 1: Create the limits module**

`packages/shared/src/statics/sounds.ts`:

```ts
export const MAX_SOUND_FILE_SIZE = 524288; // 512 KB
export const MAX_SOUND_DURATION_SECONDS = 10;
export const MAX_SOUNDS_PER_SERVER = 50;
export const SOUND_TRIGGER_COOLDOWN_MS = 500;
export const MAX_SOUND_NAME_LENGTH = 32;
```

Add to `packages/shared/src/statics/index.ts`, keeping the existing alphabetical order of the `export *` block:

```ts
export * from './sounds';
```

- [ ] **Step 2: Add the permission**

In `packages/shared/src/statics/permissions.ts`, add after `MANAGE_EMOJIS = 'MANAGE_EMOJIS',`:

```ts
  MANAGE_SOUNDS = 'MANAGE_SOUNDS',
```

Do **not** add it to `DEFAULT_ROLE_PERMISSIONS`.

- [ ] **Step 3: Add the stream kind and its mediasoup mapping**

In `packages/shared/src/types.ts`, inside `enum StreamKind`, after `SCREEN_AUDIO = 'screen_audio',`:

```ts
  SOUNDBOARD = 'soundboard',
```

In `packages/shared/src/helpers/get-mediasoup-kind.ts`, add to the audio case group:

```ts
    case StreamKind.AUDIO:
    case StreamKind.EXTERNAL_AUDIO:
    case StreamKind.SCREEN_AUDIO:
    case StreamKind.SOUNDBOARD:
      return 'audio';
```

- [ ] **Step 4: Add the file save type**

In `packages/shared/src/plugins/hooks.ts`, inside `enum FileSaveType`, after `ROLE_ICON = 'role_icon'` (add a comma to that line):

```ts
  SOUND = 'sound'
```

- [ ] **Step 5: Add the pubsub events**

In `packages/shared/src/events.ts`, after the three `EMOJI_*` entries:

```ts
  SOUND_CREATE = 'soundCreate',
  SOUND_UPDATE = 'soundUpdate',
  SOUND_DELETE = 'soundDelete',
```

- [ ] **Step 6: Add the activity log types**

In `packages/shared/src/logs.ts`, inside `enum ActivityLogType`, after the `*_EMOJI` entries:

```ts
  CREATED_SOUND = 'CREATED_SOUND',
  UPDATED_SOUND = 'UPDATED_SOUND',
  DELETED_SOUND = 'DELETED_SOUND',
```

And in the payload type map, after the `// -------------------- EMOJIS --------------------` block:

```ts
  // -------------------- SOUNDS --------------------
  [ActivityLogType.CREATED_SOUND]: {
    name: string;
  };
  [ActivityLogType.DELETED_SOUND]: {
    name: string;
  };
  [ActivityLogType.UPDATED_SOUND]: {
    fromName: string;
    toName: string;
  };
```

- [ ] **Step 7: Add the table to the Drizzle schema**

In `apps/server/src/db/schema.ts`, immediately after the `emojis` table definition (ends line 385):

```ts
const sounds = sqliteTable(
  'sounds',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    name: text('name').notNull().unique(),
    fileId: integer('file_id')
      .notNull()
      .references(() => files.id, { onDelete: 'cascade' }),
    userId: integer('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    createdAt: integer('created_at').notNull(),
    updatedAt: integer('updated_at')
  },
  (t) => [
    index('sounds_user_idx').on(t.userId),
    index('sounds_file_idx').on(t.fileId),
    uniqueIndex('sounds_name_idx').on(t.name)
  ]
);
```

Add `sounds` to the file's `export { ... }` list, keeping its existing ordering convention.

- [ ] **Step 8: Add the shared types**

In `packages/shared/src/tables.ts`, add `sounds` to the import list from `'../../../apps/server/src/db/schema'` (alphabetical, after `settings`), then after `export type TEmoji = ...` (line 39):

```ts
export type TSound = InferSelectModel<typeof sounds>;
```

After `TJoinedEmoji` (line 139-142):

```ts
export type TJoinedSound = TSound & {
  file: TFile;
  user: TPublicUser;
};
```

- [ ] **Step 9: Generate the migration**

Run: `cd apps/server && bun run db:gen`

Expected: a new file `apps/server/src/db/migrations/0026_<random_name>.sql` containing `CREATE TABLE \`sounds\`` plus the three indexes, and an updated `meta/_journal.json` + `meta/0026_snapshot.json`. Do not hand-edit these files.

- [ ] **Step 10: Write a test that the table exists and the migration applied**

Create `apps/server/src/routers/__tests__/sounds.test.ts`:

```ts
import { describe, expect, test } from 'bun:test';
import { db } from '../../db';
import { sounds } from '../../db/schema';

describe('sounds table', () => {
  test('exists and is queryable', async () => {
    const rows = await db.select().from(sounds);

    expect(Array.isArray(rows)).toBe(true);
  });
});
```

- [ ] **Step 11: Run the test**

Run: `cd apps/server && bun test src/routers/__tests__/sounds.test.ts`
Expected: PASS, 1 test.

- [ ] **Step 12: Verify the whole repo still builds**

Run from the repo root: `bun run check-types && bun run lint && bun run format:check`
Expected: all three exit 0. If `format:check` complains, run `bun run format` and re-check.

- [ ] **Step 13: Commit**

```bash
git add packages/shared apps/server/src/db apps/server/src/routers/__tests__/sounds.test.ts
git commit -m "feat(shared): soundboard permission, enums and sounds table"
```

---

### Task 2: Server queries and publisher

**Files:**

- Create: `apps/server/src/db/queries/sounds.ts`
- Modify: `apps/server/src/db/publishers.ts` (add after `publishEmoji`, ends line 93; export it)
- Test: `apps/server/src/db/queries/__tests__/sounds.test.ts`

**Interfaces:**

- Consumes: `sounds` table and `TJoinedSound` from Task 1.
- Produces:
  - `getSounds(): Promise<TJoinedSound[]>`
  - `getSoundById(id: number): Promise<TJoinedSound | undefined>`
  - `soundExists(name: string): Promise<boolean>`
  - `getUniqueSoundName(baseName: string): Promise<string>`
  - `countSounds(): Promise<number>`
  - `publishSound(soundId: number | undefined, type: 'create' | 'update' | 'delete'): Promise<void>`

- [ ] **Step 1: Write the failing test**

Create `apps/server/src/db/queries/__tests__/sounds.test.ts`:

```ts
import { describe, expect, test } from 'bun:test';
import { countSounds, getUniqueSoundName, soundExists } from '../sounds';

describe('sounds queries', () => {
  test('countSounds returns a number on an empty table', async () => {
    const count = await countSounds();

    expect(typeof count).toBe('number');
  });

  test('soundExists is false for an unknown name', async () => {
    expect(await soundExists('definitely_not_a_sound')).toBe(false);
  });

  test('getUniqueSoundName normalizes spaces and lowercases', async () => {
    expect(await getUniqueSoundName('My Sound')).toBe('my_sound');
  });
});
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `cd apps/server && bun test src/db/queries/__tests__/sounds.test.ts`
Expected: FAIL — cannot resolve module `../sounds`.

- [ ] **Step 3: Implement the queries**

Create `apps/server/src/db/queries/sounds.ts`. This mirrors `queries/emojis.ts`, plus `countSounds` for the quota check:

```ts
import { MAX_SOUND_NAME_LENGTH, type TJoinedSound } from '@sharkord/shared';
import { count, eq } from 'drizzle-orm';
import { db } from '..';
import { attachFileToken } from '../../helpers/files-crypto';
import { files, sounds, users } from '../schema';
import { getSettings } from './server';

const soundSelectFields = {
  sound: sounds,
  file: files,
  user: {
    id: users.id,
    name: users.name,
    bannerColor: users.bannerColor,
    nicknameColor: users.nicknameColor,
    nicknameFont: users.nicknameFont,
    showRoleBadge: users.showRoleBadge,
    bio: users.bio,
    createdAt: users.createdAt,
    banned: users.banned,
    avatarId: users.avatarId,
    bannerId: users.bannerId
  }
};

type TSoundRow = Awaited<ReturnType<typeof getSoundRows>>[number];

const getSoundRows = () =>
  db
    .select(soundSelectFields)
    .from(sounds)
    .innerJoin(files, eq(sounds.fileId, files.id))
    .innerJoin(users, eq(sounds.userId, users.id));

const parseSound = (
  row: TSoundRow,
  signedUrlsEnabled: boolean,
  signedUrlsTtlSeconds: number
): TJoinedSound => ({
  ...row.sound,
  file: attachFileToken(row.file, signedUrlsEnabled, signedUrlsTtlSeconds),
  user: { ...row.user, avatar: null, banner: null }
});

const getSoundById = async (id: number): Promise<TJoinedSound | undefined> => {
  const row = await getSoundRows().where(eq(sounds.id, id)).limit(1).get();

  if (!row) return undefined;

  const { storageSignedUrlsEnabled, storageSignedUrlsTtlSeconds } =
    await getSettings();

  return parseSound(row, storageSignedUrlsEnabled, storageSignedUrlsTtlSeconds);
};

const getSounds = async (): Promise<TJoinedSound[]> => {
  const rows = await getSoundRows();

  const { storageSignedUrlsEnabled, storageSignedUrlsTtlSeconds } =
    await getSettings();

  return rows.map((row) =>
    parseSound(row, storageSignedUrlsEnabled, storageSignedUrlsTtlSeconds)
  );
};

const soundExists = async (name: string): Promise<boolean> => {
  const sound = await db
    .select()
    .from(sounds)
    .where(eq(sounds.name, name))
    .limit(1)
    .get();

  return !!sound;
};

const countSounds = async (): Promise<number> => {
  const result = await db.select({ value: count() }).from(sounds).get();

  return result?.value ?? 0;
};

const getUniqueSoundName = async (baseName: string): Promise<string> => {
  let normalizedBase = baseName.toLowerCase().replace(/\s+/g, '_');

  if (normalizedBase.length > MAX_SOUND_NAME_LENGTH - 3) {
    normalizedBase = normalizedBase.substring(0, MAX_SOUND_NAME_LENGTH - 3);
  }

  let soundName = normalizedBase.substring(0, MAX_SOUND_NAME_LENGTH);
  let counter = 1;

  while (await soundExists(soundName)) {
    const suffix = `_${counter}`;
    const maxBaseLength = MAX_SOUND_NAME_LENGTH - suffix.length;
    soundName = `${normalizedBase.substring(0, maxBaseLength)}${suffix}`;
    counter++;
  }

  return soundName;
};

export {
  countSounds,
  getSoundById,
  getSounds,
  getUniqueSoundName,
  soundExists
};
```

- [ ] **Step 4: Run the test**

Run: `cd apps/server && bun test src/db/queries/__tests__/sounds.test.ts`
Expected: PASS, 3 tests.

- [ ] **Step 5: Add the publisher**

In `apps/server/src/db/publishers.ts`, import `getSoundById` from `./queries/sounds`, then add after `publishEmoji` (which ends at line 93):

```ts
const publishSound = async (
  soundId: number | undefined,
  type: 'create' | 'update' | 'delete'
) => {
  if (!soundId) return;

  if (type === 'delete') {
    pubsub.publish(ServerEvents.SOUND_DELETE, soundId);
    return;
  }

  const sound = await getSoundById(soundId);

  if (!sound) return;

  const targetEvent =
    type === 'create' ? ServerEvents.SOUND_CREATE : ServerEvents.SOUND_UPDATE;

  pubsub.publish(targetEvent, sound);
};
```

Add `publishSound` to the file's existing `export { ... }` list.

- [ ] **Step 6: Verify**

Run from the repo root: `bun run check-types && bun run lint && bun run format:check`
Expected: all exit 0.

- [ ] **Step 7: Commit**

```bash
git add apps/server/src/db
git commit -m "feat(server): sounds queries and pubsub publisher"
```

---

### Task 3: The `sounds` tRPC router

**Files:**

- Create: `apps/server/src/routers/sounds/add-sound.ts`
- Create: `apps/server/src/routers/sounds/get-sounds.ts`
- Create: `apps/server/src/routers/sounds/update-sound.ts`
- Create: `apps/server/src/routers/sounds/delete-sound.ts`
- Create: `apps/server/src/routers/sounds/events.ts`
- Create: `apps/server/src/routers/sounds/index.ts`
- Modify: `apps/server/src/routers/index.ts:5, 26` (import and register `soundsRouter`)
- Modify: `apps/server/src/config.ts:58, 123` (add the `addSound` rate limiter)
- Test: `apps/server/src/routers/__tests__/sounds.test.ts` (extend the file from Task 1)

**Interfaces:**

- Consumes: everything from Tasks 1 and 2.
- Produces: `trpc.sounds.add` (input `Array<{ fileId: string; name: string }>`), `trpc.sounds.getAll` (returns `TJoinedSound[]`), `trpc.sounds.update` (input `{ soundId: number; name: string }`), `trpc.sounds.delete` (input `{ soundId: number }`), and the subscriptions `trpc.sounds.onCreate` / `onUpdate` / `onDelete`.

- [ ] **Step 1: Write the failing tests**

Replace the contents of `apps/server/src/routers/__tests__/sounds.test.ts` with:

```ts
import { MAX_SOUND_FILE_SIZE, type TTempFile } from '@sharkord/shared';
import { describe, expect, test } from 'bun:test';
import { db } from '../../db';
import { sounds } from '../../db/schema';
import { initTest, uploadFile } from '../../__tests__/helpers';

const uploadSoundFile = async (
  mockedToken: string,
  name = 'clip.mp3',
  size = 1024
) => {
  const file = new File([new Uint8Array(size)], name, { type: 'audio/mpeg' });
  const response = await uploadFile(file, mockedToken);

  return (await response.json()) as TTempFile;
};

describe('sounds table', () => {
  test('exists and is queryable', async () => {
    const rows = await db.select().from(sounds);

    expect(Array.isArray(rows)).toBe(true);
  });
});

describe('sounds router', () => {
  test('should throw when user lacks permissions (add)', async () => {
    const { caller } = await initTest(2);

    await expect(
      caller.sounds.add([{ fileId: 'test-file-id', name: 'test_sound' }])
    ).rejects.toThrow('Insufficient permissions');
  });

  test('should throw when user lacks permissions (getAll)', async () => {
    const { caller } = await initTest(2);

    await expect(caller.sounds.getAll()).rejects.toThrow(
      'Insufficient permissions'
    );
  });

  test('should throw when user lacks permissions (update)', async () => {
    const { caller } = await initTest(2);

    await expect(
      caller.sounds.update({ soundId: 1, name: 'renamed' })
    ).rejects.toThrow('Insufficient permissions');
  });

  test('should throw when user lacks permissions (delete)', async () => {
    const { caller } = await initTest(2);

    await expect(caller.sounds.delete({ soundId: 1 })).rejects.toThrow(
      'Insufficient permissions'
    );
  });

  test('should add a sound and list it', async () => {
    const { caller, mockedToken } = await initTest();
    const uploaded = await uploadSoundFile(mockedToken);

    await caller.sounds.add([{ fileId: uploaded.id, name: 'test_sound' }]);

    const all = await caller.sounds.getAll();
    const added = all.find((s) => s.name === 'test_sound');

    expect(added).toBeDefined();
    expect(added!.userId).toBe(1);
    expect(added!.fileId).toBeDefined();
  });

  test('should reject a non-audio file', async () => {
    const { caller, mockedToken } = await initTest();
    const file = new File(['not audio'], 'image.png', { type: 'image/png' });
    const response = await uploadFile(file, mockedToken);
    const uploaded = (await response.json()) as TTempFile;

    await expect(
      caller.sounds.add([{ fileId: uploaded.id, name: 'not_a_sound' }])
    ).rejects.toThrow('Only audio files are allowed');
  });

  test('should reject a file over the size limit', async () => {
    const { caller, mockedToken } = await initTest();
    const uploaded = await uploadSoundFile(
      mockedToken,
      'big.mp3',
      MAX_SOUND_FILE_SIZE + 1
    );

    await expect(
      caller.sounds.add([{ fileId: uploaded.id, name: 'too_big' }])
    ).rejects.toThrow('Sound file is too large');
  });

  test('should de-duplicate colliding names', async () => {
    const { caller, mockedToken } = await initTest();

    const first = await uploadSoundFile(mockedToken, 'dup.mp3');
    await caller.sounds.add([{ fileId: first.id, name: 'duplicate' }]);

    const second = await uploadSoundFile(mockedToken, 'dup2.mp3');
    await caller.sounds.add([{ fileId: second.id, name: 'duplicate' }]);

    const all = await caller.sounds.getAll();
    const matches = all.filter((s) => s.name.startsWith('duplicate'));

    expect(matches.length).toBe(2);
    expect(matches.some((s) => s.name === 'duplicate_1')).toBe(true);
  });

  test('should rename and then delete a sound', async () => {
    const { caller, mockedToken } = await initTest();
    const uploaded = await uploadSoundFile(mockedToken, 'rename.mp3');

    await caller.sounds.add([{ fileId: uploaded.id, name: 'before_rename' }]);

    const created = (await caller.sounds.getAll()).find(
      (s) => s.name === 'before_rename'
    );

    expect(created).toBeDefined();

    await caller.sounds.update({ soundId: created!.id, name: 'after_rename' });

    const renamed = (await caller.sounds.getAll()).find(
      (s) => s.id === created!.id
    );

    expect(renamed!.name).toBe('after_rename');

    await caller.sounds.delete({ soundId: created!.id });

    const remaining = (await caller.sounds.getAll()).find(
      (s) => s.id === created!.id
    );

    expect(remaining).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run to confirm failure**

Run: `cd apps/server && bun test src/routers/__tests__/sounds.test.ts`
Expected: FAIL — `caller.sounds` is undefined.

- [ ] **Step 3: Add the rate limiter config**

In `apps/server/src/config.ts`, in the zod schema next to `addEmoji` (line 58):

```ts
    addSound: z.object({
      maxRequests: z.coerce.number().int().positive(),
      windowMs: z.coerce.number().int().positive()
    }),
```

And in the defaults object next to `addEmoji` (line 123):

```ts
    addSound: {
      maxRequests: 10,
      windowMs: 60_000
    },
```

- [ ] **Step 4: Implement `add`**

Create `apps/server/src/routers/sounds/add-sound.ts`:

```ts
import {
  ActivityLogType,
  FileSaveType,
  MAX_SOUND_FILE_SIZE,
  MAX_SOUND_NAME_LENGTH,
  MAX_SOUNDS_PER_SERVER,
  Permission
} from '@sharkord/shared';
import { z } from 'zod';
import { config } from '../../config';
import { db } from '../../db';
import { publishSound } from '../../db/publishers';
import { countSounds, getUniqueSoundName } from '../../db/queries/sounds';
import { sounds } from '../../db/schema';
import { enqueueActivityLog } from '../../queues/activity-log';
import { fileManager } from '../../utils/file-manager';
import { invariant } from '../../utils/invariant';
import { protectedProcedure, rateLimitedProcedure } from '../../utils/trpc';

const addSoundRoute = rateLimitedProcedure(protectedProcedure, {
  maxRequests: config.rateLimiters.addSound.maxRequests,
  windowMs: config.rateLimiters.addSound.windowMs,
  logLabel: 'addSound'
})
  .input(
    z.array(
      z.object({
        fileId: z.string(),
        name: z.string().min(1).max(MAX_SOUND_NAME_LENGTH)
      })
    )
  )
  .mutation(async ({ input, ctx }) => {
    await ctx.needsPermission(Permission.MANAGE_SOUNDS);

    for (const data of input) {
      const temporaryFile = fileManager.getTemporaryFile(data.fileId);

      invariant(temporaryFile, {
        code: 'NOT_FOUND',
        message: 'Uploaded file not found'
      });

      invariant(fileManager.temporaryFileHasMimeType(data.fileId, 'audio/'), {
        code: 'BAD_REQUEST',
        message: 'Only audio files are allowed'
      });

      invariant(temporaryFile.size <= MAX_SOUND_FILE_SIZE, {
        code: 'BAD_REQUEST',
        message: 'Sound file is too large'
      });

      invariant((await countSounds()) < MAX_SOUNDS_PER_SERVER, {
        code: 'BAD_REQUEST',
        message: 'This server has reached its sound limit'
      });

      const newFile = await fileManager.saveFile(
        data.fileId,
        ctx.userId,
        FileSaveType.SOUND
      );

      const uniqueSoundName = await getUniqueSoundName(data.name);

      const sound = db
        .insert(sounds)
        .values({
          name: uniqueSoundName,
          fileId: newFile.id,
          userId: ctx.userId,
          createdAt: Date.now()
        })
        .returning()
        .get();

      publishSound(sound.id, 'create');
      enqueueActivityLog({
        type: ActivityLogType.CREATED_SOUND,
        userId: ctx.user.id,
        details: {
          name: sound.name
        }
      });
    }
  });

export { addSoundRoute };
```

- [ ] **Step 5: Implement `getAll`**

Create `apps/server/src/routers/sounds/get-sounds.ts`:

```ts
import { Permission } from '@sharkord/shared';
import { getSounds } from '../../db/queries/sounds';
import { protectedProcedure } from '../../utils/trpc';

const getSoundsRoute = protectedProcedure.query(async ({ ctx }) => {
  await ctx.needsPermission(Permission.MANAGE_SOUNDS);

  const sounds = await getSounds();

  return sounds;
});

export { getSoundsRoute };
```

- [ ] **Step 6: Implement `update`**

Create `apps/server/src/routers/sounds/update-sound.ts`:

```ts
import {
  ActivityLogType,
  MAX_SOUND_NAME_LENGTH,
  Permission
} from '@sharkord/shared';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../../db';
import { publishSound } from '../../db/publishers';
import { getSoundById, soundExists } from '../../db/queries/sounds';
import { sounds } from '../../db/schema';
import { enqueueActivityLog } from '../../queues/activity-log';
import { invariant } from '../../utils/invariant';
import { protectedProcedure } from '../../utils/trpc';

const updateSoundRoute = protectedProcedure
  .input(
    z.object({
      soundId: z.number().min(1),
      name: z.string().min(1).max(MAX_SOUND_NAME_LENGTH)
    })
  )
  .mutation(async ({ ctx, input }) => {
    await ctx.needsPermission(Permission.MANAGE_SOUNDS);

    const existingSound = await getSoundById(input.soundId);

    invariant(existingSound, {
      code: 'NOT_FOUND',
      message: 'Sound not found'
    });

    const exists = await soundExists(input.name);

    if (exists) {
      ctx.throwValidationError('name', 'A sound with this name already exists.');
    }

    const updatedSound = await db
      .update(sounds)
      .set({
        name: input.name,
        updatedAt: Date.now()
      })
      .where(eq(sounds.id, existingSound.id))
      .returning()
      .get();

    publishSound(updatedSound.id, 'update');
    enqueueActivityLog({
      type: ActivityLogType.UPDATED_SOUND,
      userId: ctx.user.id,
      details: {
        fromName: existingSound.name,
        toName: input.name
      }
    });
  });

export { updateSoundRoute };
```

- [ ] **Step 7: Implement `delete`**

Create `apps/server/src/routers/sounds/delete-sound.ts`:

```ts
import { ActivityLogType, Permission } from '@sharkord/shared';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../../db';
import { removeFile } from '../../db/mutations/files';
import { publishSound } from '../../db/publishers';
import { sounds } from '../../db/schema';
import { enqueueActivityLog } from '../../queues/activity-log';
import { invariant } from '../../utils/invariant';
import { protectedProcedure } from '../../utils/trpc';

const deleteSoundRoute = protectedProcedure
  .input(
    z.object({
      soundId: z.number()
    })
  )
  .mutation(async ({ input, ctx }) => {
    await ctx.needsPermission(Permission.MANAGE_SOUNDS);

    const removedSound = await db
      .delete(sounds)
      .where(eq(sounds.id, input.soundId))
      .returning()
      .get();

    invariant(removedSound, {
      code: 'NOT_FOUND',
      message: 'Sound not found'
    });

    await removeFile(removedSound.fileId);

    publishSound(removedSound.id, 'delete');
    enqueueActivityLog({
      type: ActivityLogType.DELETED_SOUND,
      userId: ctx.user.id,
      details: {
        name: removedSound.name
      }
    });
  });

export { deleteSoundRoute };
```

- [ ] **Step 8: Implement the subscriptions and the router index**

Create `apps/server/src/routers/sounds/events.ts`:

```ts
import { ServerEvents } from '@sharkord/shared';
import { protectedProcedure } from '../../utils/trpc';

const onSoundCreateRoute = protectedProcedure.subscription(async ({ ctx }) => {
  return ctx.pubsub.subscribe(ServerEvents.SOUND_CREATE);
});

const onSoundDeleteRoute = protectedProcedure.subscription(async ({ ctx }) => {
  return ctx.pubsub.subscribe(ServerEvents.SOUND_DELETE);
});

const onSoundUpdateRoute = protectedProcedure.subscription(async ({ ctx }) => {
  return ctx.pubsub.subscribe(ServerEvents.SOUND_UPDATE);
});

export { onSoundCreateRoute, onSoundDeleteRoute, onSoundUpdateRoute };
```

Create `apps/server/src/routers/sounds/index.ts`:

```ts
import { t } from '../../utils/trpc';
import { addSoundRoute } from './add-sound';
import { deleteSoundRoute } from './delete-sound';
import {
  onSoundCreateRoute,
  onSoundDeleteRoute,
  onSoundUpdateRoute
} from './events';
import { getSoundsRoute } from './get-sounds';
import { updateSoundRoute } from './update-sound';

export const soundsRouter = t.router({
  add: addSoundRoute,
  update: updateSoundRoute,
  delete: deleteSoundRoute,
  getAll: getSoundsRoute,
  onCreate: onSoundCreateRoute,
  onDelete: onSoundDeleteRoute,
  onUpdate: onSoundUpdateRoute
});
```

- [ ] **Step 9: Register the router**

In `apps/server/src/routers/index.ts`, add the import next to the emojis one (line 5) and the entry next to `emojis: emojisRouter,` (line 26):

```ts
import { soundsRouter } from './sounds';
```

```ts
  sounds: soundsRouter,
```

- [ ] **Step 10: Run the tests**

Run: `cd apps/server && bun test src/routers/__tests__/sounds.test.ts`
Expected: PASS, 10 tests.

If the "reject a non-audio file" or "too large" test fails on the error message, make the `invariant` messages match the strings asserted in the test exactly — do not weaken the assertions.

If the "too large" test instead fails at the **upload** step (the `/upload` endpoint rejecting the file before `sounds.add` ever runs), that is the server's global upload cap firing first. In that case change the test to assert the upload response status rather than the tRPC error, and note in the commit message that the size cap is enforced upstream. Do not delete the test.

- [ ] **Step 11: Run the whole server suite for regressions**

Run: `cd apps/server && bun test`
Expected: no new failures compared to before this task.

- [ ] **Step 12: Verify and commit**

Run from the repo root: `bun run check-types && bun run lint && bun run format:check`

```bash
git add apps/server/src/routers apps/server/src/config.ts
git commit -m "feat(server): sounds router with permission and file validation"
```

---

### Task 4: Distribute the library through the join bootstrap

**Files:**

- Modify: `apps/server/src/routers/others/join.ts:10, 72-93, 148-158`
- Test: `apps/server/src/routers/__tests__/sounds.test.ts` (append one test)

**Interfaces:**

- Consumes: `getSounds()` from Task 2.
- Produces: a `sounds: TJoinedSound[]` field on the `others.joinServer` payload, which Task 6 reads.

- [ ] **Step 1: Write the failing test**

Append to `apps/server/src/routers/__tests__/sounds.test.ts`, inside the `describe('sounds router', ...)` block:

```ts
  test('join payload includes the sound library', async () => {
    const { initialData } = await initTest();

    expect(Array.isArray(initialData.sounds)).toBe(true);
  });
```

- [ ] **Step 2: Run to confirm failure**

Run: `cd apps/server && bun test src/routers/__tests__/sounds.test.ts`
Expected: FAIL — `initialData.sounds` is undefined (TypeScript will also flag it).

- [ ] **Step 3: Add sounds to the join payload**

In `apps/server/src/routers/others/join.ts`:

Add the import next to the emojis query import (line 10):

```ts
import { getSounds } from '../../db/queries/sounds';
```

Add `sounds` to the destructured array (after `emojis,` on line 77) and `getSounds()` to the `Promise.all` (after `getEmojis(),` on line 88). The two lists are positional — keep them in the same order.

Add `sounds,` to the returned object, next to `emojis,` (line 153).

- [ ] **Step 4: Run the test**

Run: `cd apps/server && bun test src/routers/__tests__/sounds.test.ts`
Expected: PASS, 11 tests.

- [ ] **Step 5: Verify and commit**

Run from the repo root: `bun run check-types && bun run lint && bun run format:check`

```bash
git add apps/server/src/routers apps/server/src/db
git commit -m "feat(server): ship the sound library in the join payload"
```

---

### Task 5: Authorize the `SOUNDBOARD` producer

**Files:**

- Modify: `apps/server/src/routers/voice/produce.ts:37-52`
- Test: `apps/server/src/routers/__tests__/sounds.test.ts` (append one test)

**Interfaces:**

- Consumes: `StreamKind.SOUNDBOARD` from Task 1.
- Produces: nothing new; clients may now call `voice.produce` with `kind: 'soundboard'`.

- [ ] **Step 1: Write the failing test**

Append to `apps/server/src/routers/__tests__/sounds.test.ts` a new top-level `describe`. Import `StreamKind` from `@sharkord/shared` at the top of the file:

```ts
describe('soundboard producer', () => {
  test('rejects producing when the user is not in a voice channel', async () => {
    const { caller } = await initTest();

    await expect(
      caller.voice.produce({
        transportId: 'test-transport',
        kind: StreamKind.SOUNDBOARD,
        rtpParameters: {}
      })
    ).rejects.toThrow('User is not in a voice channel');
  });
});
```

This asserts the kind is accepted by the input schema and reaches the runtime checks. Full `SPEAK` enforcement is covered by the manual end-to-end pass — the test harness has no mediasoup transport.

- [ ] **Step 2: Run to confirm it fails**

Run: `cd apps/server && bun test src/routers/__tests__/sounds.test.ts`
Expected: FAIL until Task 1's enum change is present; if Task 1 is done, this test may already pass — that is fine, keep it as a regression guard and move to Step 3.

- [ ] **Step 3: Add the permission branch**

In `apps/server/src/routers/voice/produce.ts`, extend the kind checks:

```ts
    if (input.kind === StreamKind.AUDIO) {
      await ctx.needsChannelPermission(
        ctx.currentVoiceChannelId,
        ChannelPermission.SPEAK
      );
    } else if (input.kind === StreamKind.SOUNDBOARD) {
      await ctx.needsChannelPermission(
        ctx.currentVoiceChannelId,
        ChannelPermission.SPEAK
      );
    } else if (input.kind === StreamKind.VIDEO) {
```

- [ ] **Step 4: Run the tests**

Run: `cd apps/server && bun test src/routers/__tests__/sounds.test.ts`
Expected: PASS, 12 tests.

- [ ] **Step 5: Verify and commit**

Run from the repo root: `bun run check-types && bun run lint && bun run format:check`

```bash
git add apps/server/src/routers/voice/produce.ts apps/server/src/routers/__tests__/sounds.test.ts
git commit -m "feat(server): require SPEAK to produce a soundboard stream"
```

---

### Task 6: Client state — slice, actions, selectors, subscriptions

**Files:**

- Create: `apps/client/src/features/server/sounds/actions.ts`
- Create: `apps/client/src/features/server/sounds/selectors.ts`
- Create: `apps/client/src/features/server/sounds/hooks.ts`
- Create: `apps/client/src/features/server/sounds/subscriptions.ts`
- Modify: `apps/client/src/features/server/slice.ts:39, 82, 156-188, 601-630`
- Modify: `apps/client/src/features/server/subscriptions.ts:7, 38`

**Interfaces:**

- Consumes: the `sounds` join field (Task 4) and the `sounds.on*` subscriptions (Task 3).
- Produces:
  - `useSounds(): TJoinedSound[]`
  - `soundsSelector(state: IRootState): TJoinedSound[]`
  - `addSound`, `updateSound`, `removeSound`, `setSounds` action creators
  - `subscribeToSounds(): () => void`

- [ ] **Step 1: Extend the Redux slice**

In `apps/client/src/features/server/slice.ts`, mirroring every place `emojis` appears:

- Import `TJoinedSound` alongside `TJoinedEmoji`.
- Add `sounds: TJoinedSound[];` to the state type (next to line 39).
- Add `sounds: [],` to the initial state (next to line 82).
- Add `sounds: TJoinedSound[];` to the `setInitialData` payload type (next to line 165) and `state.sounds = action.payload.sounds;` to its body (next to line 177).
- Add a `// SOUNDS` reducer block after the emoji block (line 601 onwards):

```ts
    // SOUNDS -------------------------------------------------------------

    setSounds: (state, action: PayloadAction<TJoinedSound[]>) => {
      state.sounds = action.payload;
    },
    updateSound: (
      state,
      action: PayloadAction<{ soundId: number; sound: Partial<TJoinedSound> }>
    ) => {
      const index = state.sounds.findIndex(
        (s) => s.id === action.payload.soundId
      );

      if (index === -1) return;

      state.sounds[index] = {
        ...state.sounds[index],
        ...action.payload.sound
      } as TJoinedSound;
    },
    addSound: (state, action: PayloadAction<TJoinedSound>) => {
      const exists = state.sounds.find((s) => s.id === action.payload.id);

      if (exists) return;

      state.sounds.push(action.payload);
    },
    removeSound: (state, action: PayloadAction<{ soundId: number }>) => {
      state.sounds = state.sounds.filter((s) => s.id !== action.payload.soundId);
    },
```

Also mirror the two user-cleanup lines the emoji state has (around lines 435 and 489): remove a deleted user's sounds, and reassign sounds on user reassignment, using the same logic with `state.sounds`.

- [ ] **Step 2: Create the actions**

`apps/client/src/features/server/sounds/actions.ts`:

```ts
import { store } from '@/features/store';
import type { TJoinedSound } from '@sharkord/shared';
import { serverSliceActions } from '../slice';

export const setSounds = (sounds: TJoinedSound[]) => {
  store.dispatch(serverSliceActions.setSounds(sounds));
};

export const addSound = (sound: TJoinedSound) => {
  store.dispatch(serverSliceActions.addSound(sound));
};

export const updateSound = (soundId: number, sound: Partial<TJoinedSound>) => {
  store.dispatch(serverSliceActions.updateSound({ soundId, sound }));
};

export const removeSound = (soundId: number) => {
  store.dispatch(serverSliceActions.removeSound({ soundId }));
};
```

- [ ] **Step 3: Create the selector and hook**

`apps/client/src/features/server/sounds/selectors.ts`:

```ts
import type { IRootState } from '@/features/store';

export const soundsSelector = (state: IRootState) => state.server.sounds;
```

`apps/client/src/features/server/sounds/hooks.ts`:

```ts
import { useSelector } from 'react-redux';
import { soundsSelector } from './selectors';

export const useSounds = () => useSelector(soundsSelector);
```

- [ ] **Step 4: Create the subscriptions**

`apps/client/src/features/server/sounds/subscriptions.ts`:

```ts
import { logDebug } from '@/helpers/browser-logger';
import { getTRPCClient } from '@/lib/trpc';
import type { TJoinedSound } from '@sharkord/shared';
import { addSound, removeSound, updateSound } from './actions';

const subscribeToSounds = () => {
  const trpc = getTRPCClient();

  const onSoundCreateSub = trpc.sounds.onCreate.subscribe(undefined, {
    onData: (sound: TJoinedSound) => {
      logDebug('[EVENTS] sounds.onCreate', { sound });
      addSound(sound);
    },
    onError: (err) => console.error('onSoundCreate subscription error:', err)
  });

  const onSoundDeleteSub = trpc.sounds.onDelete.subscribe(undefined, {
    onData: (soundId: number) => {
      logDebug('[EVENTS] sounds.onDelete', { soundId });
      removeSound(soundId);
    },
    onError: (err) => console.error('onSoundDelete subscription error:', err)
  });

  const onSoundUpdateSub = trpc.sounds.onUpdate.subscribe(undefined, {
    onData: (sound: TJoinedSound) => {
      logDebug('[EVENTS] sounds.onUpdate', { sound });
      updateSound(sound.id, sound);
    },
    onError: (err) => console.error('onSoundUpdate subscription error:', err)
  });

  return () => {
    onSoundCreateSub.unsubscribe();
    onSoundDeleteSub.unsubscribe();
    onSoundUpdateSub.unsubscribe();
  };
};

export { subscribeToSounds };
```

- [ ] **Step 5: Register the subscriptions**

In `apps/client/src/features/server/subscriptions.ts`, add the import next to `subscribeToEmojis` (line 7) and add `subscribeToSounds,` to the `subscriptors` array (next to line 38).

- [ ] **Step 6: Verify**

Run from the repo root: `bun run check-types && bun run lint && bun run format:check`
Expected: all exit 0. `check-types` failing on `state.server.sounds` means Step 1 is incomplete.

- [ ] **Step 7: Commit**

```bash
git add apps/client/src/features
git commit -m "feat(client): sound library state and live subscriptions"
```

---

### Task 7: Server-settings management UI

**Files:**

- Create: `apps/client/src/components/server-screens/server-settings/sounds/index.tsx`
- Create: `apps/client/src/components/server-screens/server-settings/sounds/sound-item.tsx`
- Create: `apps/client/src/components/server-screens/server-settings/sounds/sound-list.tsx`
- Create: `apps/client/src/components/server-screens/server-settings/sounds/update-sound.tsx`
- Create: `apps/client/src/components/server-screens/server-settings/sounds/upload-sound.tsx`
- Create: `apps/client/src/helpers/get-audio-duration.ts`
- Modify: `apps/client/src/features/server/admin/hooks.ts` (add `useAdminSounds` after `useAdminEmojis`, which ends near line 400)
- Modify: `apps/client/src/components/server-screens/server-settings/index.tsx:9, 25-34, 50-55, 93-95`
- Modify: `apps/client/src/i18n/locales/<locale>/settings.json` (7 files)
- Modify: `apps/client/src/i18n/locales/<locale>/permissions.json` (7 files)

**Interfaces:**

- Consumes: `trpc.sounds.*` (Task 3), `Permission.MANAGE_SOUNDS` and the limit constants (Task 1).
- Produces: `getAudioDuration(file: File): Promise<number>` (seconds), and `useAdminSounds()` returning `{ sounds: TJoinedSound[]; refetch: () => void; loading: boolean }`.

**Read first:** `apps/client/src/components/server-screens/server-settings/emojis/` — the sound screen is the deliberate counterpart of that directory. The code below is complete; consult the emoji files only if an import path or a `@sharkord/ui` prop does not resolve as written.

**No client tests in this task or any later one.** `apps/client` has no `test` script and no test files. Verification is `check-types` + `lint` + `format:check`, then the manual pass at the end of this plan. Do not stand up a client test harness.

- [ ] **Step 1: Add the duration helper**

`apps/client/src/helpers/get-audio-duration.ts`:

```ts
const getAudioDuration = async (file: File): Promise<number> => {
  const arrayBuffer = await file.arrayBuffer();
  const audioContext = new AudioContext();

  try {
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

    return audioBuffer.duration;
  } finally {
    audioContext.close();
  }
};

export { getAudioDuration };
```

- [ ] **Step 2: Add the admin hook**

In `apps/client/src/features/server/admin/hooks.ts`, add after `useAdminEmojis`, following its exact shape:

```ts
export const useAdminSounds = () => {
  const [loading, setLoading] = useState(true);
  const [sounds, setSounds] = useState<TJoinedSound[]>([]);

  const fetchSounds = useCallback(async () => {
    setLoading(true);

    const trpc = getTRPCClient();
    const sounds = await trpc.sounds.getAll.query();

    setSounds(sounds);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchSounds();
  }, [fetchSounds]);

  return { sounds, refetch: fetchSounds, loading };
};
```

Import `TJoinedSound` from `@sharkord/shared` at the top of the file.

- [ ] **Step 3: Build the Sounds settings screen**

`apps/client/src/components/server-screens/server-settings/sounds/index.tsx`, modelled on `emojis/index.tsx`, with the duration check added before upload:

```tsx
import { useAdminSounds } from '@/features/server/admin/hooks';
import { getAudioDuration } from '@/helpers/get-audio-duration';
import { uploadFiles } from '@/helpers/upload-file';
import { useFilePicker } from '@/hooks/use-file-picker';
import { getTRPCClient } from '@/lib/trpc';
import {
  MAX_SOUND_DURATION_SECONDS,
  MAX_SOUND_FILE_SIZE,
  MAX_SOUND_NAME_LENGTH
} from '@sharkord/shared';
import { LoadingCard } from '@sharkord/ui';
import { memo, useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { SoundList } from './sound-list';
import { UpdateSound } from './update-sound';
import { UploadSound } from './upload-sound';

const Sounds = memo(() => {
  const { t } = useTranslation('settings');
  const { sounds, refetch, loading } = useAdminSounds();
  const openFilePicker = useFilePicker();

  const [selectedSoundId, setSelectedSoundId] = useState<number | undefined>(
    undefined
  );
  const [isUploading, setIsUploading] = useState(false);

  const uploadSound = useCallback(async () => {
    const files = await openFilePicker('audio/*', true);

    if (!files || files.length === 0) return;

    setIsUploading(true);

    const trpc = getTRPCClient();

    try {
      for (const file of files) {
        if (file.size > MAX_SOUND_FILE_SIZE) {
          toast.error(t('soundTooLarge'));
          return;
        }

        const duration = await getAudioDuration(file);

        if (duration > MAX_SOUND_DURATION_SECONDS) {
          toast.error(t('soundTooLong'));
          return;
        }
      }

      const temporaryFiles = await uploadFiles(files);

      await trpc.sounds.add.mutate(
        temporaryFiles.map((f) => ({
          name: f.originalName
            .replace(/\.[^/.]+$/, '')
            .slice(0, MAX_SOUND_NAME_LENGTH),
          fileId: f.id
        }))
      );

      refetch();
      toast.success(t('soundCreated'));
    } catch (error) {
      console.error('Error uploading sound:', error);
      toast.error(t('failedUploadSound'));
    } finally {
      setIsUploading(false);
    }
  }, [openFilePicker, refetch, t]);

  const selectedSound = useMemo(
    () => sounds.find((s) => s.id === selectedSoundId),
    [sounds, selectedSoundId]
  );

  if (loading) {
    return <LoadingCard className="h-[600px]" />;
  }

  return (
    <div className="flex flex-col gap-6 md:flex-row">
      <SoundList
        sounds={sounds}
        setSelectedSoundId={(id) => setSelectedSoundId(id)}
        selectedSoundId={selectedSoundId ?? -1}
        uploadSound={uploadSound}
        isUploading={isUploading}
      />

      {selectedSound ? (
        <UpdateSound
          key={selectedSound.id}
          selectedSound={selectedSound}
          setSelectedSoundId={setSelectedSoundId}
          refetch={refetch}
        />
      ) : (
        <UploadSound uploadSound={uploadSound} isUploading={isUploading} />
      )}
    </div>
  );
});

export { Sounds };
```

- [ ] **Step 4: Build the sound tile**

`apps/client/src/components/server-screens/server-settings/sounds/sound-item.tsx`. This replaces the emoji `<img>` tile with a local preview button — the only structural difference from the emoji version:

```tsx
import { cn } from '@/lib/utils';
import { Play, Square } from 'lucide-react';
import { memo } from 'react';

type TSoundItemProps = {
  name: string;
  isPlaying: boolean;
  className?: string;
  onClick?: () => void;
  onTogglePreview: () => void;
};

const SoundItem = memo(
  ({
    name,
    isPlaying,
    onClick,
    onTogglePreview,
    className
  }: TSoundItemProps) => {
    return (
      <div
        className={cn(
          'flex cursor-pointer flex-col items-center justify-center gap-1 rounded-md p-2',
          className
        )}
        onClick={onClick}
      >
        <button
          type="button"
          className="text-muted-foreground hover:text-foreground"
          onClick={(e) => {
            e.stopPropagation();
            onTogglePreview();
          }}
          aria-label={name}
        >
          {isPlaying ? (
            <Square className="h-5 w-5" />
          ) : (
            <Play className="h-5 w-5" />
          )}
        </button>
        <span className="w-full truncate text-center text-xs">{name}</span>
      </div>
    );
  }
);

export { SoundItem };
```

- [ ] **Step 5: Build the list**

`apps/client/src/components/server-screens/server-settings/sounds/sound-list.tsx`. Mirrors `emoji-list.tsx:25-104`, with a 3-column grid instead of 6 (tiles carry a label) and a preview `Audio` element held in a ref so only one clip previews at a time:

```tsx
import { getFileUrl } from '@/helpers/get-file-url';
import type { TJoinedSound } from '@sharkord/shared';
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Input,
  Spinner
} from '@sharkord/ui';
import { Plus, Search } from 'lucide-react';
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { SoundItem } from './sound-item';

type TSoundListProps = {
  sounds: TJoinedSound[];
  setSelectedSoundId: (id: number) => void;
  selectedSoundId: number;
  uploadSound: () => void;
  isUploading: boolean;
};

const SoundList = memo(
  ({
    sounds,
    setSelectedSoundId,
    selectedSoundId,
    uploadSound,
    isUploading
  }: TSoundListProps) => {
    const { t } = useTranslation('settings');
    const [search, setSearch] = useState('');
    const [previewingId, setPreviewingId] = useState<number | undefined>(
      undefined
    );
    const audioRef = useRef<HTMLAudioElement | null>(null);

    const stopPreview = useCallback(() => {
      audioRef.current?.pause();
      audioRef.current = null;
      setPreviewingId(undefined);
    }, []);

    useEffect(() => stopPreview, [stopPreview]);

    const togglePreview = useCallback(
      (sound: TJoinedSound) => {
        if (previewingId === sound.id) {
          stopPreview();
          return;
        }

        stopPreview();

        const audio = new Audio(getFileUrl(sound.file));
        audio.onended = () => setPreviewingId(undefined);
        audioRef.current = audio;
        setPreviewingId(sound.id);
        audio.play().catch(() => stopPreview());
      },
      [previewingId, stopPreview]
    );

    const filteredSounds = useMemo(() => {
      const sorted = [...sounds].sort((a, b) => b.createdAt - a.createdAt);

      if (!search) return sorted;

      return sorted.filter((sound) =>
        sound.name.toLowerCase().includes(search.toLowerCase())
      );
    }, [sounds, search]);

    return (
      <Card className="w-full md:w-80 md:flex-shrink-0">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">{t('soundTitle')}</CardTitle>
            <Button
              size="icon"
              variant="ghost"
              onClick={uploadSound}
              disabled={isUploading}
            >
              {isUploading ? (
                <Spinner size="xs" />
              ) : (
                <Plus className="h-4 w-4" />
              )}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4 p-4">
          <div className="relative">
            <Search className="text-muted-foreground absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" />
            <Input
              placeholder={t('searchSoundsPlaceholder')}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <div className="max-h-96 overflow-y-auto">
            {filteredSounds.length === 0 ? (
              <div className="text-muted-foreground py-8 text-center text-sm">
                {search ? t('noSoundsFound') : t('noCustomSoundsYet')}
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-2">
                {filteredSounds.map((sound) => (
                  <SoundItem
                    key={sound.id}
                    name={sound.name}
                    isPlaying={previewingId === sound.id}
                    onClick={() => setSelectedSoundId(sound.id)}
                    onTogglePreview={() => togglePreview(sound)}
                    className={
                      selectedSoundId === sound.id
                        ? 'bg-accent ring-primary ring-2'
                        : undefined
                    }
                  />
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }
);

export { SoundList };
```

Note the `[...sounds].sort(...)` copy — `emoji-list.tsx:37` sorts the prop array in place, which mutates Redux-derived state. Do not carry that bug over.

- [ ] **Step 6: Build the empty-state panel**

`apps/client/src/components/server-screens/server-settings/sounds/upload-sound.tsx`. Mirrors `upload-emoji.tsx`, but the description states the limits from the constants rather than hardcoded numbers:

```tsx
import {
  MAX_SOUND_DURATION_SECONDS,
  MAX_SOUND_FILE_SIZE
} from '@sharkord/shared';
import { Button, Card, CardContent } from '@sharkord/ui';
import { filesize } from 'filesize';
import { Upload } from 'lucide-react';
import { memo } from 'react';
import { useTranslation } from 'react-i18next';

type TUploadSoundProps = {
  uploadSound: () => void;
  isUploading: boolean;
};

const UploadSound = memo(({ uploadSound, isUploading }: TUploadSoundProps) => {
  const { t } = useTranslation('settings');

  return (
    <Card className="flex flex-1 items-center justify-center">
      <CardContent className="text-muted-foreground max-w-md py-12 text-center">
        <div className="mb-4 text-4xl">🎵</div>
        <h3 className="mb-2 font-medium">{t('uploadSoundTitle')}</h3>
        <p className="mb-4 text-sm">
          {t('uploadSoundDesc', {
            size: filesize(MAX_SOUND_FILE_SIZE),
            seconds: MAX_SOUND_DURATION_SECONDS
          })}
        </p>
        <Button onClick={uploadSound} disabled={isUploading}>
          <Upload className="mr-2 h-4 w-4" />
          {t('uploadSoundBtn')}
        </Button>
      </CardContent>
    </Card>
  );
});

export { UploadSound };
```

- [ ] **Step 7: Build the edit panel**

`apps/client/src/components/server-screens/server-settings/sounds/update-sound.tsx`, mirroring `update-emoji.tsx:31-140`:

```tsx
import { requestConfirmation } from '@/features/dialogs/actions';
import { getFileUrl } from '@/helpers/get-file-url';
import { getTRPCClient } from '@/lib/trpc';
import {
  parseTrpcErrors,
  type TJoinedSound,
  type TTrpcErrors
} from '@sharkord/shared';
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Input,
  Label
} from '@sharkord/ui';
import { filesize } from 'filesize';
import { Trash2 } from 'lucide-react';
import { memo, useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';

type TUpdateSoundProps = {
  selectedSound: TJoinedSound;
  setSelectedSoundId: (id: number | undefined) => void;
  refetch: () => void;
};

const UpdateSound = memo(
  ({ selectedSound, setSelectedSoundId, refetch }: TUpdateSoundProps) => {
    const { t } = useTranslation('settings');
    const [name, setName] = useState(selectedSound.name);
    const [errors, setErrors] = useState<TTrpcErrors>({});

    const onDeleteSound = useCallback(async () => {
      const choice = await requestConfirmation({
        title: t('deleteSoundTitle'),
        message: t('deleteSoundMsg'),
        confirmLabel: t('deleteSoundBtn')
      });

      if (!choice) return;

      const trpc = getTRPCClient();

      try {
        await trpc.sounds.delete.mutate({ soundId: selectedSound.id });
        toast.success(t('soundDeleted'));
        refetch();
        setSelectedSoundId(undefined);
      } catch {
        toast.error(t('failedDeleteSound'));
      }
    }, [selectedSound.id, refetch, setSelectedSoundId, t]);

    const onUpdateSound = useCallback(async () => {
      const trpc = getTRPCClient();

      try {
        await trpc.sounds.update.mutate({ soundId: selectedSound.id, name });
        toast.success(t('soundUpdated'));
        refetch();
      } catch (error) {
        setErrors(parseTrpcErrors(error));
      }
    }, [name, selectedSound.id, refetch, t]);

    const onNameChange = useCallback(
      (e: React.ChangeEvent<HTMLInputElement>) => {
        setName(e.target.value);
        setErrors((prev) => ({ ...prev, name: undefined }));
      },
      []
    );

    return (
      <Card className="flex-1">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>{t('editSoundTitle')}</CardTitle>
            <Button size="icon" variant="ghost" onClick={onDeleteSound}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="bg-muted flex items-center gap-4 rounded-lg p-4">
            <audio
              controls
              src={getFileUrl(selectedSound.file)}
              className="w-full"
            />
          </div>

          <div className="text-muted-foreground text-sm">
            {filesize(selectedSound.file.size)} • {t('soundUploadedBy')}{' '}
            {selectedSound.user.name}
          </div>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="sound-name">{t('soundNameLabel')}</Label>
              <Input
                id="sound-name"
                value={name}
                onChange={onNameChange}
                placeholder={t('soundNamePlaceholder')}
                error={errors.name}
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button
              variant="outline"
              onClick={() => setSelectedSoundId(undefined)}
            >
              {t('close')}
            </Button>
            <Button
              onClick={onUpdateSound}
              disabled={selectedSound.name === name}
            >
              {t('saveChanges')}
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }
);

export { UpdateSound };
```

- [ ] **Step 8: Register the settings tab**

In `apps/client/src/components/server-screens/server-settings/index.tsx`:

- Import `{ Sounds } from './sounds'` next to the `Emojis` import (line 9).
- Add `if (can(Permission.MANAGE_SOUNDS)) return 'sounds';` to `defaultTab` after the emojis line (line 28).
- Add the trigger after the emojis trigger (lines 50-55):

```tsx
            <TabsTrigger
              value="sounds"
              disabled={!can(Permission.MANAGE_SOUNDS)}
            >
              {t('soundsTab')}
            </TabsTrigger>
```

- Add the content after the emojis content (lines 93-95):

```tsx
          <TabsContent value="sounds" className="space-y-6">
            {can(Permission.MANAGE_SOUNDS) && <Sounds />}
          </TabsContent>
```

- [ ] **Step 9: Add the translations**

This is the complete set of keys referenced by Steps 3-8 — no others are needed, and none may be omitted. Add all of them to each of the 7 `settings.json` files. English values:

```json
  "soundsTab": "Sounds",
  "soundTitle": "Sounds",
  "searchSoundsPlaceholder": "Search sounds",
  "noSoundsFound": "No sounds found",
  "noCustomSoundsYet": "No sounds yet",
  "soundCreated": "Sound uploaded",
  "failedUploadSound": "Failed to upload sound",
  "soundTooLarge": "Sound file is too large",
  "soundTooLong": "Sound is too long",
  "uploadSoundTitle": "Add a sound",
  "uploadSoundDesc": "Audio files up to {{size}} and {{seconds}} seconds long.",
  "uploadSoundBtn": "Upload sound",
  "editSoundTitle": "Edit sound",
  "deleteSoundTitle": "Delete sound",
  "deleteSoundMsg": "This sound will be removed for everyone. This cannot be undone.",
  "deleteSoundBtn": "Delete",
  "soundDeleted": "Sound deleted",
  "failedDeleteSound": "Failed to delete sound",
  "soundUpdated": "Sound updated",
  "soundUploadedBy": "uploaded by",
  "soundNameLabel": "Name",
  "soundNamePlaceholder": "sound_name"
```

`close` and `saveChanges` are reused from the existing emoji screen — do not re-add them.

In each of the 7 `permissions.json` files add the `MANAGE_SOUNDS` label and description, following exactly how `MANAGE_EMOJIS` is keyed in that file. English: `"Manage sounds"` / `"Allows uploading, renaming and deleting soundboard sounds."`

- [ ] **Step 10: Verify**

Run from the repo root: `bun run check-types && bun run lint && bun run format:check`

Then confirm no locale was missed:

```bash
grep -L "soundsTab" apps/client/src/i18n/locales/*/settings.json
grep -L "MANAGE_SOUNDS" apps/client/src/i18n/locales/*/permissions.json
```

Expected: both commands print nothing.

- [ ] **Step 11: Commit**

```bash
git add apps/client/src
git commit -m "feat(client): soundboard management in server settings"
```

---

### Task 8: Playback — transmit a sound as its own producer

**Files:**

- Create: `apps/client/src/components/voice-provider/hooks/use-soundboard.ts`
- Modify: `apps/client/src/components/voice-provider/index.tsx` (wire the hook into the provider value; the context type is at lines 110-130, the value object near line 1274)

**Interfaces:**

- Consumes: `StreamKind.SOUNDBOARD`, `SOUND_TRIGGER_COOLDOWN_MS` (Task 1); `producerTransport` from the voice provider.
- Produces, exposed on the voice context and consumed by Task 10:
  - `playSound(sound: TJoinedSound): Promise<void>`
  - `stopSound(): void`
  - `playingSoundId: number | undefined`

**Read first:** `apps/client/src/components/voice-provider/index.tsx:1020-1060` — the screen-share audio producer. This hook produces its track the same way.

- [ ] **Step 1: Write the hook**

`apps/client/src/components/voice-provider/hooks/use-soundboard.ts`:

```ts
import { logVoice } from '@/helpers/browser-logger';
import { getFileUrl } from '@/helpers/get-file-url';
import { SOUND_TRIGGER_COOLDOWN_MS, StreamKind } from '@sharkord/shared';
import type { TJoinedSound } from '@sharkord/shared';
import type { Producer } from 'mediasoup-client/types';
import type { Transport } from 'mediasoup-client/types';
import type { AppData } from 'mediasoup-client/types';
import { useCallback, useRef, useState } from 'react';

type TUseSoundboardArgs = {
  producerTransport: React.RefObject<Transport<AppData> | undefined>;
};

const useSoundboard = ({ producerTransport }: TUseSoundboardArgs) => {
  const [playingSoundId, setPlayingSoundId] = useState<number | undefined>(
    undefined
  );

  const bufferCache = useRef<Map<number, AudioBuffer>>(new Map());
  const audioContextRef = useRef<AudioContext | null>(null);
  const sourceRef = useRef<AudioBufferSourceNode | null>(null);
  const echoSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const producerRef = useRef<Producer<AppData> | null>(null);
  const lastTriggerAtRef = useRef(0);

  const teardown = useCallback(() => {
    sourceRef.current?.stop();
    sourceRef.current?.disconnect();
    sourceRef.current = null;

    echoSourceRef.current?.stop();
    echoSourceRef.current?.disconnect();
    echoSourceRef.current = null;

    producerRef.current?.close();
    producerRef.current = null;

    audioContextRef.current?.close();
    audioContextRef.current = null;

    setPlayingSoundId(undefined);
  }, []);

  const loadBuffer = useCallback(
    async (sound: TJoinedSound, audioContext: AudioContext) => {
      const cached = bufferCache.current.get(sound.id);

      if (cached) return cached;

      const response = await fetch(getFileUrl(sound.file));
      const arrayBuffer = await response.arrayBuffer();
      const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

      bufferCache.current.set(sound.id, audioBuffer);

      return audioBuffer;
    },
    []
  );

  const playSound = useCallback(
    async (sound: TJoinedSound) => {
      const now = Date.now();

      if (now - lastTriggerAtRef.current < SOUND_TRIGGER_COOLDOWN_MS) return;

      lastTriggerAtRef.current = now;

      if (!producerTransport.current) {
        logVoice('Cannot play sound - no producer transport');
        return;
      }

      // One sound at a time: a new trigger cuts the current one.
      teardown();

      try {
        const audioContext = new AudioContext();
        audioContextRef.current = audioContext;

        const audioBuffer = await loadBuffer(sound, audioContext);

        const destination = audioContext.createMediaStreamDestination();

        const source = audioContext.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(destination);
        sourceRef.current = source;

        // Local echo — the sender does not consume their own producer.
        const echoSource = audioContext.createBufferSource();
        echoSource.buffer = audioBuffer;
        echoSource.connect(audioContext.destination);
        echoSourceRef.current = echoSource;

        const track = destination.stream.getAudioTracks()[0];

        if (!track) {
          logVoice('Soundboard destination produced no audio track');
          teardown();
          return;
        }

        producerRef.current = await producerTransport.current.produce({
          track,
          codecOptions: {
            opusStereo: false,
            opusFec: true,
            opusDtx: false,
            opusMaxPlaybackRate: 48000,
            opusMaxAverageBitrate: 128000
          },
          appData: { kind: StreamKind.SOUNDBOARD }
        });

        source.onended = () => {
          teardown();
        };

        source.start();
        echoSource.start();

        setPlayingSoundId(sound.id);
      } catch (error) {
        logVoice('Error playing sound', { error });
        teardown();
      }
    },
    [loadBuffer, producerTransport, teardown]
  );

  const stopSound = useCallback(() => {
    teardown();
  }, [teardown]);

  return { playSound, stopSound, playingSoundId };
};

export { useSoundboard };
```

- [ ] **Step 2: Wire it into the voice provider**

In `apps/client/src/components/voice-provider/index.tsx`:

- Call the hook inside the provider component, after `producerTransport` is available:

```ts
  const { playSound, stopSound, playingSoundId } = useSoundboard({
    producerTransport
  });
```

- Add the three fields to the context type (the block at lines 110-130):

```ts
  playSound: (sound: TJoinedSound) => Promise<void>;
  stopSound: () => void;
  playingSoundId: number | undefined;
```

- Add matching entries to the default context object (near line 168):

```ts
  playSound: async () => {},
  stopSound: () => {},
  playingSoundId: undefined,
```

- Add `playSound, stopSound, playingSoundId` to the provider value object (near line 1274) and to its dependency array.

- Call `stopSound()` wherever the provider already tears down voice state on leaving a channel, so a clip cannot outlive the call.

- [ ] **Step 3: Verify**

Run from the repo root: `bun run check-types && bun run lint && bun run format:check`
Expected: all exit 0. `check-types` will catch any mismatch between the context type, the default value and the provider value.

- [ ] **Step 4: Commit**

```bash
git add apps/client/src/components/voice-provider
git commit -m "feat(client): play a soundboard clip as its own audio producer"
```

---

### Task 9: Playback — hear other users' sounds

**Files:**

- Create: `apps/client/src/components/voice-provider/soundboard-players.tsx`
- Modify: `apps/client/src/types.ts:84-97`
- Modify: `apps/client/src/components/voice-provider/index.tsx` (render `<SoundboardPlayers />` inside the provider's returned tree)

**Interfaces:**

- Consumes: `remoteUserStreams` from the voice context, `useVolumeControl()`, `ownVoiceState.soundMuted`, `applyAudioOutputDevice`.
- Produces: audible remote soundboard playback. Nothing else depends on it.

**Note:** `use-voice-events.ts:50-88`, `use-transports.ts:224-294` and `use-remote-streams.ts:108-144` are already kind-agnostic — they consume and store whatever kind arrives. Do not modify them.

- [ ] **Step 1: Widen the client stream types**

In `apps/client/src/types.ts`, add `SOUNDBOARD` to the remote-stream kind union (line 85-88) and to the `TRemoteStreams` map (lines 92-95):

```ts
  | StreamKind.SCREEN_AUDIO
  | StreamKind.SOUNDBOARD;
```

```ts
    [StreamKind.SCREEN_AUDIO]: MediaStream | undefined;
    [StreamKind.SOUNDBOARD]: MediaStream | undefined;
```

- [ ] **Step 2: Create the player component**

`apps/client/src/components/voice-provider/soundboard-players.tsx`:

```tsx
import { useDevices } from '@/components/devices-provider/hooks/use-devices';
import { useVoice } from '@/features/server/voice/hooks';
import { applyAudioOutputDevice } from '@/helpers/audio-output';
import { StreamKind } from '@sharkord/shared';
import { memo, useEffect, useMemo, useRef } from 'react';
import { useVolumeControl } from './volume-control-context';

type TSoundboardPlayerProps = {
  userId: number;
  stream: MediaStream;
};

const SoundboardPlayer = memo(({ userId, stream }: TSoundboardPlayerProps) => {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const { getVolume, getUserVolumeKey } = useVolumeControl();
  const { ownVoiceState } = useVoice();
  const { devices } = useDevices();

  const volume = getVolume(getUserVolumeKey(userId));

  useEffect(() => {
    if (!audioRef.current) return;

    if (audioRef.current.srcObject !== stream) {
      audioRef.current.srcObject = stream;
    }

    audioRef.current.volume = volume / 100;
    audioRef.current.muted = ownVoiceState.soundMuted;

    applyAudioOutputDevice(audioRef.current, devices.playbackId);
  }, [stream, volume, devices.playbackId, ownVoiceState.soundMuted]);

  return <audio ref={audioRef} className="hidden" autoPlay playsInline />;
});

const SoundboardPlayers = memo(() => {
  const { remoteUserStreams } = useVoice();

  const entries = useMemo(
    () =>
      Object.entries(remoteUserStreams)
        .map(([userId, streams]) => ({
          userId: Number(userId),
          stream: streams?.[StreamKind.SOUNDBOARD]
        }))
        .filter(
          (entry): entry is { userId: number; stream: MediaStream } =>
            !!entry.stream
        ),
    [remoteUserStreams]
  );

  return (
    <>
      {entries.map(({ userId, stream }) => (
        <SoundboardPlayer key={userId} userId={userId} stream={stream} />
      ))}
    </>
  );
});

export { SoundboardPlayers };
```

If `useVoice` cannot be imported here without a circular import, read `remoteUserStreams` and `ownVoiceState` from the provider's local state instead and render the component inside the provider's own JSX — it is mounted there either way.

- [ ] **Step 3: Mount it**

In `apps/client/src/components/voice-provider/index.tsx`, render `<SoundboardPlayers />` inside the provider's returned tree, next to `{children}`.

- [ ] **Step 4: Verify**

Run from the repo root: `bun run check-types && bun run lint && bun run format:check`
Expected: all exit 0.

- [ ] **Step 5: Commit**

```bash
git add apps/client/src
git commit -m "feat(client): play remote soundboard streams"
```

---

### Task 10: The soundboard button and picker

**Files:**

- Create: `apps/client/src/components/channel-view/voice/soundboard-button.tsx`
- Modify: `apps/client/src/components/channel-view/voice/controls-bar.tsx:1-18, 31-38, 77-88`
- Modify: `apps/client/src/i18n/locales/<locale>/common.json` (7 files)

**Interfaces:**

- Consumes: `useSounds()` (Task 6), `playSound` / `stopSound` / `playingSoundId` from the voice context (Task 8), `ChannelPermission.SPEAK`.
- Produces: the user-facing entry point. Nothing depends on it.

- [ ] **Step 1: Build the button and popover**

`apps/client/src/components/channel-view/voice/soundboard-button.tsx`:

```tsx
import { useSounds } from '@/features/server/sounds/hooks';
import { useVoice } from '@/features/server/voice/hooks';
import { cn } from '@/lib/utils';
import { Button, Popover, PopoverContent, PopoverTrigger } from '@sharkord/ui';
import { Music } from 'lucide-react';
import { memo } from 'react';
import { useTranslation } from 'react-i18next';

type TSoundboardButtonProps = {
  disabled: boolean;
};

const SoundboardButton = memo(({ disabled }: TSoundboardButtonProps) => {
  const { t } = useTranslation('common');
  const sounds = useSounds();
  const { playSound, playingSoundId } = useVoice();

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          size="icon"
          variant="ghost"
          className="h-10 w-10"
          disabled={disabled}
          aria-label={t('soundboard')}
        >
          <Music size={20} />
        </Button>
      </PopoverTrigger>

      <PopoverContent className="w-80 p-2">
        {sounds.length === 0 ? (
          <p className="text-muted-foreground p-4 text-center text-sm">
            {t('noSoundsAvailable')}
          </p>
        ) : (
          <div className="grid max-h-64 grid-cols-3 gap-2 overflow-y-auto">
            {sounds.map((sound) => (
              <Button
                key={sound.id}
                variant="secondary"
                className={cn(
                  'h-16 truncate text-xs',
                  playingSoundId === sound.id && 'ring-primary ring-2'
                )}
                onClick={() => playSound(sound)}
              >
                {sound.name}
              </Button>
            ))}
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
});

export { SoundboardButton };
```

If `Popover` is not exported from `@sharkord/ui`, use the same import path the existing voice UI uses for popovers — check `apps/client/src/components/channel-view/voice/` for a precedent before adding a dependency.

- [ ] **Step 2: Add it to the controls bar**

In `apps/client/src/components/channel-view/voice/controls-bar.tsx`, import `SoundboardButton` and render it inside the control cluster, after the screen-share toggle (line 88), so it sits with the other controls:

```tsx
        <SoundboardButton disabled={!permissions.canSpeak} />
```

- [ ] **Step 3: Add the translations**

In each of the 7 `common.json` files:

```json
  "soundboard": "Soundboard",
  "noSoundsAvailable": "No sounds available"
```

- [ ] **Step 4: Verify**

Run from the repo root: `bun run check-types && bun run lint && bun run format:check`

```bash
grep -L "noSoundsAvailable" apps/client/src/i18n/locales/*/common.json
```

Expected: prints nothing.

- [ ] **Step 5: Full test sweep**

Run: `cd apps/server && bun test`
Expected: no failures.

- [ ] **Step 6: Commit**

```bash
git add apps/client/src
git commit -m "feat(client): soundboard button in the voice controls bar"
```

---

## Manual end-to-end verification

Automated tests cannot exercise mediasoup. After Task 10, the user runs this on the deployed server with two clients in the same voice channel:

- [ ] Upload a clip in Server Settings → Sounds; it appears in the list.
- [ ] A user **without** `MANAGE_SOUNDS` sees no Sounds tab but does see the 🎵 button.
- [ ] Client A plays a sound; **client B hears it**.
- [ ] Client A hears its own sound (local echo), once — not doubled.
- [ ] Client A mutes its microphone, plays a sound; client B still hears it.
- [ ] Client A triggers a second sound mid-clip; the first one cuts.
- [ ] Client A's own voice still works normally after playing a sound (this is the regression that matters most — the mic chain must be untouched).
- [ ] Renaming and deleting a sound updates both clients live, without a refresh.
- [ ] A user without `SPEAK` on the channel finds the 🎵 button disabled.

## Notes for the implementer

- **Do not touch** `startMicStream` or anything between `voice-provider/index.tsx:504-634`. The whole point of this design is that the microphone chain is not modified. A diff that touches it means the approach drifted — stop and flag it.
- The `sounds` router is a deliberate near-copy of the `emojis` router. Copying it is correct here; do not try to abstract the two into a shared generic.
- If a task's test reveals the spec is wrong, stop and report rather than quietly changing behaviour.
