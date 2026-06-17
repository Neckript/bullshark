# Rebrand Sharkord → Bullshark (visible branding) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace every user-visible "Sharkord" with "Bullshark" across the client and server-seeded defaults, add a discreet "fork of Sharkord" credit, and dual-license the LICENSE — without touching internal identifiers.

**Architecture:** Pure text/branding edits in three layers (client i18n + components, the HTML shell, server seed defaults) plus a LICENSE attribution line. There is no client test runner, so the red/green loop for each task is a **control grep**: before edits it shows disallowed "Sharkord" hits (RED), after edits those hits are gone except the two deliberate exceptions (GREEN). The server keeps passing `bun test`.

**Tech Stack:** React + i18next JSON locales (7 locales: `cs, en, es, fr, it, ru, zh`), Vite, Bun, Drizzle seed. Verification: `grep`, `bun --bun run check-types`, `bun test`.

**Deliberate exceptions (must remain "Sharkord"):**
1. `settings.json → marketplaceVerifiedTooltip` (upstream marketplace verification authority).
2. The new `connect.json → forkCredit` string (the "fork of Sharkord" credit itself).

---

## File Structure

**Client (modify):**
- `apps/client/index.html` — `<title>`.
- `apps/client/src/screens/connect/index.tsx` — logo `alt`, footer GitHub link, fork credit link.
- `apps/client/src/i18n/locales/<locale>/common.json` — 3 self-ref strings per locale.
- `apps/client/src/i18n/locales/<locale>/connect.json` — `loadingApp` swap + new `forkCredit` key.
- `apps/client/src/i18n/locales/<locale>/dialogs.json` — 2 self-ref strings per locale.
- `apps/client/src/i18n/locales/<locale>/settings.json` — 8 self-ref strings per locale (keep `marketplaceVerifiedTooltip`).

**Server (modify):**
- `apps/server/src/db/seed.ts` — fresh-install visible defaults.

**Repo (modify):**
- `LICENSE` — add Bullshark copyright line.

---

## Conventions

- The brand word itself is **not** localized: in every locale the literal token `Sharkord` becomes `Bullshark` (and `sharkord` → `Bullshark` when it is the brand, e.g. seed `'sharkord Server'`). Surrounding translated copy is left as-is.
- Possessive forms: `Sharkord's` → `Bullshark's`.
- JSON edits must keep the file valid (quotes, commas). Do not reformat unrelated lines.
- Run all `grep`/`bun` commands from the repo root unless a task says otherwise.

---

## Task 1: i18n locale strings (all 7 locales)

**Files:**
- Modify: `apps/client/src/i18n/locales/{cs,en,es,fr,it,ru,zh}/common.json`
- Modify: `apps/client/src/i18n/locales/{cs,en,es,fr,it,ru,zh}/connect.json`
- Modify: `apps/client/src/i18n/locales/{cs,en,es,fr,it,ru,zh}/dialogs.json`
- Modify: `apps/client/src/i18n/locales/{cs,en,es,fr,it,ru,zh}/settings.json`

- [ ] **Step 1: Control grep to see the RED state**

Run:
```bash
grep -rn -i sharkord apps/client/src/i18n/locales
```
Expected: many hits. Per locale: `common.json` ×3, `connect.json` ×1, `dialogs.json` ×2, `settings.json` ×9. The single `settings.json` hit to KEEP in each locale is `marketplaceVerifiedTooltip`.

- [ ] **Step 2: Edit the English locale (reference values)**

In `apps/client/src/i18n/locales/en/common.json`, replace the brand token:
- `mobileNotOptimized`: "**Bullshark** is not optimized for mobile devices yet. The experience will not be ideal."
- `globalErrorTitle`: "Sorry, **Bullshark** crashed and couldn't recover."
- `globalErrorDescription`: "**Bullshark** hit an unexpected error. Reload the app. If this keeps happening, please open an issue with the error details in github."

In `apps/client/src/i18n/locales/en/connect.json`:
- `loadingApp`: "Loading **Bullshark**"
- Add a new key `forkCredit`: `"fork of Sharkord"`

In `apps/client/src/i18n/locales/en/dialogs.json`:
- `pluginInstallConfirmLead`: "Plugins are a very powerful way to extend **Bullshark's** functionality, but they also come with significant security risks."
- `pluginInstallUseDocker`: "We strongly recommend running **Bullshark** in a Docker container for isolation and reduced risk."

In `apps/client/src/i18n/locales/en/settings.json` (swap the brand in these 8 keys; **leave `marketplaceVerifiedTooltip` unchanged**):
- `othersDesc`: "General settings related to **Bullshark's** behavior."
- `restrictOwnAudioDesc`: "Exclude **Bullshark** audio from the audio captured during screen sharing."
- `restrictOwnAudioUnsupported`: "Your browser does not support restricting your own audio during screen sharing. **Bullshark** audio may be captured in the shared stream, which can cause echo or feedback."
- `noPluginsDesc`: "Install plugins to add new features and extend the functionality of your **Bullshark** server."
- `updatesDesc`: "Check for and install updates to keep your **Bullshark** server running with the latest features and security improvements."
- `upToDateDesc`: "Your server is running the latest version of **Bullshark**."
- `diskSharkordUsed`: "**Bullshark** Used"  *(rename the value only; keep the JSON key `diskSharkordUsed` as-is to avoid touching code that reads it)*

