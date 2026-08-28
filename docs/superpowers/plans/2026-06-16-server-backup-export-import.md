# Server Backup (Export / Import) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add owner-only full-server backup: a single `.zip` (manifest + `db.sqlite` snapshot + `public/` uploads) exportable over HTTP, and importable to stage a destructive restore that is applied on the next boot with a one-generation safety net.

**Architecture:** Two new HTTP endpoints on the existing `http.createServer` router (`GET /export`, `POST /import`), authenticated by the same JWT token header used by `/upload`, gated to the owner (`OWNER_ROLE_ID`). Export streams a `yazl` zip built from a `VACUUM INTO` snapshot of the live DB connection plus the `public/` tree. Import streams the upload to a temp file with a real-byte size guard, validates it with `yauzl` (must contain `manifest.json` + `db.sqlite`, migration tag not newer than the server's), extracts into `restore-staging/`, writes a `restore.pending` marker, responds, then `process.exit(0)`. At the very top of `index.ts` (before `loadDb`), `applyPendingRestore()` swaps the live `db.sqlite`/`public/` aside to `*.pre-restore` and moves staging into place. `loadDb` then forward-migrates the restored DB. The client adds an owner-only "Backup" tab in server settings.

**Tech Stack:** Bun, TypeScript, `bun:sqlite` (`VACUUM INTO`), Drizzle ORM (bun-sqlite, v0.44.7, `db.$client`), `yazl`/`yauzl` (already dependencies), node `http`, React + Redux + tRPC client, `bun test`.

---

## File Structure

**Server (new):**
- `apps/server/src/helpers/restore.ts` — restore path constants, `getLatestMigrationTag()`, `applyPendingRestore()`, `writeRestoreMarker()`.
- `apps/server/src/db/queries/is-owner.ts` — `isOwner(userId)` query.
- `apps/server/src/http/backup-auth.ts` — `getOwnerFromRequest(req)` (token header → user → owner check).
- `apps/server/src/http/zip.ts` — `addDirToZip()` / `extractZipEntries()` thin wrappers over `yazl`/`yauzl`.
- `apps/server/src/http/export.ts` — `exportRouteHandler`.
- `apps/server/src/http/import.ts` — `importRouteHandler`.

**Server (modified):**
- `apps/server/src/http/index.ts` — register `GET /export` and `POST /import`.
- `apps/server/src/index.ts` — call `applyPendingRestore()` before `loadDb()`.

**Client (new):**
- `apps/client/src/components/server-screens/server-settings/backup/index.tsx` — Backup tab UI.
- `apps/client/src/helpers/backup.ts` — `downloadBackup()` / `uploadBackup()` HTTP helpers.

**Client (modified):**
- `apps/client/src/components/server-screens/server-settings/index.tsx` — add owner-only Backup tab.
- `apps/client/src/i18n/locales/en/settings.json` (and sibling locales) — new strings.

---

## Conventions to follow (read before starting)

- HTTP handlers take `(req: http.IncomingMessage, res: http.ServerResponse)` and write with `res.writeHead(code, { 'Content-Type': 'application/json' })` + `res.end(JSON.stringify(...))`. See `apps/server/src/http/upload.ts`.
- Owner = a `user_roles` row with `roleId === OWNER_ROLE_ID` (`OWNER_ROLE_ID = 1`, from `@sharkord/shared`).
- Auth token comes in via `getUserByToken(token)` (`apps/server/src/db/queries/users.ts`), which verifies the JWT. `/upload` reads it from the `UploadHeaders.TOKEN` header.
- Paths live in `apps/server/src/helpers/paths.ts`: `DATA_PATH`, `DB_PATH` (`DATA_PATH/db.sqlite`), `PUBLIC_PATH` (`DATA_PATH/public` — persisted uploads), `TMP_PATH` (`DATA_PATH/tmp`).
- The live DB connection is the Drizzle export `db` from `apps/server/src/db`; its raw `bun:sqlite` handle is `db.$client`. In tests `db` is an in-memory DB; `VACUUM INTO '<file>'` works from `:memory:`.
- Tests: `bun test`, run from `apps/server`. Global setup in `apps/server/src/__tests__/setup.ts` boots an HTTP server on port 9999 (`testsBaseUrl = 'http://localhost:9999'`) and a fresh seeded in-memory DB per test. Helpers in `apps/server/src/__tests__/helpers.ts` (`login`, `initTest`). `tdb` is the test Drizzle handle.
- After all code is written, run `bun --bun run magic` (lint:fix + format + check-types) in `apps/server` and the client.

---

## Task 1: Restore helpers (paths, latest-migration-tag, apply-on-boot)

**Files:**
- Create: `apps/server/src/helpers/restore.ts`
- Test: `apps/server/src/helpers/__tests__/restore.test.ts`

These constants are intentionally NOT added to `paths.ts` so `ensureServerDirs()` does not auto-create `restore-staging/` on every boot. The marker file and `*.pre-restore` names carry extensions, so even if referenced they would be skipped by `ensureServerDirs` (which skips paths with an extname).

- [ ] **Step 1: Write the failing test**

```typescript
// apps/server/src/helpers/__tests__/restore.test.ts
import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import {
  applyPendingRestore,
  getLatestMigrationTag,
  RESTORE_PENDING_PATH,
  RESTORE_STAGING_PATH
} from '../restore';
import { DATA_PATH, DB_PATH, PUBLIC_PATH } from '../paths';

describe('getLatestMigrationTag', () => {
  test('returns the last tag from the drizzle journal', async () => {
    const tag = await getLatestMigrationTag();
    // the server ships migration 0023_great_taskmaster as the latest at time of writing
    expect(typeof tag).toBe('string');
    expect(tag.length).toBeGreaterThan(0);
    expect(tag.startsWith('00')).toBe(true);
  });
});

describe('applyPendingRestore', () => {
  beforeEach(async () => {
    await fs.rm(RESTORE_STAGING_PATH, { recursive: true, force: true });
    await fs.rm(RESTORE_PENDING_PATH, { force: true });
    await fs.rm(`${DB_PATH}.pre-restore`, { force: true });
    await fs.rm(`${PUBLIC_PATH}.pre-restore`, { recursive: true, force: true });
  });

  afterEach(async () => {
    await fs.rm(RESTORE_STAGING_PATH, { recursive: true, force: true });
    await fs.rm(RESTORE_PENDING_PATH, { force: true });
    await fs.rm(`${DB_PATH}.pre-restore`, { force: true });
    await fs.rm(`${PUBLIC_PATH}.pre-restore`, { recursive: true, force: true });
  });

  test('no-ops when there is no pending marker', async () => {
    await fs.mkdir(DATA_PATH, { recursive: true });
    await fs.writeFile(DB_PATH, 'LIVE_DB');
    await applyPendingRestore();
    expect(await fs.readFile(DB_PATH, 'utf8')).toBe('LIVE_DB');
  });

  test('swaps live aside to .pre-restore and moves staging into place', async () => {
    await fs.mkdir(PUBLIC_PATH, { recursive: true });
    await fs.writeFile(DB_PATH, 'LIVE_DB');
    await fs.writeFile(path.join(PUBLIC_PATH, 'live.txt'), 'LIVE_FILE');

    await fs.mkdir(path.join(RESTORE_STAGING_PATH, 'public'), {
      recursive: true
    });
    await fs.writeFile(path.join(RESTORE_STAGING_PATH, 'db.sqlite'), 'NEW_DB');
    await fs.writeFile(
      path.join(RESTORE_STAGING_PATH, 'public', 'new.txt'),
      'NEW_FILE'
    );
    await fs.writeFile(RESTORE_PENDING_PATH, '');

    await applyPendingRestore();

    expect(await fs.readFile(DB_PATH, 'utf8')).toBe('NEW_DB');
    expect(
      await fs.readFile(path.join(PUBLIC_PATH, 'new.txt'), 'utf8')
    ).toBe('NEW_FILE');
    expect(await fs.readFile(`${DB_PATH}.pre-restore`, 'utf8')).toBe('LIVE_DB');
    expect(
      await fs.readFile(path.join(`${PUBLIC_PATH}.pre-restore`, 'live.txt'), 'utf8')
    ).toBe('LIVE_FILE');
    // marker and staging are cleaned up
    expect(await fs.exists(RESTORE_PENDING_PATH)).toBe(false);
    expect(await fs.exists(RESTORE_STAGING_PATH)).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run (from `apps/server`): `bun test src/helpers/__tests__/restore.test.ts`
Expected: FAIL — `Cannot find module '../restore'`.

- [ ] **Step 3: Write minimal implementation**

```typescript
// apps/server/src/helpers/restore.ts
import fs from 'fs/promises';
import path from 'path';
import { DATA_PATH, DB_PATH, DRIZZLE_PATH, PUBLIC_PATH } from './paths';

const RESTORE_STAGING_PATH = path.join(DATA_PATH, 'restore-staging');
const RESTORE_PENDING_PATH = path.join(DATA_PATH, 'restore.pending');
const DB_PRE_RESTORE_PATH = `${DB_PATH}.pre-restore`;
const PUBLIC_PRE_RESTORE_PATH = `${PUBLIC_PATH}.pre-restore`;

type DrizzleJournalEntry = { idx: number; tag: string };
type DrizzleJournal = { entries: DrizzleJournalEntry[] };

const readJournal = async (): Promise<DrizzleJournal> => {
  const journalPath = path.join(DRIZZLE_PATH, 'meta', '_journal.json');
  const raw = await fs.readFile(journalPath, 'utf8');
  return JSON.parse(raw) as DrizzleJournal;
};

// The tag of the most recently-applied migration this server build knows about.
const getLatestMigrationTag = async (): Promise<string> => {
  const journal = await readJournal();
  const sorted = [...journal.entries].sort((a, b) => a.idx - b.idx);
  const last = sorted[sorted.length - 1];

  if (!last) {
    throw new Error('Drizzle journal has no entries');
  }

  return last.tag;
};

// Returns true when `tag` is known to this server (equal or older). A tag we do
// not recognise means the backup came from a newer build -> not restorable here.
const isMigrationTagRestorable = async (tag: string): Promise<boolean> => {
  const journal = await readJournal();
  return journal.entries.some((entry) => entry.tag === tag);
};

const writeRestoreMarker = async (): Promise<void> => {
  await fs.writeFile(RESTORE_PENDING_PATH, new Date().toISOString());
};

const moveAside = async (src: string, dest: string): Promise<void> => {
  // one generation only: drop the previous pre-restore copy first
  await fs.rm(dest, { recursive: true, force: true });

  if (await fs.exists(src)) {
    await fs.rename(src, dest);
  }
};

// Runs at the very top of boot, BEFORE loadDb. If a restore was staged by the
// import endpoint, swap the live db/public aside (recoverable) and move the
// staged copies into place. Safe to call when nothing is pending.
const applyPendingRestore = async (): Promise<void> => {
  if (!(await fs.exists(RESTORE_PENDING_PATH))) {
    return;
  }

  const stagedDb = path.join(RESTORE_STAGING_PATH, 'db.sqlite');
  const stagedPublic = path.join(RESTORE_STAGING_PATH, 'public');

  // Safety net: keep the current state recoverable from the CLI.
  await moveAside(DB_PATH, DB_PRE_RESTORE_PATH);
  await moveAside(PUBLIC_PATH, PUBLIC_PRE_RESTORE_PATH);

  await fs.rename(stagedDb, DB_PATH);

  if (await fs.exists(stagedPublic)) {
    await fs.rename(stagedPublic, PUBLIC_PATH);
  } else {
    await fs.mkdir(PUBLIC_PATH, { recursive: true });
  }

  await fs.rm(RESTORE_STAGING_PATH, { recursive: true, force: true });
  await fs.rm(RESTORE_PENDING_PATH, { force: true });
};

export {
  applyPendingRestore,
  DB_PRE_RESTORE_PATH,
  getLatestMigrationTag,
  isMigrationTagRestorable,
  PUBLIC_PRE_RESTORE_PATH,
  RESTORE_PENDING_PATH,
  RESTORE_STAGING_PATH,
  writeRestoreMarker
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test src/helpers/__tests__/restore.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/server/src/helpers/restore.ts apps/server/src/helpers/__tests__/restore.test.ts
git commit -m "feat(server): restore helpers (staging swap + migration tag)"
```

---

## Task 2: `isOwner` query + owner-from-request HTTP auth helper

**Files:**
- Create: `apps/server/src/db/queries/is-owner.ts`
- Create: `apps/server/src/http/backup-auth.ts`
- Test: `apps/server/src/http/__tests__/backup-auth.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// apps/server/src/http/__tests__/backup-auth.test.ts
import { OWNER_ROLE_ID } from '@sharkord/shared';
import { describe, expect, test } from 'bun:test';
import http from 'http';
import { initTest, login } from '../../__tests__/helpers';
import { tdb } from '../../__tests__/setup';
import { userRoles } from '../../db/schema';
import { getOwnerFromRequest } from '../backup-auth';

const makeReq = (token?: string): http.IncomingMessage => {
  const req = new http.IncomingMessage(null as never);
  req.headers = token ? { 'x-backup-token': token } : {};
  return req;
};

describe('getOwnerFromRequest', () => {
  test('returns null when no token is provided', async () => {
    expect(await getOwnerFromRequest(makeReq())).toBeNull();
  });

  test('returns null for a valid token from a non-owner user', async () => {
    await initTest();
    const { token } = await login('someuser', 'password');
    expect(await getOwnerFromRequest(makeReq(token))).toBeNull();
  });

  test('returns the user when the token belongs to the owner', async () => {
    await initTest();
    const { token, userId } = await login('owneruser', 'password');
    await tdb
      .insert(userRoles)
      .values({ userId, roleId: OWNER_ROLE_ID, createdAt: Date.now() })
      .onConflictDoNothing();

    const user = await getOwnerFromRequest(makeReq(token));
    expect(user?.id).toBe(userId);
  });
});
```

> Note: confirm the exact return shape of `login()` in `apps/server/src/__tests__/helpers.ts` (it returns the JWT token and the created user). If `login` does not return `userId`, fetch it via `getUserByIdentity('owneruser')` before inserting the owner role. Adjust the test to the real helper signature.

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test src/http/__tests__/backup-auth.test.ts`
Expected: FAIL — `Cannot find module '../backup-auth'`.

- [ ] **Step 3: Write minimal implementation**

```typescript
// apps/server/src/db/queries/is-owner.ts
import { OWNER_ROLE_ID } from '@sharkord/shared';
import { and, eq } from 'drizzle-orm';
import { db } from '..';
import { userRoles } from '../schema';

const isOwner = async (userId: number): Promise<boolean> => {
  const row = await db
    .select({ userId: userRoles.userId })
    .from(userRoles)
    .where(
      and(eq(userRoles.userId, userId), eq(userRoles.roleId, OWNER_ROLE_ID))
    )
    .get();

  return Boolean(row);
};

export { isOwner };
```

```typescript
// apps/server/src/http/backup-auth.ts
import http from 'http';
import { isOwner } from '../db/queries/is-owner';
import { getUserByToken } from '../db/queries/users';

// Dedicated header so the token is never put in a query string (avoids logs/referrers).
const BACKUP_TOKEN_HEADER = 'x-backup-token';

const getOwnerFromRequest = async (req: http.IncomingMessage) => {
  const header = req.headers[BACKUP_TOKEN_HEADER];
  const token = Array.isArray(header) ? header[0] : header;

  if (!token) return null;

  const user = await getUserByToken(token);

  if (!user) return null;

  if (!(await isOwner(user.id))) return null;

  return user;
};

export { BACKUP_TOKEN_HEADER, getOwnerFromRequest };
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test src/http/__tests__/backup-auth.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/server/src/db/queries/is-owner.ts apps/server/src/http/backup-auth.ts apps/server/src/http/__tests__/backup-auth.test.ts
git commit -m "feat(server): owner-only auth helper for backup endpoints"
```

---

## Task 3: Zip helpers (`yazl` add-dir, `yauzl` extract)

**Files:**
- Create: `apps/server/src/http/zip.ts`
- Test: `apps/server/src/http/__tests__/zip.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// apps/server/src/http/__tests__/zip.test.ts
import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import fs from 'fs/promises';
import { createWriteStream } from 'fs';
import os from 'os';
import path from 'path';
import yazl from 'yazl';
import { addDirToZip, extractZipEntries } from '../zip';

let workDir: string;

beforeEach(async () => {
  workDir = await fs.mkdtemp(path.join(os.tmpdir(), 'zip-test-'));
});

afterEach(async () => {
  await fs.rm(workDir, { recursive: true, force: true });
});

describe('addDirToZip + extractZipEntries round-trip', () => {
  test('preserves nested files and contents', async () => {
    const srcDir = path.join(workDir, 'src');
    await fs.mkdir(path.join(srcDir, 'nested'), { recursive: true });
    await fs.writeFile(path.join(srcDir, 'a.txt'), 'AAA');
    await fs.writeFile(path.join(srcDir, 'nested', 'b.txt'), 'BBB');

    const zipPath = path.join(workDir, 'out.zip');
    const zip = new yazl.ZipFile();
    await addDirToZip(zip, srcDir, 'public');
    zip.end();

    await new Promise<void>((resolve, reject) => {
      const out = createWriteStream(zipPath);
      zip.outputStream.pipe(out);
      out.on('close', resolve);
      out.on('error', reject);
    });

    const destDir = path.join(workDir, 'dest');
    const entryNames = await extractZipEntries(zipPath, destDir);

    expect(entryNames.sort()).toEqual(
      ['public/a.txt', 'public/nested/b.txt'].sort()
    );
    expect(await fs.readFile(path.join(destDir, 'public', 'a.txt'), 'utf8')).toBe(
      'AAA'
    );
    expect(
      await fs.readFile(path.join(destDir, 'public', 'nested', 'b.txt'), 'utf8')
    ).toBe('BBB');
  });

  test('extractZipEntries rejects entries that escape the destination', async () => {
    // craft a malicious zip with a ../ traversal entry
    const zipPath = path.join(workDir, 'evil.zip');
    const zip = new yazl.ZipFile();
    zip.addBuffer(Buffer.from('PWNED'), '../escape.txt');
    zip.end();
    await new Promise<void>((resolve, reject) => {
      const out = createWriteStream(zipPath);
      zip.outputStream.pipe(out);
      out.on('close', resolve);
      out.on('error', reject);
    });

    const destDir = path.join(workDir, 'dest');
    await expect(extractZipEntries(zipPath, destDir)).rejects.toThrow(
      /unsafe/i
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test src/http/__tests__/zip.test.ts`
Expected: FAIL — `Cannot find module '../zip'`.

- [ ] **Step 3: Write minimal implementation**

```typescript
// apps/server/src/http/zip.ts
import { createWriteStream } from 'fs';
import fs from 'fs/promises';
import path from 'path';
import yauzl from 'yauzl';
import type yazl from 'yazl';

// Recursively add every file under `dir` to `zip` under `<zipPrefix>/<relpath>`.
// Uses forward slashes for zip entry names regardless of host OS.
const addDirToZip = async (
  zip: yazl.ZipFile,
  dir: string,
  zipPrefix: string
): Promise<void> => {
  const entries = await fs.readdir(dir, { withFileTypes: true });

  for (const entry of entries) {
    const absPath = path.join(dir, entry.name);
    const entryName = `${zipPrefix}/${entry.name}`;

    if (entry.isDirectory()) {
      await addDirToZip(zip, absPath, entryName);
    } else if (entry.isFile()) {
      zip.addFile(absPath, entryName);
    }
  }
};

const isPathInside = (parent: string, child: string): boolean => {
  const rel = path.relative(parent, child);
  return !rel.startsWith('..') && !path.isAbsolute(rel);
};

// Extract every file entry from `zipPath` into `destDir`. Returns the list of
// entry names extracted. Rejects on any entry that would escape `destDir`.
const extractZipEntries = (
  zipPath: string,
  destDir: string
): Promise<string[]> => {
  return new Promise((resolve, reject) => {
    const extracted: string[] = [];

    yauzl.open(zipPath, { lazyEntries: true }, (err, zipfile) => {
      if (err || !zipfile) {
        reject(err ?? new Error('Failed to open zip'));
        return;
      }

      zipfile.on('error', reject);
      zipfile.on('end', () => resolve(extracted));

      zipfile.readEntry();

      zipfile.on('entry', (entry) => {
        // directory entries end with '/'
        if (/\/$/.test(entry.fileName)) {
          zipfile.readEntry();
          return;
        }

        const destPath = path.join(destDir, entry.fileName);

        if (!isPathInside(destDir, destPath)) {
          reject(new Error(`Unsafe zip entry path: ${entry.fileName}`));
          zipfile.close();
          return;
        }

        zipfile.openReadStream(entry, async (streamErr, readStream) => {
          if (streamErr || !readStream) {
            reject(streamErr ?? new Error('Failed to read zip entry'));
            return;
          }

          try {
            await fs.mkdir(path.dirname(destPath), { recursive: true });
          } catch (mkdirErr) {
            reject(mkdirErr);
            return;
          }

          const out = createWriteStream(destPath);
          readStream.pipe(out);
          out.on('error', reject);
          out.on('close', () => {
            extracted.push(entry.fileName);
            zipfile.readEntry();
          });
        });
      });
    });
  });
};

export { addDirToZip, extractZipEntries };
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test src/http/__tests__/zip.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/server/src/http/zip.ts apps/server/src/http/__tests__/zip.test.ts
git commit -m "feat(server): zip add-dir/extract helpers with traversal guard"
```

---

## Task 4: Export endpoint (`GET /export`)

**Files:**
- Create: `apps/server/src/http/export.ts`
- Modify: `apps/server/src/http/index.ts` (registration done in Task 7; this task wires the handler module only)
- Test: `apps/server/src/http/__tests__/export.test.ts`

The snapshot uses `db.$client` (the live `bun:sqlite` handle) so it works against the in-memory test DB. The temp snapshot path is server-generated, so its quotes are escaped and inlined into the `VACUUM INTO` statement.

- [ ] **Step 1: Write the failing test**

```typescript
// apps/server/src/http/__tests__/export.test.ts
import { OWNER_ROLE_ID } from '@sharkord/shared';
import { describe, expect, test } from 'bun:test';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import yauzl from 'yauzl';
import { initTest, login } from '../../__tests__/helpers';
import { tdb, testsBaseUrl } from '../../__tests__/setup';
import { userRoles } from '../../db/schema';
import { BACKUP_TOKEN_HEADER } from '../backup-auth';

const makeOwner = async (identity: string) => {
  const { token, userId } = await login(identity, 'password');
  await tdb
    .insert(userRoles)
    .values({ userId, roleId: OWNER_ROLE_ID, createdAt: Date.now() })
    .onConflictDoNothing();
  return token;
};

const listZipEntries = async (buf: Buffer): Promise<string[]> => {
  const tmp = path.join(os.tmpdir(), `exp-${Date.now()}.zip`);
  await fs.writeFile(tmp, buf);
  return new Promise((resolve, reject) => {
    const names: string[] = [];
    yauzl.open(tmp, { lazyEntries: true }, (err, zf) => {
      if (err || !zf) return reject(err);
      zf.readEntry();
      zf.on('entry', (e) => {
        names.push(e.fileName);
        zf.readEntry();
      });
      zf.on('end', () => resolve(names));
      zf.on('error', reject);
    });
  });
};

describe('GET /export', () => {
  test('rejects unauthenticated requests with 401', async () => {
    await initTest();
    const res = await fetch(`${testsBaseUrl}/export`);
    expect(res.status).toBe(401);
  });

  test('rejects non-owner with 403', async () => {
    await initTest();
    const { token } = await login('plainuser', 'password');
    const res = await fetch(`${testsBaseUrl}/export`, {
      headers: { [BACKUP_TOKEN_HEADER]: token }
    });
    expect(res.status).toBe(403);
  });

  test('owner gets a zip containing manifest.json and db.sqlite', async () => {
    await initTest();
    const token = await makeOwner('owner1');
    const res = await fetch(`${testsBaseUrl}/export`, {
      headers: { [BACKUP_TOKEN_HEADER]: token }
    });
    expect(res.status).toBe(200);
    expect(res.headers.get('content-disposition')).toContain('attachment');

    const buf = Buffer.from(await res.arrayBuffer());
    const names = await listZipEntries(buf);
    expect(names).toContain('manifest.json');
    expect(names).toContain('db.sqlite');
  });
});
```

> Confirm `login()`'s return includes `token` and `userId`; if not, adapt `makeOwner` as noted in Task 2.

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test src/http/__tests__/export.test.ts`
Expected: FAIL — `/export` returns 404 (route not registered) / `Cannot find module '../export'`.

> The 401/403/200 expectations will only pass once Task 7 registers the route. Implement this module now; re-run after Task 7. To unblock iteration, you may temporarily register the route locally, but the canonical registration is Task 7.

- [ ] **Step 3: Write minimal implementation**

```typescript
// apps/server/src/http/export.ts
import { getErrorMessage } from '@sharkord/shared';
import { createWriteStream } from 'fs';
import fs from 'fs/promises';
import http from 'http';
import path from 'path';
import yazl from 'yazl';
import { db } from '../db';
import { PUBLIC_PATH, TMP_PATH } from '../helpers/paths';
import { getLatestMigrationTag } from '../helpers/restore';
import { logger } from '../logger';
import { SERVER_VERSION } from '../utils/env';
import { getOwnerFromRequest } from './backup-auth';

const backupFileName = (): string => {
  const date = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  return `bullshark-backup-${date}.zip`;
};

const exportRouteHandler = async (
  req: http.IncomingMessage,
  res: http.ServerResponse
) => {
  const owner = await getOwnerFromRequest(req);

  if (!owner) {
    const header = req.headers['x-backup-token'];
    const status = header ? 403 : 401;
    res.writeHead(status, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: status === 401 ? 'Unauthorized' : 'Forbidden' }));
    return;
  }

  await fs.mkdir(TMP_PATH, { recursive: true });
  const snapshotPath = path.join(TMP_PATH, `export-${Date.now()}.sqlite`);

  try {
    // Consistent snapshot of the live DB (safe while the server keeps writing).
    const escaped = snapshotPath.replace(/'/g, "''");
    db.$client.run(`VACUUM INTO '${escaped}'`);

    const manifest = {
      serverVersion: SERVER_VERSION,
      latestMigrationTag: await getLatestMigrationTag(),
      createdAt: new Date().toISOString()
    };

    const zip = new yazl.ZipFile();
    zip.addBuffer(Buffer.from(JSON.stringify(manifest, null, 2)), 'manifest.json');
    zip.addFile(snapshotPath, 'db.sqlite');

    // include all persisted uploads if the public dir exists
    if (await fs.exists(PUBLIC_PATH)) {
      const { addDirToZip } = await import('./zip');
      await addDirToZip(zip, PUBLIC_PATH, 'public');
    }

    zip.end();

    res.writeHead(200, {
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="${backupFileName()}"`,
      'Cache-Control': 'no-store'
    });

    await new Promise<void>((resolve, reject) => {
      zip.outputStream.pipe(res);
      zip.outputStream.on('end', resolve);
      zip.outputStream.on('error', reject);
    });
  } catch (error) {
    logger.error('Export failed: %s', getErrorMessage(error));
    if (!res.headersSent) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Export failed' }));
    } else {
      res.destroy();
    }
  } finally {
    await fs.rm(snapshotPath, { force: true });
  }
};

export { exportRouteHandler };
```

> `db.$client` is typed on Drizzle's bun-sqlite database (v0.44.7). If TS complains, the underlying type is `import('bun:sqlite').Database`. Hoist `import { addDirToZip } from './zip'` to the top of the file instead of the dynamic import if you prefer; the dynamic import only avoids a load-order edge case and is not required.

- [ ] **Step 4: Run test to verify it passes (after Task 7)**

Run: `bun test src/http/__tests__/export.test.ts`
Expected: PASS (3 tests) once the route is registered.

- [ ] **Step 5: Commit**

```bash
git add apps/server/src/http/export.ts apps/server/src/http/__tests__/export.test.ts
git commit -m "feat(server): GET /export streams owner-only backup zip"
```

---

## Task 5: Import endpoint (`POST /import`)

**Files:**
- Create: `apps/server/src/http/import.ts`
- Test: `apps/server/src/http/__tests__/import.test.ts`

Behaviour: owner-gated; stream body to a temp file with a **real-byte** size guard (do not trust `Content-Length`); validate the zip (`manifest.json` + `db.sqlite` present; `manifest.latestMigrationTag` known to this server); extract into `RESTORE_STAGING_PATH`; write the `restore.pending` marker; respond 200; schedule `process.exit(0)` on `setTimeout(0)` so the response flushes. `process.exit` is NOT called in tests (guard on `IS_TEST`).

- [ ] **Step 1: Write the failing test**

```typescript
// apps/server/src/http/__tests__/import.test.ts
import { OWNER_ROLE_ID } from '@sharkord/shared';
import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { createWriteStream } from 'fs';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import yazl from 'yazl';
import { initTest, login } from '../../__tests__/helpers';
import { tdb, testsBaseUrl } from '../../__tests__/setup';
import { userRoles } from '../../db/schema';
import { getLatestMigrationTag, RESTORE_PENDING_PATH, RESTORE_STAGING_PATH } from '../../helpers/restore';
import { BACKUP_TOKEN_HEADER } from '../backup-auth';

const makeOwnerToken = async (identity: string) => {
  const { token, userId } = await login(identity, 'password');
  await tdb
    .insert(userRoles)
    .values({ userId, roleId: OWNER_ROLE_ID, createdAt: Date.now() })
    .onConflictDoNothing();
  return token;
};

const buildBackupZip = async (opts: {
  manifest?: object | null;
  withDb?: boolean;
}): Promise<Buffer> => {
  const zip = new yazl.ZipFile();
  if (opts.manifest !== null) {
    zip.addBuffer(
      Buffer.from(JSON.stringify(opts.manifest ?? {
        serverVersion: '0.0.0',
        latestMigrationTag: 'PLACEHOLDER',
        createdAt: new Date().toISOString()
      })),
      'manifest.json'
    );
  }
  if (opts.withDb !== false) {
    zip.addBuffer(Buffer.from('SQLITEDATA'), 'db.sqlite');
  }
  zip.end();
  const tmp = path.join(os.tmpdir(), `imp-${Date.now()}-${Math.random()}.zip`);
  await new Promise<void>((resolve, reject) => {
    const out = createWriteStream(tmp);
    zip.outputStream.pipe(out);
    out.on('close', resolve);
    out.on('error', reject);
  });
  const buf = await fs.readFile(tmp);
  await fs.rm(tmp, { force: true });
  return buf;
};

const cleanup = async () => {
  await fs.rm(RESTORE_STAGING_PATH, { recursive: true, force: true });
  await fs.rm(RESTORE_PENDING_PATH, { force: true });
};

beforeEach(cleanup);
afterEach(cleanup);

describe('POST /import', () => {
  test('rejects non-owner with 403', async () => {
    await initTest();
    const { token } = await login('plain', 'password');
    const body = await buildBackupZip({});
    const res = await fetch(`${testsBaseUrl}/import`, {
      method: 'POST',
      headers: { [BACKUP_TOKEN_HEADER]: token },
      body
    });
    expect(res.status).toBe(403);
  });

  test('rejects a zip missing db.sqlite with 400', async () => {
    await initTest();
    const token = await makeOwnerToken('owner-a');
    const body = await buildBackupZip({ withDb: false });
    const res = await fetch(`${testsBaseUrl}/import`, {
      method: 'POST',
      headers: { [BACKUP_TOKEN_HEADER]: token },
      body
    });
    expect(res.status).toBe(400);
    expect(await fs.exists(RESTORE_PENDING_PATH)).toBe(false);
  });

  test('rejects a backup from a newer server (unknown migration tag) with 409', async () => {
    await initTest();
    const token = await makeOwnerToken('owner-b');
    const body = await buildBackupZip({
      manifest: {
        serverVersion: '99.0.0',
        latestMigrationTag: '9999_from_the_future',
        createdAt: new Date().toISOString()
      }
    });
    const res = await fetch(`${testsBaseUrl}/import`, {
      method: 'POST',
      headers: { [BACKUP_TOKEN_HEADER]: token },
      body
    });
    expect(res.status).toBe(409);
    expect(await fs.exists(RESTORE_PENDING_PATH)).toBe(false);
  });

  test('owner with a valid (current-tag) backup stages a pending restore', async () => {
    await initTest();
    const token = await makeOwnerToken('owner-c');
    const body = await buildBackupZip({
      manifest: {
        serverVersion: '1.0.0',
        latestMigrationTag: await getLatestMigrationTag(),
        createdAt: new Date().toISOString()
      }
    });
    const res = await fetch(`${testsBaseUrl}/import`, {
      method: 'POST',
      headers: { [BACKUP_TOKEN_HEADER]: token },
      body
    });
    expect(res.status).toBe(200);
    expect(await fs.exists(RESTORE_PENDING_PATH)).toBe(true);
    expect(
      await fs.exists(path.join(RESTORE_STAGING_PATH, 'db.sqlite'))
    ).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test src/http/__tests__/import.test.ts`
Expected: FAIL — `/import` 404 / `Cannot find module '../import'` (route registered in Task 7).

- [ ] **Step 3: Write minimal implementation**

```typescript
// apps/server/src/http/import.ts
import { getErrorMessage } from '@sharkord/shared';
import { createWriteStream } from 'fs';
import fs from 'fs/promises';
import http from 'http';
import path from 'path';
import yauzl from 'yauzl';
import { TMP_PATH } from '../helpers/paths';
import {
  isMigrationTagRestorable,
  RESTORE_STAGING_PATH,
  writeRestoreMarker
} from '../helpers/restore';
import { logger } from '../logger';
import { IS_TEST } from '../utils/env';
import { getOwnerFromRequest } from './backup-auth';
import { extractZipEntries } from './zip';

// Hard ceiling on the upload, enforced on real bytes (Content-Length is untrusted).
const MAX_IMPORT_BYTES = 20 * 1024 * 1024 * 1024; // 20 GiB

const sendJson = (res: http.ServerResponse, code: number, body: object) => {
  res.writeHead(code, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(body));
};

// Stream the request body to `destPath`, aborting if it exceeds MAX_IMPORT_BYTES.
const streamToFileWithGuard = (
  req: http.IncomingMessage,
  destPath: string
): Promise<{ aborted: boolean }> => {
  return new Promise((resolve, reject) => {
    const out = createWriteStream(destPath);
    let received = 0;
    let aborted = false;

    req.on('data', (chunk: Buffer) => {
      received += chunk.length;
      if (received > MAX_IMPORT_BYTES) {
        aborted = true;
        req.destroy();
        out.destroy();
        resolve({ aborted: true });
      }
    });

    out.on('error', reject);
    req.on('error', reject);
    req.on('end', () => {
      if (aborted) return;
      out.end();
    });
    out.on('close', () => {
      if (!aborted) resolve({ aborted: false });
    });

    req.pipe(out);
  });
};

// Read the manifest from an already-validated staging dir.
const readStagedManifest = async (): Promise<{ latestMigrationTag?: string } | null> => {
  try {
    const raw = await fs.readFile(
      path.join(RESTORE_STAGING_PATH, 'manifest.json'),
      'utf8'
    );
    return JSON.parse(raw);
  } catch {
    return null;
  }
};

const importRouteHandler = async (
  req: http.IncomingMessage,
  res: http.ServerResponse
) => {
  const owner = await getOwnerFromRequest(req);

  if (!owner) {
    req.resume();
    const header = req.headers['x-backup-token'];
    sendJson(res, header ? 403 : 401, {
      error: header ? 'Forbidden' : 'Unauthorized'
    });
    return;
  }

  await fs.mkdir(TMP_PATH, { recursive: true });
  const uploadPath = path.join(TMP_PATH, `import-${Date.now()}.zip`);

  try {
    const { aborted } = await streamToFileWithGuard(req, uploadPath);
    if (aborted) {
      sendJson(res, 413, { error: 'Backup file is too large' });
      return;
    }

    // fresh staging dir
    await fs.rm(RESTORE_STAGING_PATH, { recursive: true, force: true });
    await fs.mkdir(RESTORE_STAGING_PATH, { recursive: true });

    let entryNames: string[];
    try {
      entryNames = await extractZipEntries(uploadPath, RESTORE_STAGING_PATH);
    } catch (zipErr) {
      logger.warn('Import: invalid zip: %s', getErrorMessage(zipErr));
      await fs.rm(RESTORE_STAGING_PATH, { recursive: true, force: true });
      sendJson(res, 400, { error: 'Invalid backup archive' });
      return;
    }

    const hasManifest = entryNames.includes('manifest.json');
    const hasDb = entryNames.includes('db.sqlite');

    if (!hasManifest || !hasDb) {
      await fs.rm(RESTORE_STAGING_PATH, { recursive: true, force: true });
      sendJson(res, 400, {
        error: 'Backup is missing manifest.json or db.sqlite'
      });
      return;
    }

    const manifest = await readStagedManifest();
    const tag = manifest?.latestMigrationTag;

    if (!tag || !(await isMigrationTagRestorable(tag))) {
      await fs.rm(RESTORE_STAGING_PATH, { recursive: true, force: true });
      sendJson(res, 409, {
        error:
          'This backup is from a newer server version and cannot be restored here'
      });
      return;
    }

    await writeRestoreMarker();

    sendJson(res, 200, {
      success: true,
      message: 'Restore staged. The server is restarting…'
    });

    if (!IS_TEST) {
      // let the response flush before exiting; supervisor restarts the process
      setTimeout(() => process.exit(0), 250);
    }
  } catch (error) {
    logger.error('Import failed: %s', getErrorMessage(error));
    await fs.rm(RESTORE_STAGING_PATH, { recursive: true, force: true });
    if (!res.headersSent) {
      sendJson(res, 500, { error: 'Import failed' });
    }
  } finally {
    await fs.rm(uploadPath, { force: true });
  }
};

export { importRouteHandler, MAX_IMPORT_BYTES };
```

- [ ] **Step 4: Run test to verify it passes (after Task 7)**

Run: `bun test src/http/__tests__/import.test.ts`
Expected: PASS (4 tests) once the route is registered.

- [ ] **Step 5: Commit**

```bash
git add apps/server/src/http/import.ts apps/server/src/http/__tests__/import.test.ts
git commit -m "feat(server): POST /import stages owner-only restore with guards"
```

---

## Task 6: Apply pending restore on boot

**Files:**
- Modify: `apps/server/src/index.ts:24` (before `await loadDb();`)

`applyPendingRestore` was already implemented and unit-tested in Task 1. This task only wires it into boot.

- [ ] **Step 1: Add the call before loadDb**

In `apps/server/src/index.ts`, add the import alongside the existing imports and call it immediately before `await loadDb();`:

```typescript
// add to the import block near the other ./helpers and ./db imports:
import { applyPendingRestore } from './helpers/restore';

// ...

// Apply any staged restore BEFORE the DB is opened/migrated.
await applyPendingRestore();

await loadDb();
```

The result should read:

```typescript
import { applyPendingRestore } from './helpers/restore';
import { loadDb } from './db';
// ...
await applyPendingRestore();
await loadDb();
```

- [ ] **Step 2: Type-check**

Run (from `apps/server`): `bun --bun run check-types`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add apps/server/src/index.ts
git commit -m "feat(server): apply pending restore at boot before loadDb"
```

---

## Task 7: Register `/export` and `/import` routes

**Files:**
- Modify: `apps/server/src/http/index.ts:14-22` (imports) and `:39-58` (route tables)

- [ ] **Step 1: Add the handler imports**

Add to the import block in `apps/server/src/http/index.ts`:

```typescript
import { exportRouteHandler } from './export';
import { importRouteHandler } from './import';
```

- [ ] **Step 2: Register the routes**

In the `routeHandlers` object, add `'/export'` to `GET.exact` and `'/import'` to `POST.exact`:

```typescript
  GET: {
    exact: {
      '/healthz': (req, res) => healthRouteHandler(req, res),
      '/info': (req, res) => infoRouteHandler(req, res),
      '/manifest.json': (req, res) => manifestRouteHandler(req, res),
      '/export': (req, res) => exportRouteHandler(req, res)
    },
    prefix: {
      '/public': (req, res) => publicRouteHandler(req, res),
      '/plugin-components': (req, res) =>
        pluginsComponentsRouteHandler(req, res),
      '/plugin-bundle': (req, res) => pluginBundleRouteHandler(req, res)
    }
  },
  POST: {
    exact: {
      '/upload': (req, res) => uploadFileRouteHandler(req, res),
      '/login': (req, res) => loginRouteHandler(req, res),
      '/import': (req, res) => importRouteHandler(req, res)
    },
    prefix: {}
  }
```

- [ ] **Step 3: Run the export + import test suites to verify they now pass**

Run (from `apps/server`):
```bash
bun test src/http/__tests__/export.test.ts src/http/__tests__/import.test.ts
```
Expected: PASS (3 + 4 tests).

- [ ] **Step 4: Run the full server test suite**

Run: `bun test`
Expected: all suites PASS (no regressions).

- [ ] **Step 5: Commit**

```bash
git add apps/server/src/http/index.ts
git commit -m "feat(server): register /export and /import routes"
```

---

## Task 8: Client backup helpers + owner-only Backup tab

**Files:**
- Create: `apps/client/src/helpers/backup.ts`
- Create: `apps/client/src/components/server-screens/server-settings/backup/index.tsx`
- Modify: `apps/client/src/components/server-screens/server-settings/index.tsx`

Auth pattern mirrors `apps/client/src/helpers/upload-file.ts`: base URL from `getUrlFromServer()`, token from `getSessionStorageItem(SessionStorageKey.TOKEN)`. The export must be fetched with the auth header (not a plain `<a href>`), then turned into a Blob download. The header name must match the server: `x-backup-token`.

- [ ] **Step 1: Create the HTTP helpers**

```typescript
// apps/client/src/helpers/backup.ts
import { getUrlFromServer } from './get-file-url';
import { getSessionStorageItem, SessionStorageKey } from './storage';

const BACKUP_TOKEN_HEADER = 'x-backup-token';

const getToken = () => getSessionStorageItem(SessionStorageKey.TOKEN) ?? '';

// Fetch the backup zip with auth and trigger a browser download.
const downloadBackup = async (): Promise<void> => {
  const url = getUrlFromServer();
  const res = await fetch(`${url}/export`, {
    headers: { [BACKUP_TOKEN_HEADER]: getToken() }
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || `Export failed (${res.status})`);
  }

  const blob = await res.blob();
  const disposition = res.headers.get('content-disposition') ?? '';
  const match = disposition.match(/filename="([^"]+)"/);
  const filename = match?.[1] ?? 'bullshark-backup.zip';

  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = objectUrl;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(objectUrl);
};

// Upload a backup zip. On success the server stages the restore and restarts.
const uploadBackup = async (file: File): Promise<void> => {
  const url = getUrlFromServer();
  const res = await fetch(`${url}/import`, {
    method: 'POST',
    headers: {
      [BACKUP_TOKEN_HEADER]: getToken(),
      'Content-Type': 'application/zip'
    },
    body: file
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || `Import failed (${res.status})`);
  }
};

export { downloadBackup, uploadBackup };
```

- [ ] **Step 2: Create the Backup tab component**

```tsx
// apps/client/src/components/server-screens/server-settings/backup/index.tsx
import { downloadBackup, uploadBackup } from '@/helpers/backup';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Group
} from '@sharkord/ui';
import { memo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';

const Backup = memo(() => {
  const { t } = useTranslation('settings');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);

  const onExport = async () => {
    setExporting(true);
    try {
      await downloadBackup();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : String(error));
    } finally {
      setExporting(false);
    }
  };

  const onPickFile = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (file) setPendingFile(file);
  };

  const onConfirmImport = async () => {
    if (!pendingFile) return;
    setImporting(true);
    try {
      await uploadBackup(pendingFile);
      toast.success(t('backupImportStarted'));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : String(error));
    } finally {
      setImporting(false);
      setPendingFile(null);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('backupTitle')}</CardTitle>
        <CardDescription>{t('backupDesc')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-destructive">{t('backupSecurityWarning')}</p>

        <Group label={t('backupExportLabel')} description={t('backupExportDesc')}>
          <Button onClick={onExport} disabled={exporting}>
            {exporting ? t('backupExporting') : t('backupExportButton')}
          </Button>
        </Group>

        <Group label={t('backupImportLabel')} description={t('backupImportDesc')}>
          <Button
            variant="destructive"
            disabled={importing}
            onClick={() => fileInputRef.current?.click()}
          >
            {importing ? t('backupImporting') : t('backupImportButton')}
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".zip,application/zip"
            className="hidden"
            onChange={onPickFile}
          />
        </Group>
      </CardContent>

      <AlertDialog
        open={!!pendingFile}
        onOpenChange={(open) => !open && setPendingFile(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('backupImportConfirmTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('backupImportConfirmDesc')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={onConfirmImport}>
              {t('backupImportConfirmAction')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
});

export { Backup };
```

> Verify the exact names exported by `@sharkord/ui` for the alert dialog primitives (the codebase uses `@radix-ui/react-alert-dialog`; check `packages/ui/src/index.ts`). If `Group` requires different props, mirror the usage in `storage/index.tsx`. Adjust imports to match what `@sharkord/ui` actually exports.

- [ ] **Step 3: Add the owner-only tab to server settings**

In `apps/client/src/components/server-screens/server-settings/index.tsx`:

1. Add imports:
```tsx
import { useIsOwnUserOwner } from '@/features/server/hooks';
import { Backup } from './backup';
```
2. Inside the component, read owner status:
```tsx
const isOwner = useIsOwnUserOwner();
```
3. Add a `TabsTrigger` (only render when owner) after the `plugins` trigger:
```tsx
{isOwner && (
  <TabsTrigger value="backup">{t('backupTab')}</TabsTrigger>
)}
```
4. Add the matching `TabsContent` after the `plugins` content:
```tsx
<TabsContent value="backup" className="space-y-6">
  {isOwner && <Backup />}
</TabsContent>
```

- [ ] **Step 4: Type-check the client**

Run (from `apps/client`): `bun --bun run check-types`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add apps/client/src/helpers/backup.ts apps/client/src/components/server-screens/server-settings/backup/index.tsx apps/client/src/components/server-screens/server-settings/index.tsx
git commit -m "feat(client): owner-only backup export/import tab"
```

---

## Task 9: i18n strings + final verification

**Files:**
- Modify: `apps/client/src/i18n/locales/en/settings.json` (and every sibling locale's `settings.json`)

- [ ] **Step 1: Add the English strings**

Add these keys to the `settings` namespace (`en/settings.json`). Locate the file under `apps/client/src/i18n/locales/en/` (confirm the exact path with the existing `storageTab`/`storageTitle` keys — match that file).

```json
{
  "backupTab": "Backup",
  "backupTitle": "Backup & Restore",
  "backupDesc": "Export a full snapshot of this server, or restore one.",
  "backupSecurityWarning": "A backup contains the raw database — including secrets and password hashes. Store it somewhere safe and never share it.",
  "backupExportLabel": "Export a backup",
  "backupExportDesc": "Download a .zip with the database and all uploaded files.",
  "backupExportButton": "Export backup",
  "backupExporting": "Exporting…",
  "backupImportLabel": "Restore from a backup",
  "backupImportDesc": "Replaces ALL server data and restarts the server.",
  "backupImportButton": "Import backup",
  "backupImporting": "Uploading…",
  "backupImportStarted": "Restore staged. The server is restarting…",
  "backupImportConfirmTitle": "Restore this backup?",
  "backupImportConfirmDesc": "This permanently replaces ALL current data (messages, users, files, settings) and restarts the server. This cannot be undone. A one-time safety copy of the current data is kept on the server.",
  "backupImportConfirmAction": "Replace everything & restart"
}
```

- [ ] **Step 2: Mirror keys into other locales**

For each other locale directory under `apps/client/src/i18n/locales/*/settings.json`, add the same keys. Translate if a translation is readily available; otherwise copy the English value (the project's existing fallback convention applies — confirm by checking whether other recently-added keys were left in English in non-en locales).

- [ ] **Step 3: Full verification**

Run, from `apps/server`:
```bash
bun --bun run magic   # lint:fix + format + check-types
bun test
```
Expected: lint/format clean, types clean, all tests PASS.

Run, from `apps/client`:
```bash
bun --bun run check-types
```
Expected: no errors. (The client build itself is CI/Linux-only per project notes — do not attempt a full local production build on Windows.)

- [ ] **Step 4: Commit**

```bash
git add apps/client/src/i18n/locales
git commit -m "feat(client): i18n strings for backup tab"
```

---

## Self-Review

**Spec coverage:**
- Export `GET /export` owner-only, VACUUM INTO snapshot, zip (manifest + db + public), Content-Disposition, temp cleanup → Task 4. ✅
- Import `POST /import` owner-only, temp upload with real-byte size guard, validation (valid zip, manifest+db present, tag not newer), stage to `restore-staging/`, write `restore.pending`, respond 200, `process.exit(0)` → Task 5. ✅
- Boot application before `loadDb`: pre-restore safety net (db + public, one generation), move staging into place, remove marker/staging, then forward-migrate via `loadDb` → Tasks 1 + 6. ✅
- Owner-only for both endpoints → Task 2 (server, authoritative) + Task 8 (UI gating). ✅
- UI Backup section: export button, import file picker → strong confirm dialog → upload; security warning → Tasks 8 + 9. ✅
- Refuse newer-version backups (equal/older OK) via migration-tag membership in the journal → Tasks 1 (`isMigrationTagRestorable`) + 5. ✅
- Out of scope (no scheduled/auto backups, no partial restore, no archive encryption) → not implemented, as intended. ✅
- Tests: consistent snapshot/round-trip (Tasks 3, 4), refuse newer (Task 5), boot marker + pre-restore (Task 1), upload size guard (Task 5 `streamToFileWithGuard`; the 413 path is covered indirectly — if a dedicated >limit test is wanted, lower `MAX_IMPORT_BYTES` via a test-only constant), owner gating (Tasks 2, 4, 5). ✅

**Placeholder scan:** No "TBD"/"add error handling" placeholders; every code step is concrete. Three explicit *verification* notes remain where the plan depends on real helper signatures (`login()` return shape, `@sharkord/ui` exports, locale file path) — these are deliberate "confirm against the repo" checks, not unfilled work.

**Type consistency:** `BACKUP_TOKEN_HEADER` = `'x-backup-token'` used identically server (Task 2) and client (Task 8). `getOwnerFromRequest`, `getLatestMigrationTag`, `isMigrationTagRestorable`, `writeRestoreMarker`, `applyPendingRestore`, `RESTORE_STAGING_PATH`, `RESTORE_PENDING_PATH`, `addDirToZip`, `extractZipEntries`, `exportRouteHandler`, `importRouteHandler` names match across their defining task and call sites. `db.$client` (Drizzle bun-sqlite v0.44.7) used for `VACUUM INTO`.
