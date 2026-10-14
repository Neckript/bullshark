<div align="center">

# 🦈 Bullshark

**Own your voice. Own your data. Own your server.**

[![Fork of Sharkord](https://img.shields.io/badge/fork%20of-Sharkord-gray?style=flat-square)](https://github.com/Sharkord/sharkord)
[![License MIT](https://img.shields.io/badge/license-MIT-green?style=flat-square)](./LICENSE)
[![Built with Bun](https://img.shields.io/badge/built%20with-Bun-black?style=flat-square)](https://bun.sh)
[![Self-hosted](https://img.shields.io/badge/self--hosted-first-purple?style=flat-square)](#)
[![Status Beta](https://img.shields.io/badge/status-beta-orange?style=flat-square)](#status)

**English** · [Français](./README.fr.md)

</div>

---

## What is Bullshark?

Bullshark is a self-hosted, open-source voice and chat platform for gamers who believe their conversations belong to them — not to a corporation, not to a cloud, not to anyone else. You install it. You run it. You own it. Every message, every voice packet, every file lives on your machine and nowhere else.

> Bullshark is a gaming-focused fork of [Sharkord](https://github.com/Sharkord/sharkord), built and maintained by the community, for the community.
>
> 💙 Support the original creator of Sharkord: [ko-fi.com/diogomartino](https://ko-fi.com/B0B71U3476)

---

## Status

Bullshark is in **beta** since v0.1.0. The core is complete: text, voice, screen sharing, moderation, plugins, PWA and desktop app. Updates keep your data: database migrations run automatically when the server starts. Expect some rough edges, and please report them in the issues. Before a major update, take a backup from the server settings (owner only).

---

## Sovereignty first

When you use Discord, your conversations travel through servers you don't control, in a country you don't live in, owned by a company you can't audit. They can read them, sell insights from them, hand them over to authorities, shut down your server overnight, or simply change their terms whenever they feel like it.

With Bullshark, none of that exists. There are no "Bullshark servers". There is no company between you and your data. Your server runs on your hardware, in your country, under your rules. A VPS in your city, a machine in your living room, a Raspberry Pi under your desk — wherever you host it, that's where your data lives. Full stop.

---

## Why Bullshark?

| | Discord | TeamSpeak | **Bullshark** |
|---|---|---|---|
| Self-hosted | ✗ | ✓ | ✓ |
| You choose where data lives | ✗ | ✓ | ✓ |
| Zero corporate visibility | ✗ | ✗ | ✓ |
| Subject to US Cloud Act | ✓ | ✓ | ✗ |
| No forced updates or TOS changes | ✗ | ✗ | ✓ |
| Can't be shut down externally | ✗ | ✗ | ✓ |
| Free forever, no Nitro | Nitro $$$ | ✓ | ✓ |
| Modern interface | ✓ | ✗ | ✓ |
| Voice + Video + Screen share | ✓ | partial | ✓ |
| Open source & auditable | ✗ | ✗ | ✓ MIT |
| Zero telemetry | ✗ | ✗ | ✓ |
| Gaming features (PTT, global hotkeys) | ✓ | partial | ✓ |

---

## Features

- **Voice channels** — low-latency WebRTC via Mediasoup
- **Text chat** — rich messages, reactions, threads, file sharing
- **Video & screen sharing** — built-in, adaptive quality per viewer
- **Push-to-Talk + Voice Activity Detection** — configurable hotkeys
- **Noise suppression** — processed client-side, never leaves your machine
- **Soundboard** — play sounds directly into voice channels
- **In-game overlay** — see who is talking without leaving your game (desktop app)
- **Roles & permissions** — per-channel, per-role granular control
- **Moderation tools** — timeouts, slow mode, voice server-mute
- **Plugins** — extend your server from the built-in marketplace
- **Mobile** — installable PWA with push notifications
- **Zero telemetry** — no analytics, no tracking, no phoning home

---

## Quick Start

### Linux (native binary)

```bash
curl -L https://github.com/Neckript/bullshark/releases/latest/download/bullshark-linux-x64 -o bullshark
chmod +x bullshark
./bullshark
```

Use `bullshark-linux-arm64` on ARM (Raspberry Pi, etc.). There is no native Windows or macOS binary yet: use Docker there.

### Docker (Linux, Windows, macOS)

No pre-built image is published yet, so build it from source:

```bash
git clone https://codeberg.org/The_Neckript/bullshark.git
cd bullshark
docker build -t bullshark:local .
docker run -d \
  -p 4991:4991/tcp \
  -p 40000:40000/tcp \
  -p 40000:40000/udp \
  -v ./data:/home/bun/.config/bullshark \
  --name bullshark \
  bullshark:local
```

Then open `http://localhost:4991` in your browser. Before exposing it to the internet (HTTPS, ports, DNS), read [docs/getting-started.md](./docs/getting-started.md).

> ⚠️ On first launch, Bullshark prints an **owner token** in the console. This is your master key — store it securely. To use it: log in, open the browser DevTools Console (`F12`) and run `await useToken("THE_TOKEN")` — see [docs/server-administration.md](./docs/server-administration.md).

Coming from Sharkord? See [docs/migration-sharkord.md](./docs/migration-sharkord.md).

---

## Server administration

Lost the owner token, or need to revoke it? Regenerate one with the `--new-owner-token` flag (it prints a fresh token, invalidates the old one, and exits without starting the server):

```bash
# Native binary
./bullshark --new-owner-token

# Docker (replace "bullshark" with your container name — see `docker ps`)
docker exec -u bun -e HOME=/home/bun bullshark /bullshark --new-owner-token
```

> ⚠️ For a Dockerized server, always run it **inside the container** as above — do **not** run `bun src/index.ts --new-owner-token` from the source tree (it targets a different, dev database, not your container's).

See [docs/server-administration.md](./docs/server-administration.md) for the full owner-token lifecycle, the security model, and upgrade notes.

---

## Differences from Sharkord

Bullshark is a gaming-focused fork. We diverge from upstream intentionally:

- **Faster bug fixes** on anything that impacts voice stability
- **Gaming features** outside Sharkord's scope: PTT, global hotkeys, soundboard, noise suppression, in-game overlay
- **Bilingual documentation** — English and French, because sovereignty is a European concern too
- **No artificial scope restrictions** — we build what gamers need

We sync selectively from upstream — core fixes yes, vision conflicts no.

---

## Roadmap

### Foundation
- [x] Fork established
- [x] `fix` Audio stability — voice freeze after 10s (#695 upstream)
- [x] `fix` Emoji reactions on Firefox (#728 upstream)
- [x] `feat` Global mute/unmute hotkey — OS-level, configurable, via [Bullshark Desktop](https://github.com/Neckript/bullshark-desktop) (2026-07-03)

### Sovereignty
- [x] `docs` HTTPS guide — Caddy + OVH DNS (no Cloudflare dependency)
- [x] `docs` HTTPS guide — Caddy + Hetzner DNS
- [ ] `docs` Deployment guides — OVH, Hetzner, Raspberry Pi, bare metal
- [ ] `feat` Replace any remaining US-dependent defaults with EU-sovereign alternatives

### Gaming features
- [x] `feat` Push-to-Talk + VAD (configurable input modes, window-scoped PTT key)
- [x] `feat` Client-side noise suppression (RNNoise + noise gate worklets)
- [x] `feat` Soundboard
- [x] `feat` Voice channel grid UI
- [x] `feat` In-game overlay

### Platform
- [x] `feat` Roles & permissions granular (per-channel, per-role)
- [x] `feat` Threads & discussion channels
- [x] `feat` Server backup — owner-only export/import (.zip) from the UI (2026-06-17)
- [x] `feat` PWA mobile optimized

### Next
- [ ] `perf` Voice stays clean under heavy CPU load (games): one shared audio context, process priority in the desktop app
- [ ] `perf` GPU-encoded screen sharing on Windows
- [ ] `feat` Audio redundancy (RED) for lossy Wi-Fi / 4G
- [ ] `feat` Import a Discord server from a template link

### Release
- [x] `release` v0.1.0 — beta
- [ ] `release` v1.0.0 — stable

---

## Contributing

Open to contributions. Read [CONTRIBUTING.md](./CONTRIBUTING.md) before opening a PR. Convention: `feat(issue): description` / `fix(issue): description`, always target `development`, issue first.

---

## Built on

[Sharkord](https://github.com/Sharkord/sharkord) · [Bun](https://bun.sh) · [Mediasoup](https://mediasoup.org) · [tRPC](https://trpc.io) · [React](https://react.dev) · [Drizzle ORM](https://orm.drizzle.team) · [ShadCN UI](https://ui.shadcn.com)

---

## License

MIT — see [LICENSE](./LICENSE)

Original work © Sharkord contributors — [Support the creator](https://ko-fi.com/B0B71U3476)
Fork © 2025 Neckript/Bullshark contributors

---

<div align="center">

*Your server. Your data. Your sovereignty.*

</div>
