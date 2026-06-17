# Server Sovereign Auto-Update via Codeberg — Design

**Date:** 2026-06-17
**Status:** Approved (design)
**Sub-project:** A of 2 (server). Desktop auto-update is a separate spec/plan.

## Goal

Replace the GitHub-bound `bun-sfe-autoupdater` with a small, self-contained, **Linux-only** in-repo auto-updater that pulls server releases from **Codeberg** (Forgejo API), and move the release-publishing CI step to publish to Codeberg. Build still runs on GitHub Actions (hybrid). At runtime the server contacts **only `codeberg.org`** — no GitHub, no third-party helper.

## Context & constraints (decided during brainstorming)

- Production server runs as a **single-file Bun executable on a Linux host** (x64 and/or arm64). Auto-update is the real update channel (Docker is a separate, out-of-scope channel where `canUpdate()` is already false).
- **Sovereignty:** the existing `bun-sfe-autoupdater@0.0.4` hardcodes `https://api.github.com/...` for the release fetch **and** downloads a self-replace "helper" binary from the package author's GitHub (`diogomartino/bun-sfe-autoupdater`) using a GitHub-specific `asset.digest`. Both are unacceptable. Since the host is Linux-only, the cross-platform helper is unnecessary: a running Linux binary can be replaced by `rename()` over it, then restarted.
- **Build targets:** Linux-only (`linux-x64`, `linux-arm64`). Windows/macOS server targets are dropped from the release build.
- **Restart strategy:** after the swap, spawn the new binary **detached** then `process.exit(0)` (works with or without a supervisor; compatible with systemd `Restart=always`).
- **Hybrid CI:** binaries are built on GitHub Actions; the release (assets + `release.json`) is published to Codeberg.

## Repositories / hosts

- Code + releases home: `https://codeberg.org/The_Neckript/bullshark` (Forgejo). GitHub `Neckript/bullshark` kept as a public mirror.
- Forgejo release API base: `https://codeberg.org/api/v1`.

## `release.json` schema (the update manifest)

Produced by the build, uploaded as a release asset, and read by the runtime updater:

```json
{
  "version": "1.2.3",
  "releaseDate": "2026-06-17T12:00:00.000Z",
  "artifacts": [
    { "name": "bullshark-linux-x64",   "target": "linux-x64",   "size": 123456, "checksum": "<sha256-hex>" },
    { "name": "bullshark-linux-arm64", "target": "linux-arm64", "size": 123456, "checksum": "<sha256-hex>" }
  ]
}
```

`validateReleaseMetadata` + the `TReleaseMetadata` type currently come from `bun-sfe-autoupdater`. Removing that package means we own this schema: define a small zod schema + types in `@sharkord/shared` (where `TArtifact` already lives), consumed by both `apps/server/build/helpers.ts` and the runtime updater.

## In scope — components

### 1. Runtime updater — `apps/server/src/utils/updater.ts` (rewrite) + `apps/server/src/utils/updater/` helpers

Public surface stays the same as today (`updater` singleton with `canUpdate`, `getLatestVersion`, `hasUpdates`, `update`) so `index.ts` wiring is unchanged.

- `canUpdate()` — unchanged: `IS_PRODUCTION && !IS_DOCKER`.
- `getCurrentArch()` — returns `'linux-x64' | 'linux-arm64'`; throws for anything else (we never ship/auto-update other server targets).
- `fetchLatestMetadata()` —
  - `GET https://codeberg.org/api/v1/repos/The_Neckript/bullshark/releases/latest` (public repo → no auth header).
  - From the Forgejo release JSON, find the attachment whose `name === 'release.json'`, fetch its `browser_download_url`, parse + `validateReleaseMetadata`.
  - Returns `{ release, metadata }` where `release` is the Forgejo release (for the per-arch `browser_download_url`).
- `hasUpdates()` — `semver.gt(metadata.version, SERVER_VERSION)` AND the metadata has an artifact whose `target === getCurrentArch()` AND that artifact name exists among the release attachments.
- `update()` — guarded by `canUpdate()`, `config.server.autoupdate`, and the `isUpdating` lock:
  1. `hasUpdates()`? if not, return.
  2. Resolve the arch artifact + its `browser_download_url` + expected `checksum` from `release.json`.
  3. Download to a temp file in the same directory as `process.execPath` (same filesystem → atomic rename).
  4. Compute sha256; if it ≠ the manifest `checksum`, delete temp + abort with an error log (never install an unverified binary).
  5. `chmod(temp, 0o755)`, then `rename(temp, process.execPath)` (replaces the running binary on Linux).
  6. Restart: `Bun.spawn([process.execPath, ...process.argv.slice(2)], { detached: true, stdio: 'inherit' })`, then `process.exit(0)`. Guard the spawn+exit behind `!IS_TEST`.
- Auto-start: `setupAutoUpdater()` unchanged — if `config.server.autoupdate`, run once then `setInterval` every 1h.
- Errors are caught + logged (`logger.error`), never thrown to the boot path.

