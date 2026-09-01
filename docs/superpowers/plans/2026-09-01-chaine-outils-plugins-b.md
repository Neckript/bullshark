# Plugin Toolchain (chantier B) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make it possible to write, build and install a Bullshark plugin without cloning the monorepo — by shipping a built SDK, replacing the single-integer compatibility check with declared capabilities enforced as least-privilege, and forking the builder and example onto Codeberg.

**Design spec:** `docs/superpowers/specs/2026-09-01-chaine-outils-plugins-b-design.md`. Read it before starting; this plan does not restate its reasoning.

**Architecture:** Tasks 1–7 are monorepo work (`packages/shared`, `packages/plugin-sdk`, `apps/server`, `apps/client`) and are covered by `bun test`. Tasks 8–11 create and populate three external Codeberg repos and are verified end-to-end rather than by unit tests. Every step consumes the previous one, so the order below is not negotiable.

**Tech Stack:** Bun (runtime, test runner, bundler), TypeScript, zod, React 19, Drizzle, tRPC. Verification: `bun test`, `bun --bun run check-types`, `bun --bun run lint`.

**Current state (verified 2026-09-01):**
- `PLUGIN_SDK_VERSION = 1` at `packages/shared/src/plugins/index.ts:190`, compared with strict equality at `apps/server/src/plugins/index.ts:194` and `apps/client/.../marketplace/marketplace-item.tsx:53,66`.
- `packages/plugin-sdk/package.json` has `"main": "src/index.ts"`, no build script. No package in the monorepo has one.
- `packages/plugin-sdk/src/index.ts` re-exports 12 mediasoup types and declares `mediasoup` in devDependencies.
- `bullshark-plugins` and `bullshark-plugin-sdk` exist on Codeberg, branch `main`. `bullshark-plugin-builder` and `bullshark-plugin-example` do not exist yet.

---

## File Structure

**`packages/shared` (modify):**
- `src/plugins/index.ts` — add `zCapability`, `PluginCapability`, `capabilities` on `zPluginManifest`; narrow the documented meaning of `PLUGIN_SDK_VERSION`; drop the dead `zPluginPackageJson` / `TPluginPackageJson` aliases.
- `src/plugins/marketplace.ts` — add optional `capabilities` to the version schema.

**`packages/plugin-sdk` (modify):**
- `package.json` — `main`/`types` → `dist/`, add `build` script, `exports` map with `./voice`, optional `mediasoup` peer dependency.
- `src/index.ts` — move mediasoup re-exports out.
- `src/voice.ts` — **new**, the mediasoup type surface.
- `tsconfig.json` — declaration emit.

**`apps/server` (modify):**
- `src/plugins/index.ts` — replace `verifySdkVersion` with `verifyCapabilities`; build a capability-restricted `PluginContext`.
- `src/plugins/__tests__/capabilities.test.ts` — **new**.

**`apps/client` (modify):**
- `src/components/server-screens/server-settings/plugins/marketplace/marketplace-item.tsx` — capability check instead of `sdkVersion` equality.

**Docs (modify):**
- `docs/plugins/overview.md` — document `capabilities`.
- `docs/plugins/security.md` — state plainly that capabilities are not a sandbox.

**External repos (create):**
- `bullshark-plugin-sdk` — distribution target (already created, empty).
- `bullshark-plugin-builder` — fork of `Sharkord/plugin-builder`.
- `bullshark-plugin-example` — fork of `Sharkord/plugin-example`.

---

## Conventions

- Run every command from the repo root unless a task says otherwise.
- Each task states a RED check that must fail before the edit and a GREEN check that must pass after. Do not skip the RED check: it is what proves the test is testing something.
- Commit one task per commit, message in French, no accents, following the existing branch style.
- Do not touch `LICENSE`. Do not reintroduce the word `sharkord` anywhere except when quoting the upstream repo URL in a fork's provenance note.
- Capability strings are lowercase, dot-separated, and defined in exactly one place (`packages/shared`). Never write a capability string as a bare literal in server or client code — import the enum.

---

## Task 1: Define the capability vocabulary

**Files:**
- Modify: `packages/shared/src/plugins/index.ts`
- Create: `packages/shared/src/plugins/__tests__/capabilities.test.ts`

- [ ] **Step 1: RED — the vocabulary does not exist**

```bash
grep -n "PluginCapability" packages/shared/src/plugins/index.ts
```
Expected: no output.

- [ ] **Step 2: Add the enum and schema**

In `packages/shared/src/plugins/index.ts`, above `PLUGIN_SDK_VERSION`:

