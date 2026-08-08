# Soundboard — Design

**Date:** 2026-08-08
**Status:** Approved

---

## Overview

A server-wide library of short sound clips that members can play into a voice
channel. Sounds are uploaded and managed by admins (like custom emojis), and
played by anyone with `SPEAK` on the voice channel.

A played sound is transmitted as its **own audio producer** (`StreamKind.SOUNDBOARD`),
not mixed into the microphone track. The server already carries several audio
producers per user (`SCREEN_AUDIO`, `EXTERNAL_AUDIO`), so this reuses an
established path.

**Scope decisions (approved):**

- Library is **server-wide**, following the custom-emoji pattern — not per-user.
- New admin permission `MANAGE_SOUNDS` for upload/rename/delete. Playing requires
  only `ChannelPermission.SPEAK` on the voice channel.
- Transmission via a **dedicated producer**, not by mixing into the mic track.
- One sound at a time per user; triggering a new one cuts the previous one.
- Out of scope for v1: favourites, per-sound volume, sound hotkeys, categories,
  bundled default sounds.

### Why a dedicated producer, not mic mixing

The obvious-looking alternative — inject an `AudioBufferSourceNode` into the
existing microphone WebAudio chain — does not survive contact with the code:

- The WebAudio chain in `apps/client/src/components/voice-provider/index.tsx:504-634`
  exists **only when the noise gate is enabled**. With the gate off and no NS
  chain, the transmitted track is the raw `getUserMedia` track — there is no
  `AudioContext` and no stable injection point.
- Injecting upstream of the gate / noise-suppression worklets would run the clip
  through models trained on speech, mangling it.
- Mute, PTT and VAD all work by setting `track.enabled = false` on the final
  transmitted track. A mixed-in sound would be silenced by the same switch, so
  supporting "play while muted" would require converting mute/PTT/VAD to a gain
  node — a refactor of the most delicate audio code in the client.

The dedicated producer leaves the entire microphone chain untouched.

**Accepted consequence:** a sound is transmitted even while the user's
microphone is muted. This is intentional.

---

## Data model (Drizzle migration, additive)

### New table `sounds` (`apps/server/src/db/schema.ts`)

Mirrors the `emojis` table at `schema.ts:366-385`:

- `id` (pk, autoincrement)
- `name: text` — not null, unique
- `fileId: integer` — not null, FK → `files.id`, `onDelete: 'cascade'`
- `userId: integer` — not null, FK → `users.id`, `onDelete: 'cascade'` (uploader)
- `createdAt: integer` — not null
- `updatedAt: integer` — nullable
- Indexes: `sounds_user_idx` on `userId`, `sounds_file_idx` on `fileId`,
  unique `sounds_name_idx` on `name`

Name collisions are resolved by a `getUniqueSoundName` query helper, copied from
`getUniqueEmojiName` in `apps/server/src/db/queries/emojis.ts`.

---

## Server

### Permission

`Permission.MANAGE_SOUNDS` added to the admin block of
`packages/shared/src/statics/permissions.ts`. **Not** included in
`DEFAULT_ROLE_PERMISSIONS`.

### File handling

- `FileSaveType.SOUND = 'sound'` added to `packages/shared/src/plugins/hooks.ts`.
- Uploads go through the existing temp-file → `fileManager.saveFile` flow used by
  emojis.

### Router `sounds` (`apps/server/src/routers/sounds/`)

Structural copy of `apps/server/src/routers/emojis/`:

| Procedure  | Guard                      | Notes                                    |
| ---------- | -------------------------- | ---------------------------------------- |
| `add`      | `MANAGE_SOUNDS`            | rate-limited; validates file; publishes   |
| `update`   | `MANAGE_SOUNDS`            | rename only                               |
| `delete`   | `MANAGE_SOUNDS`            | cascade removes the file row              |
| `getAll`   | `protectedProcedure`       | any member can list, to play them         |
| `onCreate` / `onUpdate` / `onDelete` | `protectedProcedure` | pubsub subscriptions      |

Supporting pieces, all following the emoji equivalents:

- `ServerEvents.SOUND_CREATE` / `SOUND_UPDATE` / `SOUND_DELETE` in
  `packages/shared/src/events.ts`
- `publishSound` in `apps/server/src/db/publishers`
- `ActivityLogType.CREATED_SOUND` / `DELETED_SOUND` in
  `packages/shared/src/logs.ts` (+ their label entries)
- `config.rateLimiters.addSound` in `apps/server/src/config.ts`, defaulting to
  `{ maxRequests: 10, windowMs: 60_000 }` like `addEmoji`

### Validation

Two levels, with an explicit boundary:

**Server-side (authoritative), in `add`:**

- `fileManager.temporaryFileHasMimeType(fileId, 'audio/')` — rejects non-audio
- file size ≤ **512 KB**
- server-wide quota of **50** sounds; `add` fails once the table is full
- rate limiter as above

