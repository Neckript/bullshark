# Architecture

How Bullshark is put together, as of 2026-10-10 (`development` @ `a88bf956`).

Comment Bullshark est assemblé, au 10 octobre 2026.

Headings are bilingual; the body is English, like the code and its comments.
Les titres sont bilingues ; le corps est en anglais, comme le code.

---

## 1. Shape / Forme générale

A Bun monorepo. Two apps, five packages, one SQLite file.

```
apps/
  server/     Bun + node:http + ws + tRPC + Drizzle/SQLite + mediasoup
  client/     React 19 + Vite + Redux + tRPC-over-WebSocket + mediasoup-client
packages/
  shared/     types, zod schemas, event names, permission tables - both sides
  ui/         presentational React components
  plugin-sdk/ the surface a plugin is written against
  scripts/    build and release tooling
  e2e/        Playwright suite
```

The server is **one process** that owns everything: the HTTP routes, the
WebSocket, the database, the voice SFU, the cron jobs and the plugin host.
There is no queue broker, no Redis, no second service. A Bullshark instance is
a single binary plus a data directory.

Le serveur est **un seul processus** qui porte tout. Pas de broker, pas de
Redis, pas de second service.

## 2. Boot sequence / Séquence de démarrage

`apps/server/src/index.ts` is deliberately a flat, ordered script. The order is
load-bearing and the file says so in comments.

1. `ensureServerDirs()` - create the data directory tree. Must run first:
   every later step writes into it.
2. `loadEmbeds()` - unpack what Bun embedded in the executable
   (`embeddedFiles`): the client build, the migrations and the mediasoup worker
   binary, into `interface/`, `drizzle/` and `mediasoup/`.
3. `applyPendingRestore()` - apply a restore staged by `POST /import`
   **before** the database is opened, so `loadDb` then forward-migrates a
   restored backup that is older than the running version.
4. `loadDb()` - open SQLite, set pragmas, run migrations, seed.
5. `ensureVapidKeys()` - web-push keys.
6. CLI short-circuits: `--new-owner-token`, `--regenerate-tls-cert` print and
   exit here.
7. `pluginManager.loadPlugins()`
8. `createServers()` - HTTP, then the WebSocket on the same server.
9. `loadMediasoup()` - worker and WebRTC server.
10. `initVoiceRuntimes()` - one voice runtime per voice channel.
11. `loadCrons()`

## 3. Data layer / Couche de données

`bun:sqlite` through Drizzle. One file, `db.sqlite`, in the data directory.
26 tables, 30 migrations (`apps/server/src/db/migrations/`).

Pragmas set at open (`db/index.ts`), each for a stated reason:

| Pragma | Why |
|---|---|
| `foreign_keys = ON` | not SQLite's default |
| `journal_mode = WAL` | the default rollback journal makes a writer block every reader - the wrong trade for a chat server |
| `synchronous = NORMAL` | the safe pairing with WAL |
| `busy_timeout = 5000` | without it a concurrent write throws `SQLITE_BUSY` instead of waiting |

Tables, grouped:

- **Identity** - `users`, `logins`, `user_settings`, `user_recovery_codes`,
  `user_roles`, `push_subscriptions`
- **Spaces** - `categories`, `channels`, `direct_messages`,
  `channel_read_states`
- **Content** - `messages`, `message_files`, `message_reactions`, `files`,
  `emojis`, `sounds`
- **Access** - `roles`, `role_permissions`, and the per-target overrides:
  `channel_role_permissions`, `channel_user_permissions`,
  `category_role_permissions`, `category_user_permissions`
- **Server** - `settings`, `invites`, `activity_log`, `plugin_data`

Reads and writes are split by directory: `db/queries/` and `db/mutations/`.

### Prepared statements / Requêtes préparées

Drizzle rebuilds the SQL on **every** call. The hot read paths are prepared
once and keyed in a `WeakMap` on `db.$client` (`db/prepared.ts`). Two traps are
encoded there and must not be undone:

- **No result cache.** `cli/new-owner-token.ts` writes to `settings` from a
  second process while the server runs, so an in-memory cache would never see
  an owner-token rotation. A prepared statement still hits the database.
- **No module-level variable.** The test harness builds a fresh in-memory
  database per test and injects it through a Proxy, so a held statement would
  point at a closed handle from the second test onward. Hence the `WeakMap`,
  keyed on a distinct object per test database.

Measured gains: `getUserById` 1223us to 65us, `getUsers` 1098us to 146us,
`getPublicSettings` ~550us to 18us. **Measure before preparing** - the build
cost tracks query complexity, and cheap queries are not worth it.