```ts
export enum PluginCapability {
  EVENTS = 'events',
  ACTIONS = 'actions',
  COMMANDS = 'commands',
  MESSAGES = 'messages',
  SETTINGS = 'settings',
  DATA = 'data',
  UI = 'ui',
  VOICE = 'voice',
  HOOKS_BEFORE_FILE_SAVE = 'hooks.onBeforeFileSave',
  CLIENT_SLOTS = 'client.slots'
}

export const zCapability = z.enum(PluginCapability);
```

Add to `zPluginManifest`, after `sdkVersion`:

```ts
capabilities: z.array(zCapability).default([])
```

Narrow the `PLUGIN_SDK_VERSION` declaration with a comment stating it now covers only the plugin **format** — manifest filename, `server/index.js` + `client/index.js` layout, and the `window.__BULLSHARK_*` global names — and that API compatibility is carried by `capabilities`.

Delete `zPluginPackageJson` and `TPluginPackageJson`: they are unused aliases of the manifest schema. Confirm with `grep -rn "PluginPackageJson" apps packages --include=*.ts --include=*.tsx` before deleting.

- [ ] **Step 3: Add `capabilities` to `TPluginInfo`**

Same file, mirroring the other manifest-derived fields:

```ts
capabilities: TPluginManifest['capabilities'];
```

- [ ] **Step 4: GREEN — schema tests**

Write `packages/shared/src/plugins/__tests__/capabilities.test.ts` covering:
- a manifest with no `capabilities` parses and yields `[]`
- a manifest with a valid capability list parses and preserves order
- a manifest with an unknown capability string fails to parse
- `hooks.onBeforeFileSave` and `client.slots` parse (dots are legal)

```bash
bun test packages/shared
bun --bun run check-types
```

---

## Task 2: Split mediasoup out of the SDK entry point

**Files:**
- Create: `packages/plugin-sdk/src/voice.ts`
- Modify: `packages/plugin-sdk/src/index.ts`, `packages/plugin-sdk/package.json`

- [ ] **Step 1: RED — the main entry pulls mediasoup**

```bash
grep -n "mediasoup" packages/plugin-sdk/src/index.ts
```
Expected: two hits — the `import type { AppData, Producer, Router }` and the 12-type `export type` block.

- [ ] **Step 2: Create the voice sub-entry**

`packages/plugin-sdk/src/voice.ts` holds the full mediasoup re-export block moved verbatim from `index.ts`, plus `TCreateStreamOptions` and `TExternalStreamHandle` (both reference `Producer`).

- [ ] **Step 3: Rewire `index.ts`**

`PluginContext.voice` keeps its shape but imports its mediasoup types from `./voice`. Remove the 12-type re-export block and the direct `mediasoup/types` import from `index.ts`. Re-export `TCreateStreamOptions` and `TExternalStreamHandle` from `./voice` so existing type-only consumers keep working.

- [ ] **Step 4: Declare mediasoup optional**

In `packages/plugin-sdk/package.json`, move `mediasoup` from `devDependencies` to:

```json
"peerDependencies": { "mediasoup": "^3.19.11", "react": "^19.1.1", "react-dom": "^19.1.1" },
"peerDependenciesMeta": { "mediasoup": { "optional": true } }
```

Keep it in `devDependencies` as well so the monorepo still type-checks.

- [ ] **Step 5: GREEN**

```bash
grep -n "mediasoup" packages/plugin-sdk/src/index.ts   # expect: no output
bun --bun run check-types
```

---

## Task 3: Build the SDK

**Files:**
- Modify: `packages/plugin-sdk/package.json`, `packages/plugin-sdk/tsconfig.json`
- Create: `packages/plugin-sdk/.gitignore` (ignore `dist/`)

- [ ] **Step 1: RED — no build output exists**

```bash
ls packages/plugin-sdk/dist 2>/dev/null
```
Expected: nothing.

- [ ] **Step 2: Add the build script**

```json
"build": "rm -rf dist && bun build src/index.ts src/voice.ts --outdir dist --format esm --target node --external mediasoup --external react --external react-dom && tsc --emitDeclarationOnly --declaration --outDir dist"
```

`@bullshark/shared` must **not** be external — it is a `workspace:*` dependency that will never resolve for an external author, so its enums must be inlined into the bundle.

Set `tsconfig.json` to emit declarations, and point the package at the build:

```json
"main": "dist/index.js",
"types": "dist/index.d.ts",
"exports": {
  ".": { "types": "./dist/index.d.ts", "import": "./dist/index.js" },
  "./voice": { "types": "./dist/voice.d.ts", "import": "./dist/voice.js" }
}
```