Decompose so the risky/`process`-touching parts are isolated and testable:
- `apps/server/src/utils/updater/forgejo.ts` — `fetchLatestRelease()`, `findAsset()`, pure HTTP/JSON (mockable).
- `apps/server/src/utils/updater/verify.ts` — `sha256File()` + `verifyChecksum()`.
- `apps/server/src/utils/updater/swap.ts` — `swapBinary(tempPath, targetPath)` (download-to-temp + verify + rename), no `process.exit`.
- `apps/server/src/utils/updater.ts` — the `Updater` class wiring + the guarded restart.

### 2. Shared release schema — `@sharkord/shared`

Add `zReleaseMetadata` (zod) + exported `TReleaseMetadata` (and keep `TArtifact`), plus `validateReleaseMetadata(input): TReleaseMetadata`. Replace the `bun-sfe-autoupdater` imports in `apps/server/build/helpers.ts` (and the runtime updater) with these.

### 3. Build — `apps/server/build/build.ts` + `apps/server/build/helpers.ts`

- Asset prefix `sharkord-*` → `bullshark-*`.
- Reduce `allTargets` to Linux only: `bullshark-linux-x64` (`bun-linux-x64`), `bullshark-linux-arm64` (`bun-linux-arm64`). Remove the Windows/macOS targets.
- `getVersionInfo()` keeps emitting `{ version, releaseDate, artifacts:[{name,target,size,checksum}] }`, now validated by the shared `validateReleaseMetadata`.
- Drop the `bun-sfe-autoupdater` dependency from `apps/server/package.json`.

### 4. Release CI — `.github/workflows/release.yml`

Keep the manual `workflow_dispatch` + `ci`/`e2e` gates + the GitHub Actions build (`build` composite action, renamed conceptually to build Bullshark Linux artifacts). Replace the GitHub-release publish with Codeberg publishing, and make the workflow the single integration point (no reliance on mirror auto-sync):

1. Build → `apps/server/build/out/{bullshark-linux-x64,bullshark-linux-arm64,release.json}`.
2. Read `version` from `package.json`.
3. Commit the version bump and **push the commit + tag `v<version>` to both remotes**: the GitHub origin and `https://<user>:${{ secrets.CODEBERG_TOKEN }}@codeberg.org/The_Neckript/bullshark.git`.
4. **Create the Codeberg release** for `tag_name=v<version>` via `POST https://codeberg.org/api/v1/repos/The_Neckript/bullshark/releases` (header `Authorization: token ${{ secrets.CODEBERG_TOKEN }}`), then upload each asset via `POST .../releases/{id}/assets?name=<file>` (multipart). Implemented as a `curl` shell step (host-tool-agnostic) — the two binaries + `release.json`.
5. Docker image publish (Docker Hub) is left as-is for now (secondary channel; image rename is a separate decision).

New required secret: **`CODEBERG_TOKEN`** (Codeberg application token with repo write scope), added in the GitHub repo settings.

## Sovereignty result

At runtime the server only ever calls `codeberg.org`. The `bun-sfe-autoupdater` dependency and its GitHub/third-party helper download are gone.

## Testing

`bun test` from `apps/server`, no network:
- `forgejo.ts`: given a mocked Forgejo `releases/latest` payload + a mocked `release.json`, `fetchLatestMetadata()` returns the parsed metadata and resolves the arch asset URL; missing `release.json` asset → throws.
- `hasUpdates()`: newer version + matching arch artifact → true; same/older version → false; newer version but no artifact for current arch → false.
- `verify.ts`: `sha256File()` matches a known fixture; `verifyChecksum()` accepts a matching hash and rejects a tampered one.
- `swap.ts`: against temp files — writes the downloaded bytes, verifies checksum, renames over a dummy "current" file, and the target ends up with the new content; a checksum mismatch leaves the target untouched and removes the temp.
- The actual `process.exit`/detached spawn is gated behind `IS_TEST` and not exercised in tests.
- `@sharkord/shared`: `validateReleaseMetadata` accepts a valid manifest and rejects malformed input.

CI publishing is verified manually on the first real Codeberg release (cannot be unit-tested).

## Out of scope

- Desktop auto-update (sub-project B).
- Docker image registry/name (`sharkord` → `bullshark`, Docker Hub vs Codeberg registry).
- Windows/macOS **server** self-update.
- The connect-footer / debug-info GitHub links (GitHub stays a public mirror).
- Any change to how clients are served; only the server self-update path changes.

## Risks / notes

- The Forgejo `releases/latest` JSON is GitHub-ish but not identical; the parser targets the Forgejo shape explicitly (`assets[].name`, `assets[].browser_download_url`) rather than assuming GitHub fields (`asset.url`, `asset.digest`).
- `rename()` over `process.execPath` requires the temp file to be on the **same filesystem** (hence "temp beside the executable"), otherwise it falls back to a cross-device copy — the swap helper writes the temp in `dirname(process.execPath)`.
- If `config.server.autoupdate` is off, none of this runs — existing behavior preserved.
- End-to-end verification is blocked until the first Codeberg release exists; until then, only unit tests + a manual CI dry-run validate the work.