Not everything can be prepared: the message read path uses
`inArray(messageIds)`, a variable-length `IN` list, which SQLite cannot bind.

## 4. Transport / Transport

Two surfaces on **one** listener (`utils/create-servers.ts`).

### HTTP - `apps/server/src/http/`

A hand-rolled method/path table (`http/index.ts`), not a framework. Exact
matches and prefix matches, `GET` and `POST` only. A comment in the file notes
this is temporary pending a move to `Bun.serve`.

| Route | Purpose |
|---|---|
| `GET /healthz`, `GET /info` | liveness, public server metadata |
| `GET /manifest.json` | PWA manifest |
| `GET /export`, `POST /import` | full backup out and in |
| `GET /public/*` | uploaded files |
| `GET /plugin-components/*`, `GET /plugin-bundle/*` | plugin client code |
| `POST /upload` | file upload |
| `POST /login`, `POST /login/2fa` | the only auth endpoints |

Baseline security headers go on **every** response via `setHeader`, so they
survive later `writeHead` calls. `nosniff` stops MIME-sniffing of uploads into
HTML/JS; `SAMEORIGIN` is clickjacking protection; `Referrer-Policy` avoids
leaking signed-URL query tokens. CORP and Permissions-Policy are deliberately
**not** set - they would break cross-origin media embedding (the wildcard CORS
is intentional) and voice/screen-share.

### WebSocket + tRPC - `apps/server/src/utils/wss.ts`

Everything else is tRPC over a single WebSocket (`applyWSSHandler`). 17
routers compose into `appRouter` (`routers/index.ts`): `others`, `messages`,
`users`, `channels`, `dms`, `files`, `emojis`, `roles`, `invites`, `voice`,
`categories`, `plugins`, `gifs`, `settings`, `push`, `security`, `sounds`.

The client holds one `createWSClient` and a single `wsLink`
(`apps/client/src/lib/trpc.ts`). No HTTP batch link - there is nothing to
batch over.

`getUserByToken` is the **single** token verification point.
`users.token_version` is carried in the JWT and compared there; it is bumped by
SQL increment on password change and on ban. The claim is **optional and a
missing claim reads as 0** - without that, deploying would log every user out
at once.

### Real-time fan-out / Diffusion temps réel

`db/publishers.ts` over `utils/pubsub.ts`. Two shapes:

- `pubsub.publish(event, payload)` - everyone.
- `pubsub.publishFor(userIds, event, payload)` - only the users who can see it.

A publisher computes the affected user set from permissions before sending, so
a private channel's traffic never reaches a user without access. Event names
live in `packages/shared/src/events.ts`, shared by both sides.

## 5. Voice and video / Vocal et vidéo

mediasoup as an SFU, in-process.

- **One worker** (`utils/mediasoup.ts`), created at boot, with a `died`
  handler. `ponytail:` all voice channels therefore share one core - a worker
  pool is the upgrade path when concurrency demands it.
- **One `VoiceRuntime` per voice channel** (`runtimes/voice.ts`), each owning a
  mediasoup `Router`, its producers and its consumers.
- **Codecs offered** by the router: VP9, VP8, H264 (two profiles), AV1, plus
  audio.

Layered video, as of 2026-10-10:

| Sender engine | Webcam | Screen share |
|---|---|---|
| Chromium | VP9 SVC, 1 encoder | VP9 SVC, 1 encoder |
| Firefox / Safari | VP8 simulcast, 3 encoders | single stream, no simulcast |

VP8 simulcast runs three software encoders in parallel. At desktop-capture
resolution that is CPU-bound and collapses framerate, so screen share drops
simulcast entirely rather than hit the wall. A webcam's resolution is far
lower, so it keeps simulcast where SVC is unavailable. Both paths share
`SVC_SCALABILITY_MODE = 'L3T3_KEY'` - three spatial layers, matching the
three-option quality picker. See
[`development/2026-10-10-webcam-vp9-svc.md`](development/2026-10-10-webcam-vp9-svc.md).

Quality-layer selection is codec-agnostic server-side:
`validateProducerQualityLayers` accepts `producer.type === 'svc'` for any video
producer and parses the spatial layer count out of `scalabilityMode`.

## 6. Permissions / Permissions

Three levels, most specific wins:

1. Role permissions (`role_permissions`) - the baseline.
2. Category overrides (`category_role_permissions`,
   `category_user_permissions`).
3. Channel overrides (`channel_role_permissions`,
   `channel_user_permissions`).