Note: changing `main`/`types` changes how the monorepo resolves the package. Run the full typecheck after this step, not just the SDK's.

- [ ] **Step 3: GREEN — the bundle stands alone**

```bash
cd packages/plugin-sdk && bun run build
grep -c "@bullshark/shared" dist/index.js    # expect: 0
node -e "import('./dist/index.js').then(m => console.log(Object.keys(m).sort().join(' ')))"
```
Expected exports include `FileSaveType`, `PluginSlot`, `PluginCapability`, `PLUGIN_SDK_VERSION`, `createCallAction`, `createRegisterAction`, `createRegisterCommand`.

```bash
grep -c "mediasoup" dist/index.js            # expect: 0
bun --bun run check-types                    # from repo root
```

---

## Task 4: Enforce capabilities on the server

**Files:**
- Modify: `apps/server/src/plugins/index.ts`
- Create: `apps/server/src/plugins/__tests__/capabilities.test.ts`

This is the task that turns capabilities from a label into a permission model. Take it slowly.

- [ ] **Step 1: RED — write the failing tests first**

`capabilities.test.ts` must cover, each failing against current code:
- a plugin declaring no capabilities receives a context with `path`, `pluginId`, `logger`, `log`, `debug`, `error` and **nothing else**
- a plugin declaring `messages` has `ctx.messages` and does **not** have `ctx.voice`
- a plugin declaring `voice` has `ctx.voice`
- a plugin declaring a capability the server does not know is refused, and the error message contains the offending capability string
- a plugin that did not declare `hooks.onBeforeFileSave` never has its hook invoked, even if it somehow registered one
- `sdkVersion` mismatch is still refused (the format gate survives)

```bash
bun test apps/server/src/plugins
```
Expected: red.

- [ ] **Step 2: Add the server capability registry**

In `apps/server/src/plugins/index.ts`, declare the set of capabilities this server can provide, built from `PluginCapability` — not a hand-written literal list, so a new enum member cannot be silently unsupported.

- [ ] **Step 3: Replace `verifySdkVersion`**

Keep the existing `sdkVersion !== PLUGIN_SDK_VERSION` check as the format gate. Add `verifyCapabilities(declared)`, returning `{ isValid, error? }` where the error names the first unsupported capability verbatim.

- [ ] **Step 4: Build the context from declared capabilities**

Split the current `PluginContext` construction into a base (always provided: `path`, `pluginId`, `logger`, `log`, `debug`, `error`) plus one branch per capability, attached only when declared. `hooks.onBeforeFileSave` must also be skipped at **dispatch** time, not only at registration — a plugin must not intercept file saves it never asked for.

- [ ] **Step 5: GREEN**

```bash
bun test apps/server
bun --bun run check-types
```

---

## Task 4b: Make plugin entry points genuinely optional

Added 2026-09-01, after Task 1 revealed that the code contradicts the docs.

`docs/plugins/overview.md` documents `server/index.js` and `client/index.js` as
optional. They are not: `apps/server/src/plugins/index.ts:265-271` throws when
either is missing, and `hasPluginStructure` in `apps/server/src/helpers/downloads.ts`
requires both. Task 8 makes the builder accept single-entry plugins; without this
task the builder would emit plugins the server refuses, which is worse than the
current state.

A server-only plugin (moderation, logging) and a client-only plugin (pure UI) are
both legitimate — the separate `SERVER_ENTRY_FILE` / `CLIENT_ENTRY_FILE`
constants and the existence of a `client.slots` capability only make sense if
they are.

**The wrinkle, found while scoping this:** `uiState` is only ever written by
`ctx.ui.enable()` / `disable()`, which is server-side code, and
`getPluginIdsWithComponents` filters on it. A client-only plugin has no server
module and therefore no way to ever enable its own UI — it would load and stay
invisible forever. Making the entries optional without fixing this ships a
feature that silently does nothing.

**Files:**
- Modify: `packages/shared/src/plugins/index.ts` (`TPluginInfo`)
- Modify: `apps/server/src/plugins/index.ts`, `apps/server/src/helpers/downloads.ts`
- Create: `apps/server/src/plugins/__tests__/optional-entries.test.ts`

- [ ] **Step 1: RED — write the failing tests**

- a plugin with only `server/index.js` loads, and `onLoad` runs
- a plugin with only `client/index.js` loads, no module import is attempted, and it appears in `getPluginIdsWithComponents()`
- a plugin with neither entry is refused, with an error naming the plugin
- a plugin with both keeps today's behaviour exactly, including UI opt-in via `ctx.ui.enable()`
- `hasPluginStructure` accepts manifest + either entry, rejects manifest alone