- [ ] **Step 3: Edit the other 6 locales (`cs, es, fr, it, ru, zh`)**

For each locale, apply the **same rule** to the same keys: in `common.json` (3), `connect.json` `loadingApp` (1), `dialogs.json` (2), and the 8 `settings.json` keys above, replace the literal token `Sharkord`/`Sharkord's` with `Bullshark`/`Bullshark's`. Leave the translated wording around it intact. Leave `marketplaceVerifiedTooltip` untouched. Add a `forkCredit` key to each locale's `connect.json`:
- `cs`: `"fork projektu Sharkord"`
- `es`: `"fork de Sharkord"`
- `fr`: `"fork de Sharkord"`
- `it`: `"fork di Sharkord"`
- `ru`: `"форк Sharkord"`
- `zh`: `"Sharkord 的分支"`

Use this per-locale grep to find the exact lines to touch (run for each locale):
```bash
grep -n -i sharkord apps/client/src/i18n/locales/fr/common.json apps/client/src/i18n/locales/fr/connect.json apps/client/src/i18n/locales/fr/dialogs.json apps/client/src/i18n/locales/fr/settings.json
```

- [ ] **Step 4: Validate JSON**

Run:
```bash
for f in apps/client/src/i18n/locales/*/*.json; do node -e "JSON.parse(require('fs').readFileSync('$f','utf8'))" || echo "INVALID: $f"; done
```
Expected: no `INVALID:` lines.

- [ ] **Step 5: Control grep to confirm GREEN state**

Run:
```bash
grep -rn -i sharkord apps/client/src/i18n/locales
```
Expected: exactly two kinds of hits remain per locale — `marketplaceVerifiedTooltip` (1) and the new `forkCredit` value (1). Nothing else.

- [ ] **Step 6: Commit**

```bash
git add apps/client/src/i18n/locales
git commit -m "feat(client): rebrand visible i18n strings to Bullshark, add fork credit"
```

---

## Task 2: Connect screen + HTML title

**Files:**
- Modify: `apps/client/index.html`
- Modify: `apps/client/src/screens/connect/index.tsx`

- [ ] **Step 1: Control grep (RED)**

Run:
```bash
grep -n -i sharkord apps/client/index.html apps/client/src/screens/connect/index.tsx
```
Expected hits: `index.html` `<title>Sharkord</title>`; `connect/index.tsx` lines for `alt="Sharkord"`, the GitHub href, the `sharkord.com` href, and the `Sharkord` link text. (The `@sharkord/...` import lines also appear — those are OUT OF SCOPE, leave them.)

- [ ] **Step 2: Edit the HTML title**

In `apps/client/index.html`, change `<title>Sharkord</title>` to:
```html
<title>Bullshark</title>
```

- [ ] **Step 3: Edit the logo alt text**

In `apps/client/src/screens/connect/index.tsx` (~line 133), change:
```tsx
              alt="Sharkord"
```
to:
```tsx
              alt="Bullshark"
```

- [ ] **Step 4: Edit the footer links**

In `apps/client/src/screens/connect/index.tsx`, the footer block (~lines 231-248). Replace the two `<a>` elements so the GitHub link points at the product and the second link becomes the fork credit. Ensure `useTranslation` for the `connect` namespace is already in scope as `t` (it is — the screen already uses `t('connectBtn')` etc.). Resulting block:

```tsx
      <div className="flex justify-center items-center gap-2 text-xs text-muted-foreground select-none">
        <span>v{VITE_APP_VERSION}</span>
        <a
          href="https://github.com/Neckript/bullshark"
          target="_blank"
          rel="noopener noreferrer"
        >
          GitHub
        </a>

        <a
          className="text-xs"
          href="https://github.com/Sharkord/sharkord"
          target="_blank"
          rel="noopener noreferrer"
        >
          {t('forkCredit')}
        </a>
      </div>
```

- [ ] **Step 5: Control grep (GREEN)**

Run:
```bash
grep -n -i sharkord apps/client/index.html apps/client/src/screens/connect/index.tsx
```
Expected: `index.html` has no hits. `connect/index.tsx` shows only the `@sharkord/...` import lines (out of scope) and the `https://github.com/Sharkord/sharkord` credit href. No `alt="Sharkord"`, no `<title>`, no `sharkord.com`.

- [ ] **Step 6: Type-check the client**