**Client-side (comfort only), before upload:**

- duration ≤ **10 s**, measured with `decodeAudioData`
- extension hint restricted to `.mp3` / `.ogg` / `.wav` in the file picker

The server does not decode audio, so **duration is not enforced server-side**. The
512 KB size cap is the real bound on what a malicious client can push, and it is
enforced server-side.

### Voice transmission

- `StreamKind.SOUNDBOARD = 'soundboard'` added to `packages/shared/src/types.ts:8-15`.
- `packages/shared/src/helpers/get-mediasoup-kind.ts` maps `SOUNDBOARD` → `'audio'`.
- `apps/server/src/routers/voice/produce.ts` adds a branch: `SOUNDBOARD` requires
  `ctx.needsChannelPermission(currentVoiceChannelId, ChannelPermission.SPEAK)`,
  alongside the existing `AUDIO` / `VIDEO` / `SCREEN` checks.

No other server voice code changes: `VoiceRuntime.addProducer`, the
`VOICE_NEW_PRODUCER` publish and the consume path are already kind-agnostic.

---

## Client

### Playing a sound (sender)

A `use-soundboard` hook owning a small state machine:

1. Fetch the sound file and `decodeAudioData` it. Decoded `AudioBuffer`s are
   cached in memory, keyed by sound id, so repeat plays do not re-fetch.
2. Create an `AudioContext`, wire `AudioBufferSourceNode` → `MediaStreamDestination`.
3. `producerTransport.produce({ track, appData: { kind: StreamKind.SOUNDBOARD } })`,
   with the same opus `codecOptions` used for screen-share audio
   (`voice-provider/index.tsx:1036-1045`).
4. On the source's `onended`: close the producer, close the `AudioContext`, clear
   state.

Concurrency and abuse control:

- **One sound at a time.** Triggering a new sound tears down the current producer
  first.
- **500 ms cooldown** between triggers, client-side.

The sender does not consume their own producer, so the hook also plays the buffer
through the local output device for **local echo**.

### Hearing a sound (receiver)

`SOUNDBOARD` is threaded through the existing remote-stream plumbing:

- `apps/client/src/types.ts:84-97` — add to the `TRemoteStreamKind` union and the
  `TRemoteStreams` map
- `apps/client/src/components/voice-provider/hooks/use-transports.ts` — consume
  existing soundboard producers when joining, next to the `SCREEN_AUDIO` loop
  (~line 430)
- `apps/client/src/components/voice-provider/hooks/use-voice-events.ts` — handle
  `VOICE_NEW_PRODUCER` with `kind: SOUNDBOARD`
- `apps/client/src/components/voice-provider/hooks/use-remote-streams.ts` — store
  and tear down the stream
- `apps/client/src/components/channel-view/voice/hooks/use-voice-refs.ts` — expose
  it as an audio element source, subject to the existing per-user volume

### UI

**Trigger** — a 🎵 button in `apps/client/src/components/channel-view/voice/controls-bar.tsx`,
rendered only while connected to a voice channel and holding `SPEAK`. It opens a
popover showing the sound library as a grid; clicking a tile plays it. The active
tile shows a playing state until the clip ends.

**Management** — a "Sounds" card in the server settings screen
(`apps/client/src/components/server-screens/server-settings/index.tsx`), placed
next to Emojis and gated on `MANAGE_SOUNDS`: upload (with client-side duration
check and inline errors), rename, delete.

**i18n** — all new strings across the 7 locales, including the `MANAGE_SOUNDS`
label and description in each `permissions.json`.

**Desktop app** — no work. The desktop client renders the web client in a webview.

---

## Testing

**Server (`bun test`):**

- `add` rejects a caller without `MANAGE_SOUNDS`
- `add` rejects a non-audio mime type
- `add` rejects a file over 512 KB
- `add` rejects once the 50-sound quota is reached
- `add` de-duplicates a colliding name
- `delete` rejects a caller without `MANAGE_SOUNDS`, and removes the file row
- `getAll` is readable by a plain member
- `produce` with `kind: SOUNDBOARD` is rejected without `SPEAK` on the channel,
  and accepted with it

**Client:** unit tests for pure logic only (name normalisation, cooldown gate).
No component tests — the codebase does not have that harness.

**End-to-end:** manual, two clients on the deployed server. Verified by the user.
Checklist: upload a sound; a second client hears it; the sender hears local echo;
playing while mic-muted still transmits; triggering a second sound cuts the first;
a member without `MANAGE_SOUNDS` sees no management card but can still play.

---

## Delivery

Branch `feat/soundboard`, cut from `development`.

`bun run format:check`, `check-types` and `lint` must all pass before each commit —
CI gates on Prettier formatting, and it is the usual cause of red builds.