- [ ] **Step 2: Report entry presence on `TPluginInfo`**

Add `hasServerEntry: boolean` and `hasClientEntry: boolean`. File presence is a
fact and must be reported as one — do not infer it from the declared
`client.slots` capability, which is an intention and can disagree.

- [ ] **Step 3: Relax `getPluginInfo`**

Throw only when neither entry exists.

- [ ] **Step 4: Skip the server module when absent**

In `load`, when `!hasServerEntry`, do not build a module specifier, do not
import, do not require `onLoad`. Register the plugin as loaded so it counts as
active. `unload` already guards `onUnload` with a `typeof` check and tolerates a
missing module — verify, do not rewrite.

- [ ] **Step 5: Default the UI state for client-only plugins**

When a plugin has a client entry and **no** server entry, initialise
`uiState` to `true` at load: it has no code that could ever call
`ctx.ui.enable()`. Plugins that do have a server entry keep today's opt-in
behaviour unchanged.

- [ ] **Step 6: Relax `hasPluginStructure`**

`manifest.json` plus **at least one** entry.

- [ ] **Step 7: GREEN**

```bash
cd apps/server && bun test
bun --bun run check-types    # from repo root
```

---

## Task 5: Surface capabilities in the marketplace UI

**Files:**
- Modify: `apps/client/src/components/server-screens/server-settings/plugins/marketplace/marketplace-item.tsx`
- Modify: `packages/shared/src/plugins/marketplace.ts`

- [ ] **Step 1: RED**

```bash
grep -n "PLUGIN_SDK_VERSION" apps/client/src/components/server-screens/server-settings/plugins/marketplace/marketplace-item.tsx
```
Expected: three hits (the import plus lines 53 and 66).

- [ ] **Step 2: Extend the registry schema**

In `packages/shared/src/plugins/marketplace.ts`, add `capabilities: z.array(zCapability).optional()` to the version schema. Absent means "declares none" — existing entries stay valid.

- [ ] **Step 3: Replace the version comparison**

Both call sites compare declared capabilities against what the client knows the server supports, instead of `sdkVersion === PLUGIN_SDK_VERSION`. When an entry is incompatible, the UI must name the missing capability rather than showing an opaque "incompatible" badge.

- [ ] **Step 4: GREEN**

```bash
bun test packages/shared
bun --bun run check-types && bun --bun run lint
```

---

## Task 6: Documentation

**Files:**
- Modify: `docs/plugins/overview.md`, `docs/plugins/security.md`

- [ ] **Step 1: Document `capabilities` in `overview.md`**

Add it to the required-fields list, with the full capability table, in both EN and FR (the file is bilingual). Update the `manifest.json` example. Correct the "Installing a plugin today" section, which currently says there is no toolchain — that stops being true at Task 11.

- [ ] **Step 2: State the limit in `security.md`**

Directly beside the capability list, in both languages: capabilities restrict the **API surface** offered to a plugin, not its system privileges. A server plugin runs in the server process and keeps filesystem and network access regardless of what it declared. This paragraph is required by the spec's risk section — a reader who takes capabilities for a sandbox is worse off than one who knows there is none.

- [ ] **Step 3: GREEN — no stale claims**

```bash
grep -n "sdkVersion" docs/plugins/overview.md
```
Every remaining mention must describe the narrowed format-only meaning.

---

## Task 7: Publish the SDK to its distribution repo

**Files:**
- Modify: `.github/workflows/release.yml`

- [ ] **Step 1: Add a publish step**

After the existing build, push `packages/plugin-sdk/dist` plus a generated `package.json`, `README.md` and `LICENSE` to `codeberg.org/The_Neckript/bullshark-plugin-sdk`, reusing the `CODEBERG_TOKEN` secret and the remote pattern already in `release.yml`.

The generated `package.json` must **not** carry `workspace:*` dependencies, `devDependencies`, or the `build` script — only `name`, `version`, `type`, `main`, `types`, `exports`, `peerDependencies`, `peerDependenciesMeta`, `license`.

The commit must be atomic — one commit carrying `dist/` and `package.json` together — and the tag pushed only after it lands, per the spec's divergence risk.

- [ ] **Step 2: GREEN — consume it from outside**

From a scratch directory outside the monorepo:

```bash
mkdir /tmp/sdk-check && cd /tmp/sdk-check && npm init -y
npm i "git+https://codeberg.org/The_Neckript/bullshark-plugin-sdk.git#v<version>"
node -e "import('@bullshark/plugin-sdk').then(m => console.log(Object.keys(m).length))"
```
This is the first real proof of objective 1. If it fails, stop — Tasks 8–11 all depend on it.