Permission bits and the resolution tables live in `packages/shared`, so the
client greys out what the server would refuse - and the server never trusts
that it did.

## 7. Plugins / Plugins

Server-side host in `apps/server/src/plugins/`:

| Piece | Role |
|---|---|
| `event-bus.ts` | plugins subscribe to server events |
| `command-registry.ts`, `action-registry.ts` | what a plugin can expose |
| `hooks-manager.ts` | interception points |
| `plugin-settings-manager.ts`, `plugin-state-store.ts` | durable state |
| `execution-timeout.ts` | a plugin cannot hang the server |

**Plugin-owned durable storage is settings only** - string, number or boolean.
There is no KV store: `plugin-state-store.ts` holds enabled/disabled flags and
nothing else. And `downloadPlugin` does `fs.rm(targetPluginPath)` before
copying, so anything written into `ctx.path` is lost on every update.

Plugins are fetched from a registry over plain HTTPS with a sha256 check
(`helpers/downloads.ts`, `assertPublicHttpsUrl`). No API token is involved: a
file committed in a plugin repo, served at its raw URL, is a valid release.

Client-side, plugin code is served by `GET /plugin-bundle/*` and rendered
through slot components.

## 8. Client / Client

- **React 19 + Vite 7**, SWC plugin.
- **Redux** (`features/store.ts`), four slices: `app`, `server`,
  `server-screens`, `dialogs`.
- **Four screens** (`screens/`): `connect`, `loading-app`, `server-view`,
  `disconnected`. Navigation inside a server is slice state, not routes.
- **Tailwind 4**, shared components in `packages/ui`.
- **i18next**, 7 locales, resources lazy-loaded.
- **mediasoup-client** in `components/voice-provider/`, which owns every
  producer and consumer.

In development the server redirects `/` to the Vite dev server on port 5173
(`http/interface.ts`). In production it serves the client build from
`INTERFACE_PATH`, a directory **versioned by server version** - so a server
always serves the interface built for it, and an update cannot leave a new
server serving an old client.

## 9. Files / Fichiers

A four-step lifecycle (`utils/file-manager.ts`):

1. `POST /upload` writes into `UPLOADS_PATH`.
2. `addTemporaryFile` moves it into `TMP_PATH` under a managed name.
3. The temporary file is tracked with a **1-minute TTL**.
4. On confirm, `saveFile` moves it to `PUBLIC_PATH` and creates the DB row,
   after a quota check.

One cron does two things (`crons/cleanup-files.ts`), every 15 minutes and once
at boot — it is registered with `runOnInit`:

1. **Stale staging sweep.** That 1-minute TTL is an in-memory timer, so a crash
   or a redeploy loses it and strands the file. The sweep removes every
   top-level entry of `TMP_PATH` and `UPLOADS_PATH` older than **one hour**,
   60x the TTL — nothing a running server still cares about there can be that
   old, so it needs no cross-check against the in-memory list. A plugin
   download rebuilds `tmp/downloads` with `ensureDir`, and a restore stages in
   `restore-staging/`, outside both directories, so neither can be broken by
   it.
2. **Orphan reaping.** Deletes rows in `files` that nothing references —
   messages, avatars, banners, emojis, reactions, the server logo and banner,
   role icons — and unlinks them from disk.

See [`development/2026-10-10-staging-sweep.md`](development/2026-10-10-staging-sweep.md).

## 10. Data directory / Répertoire de données

Resolved once at startup (`helpers/paths.ts`), in priority order:
`BULLSHARK_DATA_PATH`, then the deprecated `SHARKORD_DATA_PATH` (read with a
warning, kept so an existing deployment does not wake up on an empty
directory), then `./data-test` in test, `./data` in development, and the OS
app-data path in production.

```
db.sqlite      the whole database
public/        served uploads
uploads/ tmp/  upload staging
logs/
interface/<server version>/
drizzle/       migrations
mediasoup/     the worker binary
plugins/
tls/           cert.pem, key.pem
config.ini
```

Nothing outside this directory is state. Backing it up backs up the instance.

## 11. Quality gates / Garde-fous

```
bun run magic   # format, then check-types, then lint - across all workspaces
bun run test    # per-workspace bun test
bun run knip    # unused exports and dependencies
```

Server tests build a fresh in-memory database per test and inject it through a
Proxy. **`mock.module` is global and permanent in Bun** - a module mocked in
one test file stays mocked for every file that runs after it in the same
process. That leak broke CI on Linux only, for twelve days.

Playwright lives in `packages/e2e` and runs against a real server.
