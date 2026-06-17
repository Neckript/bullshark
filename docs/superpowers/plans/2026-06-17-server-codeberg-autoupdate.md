# Sovereign Server Auto-Update via Codeberg — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the GitHub-bound `bun-sfe-autoupdater` with a small, Linux-only, in-repo auto-updater that pulls server releases from Codeberg (Forgejo API), and publish releases to Codeberg from CI (build still on GitHub Actions).

**Architecture:** A runtime updater split into pure, testable units — `forgejo.ts` (HTTP + parsing against the Forgejo release shape), `verify.ts` (sha256), `swap.ts` (download→verify→atomic `rename()` over `process.execPath`) — wired by a rewritten `updater.ts` that guards on `IS_PRODUCTION && !IS_DOCKER`, restarts via detached spawn + `process.exit(0)`, and is gated by `IS_TEST`. The `release.json` manifest schema (already typed as `TVersionInfo` in `@sharkord/shared`) gets a zod validator in shared, replacing the one from the removed package. Build emits Linux-only `bullshark-*` artifacts; CI publishes them to a Codeberg release.

**Tech Stack:** Bun + TypeScript, `bun test`, zod (already in `@sharkord/shared`), `semver`, Forgejo REST API (`https://codeberg.org/api/v1`), GitHub Actions + `curl`.

---

## File Structure

**Shared (modify):**
- `packages/shared/src/helpers/release-metadata.ts` — NEW: `zVersionInfo` zod schema + `validateReleaseMetadata()`, typed to the existing `TVersionInfo`.
- `packages/shared/src/helpers/index.ts` — export the new module.
- `packages/shared/src/helpers/__tests__/release-metadata.test.ts` — NEW test.

**Server runtime (new/rewrite):**
- `apps/server/src/utils/updater/forgejo.ts` — NEW: Forgejo release fetch + asset lookup + metadata download.
- `apps/server/src/utils/updater/verify.ts` — NEW: `sha256File`, `verifyChecksum`.
- `apps/server/src/utils/updater/swap.ts` — NEW: `swapBinary` (download→verify→rename).
- `apps/server/src/utils/updater.ts` — REWRITE: `Updater` class + `selectUpdate` (pure) + guarded restart.
- `apps/server/src/utils/__tests__/updater.test.ts` — NEW: `selectUpdate` + arch tests.
- `apps/server/src/utils/updater/__tests__/forgejo.test.ts`, `verify.test.ts`, `swap.test.ts` — NEW tests.

**Server build (modify):**
- `apps/server/build/build.ts` — Linux-only targets, `bullshark-*` names.
- `apps/server/build/helpers.ts` — import `validateReleaseMetadata`/`TVersionInfo` from `@sharkord/shared` instead of `bun-sfe-autoupdater`.
- `apps/server/package.json` — remove `bun-sfe-autoupdater`.

**CI (modify):**
- `.github/workflows/release.yml` — push tag to both remotes + publish a Codeberg release via `curl`.

---

## Conventions

- Run `bun test` / `bun --bun run check-types` from the relevant package dir (`apps/server`, `packages/shared`).
- The server test runner boots an HTTP server + in-memory DB globally; the new updater tests must NOT hit the network — every fetch is injected via a `deps`/`fetchImpl` parameter and stubbed in tests.
- Repo is a real git repo at `C:\Users\Neckr\Documents\bullshark`, branch `development`, `origin` = Codeberg, `github` = the mirror.
- Codeberg coordinates: API base `https://codeberg.org/api/v1`, owner `The_Neckript`, repo `bullshark`.

---

## Task 1: Shared `release.json` zod validator

**Files:**
- Create: `packages/shared/src/helpers/release-metadata.ts`
- Modify: `packages/shared/src/helpers/index.ts`
- Test: `packages/shared/src/helpers/__tests__/release-metadata.test.ts`

The runtime type already exists: `TVersionInfo = { version: string; releaseDate: string; artifacts: { name; target; size; checksum }[] }` in `packages/shared/src/types.ts`. We add a zod schema that parses to exactly that.

- [ ] **Step 1: Write the failing test**

