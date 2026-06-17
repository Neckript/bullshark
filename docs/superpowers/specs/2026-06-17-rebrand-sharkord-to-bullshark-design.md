# Rebrand: Sharkord → Bullshark (visible branding) — Design

**Date:** 2026-06-17
**Status:** Approved (design)
**Scope class:** Visible branding only — internal identifiers untouched.

## Goal

Replace every user-visible mention of "Sharkord" with "Bullshark" across the app, so Bullshark reads as a product in its own right, while crediting the upstream project cleanly and respecting the original author's work ("Bullshark, a fork of Sharkord").

## Guiding principle

Every occurrence of "Sharkord" **rendered to an end user** becomes "Bullshark", with exactly two deliberate exceptions:

1. The marketplace-verified tooltip, which refers to the upstream Sharkord verification authority (kept as "Sharkord").
2. A new, discreet "fork of Sharkord" credit (intentionally contains "Sharkord").

Everything internal is left untouched: `@sharkord/*` package names, CI job names, Docker, `SHARKORD_*` environment-variable names, log lines, test fixtures, code comments, lockfiles, git internals, and historical docs/specs/plans.

## In scope — concrete changes

### 1. Product self-references → Bullshark

- `apps/client/index.html`: `<title>Sharkord</title>` → `<title>Bullshark</title>`.
- `apps/client/src/screens/connect/index.tsx`: `alt="Sharkord"` → `alt="Bullshark"`.
- i18n strings across **all 7 locales** (`cs, en, es, fr, it, ru, zh`), same keys in each:
  - `common.json`: `mobileNotOptimized`, `globalErrorTitle`, `globalErrorDescription`.
  - `connect.json`: `loadingApp` ("Loading Sharkord").
  - `dialogs.json`: `pluginInstallConfirmLead`, `pluginInstallUseDocker`.
  - `settings.json`: `othersDesc`, `restrictOwnAudioDesc`, `restrictOwnAudioUnsupported`, `noPluginsDesc`, `updatesDesc`, `upToDateDesc`, `diskSharkordUsed`.
  - Translate the brand naturally where the surrounding string is already translated; otherwise keep the surrounding copy and swap only the brand token. The brand word "Bullshark" itself is not localized.
- Server-side visible defaults in `apps/server/src/db/seed.ts` (fresh-install defaults shown to users):
  - default server name `'sharkord Server'` → `'Bullshark Server'`.
  - default server description.
  - sample/welcome content (`'<p>Welcome to sharkord!</p>'`) and the seed user display name/bio.
  - The seed user's `password` value is a credential, not brand copy — left unchanged (not branding).

### 2. Deliberate exception (kept as "Sharkord")

- `apps/client/src/i18n/locales/*/settings.json` → `marketplaceVerifiedTooltip` ("This plugin was verified by Sharkord.") stays "Sharkord" in all locales: it names the upstream marketplace verification authority, not our product.

### 3. Connect-screen footer (attribution)

Current footer: `v{version} · GitHub(→github.com/sharkord/sharkord) · Sharkord(→sharkord.com)`.

New footer:

- `GitHub` link → `https://github.com/Neckript/bullshark` (the product repo, `origin`).
- The `Sharkord → sharkord.com` link is replaced by a discreet credit **"fork of Sharkord"** → `https://github.com/Sharkord/sharkord` (the upstream, `upstream` remote).
- The credit label is added as a dedicated i18n key (e.g. `connect.json → forkCredit`) so it is translatable; the link target is a literal URL in the component.

### 4. LICENSE (MIT-fork attribution)

Preserve the original copyright line and add ours below it:

```
Copyright (c) 2025 Sharkord Team
Copyright (c) 2026 Bullshark contributors
```

## Explicitly out of scope

- `@sharkord/*` workspace package names (server, shared, ui, plugin-sdk) and all their imports.
- `SHARKORD_*` environment-variable names in `apps/server/src/config.ts` (deployment config contract — renaming would break existing self-hosted deployments).
- CI: `.github/actions/build-sharkord`, workflows; `Dockerfile`, `docker-entrypoint.sh`; `bun.lock`.
- The `/logo.webp` image asset (server-configurable; only the `alt` text changes).
- Historical `docs/` specs and plans, security audit, README (already rebranded).
- Server log lines, test fixtures/files, and code comments mentioning "sharkord".

## Verification

- `bun --bun run check-types` in `apps/client` — no type errors.
- Control grep after the change: `grep -ri sharkord apps/client/src apps/client/index.html` returns only (a) `@sharkord/*` imports, (b) the `marketplaceVerifiedTooltip` strings, and (c) the "fork of Sharkord" credit. Any other hit is a miss to fix.
- `bun test` (server) stays green — no regressions.
- Manual: run the app; confirm the window/tab title is "Bullshark", the connect screen logo `alt` and footer read "Bullshark" with a "fork of Sharkord" credit link to the upstream repo, and a fresh server seeds as "Bullshark Server".

## Notes / risks

- The seed changes only affect **newly seeded** servers; existing servers keep their stored names — acceptable and expected.
- Keeping `@sharkord/*` and `SHARKORD_*` intact preserves third-party plugin compatibility and existing deployment configs; this is intentional, not an oversight.