---

## Task 8: Fork the builder

**Repo:** `codeberg.org/The_Neckript/bullshark-plugin-builder` (create as public, MIT, branch `main`)

- [ ] **Step 1: Import the upstream history**

Push `github.com/Sharkord/plugin-builder` into the new Codeberg repo, preserving history. Record the fork point commit in the README, as `CONTRIBUTING.md` does for the main repo — MIT attribution applies here too, and the upstream `LICENSE` stays.

- [ ] **Step 2: Rename the ABI globals**

In `src/helpers/bundle.ts`, the `globals` map: `window.__SHARKORD_*` → `window.__BULLSHARK_*` for all five entries. Without this every client bundle is dead on arrival.

- [ ] **Step 3: Stop duplicating the schema**

Delete the three hand-copied schemas in `src/statics.ts` (`zPluginManifest`, `zManifest`, `zPluginVersion`) and import them from `@bullshark/plugin-sdk` — installed as the git dependency from Task 7. This makes the builder the SDK's first external consumer, and therefore the real test of Task 7.

- [ ] **Step 4: Replace GitHub publishing with Codeberg**

Drop `@octokit/rest`, `src/helpers/github-release.ts` and `src/helpers/resolve-github-repository.ts`. Publish through the Forgejo API, mirroring the call shape already used in the monorepo's `release.yml`.

- [ ] **Step 5: Make both entry points optional**

`src/helpers/bundle.ts` currently throws if either `src/server/index.ts` or `src/client/index.ts` is missing. Build whichever exist; fail only when neither does.

- [ ] **Step 6: Validate capabilities at build time**

Check the manifest's `capabilities` against the SDK enum and fail the build on an unknown value — an error at build time is worth far more than the same error at install time.

- [ ] **Step 7: GREEN**

```bash
grep -rn "SHARKORD" src/          # expect: no output
grep -rn "octokit" src/ package.json   # expect: no output
```

---

## Task 9: Fork the example

**Repo:** `codeberg.org/The_Neckript/bullshark-plugin-example` (create as public, MIT, branch `main`)

- [ ] **Step 1: Import upstream history**, same provenance note as Task 8.

- [ ] **Step 2: Depend on the distributed SDK** — the git dependency, not a workspace link. The example must build with no knowledge of the monorepo.

- [ ] **Step 3: Rename globals** in `src/global.d.ts` and any client code referencing `__SHARKORD_*`.

- [ ] **Step 4: Declare capabilities** in `manifest.json`, matching what the example actually uses. Read `src/server/index.ts` and `src/client/index.ts` and declare exactly those — the example is documentation, and an over-declared example teaches the wrong habit.

- [ ] **Step 5: Switch publishing to Codeberg.**

---

## Task 10: End-to-end verification

- [ ] **Step 1: Build the example from a clean checkout**

Clone `bullshark-plugin-example` into an empty directory on a machine with no monorepo, install, build with the Task 8 builder.

- [ ] **Step 2: Inspect the bundle**

```bash
grep -c "__BULLSHARK_" dist/client/index.js    # expect: > 0
grep -c "__SHARKORD_" dist/client/index.js     # expect: 0
```
Confirm React is not bundled (bundle size stays small; no `react.production` marker).

- [ ] **Step 3: Install on a real server**

Copy the built directory into a dev server's `plugins` path, enable it in Server Settings → Plugins, confirm it loads and its slot renders. Then flip one declared capability off in its `manifest.json` and confirm the server refuses it, naming that capability.

---

## Task 11: First registry entry

**Repo:** `codeberg.org/The_Neckript/bullshark-plugins`

- [ ] **Step 1: Publish the example** as a Codeberg release via the Task 8 builder, producing `downloadUrl`, `checksum` and `size`.

- [ ] **Step 2: Replace `[]`** in `plugins.json` with the example's entry, including `capabilities`.

- [ ] **Step 3: Write the registry `README.md`** — entry format and submission procedure (a pull request, reviewed by hand; no automation while the registry has one plugin).

- [ ] **Step 4: GREEN — the loop closes**

Open Server Settings → Plugins → Marketplace on a real server. The example appears, installs, and runs. This is the end of chantier B.

---

## Rollback

Tasks 1–7 are ordinary commits on `feat/independence-b`; revert individually. Task 7 is the first irreversible-ish step: once a version tag exists on `bullshark-plugin-sdk`, someone may depend on it — publish a new tag rather than deleting one. Tasks 8–11 live in repos with no consumers until Task 11 lands, so they can be force-reset freely until then.