```typescript
// packages/shared/src/helpers/__tests__/release-metadata.test.ts
import { describe, expect, test } from 'bun:test';
import { validateReleaseMetadata } from '../release-metadata';

const valid = {
  version: '1.2.3',
  releaseDate: '2026-06-17T12:00:00.000Z',
  artifacts: [
    { name: 'bullshark-linux-x64', target: 'linux-x64', size: 123, checksum: 'abc' }
  ]
};

describe('validateReleaseMetadata', () => {
  test('returns the parsed metadata for a valid manifest', () => {
    expect(validateReleaseMetadata(valid)).toEqual(valid);
  });

  test('throws when version is missing', () => {
    const { version: _omit, ...bad } = valid;
    expect(() => validateReleaseMetadata(bad)).toThrow();
  });

  test('throws when an artifact is missing checksum', () => {
    const bad = {
      ...valid,
      artifacts: [{ name: 'x', target: 'linux-x64', size: 1 }]
    };
    expect(() => validateReleaseMetadata(bad)).toThrow();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run (from `packages/shared`): `bun test src/helpers/__tests__/release-metadata.test.ts`
Expected: FAIL — `Cannot find module '../release-metadata'`.

- [ ] **Step 3: Write minimal implementation**

```typescript
// packages/shared/src/helpers/release-metadata.ts
import z from 'zod';
import type { TVersionInfo } from '../types';

const zArtifact = z.object({
  name: z.string(),
  target: z.string(),
  size: z.number(),
  checksum: z.string()
});

const zVersionInfo = z.object({
  version: z.string(),
  releaseDate: z.string(),
  artifacts: z.array(zArtifact)
});

const validateReleaseMetadata = (input: unknown): TVersionInfo =>
  zVersionInfo.parse(input);

export { validateReleaseMetadata, zVersionInfo };
```

- [ ] **Step 4: Export it**

In `packages/shared/src/helpers/index.ts`, add the re-export line (match the existing export style in that file):

```typescript
export * from './release-metadata';
```

- [ ] **Step 5: Run test to verify it passes**

Run (from `packages/shared`): `bun test src/helpers/__tests__/release-metadata.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 6: Type-check**

Run (from `packages/shared`): `bun --bun run check-types`
Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add packages/shared/src/helpers/release-metadata.ts packages/shared/src/helpers/index.ts packages/shared/src/helpers/__tests__/release-metadata.test.ts
git commit -m "feat(shared): zod validator for release.json metadata"
```

---

## Task 2: Forgejo release client

**Files:**
- Create: `apps/server/src/utils/updater/forgejo.ts`
- Test: `apps/server/src/utils/updater/__tests__/forgejo.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// apps/server/src/utils/updater/__tests__/forgejo.test.ts
import { describe, expect, test } from 'bun:test';
import {
  fetchLatestRelease,
  fetchReleaseMetadata,
  findAsset,
  type ForgejoRelease
} from '../forgejo';

const release: ForgejoRelease = {
  tag_name: 'v1.2.3',
  assets: [
    { name: 'release.json', browser_download_url: 'https://cb/release.json' },
    {
      name: 'bullshark-linux-x64',
      browser_download_url: 'https://cb/bullshark-linux-x64'
    }
  ]
};

const metadata = {
  version: '1.2.3',
  releaseDate: '2026-06-17T12:00:00.000Z',
  artifacts: [
    { name: 'bullshark-linux-x64', target: 'linux-x64', size: 1, checksum: 'h' }
  ]
};

const jsonResponse = (body: unknown, ok = true) =>
  ({ ok, status: ok ? 200 : 500, json: async () => body }) as Response;

describe('findAsset', () => {
  test('finds an asset by exact name', () => {
    expect(findAsset(release, 'release.json')?.browser_download_url).toBe(
      'https://cb/release.json'
    );
  });
  test('returns undefined when absent', () => {
    expect(findAsset(release, 'nope')).toBeUndefined();
  });
});

describe('fetchLatestRelease', () => {
  test('GETs the Forgejo latest-release endpoint and returns the JSON', async () => {
    let calledUrl = '';
    const fetchImpl = (async (url: string) => {
      calledUrl = url;
      return jsonResponse(release);
    }) as unknown as typeof fetch;

    const result = await fetchLatestRelease({ fetch: fetchImpl });
    expect(calledUrl).toBe(
      'https://codeberg.org/api/v1/repos/The_Neckript/bullshark/releases/latest'
    );
    expect(result.tag_name).toBe('v1.2.3');
  });

  test('throws on a non-ok response', async () => {
    const fetchImpl = (async () =>
      jsonResponse({}, false)) as unknown as typeof fetch;
    await expect(fetchLatestRelease({ fetch: fetchImpl })).rejects.toThrow();
  });
});