Run (from `apps/client`):
```bash
bun --bun run check-types
```
Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add apps/client/index.html apps/client/src/screens/connect/index.tsx
git commit -m "feat(client): rebrand window title + connect screen to Bullshark with fork credit"
```

---

## Task 3: Server seed visible defaults

**Files:**
- Modify: `apps/server/src/db/seed.ts`

- [ ] **Step 1: Control grep (RED)**

Run:
```bash
grep -n -i sharkord apps/server/src/db/seed.ts
```
Expected hits include line 24 (`@sharkord/shared` import — OUT OF SCOPE), and the visible defaults at ~lines 55, 57, 162, 166, 176 plus the seed user password at ~164.

- [ ] **Step 2: Edit the visible defaults**

In `apps/server/src/db/seed.ts`, change the user-visible default values (leave the `@sharkord/shared` import and the `password: 'sharkord'` value untouched — password is a credential, not branding):
- `name: 'sharkord Server'` → `name: 'Bullshark Server'`
- default server description `'This is the default Sharkord server description. Change me in the server settings!'` → `'This is the default Bullshark server description. Change me in the server settings!'`
- seed user `name: 'Sharkord'` → `name: 'Bullshark'`
- seed user `bio: 'Hey, I am Sharkord!'` → `bio: 'Hey, I am Bullshark!'`
- welcome message `content: '<p>Welcome to sharkord!</p>'` → `content: '<p>Welcome to Bullshark!</p>'`

- [ ] **Step 3: Control grep (GREEN)**

Run:
```bash
grep -n -i sharkord apps/server/src/db/seed.ts
```
Expected: only the `@sharkord/shared` import (line 24) and `password: 'sharkord'` (~line 164) remain. No other hits.

- [ ] **Step 4: Run the server test suite (no regressions)**

Run (from `apps/server`):
```bash
bun test
```
Expected: all suites PASS. (If a seed-dependent test asserted the old `'Sharkord'`/`'sharkord Server'` strings, update that test's expectation to the new value as part of this task, then re-run.)

- [ ] **Step 5: Commit**

```bash
git add apps/server/src/db/seed.ts
git commit -m "feat(server): seed fresh servers with Bullshark default branding"
```

---

## Task 4: LICENSE attribution

**Files:**
- Modify: `LICENSE`

- [ ] **Step 1: Add the Bullshark copyright line**

In `LICENSE`, change:
```
Copyright (c) 2025 Sharkord Team
```
to:
```
Copyright (c) 2025 Sharkord Team
Copyright (c) 2026 Bullshark contributors
```

- [ ] **Step 2: Verify**

Run:
```bash
grep -n "Copyright" LICENSE
```
Expected: both copyright lines present, original first.

- [ ] **Step 3: Commit**

```bash
git add LICENSE
git commit -m "docs: add Bullshark copyright alongside original Sharkord attribution"
```

---

## Task 5: Final whole-app verification

**Files:** none (verification only)

- [ ] **Step 1: Whole-client control grep**

Run:
```bash
grep -rn -i sharkord apps/client/src apps/client/index.html
```
Expected: the ONLY remaining hits are (a) `@sharkord/...` import statements, (b) `marketplaceVerifiedTooltip` strings (7 locales), and (c) the `forkCredit` strings + the `https://github.com/Sharkord/sharkord` credit href. Any other hit is a miss — fix it and re-run.

- [ ] **Step 2: Client type-check**

Run (from `apps/client`):
```bash
bun --bun run check-types
```
Expected: no errors.

- [ ] **Step 3: Server tests**

Run (from `apps/server`):
```bash
bun test
```
Expected: all PASS.

- [ ] **Step 4: Manual smoke (per spec verification)**

Start the app (per the project's run instructions) and confirm:
- Browser tab / window title reads "Bullshark".
- Connect screen: logo `alt` is "Bullshark"; footer shows `GitHub` (→ `github.com/Neckript/bullshark`) and "fork of Sharkord" (→ `github.com/Sharkord/sharkord`).
- A freshly seeded server appears as "Bullshark Server".

- [ ] **Step 5: Final commit (if Step 1 required fixes)**

```bash
git add -A
git commit -m "fix(client): clean up stray Sharkord references after rebrand"
```
(Skip if nothing changed.)

---

## Self-Review

**Spec coverage:**
- §1 product self-references (HTML title, alt, i18n, seed defaults) → Tasks 1, 2, 3. ✅
- §2 deliberate exception `marketplaceVerifiedTooltip` → preserved in Task 1 Steps 2/5 and Task 5 Step 1. ✅
- §3 footer attribution (GitHub → product, "fork of Sharkord" → upstream) → Task 2 Step 4 + `forkCredit` key in Task 1. ✅
- §4 LICENSE dual copyright → Task 4. ✅
- §5 out of scope (`@sharkord/*`, `SHARKORD_*`, CI/Docker, lockfile, logo asset, docs, seed password) → explicitly left untouched and excluded from the GREEN grep expectations. ✅
- §6 verification (control grep, check-types, bun test, manual) → Task 5. ✅

**Placeholder scan:** No TBD/TODO/"handle edge cases". Every edit shows exact before/after strings and exact file/line anchors. ✅

**Type consistency:** `forkCredit` i18n key is created in Task 1 (all 7 locales) and consumed in Task 2 Step 4 (`t('forkCredit')`) under the already-active `connect` translation namespace. The JSON key `diskSharkordUsed` is intentionally NOT renamed (only its value) so existing consumers keep working. No new functions/types introduced. ✅