describe('fetchReleaseMetadata', () => {
  test('downloads + validates the release.json asset', async () => {
    const fetchImpl = (async (url: string) => {
      if (url === 'https://cb/release.json') return jsonResponse(metadata);
      throw new Error(`unexpected url ${url}`);
    }) as unknown as typeof fetch;

    const result = await fetchReleaseMetadata(release, { fetch: fetchImpl });
    expect(result.version).toBe('1.2.3');
  });

  test('throws when release.json asset is missing', async () => {
    const fetchImpl = (async () => jsonResponse({})) as unknown as typeof fetch;
    await expect(
      fetchReleaseMetadata({ tag_name: 'v1', assets: [] }, { fetch: fetchImpl })
    ).rejects.toThrow(/release\.json/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run (from `apps/server`): `bun test src/utils/updater/__tests__/forgejo.test.ts`
Expected: FAIL — `Cannot find module '../forgejo'`.

- [ ] **Step 3: Write minimal implementation**

```typescript
// apps/server/src/utils/updater/forgejo.ts
import { validateReleaseMetadata } from '@sharkord/shared';
import type { TVersionInfo } from '@sharkord/shared';

const CODEBERG_API_BASE = 'https://codeberg.org/api/v1';
const REPO_OWNER = 'The_Neckript';
const REPO_NAME = 'bullshark';

type ForgejoAsset = {
  name: string;
  browser_download_url: string;
  size?: number;
};

type ForgejoRelease = {
  tag_name: string;
  assets: ForgejoAsset[];
};

type ForgejoDeps = { fetch: typeof fetch };

const fetchLatestRelease = async (
  deps: ForgejoDeps = { fetch }
): Promise<ForgejoRelease> => {
  const url = `${CODEBERG_API_BASE}/repos/${REPO_OWNER}/${REPO_NAME}/releases/latest`;
  const res = await deps.fetch(url, { headers: { Accept: 'application/json' } });

  if (!res.ok) {
    throw new Error(`Forgejo releases/latest failed: ${res.status}`);
  }

  return (await res.json()) as ForgejoRelease;
};

const findAsset = (
  release: ForgejoRelease,
  name: string
): ForgejoAsset | undefined => release.assets.find((a) => a.name === name);

const fetchReleaseMetadata = async (
  release: ForgejoRelease,
  deps: ForgejoDeps = { fetch }
): Promise<TVersionInfo> => {
  const asset = findAsset(release, 'release.json');

  if (!asset) {
    throw new Error('release.json asset not found in the latest release');
  }

  const res = await deps.fetch(asset.browser_download_url);

  if (!res.ok) {
    throw new Error(`download release.json failed: ${res.status}`);
  }

  return validateReleaseMetadata(await res.json());
};

export {
  CODEBERG_API_BASE,
  fetchLatestRelease,
  fetchReleaseMetadata,
  findAsset,
  REPO_NAME,
  REPO_OWNER
};
export type { ForgejoAsset, ForgejoDeps, ForgejoRelease };
```

- [ ] **Step 4: Run test to verify it passes**

Run (from `apps/server`): `bun test src/utils/updater/__tests__/forgejo.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/server/src/utils/updater/forgejo.ts apps/server/src/utils/updater/__tests__/forgejo.test.ts
git commit -m "feat(server): Forgejo release client for Codeberg auto-update"
```

---

## Task 3: Checksum verification

**Files:**
- Create: `apps/server/src/utils/updater/verify.ts`
- Test: `apps/server/src/utils/updater/__tests__/verify.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// apps/server/src/utils/updater/__tests__/verify.test.ts
import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { sha256File, verifyChecksum } from '../verify';

// sha256 of the bytes "hello"
const HELLO_SHA256 =
  '2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824';

let dir: string;
let file: string;

beforeEach(async () => {
  dir = await fs.mkdtemp(path.join(os.tmpdir(), 'verify-'));
  file = path.join(dir, 'f.bin');
  await fs.writeFile(file, 'hello');
});

afterEach(async () => {
  await fs.rm(dir, { recursive: true, force: true });
});

describe('sha256File', () => {
  test('computes the sha256 hex of a file', async () => {
    expect(await sha256File(file)).toBe(HELLO_SHA256);
  });
});

describe('verifyChecksum', () => {
  test('true on a matching checksum', async () => {
    expect(await verifyChecksum(file, HELLO_SHA256)).toBe(true);
  });
  test('false on a mismatch', async () => {
    expect(await verifyChecksum(file, 'deadbeef')).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run (from `apps/server`): `bun test src/utils/updater/__tests__/verify.test.ts`
Expected: FAIL — `Cannot find module '../verify'`.

- [ ] **Step 3: Write minimal implementation**

```typescript
// apps/server/src/utils/updater/verify.ts
import fs from 'fs/promises';

const sha256File = async (filePath: string): Promise<string> => {
  const fileBuffer = await fs.readFile(filePath);
  const hashBuffer = await crypto.subtle.digest('SHA-256', fileBuffer);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
};

const verifyChecksum = async (
  filePath: string,
  expected: string
): Promise<boolean> => (await sha256File(filePath)) === expected;

export { sha256File, verifyChecksum };
```

- [ ] **Step 4: Run test to verify it passes**

Run (from `apps/server`): `bun test src/utils/updater/__tests__/verify.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/server/src/utils/updater/verify.ts apps/server/src/utils/updater/__tests__/verify.test.ts
git commit -m "feat(server): sha256 checksum verification for updates"
```

---

## Task 4: Atomic binary swap

**Files:**
- Create: `apps/server/src/utils/updater/swap.ts`
- Test: `apps/server/src/utils/updater/__tests__/swap.test.ts`

`swapBinary` downloads to a temp file in the **same directory** as the target (so `rename()` is atomic), verifies the checksum, then renames over the target. On any failure the temp file is removed and the target is left intact.

- [ ] **Step 1: Write the failing test**

```typescript
// apps/server/src/utils/updater/__tests__/swap.test.ts
import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { swapBinary } from '../swap';

// sha256 of "NEW_BINARY"
const NEW_SHA256 =
  '0f5c9c1cda9c9f0f0d2b7f0a4a6b1f6e9b2f4a8c7d3e1b5a9c8e7f6d2a1b3c4d';

let dir: string;
let target: string;

beforeEach(async () => {
  dir = await fs.mkdtemp(path.join(os.tmpdir(), 'swap-'));
  target = path.join(dir, 'server-bin');
  await fs.writeFile(target, 'OLD_BINARY');
});

afterEach(async () => {
  await fs.rm(dir, { recursive: true, force: true });
});

const okResponse = (bytes: string) =>
  ({ ok: true, status: 200, arrayBuffer: async () => new TextEncoder().encode(bytes).buffer }) as Response;

describe('swapBinary', () => {
  test('replaces the target when the checksum matches', async () => {
    // compute the real checksum of "NEW_BINARY" at runtime to avoid a wrong literal
    const tmp = path.join(dir, 'probe');
    await fs.writeFile(tmp, 'NEW_BINARY');
    const { sha256File } = await import('../verify');
    const checksum = await sha256File(tmp);
    await fs.rm(tmp);

    const fetchImpl = (async () =>
      okResponse('NEW_BINARY')) as unknown as typeof fetch;

    await swapBinary(
      {
        downloadUrl: 'https://cb/new',
        expectedChecksum: checksum,
        targetPath: target
      },
      { fetch: fetchImpl }
    );

    expect(await fs.readFile(target, 'utf8')).toBe('NEW_BINARY');
  });

  test('leaves the target intact and throws on a checksum mismatch', async () => {
    const fetchImpl = (async () =>
      okResponse('NEW_BINARY')) as unknown as typeof fetch;

    await expect(
      swapBinary(
        {
          downloadUrl: 'https://cb/new',
          expectedChecksum: 'deadbeef',
          targetPath: target
        },
        { fetch: fetchImpl }
      )
    ).rejects.toThrow(/checksum/i);

    expect(await fs.readFile(target, 'utf8')).toBe('OLD_BINARY');
    // no leftover temp files
    const leftovers = (await fs.readdir(dir)).filter((n) =>
      n.startsWith('.update-')
    );
    expect(leftovers).toEqual([]);
  });
});
```

> Note: `NEW_SHA256` above is illustrative; the passing test computes the real checksum at runtime, so no hardcoded hash is relied upon.

- [ ] **Step 2: Run test to verify it fails**

Run (from `apps/server`): `bun test src/utils/updater/__tests__/swap.test.ts`
Expected: FAIL — `Cannot find module '../swap'`.

- [ ] **Step 3: Write minimal implementation**

```typescript
// apps/server/src/utils/updater/swap.ts
import fs from 'fs/promises';
import path from 'path';
import type { ForgejoDeps } from './forgejo';
import { verifyChecksum } from './verify';

type SwapArgs = {
  downloadUrl: string;
  expectedChecksum: string;
  targetPath: string;
};

const downloadToTemp = async (
  downloadUrl: string,
  targetPath: string,
  deps: ForgejoDeps
): Promise<string> => {
  const tempPath = path.join(
    path.dirname(targetPath),
    `.update-${Date.now()}.tmp`
  );
  const res = await deps.fetch(downloadUrl);

  if (!res.ok) {
    throw new Error(`download binary failed: ${res.status}`);
  }

  const bytes = new Uint8Array(await res.arrayBuffer());
  await fs.writeFile(tempPath, bytes);
  return tempPath;
};

const swapBinary = async (
  args: SwapArgs,
  deps: ForgejoDeps = { fetch }
): Promise<void> => {
  const tempPath = await downloadToTemp(args.downloadUrl, args.targetPath, deps);

  try {
    if (!(await verifyChecksum(tempPath, args.expectedChecksum))) {
      throw new Error('checksum mismatch — refusing to install update');
    }

    await fs.chmod(tempPath, 0o755);
    await fs.rename(tempPath, args.targetPath);
  } catch (error) {
    await fs.rm(tempPath, { force: true });
    throw error;
  }
};

export { swapBinary };
export type { SwapArgs };
```

- [ ] **Step 4: Run test to verify it passes**

Run (from `apps/server`): `bun test src/utils/updater/__tests__/swap.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/server/src/utils/updater/swap.ts apps/server/src/utils/updater/__tests__/swap.test.ts
git commit -m "feat(server): atomic verified binary swap for Linux self-update"
```

---

## Task 5: Updater class rewrite

**Files:**
- Modify (rewrite): `apps/server/src/utils/updater.ts`
- Test: `apps/server/src/utils/__tests__/updater.test.ts`

The public surface (`updater` singleton with `canUpdate`, `getLatestVersion`, `hasUpdates`, `update`) is preserved so `apps/server/src/index.ts` wiring is unchanged. The pure decision (`selectUpdate`) is exported and unit-tested; the `process.exit`/spawn restart is gated behind `IS_TEST`.

- [ ] **Step 1: Write the failing test**

```typescript
// apps/server/src/utils/__tests__/updater.test.ts
import { describe, expect, test } from 'bun:test';
import { selectUpdate } from '../updater';

const meta = (version: string) => ({
  version,
  releaseDate: '2026-06-17T00:00:00.000Z',
  artifacts: [
    { name: 'bullshark-linux-x64', target: 'linux-x64', size: 1, checksum: 'h' },
    { name: 'bullshark-linux-arm64', target: 'linux-arm64', size: 1, checksum: 'h' }
  ]
});

describe('selectUpdate', () => {
  test('returns the matching artifact when the version is newer', () => {
    const a = selectUpdate(meta('9.9.9'), 'linux-x64', '1.0.0');
    expect(a?.name).toBe('bullshark-linux-x64');
  });

  test('returns null when the version is not newer', () => {
    expect(selectUpdate(meta('1.0.0'), 'linux-x64', '1.0.0')).toBeNull();
  });

  test('returns null when no artifact matches the arch', () => {
    const noArm = {
      ...meta('9.9.9'),
      artifacts: meta('9.9.9').artifacts.filter((x) => x.target !== 'linux-arm64')
    };
    expect(selectUpdate(noArm, 'linux-arm64', '1.0.0')).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run (from `apps/server`): `bun test src/utils/__tests__/updater.test.ts`
Expected: FAIL — `selectUpdate` is not exported (old `updater.ts` has no such export).

- [ ] **Step 3: Write the implementation (full file replacement)**

```typescript
// apps/server/src/utils/updater.ts
import { getErrorMessage } from '@sharkord/shared';
import type { TArtifact, TVersionInfo } from '@sharkord/shared';
import semver from 'semver';
import { config } from '../config';
import { logger } from '../logger';
import { IS_DOCKER, IS_PRODUCTION, IS_TEST, SERVER_VERSION } from './env';
import {
  fetchLatestRelease,
  fetchReleaseMetadata,
  findAsset
} from './updater/forgejo';
import { swapBinary } from './updater/swap';

const UPDATE_CHECK_INTERVAL_MS = 60 * 60 * 1000; // 1 hour

type ServerArch = 'linux-x64' | 'linux-arm64';

const getCurrentArch = (): ServerArch => {
  if (process.platform === 'linux' && process.arch === 'x64') return 'linux-x64';
  if (process.platform === 'linux' && process.arch === 'arm64')
    return 'linux-arm64';
  throw new Error(
    `Unsupported server platform/arch for auto-update: ${process.platform}-${process.arch}`
  );
};

// Pure decision: the artifact to install, or null if no applicable newer build.
const selectUpdate = (
  metadata: TVersionInfo,
  arch: ServerArch,
  currentVersion: string
): TArtifact | null => {
  if (!semver.gt(metadata.version, currentVersion)) return null;
  return metadata.artifacts.find((a) => a.target === arch) ?? null;
};

class Updater {
  private isUpdating = false;

  constructor() {
    if (this.canUpdate()) {
      void this.setupAutoUpdater();
    }
  }

  public canUpdate = (): boolean => IS_PRODUCTION && !IS_DOCKER;

  public getLatestVersion = async (): Promise<string> => {
    const release = await fetchLatestRelease();
    const metadata = await fetchReleaseMetadata(release);
    return metadata.version;
  };

  public hasUpdates = async (): Promise<boolean> => {
    const release = await fetchLatestRelease();
    const metadata = await fetchReleaseMetadata(release);
    const artifact = selectUpdate(metadata, getCurrentArch(), SERVER_VERSION);
    return artifact !== null && findAsset(release, artifact.name) !== undefined;
  };

  public update = async (): Promise<void> => {
    if (!this.canUpdate() || this.isUpdating) return;

    this.isUpdating = true;

    try {
      logger.info('Checking for updates...');

      const release = await fetchLatestRelease();
      const metadata = await fetchReleaseMetadata(release);
      const artifact = selectUpdate(metadata, getCurrentArch(), SERVER_VERSION);

      if (!artifact) {
        logger.debug('No update available');
        return;
      }

      const asset = findAsset(release, artifact.name);

      if (!asset) {
        logger.warn('Update metadata references a missing asset: %s', artifact.name);
        return;
      }

      logger.info('Update %s available, downloading...', metadata.version);

      await swapBinary({
        downloadUrl: asset.browser_download_url,
        expectedChecksum: artifact.checksum,
        targetPath: process.execPath
      });

      logger.info('Update installed, restarting...');

      if (!IS_TEST) {
        const child = Bun.spawn([process.execPath, ...process.argv.slice(2)], {
          stdio: ['inherit', 'inherit', 'inherit'],
          detached: true
        });
        child.unref();
        process.exit(0);
      }
    } catch (error) {
      logger.error('Auto-update failed: %s', getErrorMessage(error));
    } finally {
      this.isUpdating = false;
    }
  };

  private setupAutoUpdater = async (): Promise<void> => {
    if (!config.server.autoupdate) {
      return;
    }

    logger.info(
      `Auto-updater enabled, checking every ${UPDATE_CHECK_INTERVAL_MS / 1000 / 60} minutes`
    );

    await this.update();

    setInterval(this.update, UPDATE_CHECK_INTERVAL_MS);
  };
}

const updater = new Updater();

export { selectUpdate, updater };
```

- [ ] **Step 4: Run test to verify it passes**

Run (from `apps/server`): `bun test src/utils/__tests__/updater.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Run the full server test suite (no regressions)**

Run (from `apps/server`): `bun test`
Expected: all suites PASS. Constructing `new Updater()` is a no-op under tests (`canUpdate()` is false because `IS_PRODUCTION` is false in test env), so no network is touched on import.

- [ ] **Step 6: Type-check**

Run (from `apps/server`): `bun --bun run check-types`
Expected: no errors. (`bun-sfe-autoupdater` is no longer imported by `updater.ts`.)

- [ ] **Step 7: Commit**

```bash
git add apps/server/src/utils/updater.ts apps/server/src/utils/__tests__/updater.test.ts
git commit -m "feat(server): sovereign Codeberg auto-updater (replaces bun-sfe-autoupdater)"
```

---

## Task 6: Build → Linux-only `bullshark-*` + drop the package

**Files:**
- Modify: `apps/server/build/build.ts:87-93`
- Modify: `apps/server/build/helpers.ts:1-5`
- Modify: `apps/server/package.json`

- [ ] **Step 1: Linux-only `bullshark-*` targets in build.ts**

Replace the `allTargets` array in `apps/server/build/build.ts` (currently lines 87-93) with:

```typescript
const allTargets: TTarget[] = [
  { out: 'bullshark-linux-x64', target: 'bun-linux-x64' },
  { out: 'bullshark-linux-arm64', target: 'bun-linux-arm64' }
];
```

Also change the final log line `console.log('Sharkord built.');` (line 127) to:

```typescript
console.log('Bullshark built.');
```

- [ ] **Step 2: Repoint helpers.ts to the shared validator**

In `apps/server/build/helpers.ts`, replace the import block (lines 1-5):

```typescript
import type { TArtifact } from '@sharkord/shared';
import {
  validateReleaseMetadata,
  type TReleaseMetadata
} from 'bun-sfe-autoupdater';
```

with:

```typescript
import {
  validateReleaseMetadata,
  type TArtifact,
  type TVersionInfo
} from '@sharkord/shared';
```

Then update the `getVersionInfo` return type: change its annotation `Promise<TReleaseMetadata>` to `Promise<TVersionInfo>` (the object shape is identical).

- [ ] **Step 3: Remove the dependency**

In `apps/server/package.json`, delete the line:

```json
    "bun-sfe-autoupdater": "^0.0.4",
```

Then run (from repo root): `bun install`
Expected: lockfile updates, `bun-sfe-autoupdater` removed, no errors.

- [ ] **Step 4: Verify the package is fully gone + types pass**

Run (from repo root): `grep -rn "bun-sfe-autoupdater" apps packages .github`
Expected: NO matches.

Run (from `apps/server`): `bun --bun run check-types`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add apps/server/build/build.ts apps/server/build/helpers.ts apps/server/package.json bun.lock
git commit -m "build(server): Linux-only bullshark-* artifacts; drop bun-sfe-autoupdater"
```

---

## Task 7: Release CI publishes to Codeberg

**Files:**
- Modify: `.github/workflows/release.yml`

This keeps the GitHub Actions build but (a) pushes the version-bump commit + tag to both remotes and (b) creates the Codeberg release with the Linux artifacts + `release.json`. Requires a new GitHub Actions secret `CODEBERG_TOKEN` (a Codeberg application token with repo write scope).

- [ ] **Step 1: Replace the "Create GitHub release" step**

In `.github/workflows/release.yml`, replace the `Create GitHub release` step (the `softprops/action-gh-release@v2` block listing the `sharkord-*` files) with the two steps below. Keep every prior step (checkout, build action, get_version, identify user, docker) unchanged except the asset paths now use `bullshark-*`.

```yaml
      - name: Push version bump and tag to both remotes
        env:
          CODEBERG_TOKEN: ${{ secrets.CODEBERG_TOKEN }}
        run: |
          set -euo pipefail
          VERSION="${{ steps.get_version.outputs.version }}"
          git tag "v${VERSION}"
          # origin here is the GitHub checkout remote
          git push origin HEAD --follow-tags
          git remote add codeberg "https://x-access-token:${CODEBERG_TOKEN}@codeberg.org/The_Neckript/bullshark.git"
          git push codeberg HEAD:refs/heads/${{ github.ref_name }}
          git push codeberg "v${VERSION}"

      - name: Create Codeberg release and upload assets
        env:
          CODEBERG_TOKEN: ${{ secrets.CODEBERG_TOKEN }}
        run: |
          set -euo pipefail
          VERSION="${{ steps.get_version.outputs.version }}"
          API="https://codeberg.org/api/v1/repos/The_Neckript/bullshark"
          OUT="apps/server/build/out"

          RELEASE_ID=$(curl -sf -X POST "${API}/releases" \
            -H "Authorization: token ${CODEBERG_TOKEN}" \
            -H "Content-Type: application/json" \
            -d "{\"tag_name\":\"v${VERSION}\",\"name\":\"v${VERSION}\",\"draft\":false,\"prerelease\":false}" \
            | jq -r '.id')

          for f in bullshark-linux-x64 bullshark-linux-arm64 release.json; do
            curl -sf -X POST "${API}/releases/${RELEASE_ID}/assets?name=${f}" \
              -H "Authorization: token ${CODEBERG_TOKEN}" \
              -F "attachment=@${OUT}/${f}"
          done
```

- [ ] **Step 2: Update the asset list referenced anywhere else in the file**

If the removed `softprops` block (or any docker label) still references `sharkord-*` artifact paths, ensure no remaining step points at the old `apps/server/build/out/sharkord-*` paths. The build now emits only `bullshark-linux-x64`, `bullshark-linux-arm64`, `release.json`.

- [ ] **Step 3: Validate the workflow YAML**

If `actionlint` is available, run: `actionlint .github/workflows/release.yml`
Otherwise verify YAML parses (from repo root):

```bash
bun -e "const fs=require('fs');const y=fs.readFileSync('.github/workflows/release.yml','utf8');if(!y.includes('codeberg.org/api/v1/repos/The_Neckript/bullshark'))throw new Error('codeberg publish missing');console.log('ok')"
```
Expected: `ok`.

- [ ] **Step 4: Commit**

```bash
git add .github/workflows/release.yml
git commit -m "ci(server): publish releases to Codeberg via Forgejo API"
```

- [ ] **Step 5: Manual follow-up (not a code step)**

Record for the operator: add the **`CODEBERG_TOKEN`** secret in the GitHub repo settings (Settings → Secrets and variables → Actions). End-to-end verification happens on the first real release run; the auto-updater can only be exercised once a Codeberg release with these assets exists.

---

## Self-Review

**Spec coverage:**
- §"In scope 1" runtime updater (forgejo fetch, hasUpdates/arch, verified download, Linux rename, detached-spawn restart gated by IS_TEST, guards) → Tasks 2,3,4,5. ✅
- §"In scope 2" shared zod schema replacing the package's validator → Task 1 + Task 6 Step 2. ✅
- §"In scope 3" build Linux-only `bullshark-*` + drop dependency → Task 6. ✅
- §"In scope 4" CI publishes to Codeberg, pushes tag to both remotes, `CODEBERG_TOKEN` → Task 7. ✅
- §Sovereignty (runtime only calls codeberg.org) → Task 2 base URL + Task 6 dependency removal + Task 4 grep gate. ✅
- §Testing (forgejo/hasUpdates/verify/swap unit tests, exit gated by IS_TEST, shared validator test) → Tasks 1-5. ✅
- §Out of scope (desktop, Docker image, Windows/macOS server, footer links) → untouched; no task addresses them, intentionally. ✅

**Placeholder scan:** No TBD/"handle errors" placeholders; every code step shows full code. The one illustrative `NEW_SHA256` literal in Task 4 is explicitly annotated and the test computes the real checksum at runtime, so nothing depends on the placeholder value. ✅

**Type consistency:** `TVersionInfo`/`TArtifact` from `@sharkord/shared` used identically in Tasks 1,2,5,6. `validateReleaseMetadata` defined in Task 1, consumed in Tasks 2 and 6. `ForgejoRelease`/`ForgejoAsset`/`ForgejoDeps` defined in Task 2, consumed in Task 4 (`ForgejoDeps`) and Task 5 (`fetchLatestRelease`/`fetchReleaseMetadata`/`findAsset`). `selectUpdate(metadata, arch, currentVersion)` defined and consumed in Task 5. `swapBinary({downloadUrl, expectedChecksum, targetPath}, deps)` defined in Task 4, called identically in Task 5. Asset names `bullshark-linux-x64`/`bullshark-linux-arm64` consistent across Tasks 6 and 7 and match `target` values `linux-x64`/`linux-arm64`. ✅
