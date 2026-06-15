<div align="center">

# 🦈 Bullshark

**Own your voice. Own your data. Own your server.**  
**Ta voix. Tes données. Ton serveur.**

[![Fork of Sharkord](https://img.shields.io/badge/fork%20of-Sharkord-gray?style=flat-square)](https://github.com/Sharkord/sharkord)
[![License MIT](https://img.shields.io/badge/license-MIT-green?style=flat-square)](./LICENSE)
[![Built with Bun](https://img.shields.io/badge/built%20with-Bun-black?style=flat-square)](https://bun.sh)
[![Self-hosted](https://img.shields.io/badge/self--hosted-first-purple?style=flat-square)](#)

</div>

---

## What is Bullshark? / C'est quoi Bullshark ?

**EN** — Bullshark is a self-hosted, open-source voice and chat platform for gamers who believe their conversations belong to them — not to a corporation, not to a cloud, not to anyone else. You install it. You run it. You own it. Every message, every voice packet, every file lives on your machine and nowhere else.

**FR** — Bullshark c'est une plateforme de communication auto-hébergée et open source pour les gamers qui pensent que leurs conversations leur appartiennent — pas à une entreprise, pas à un cloud américain, pas à quiconque d'autre. Tu l'installes. Tu le fais tourner. Tu en es le seul maître. Chaque message, chaque paquet vocal, chaque fichier reste sur ta machine et nulle part ailleurs.

> Bullshark is a gaming-focused fork of [Sharkord](https://github.com/Sharkord/sharkord), built and maintained by the community, for the community.  
> Bullshark est un fork orienté gaming de [Sharkord](https://github.com/Sharkord/sharkord), construit et maintenu par la communauté, pour la communauté.
>
> 💙 Support the original creator of Sharkord: [ko-fi.com/diogomartino](https://ko-fi.com/B0B71U3476)

---

## Sovereignty first / La souveraineté avant tout

**EN**

When you use Discord, your conversations travel through servers you don't control, in a country you don't live in, owned by a company you can't audit. They can read it, sell insights from it, hand it over to authorities, shut down your server overnight, or simply change their terms whenever they feel like it.

With Bullshark, none of that exists. There are no "Bullshark servers". There is no company between you and your data. Your server runs on your hardware, in your country, under your rules. A VPS in your city, a machine in your living room, a Raspberry Pi under your desk — wherever you host it, that's where your data lives. Full stop.

**FR**

Quand tu utilises Discord, tes conversations transitent par des serveurs que tu ne contrôles pas, dans un pays où tu ne vis pas, appartenant à une entreprise que tu ne peux pas auditer. Ils peuvent les lire, en extraire des données, les transmettre aux autorités, fermer ton serveur du jour au lendemain, ou simplement changer leurs conditions quand ça leur chante.

Avec Bullshark, rien de tout ça n'existe. Il n'y a pas de "serveurs Bullshark". Il n'y a aucune entreprise entre toi et tes données. Ton serveur tourne sur ton matériel, dans ton pays, sous tes règles. Un VPS dans ta ville, une machine dans ton salon, un Raspberry Pi sous ton bureau — là où tu l'héberges, là sont tes données. Point final.

---

## Why Bullshark? / Pourquoi Bullshark ?

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
| Gaming features (PTT, hotkeys, soundboard) | ✓ | partial | ✓ |

---

## Features / Fonctionnalités

- **Voice channels** — low-latency WebRTC via Mediasoup
- **Text chat** — rich messages, reactions, file sharing
- **Video & screen sharing** — built-in, no plugins needed
- **Push-to-Talk + Voice Activity Detection** — configurable hotkeys
- **Noise suppression** — processed client-side, never leaves your machine
- **Soundboard** — inject sounds directly into voice channels
- **Roles & permissions** — per-channel, per-user granular control
- **Zero telemetry** — no analytics, no tracking, no phoning home
- **Single binary** — one file, runs anywhere: Linux, Windows, macOS, Docker

---

## Quick Start / Démarrage rapide

### Linux / macOS
```bash
curl -L https://github.com/Neckript/bullshark/releases/latest/download/bullshark-linux-x64 -o bullshark
chmod +x bullshark
./bullshark
```

### Docker
```bash
docker run \
  -p 4991:4991/tcp \
  -p 40000:40000/tcp \
  -p 40000:40000/udp \
  -v ./data:/home/bun/.config/bullshark \
  --name bullshark \
  ghcr.io/neckript/bullshark:latest
```

Puis ouvre `http://localhost:4991` dans ton navigateur.  
Then open `http://localhost:4991` in your browser.

> ⚠️ On first launch, Bullshark prints an **owner token** in the console. This is your master key — store it securely. Paste it in the web UI ("secret token" prompt) to become the server owner.  
> ⚠️ Au premier lancement, Bullshark affiche un **token owner** dans la console. C'est ta clé maître — garde-la précieusement. Colle-la dans l'interface web (invite « secret token ») pour devenir owner du serveur.

---

## Server administration / Administration du serveur

**EN** — Lost the owner token, or need to revoke it? Regenerate one with the
`--new-owner-token` flag (it prints a fresh token, invalidates the old one, and
exits without starting the server):

**FR** — Token owner perdu, ou besoin de le révoquer ? Régénères-en un avec le flag
`--new-owner-token` (il affiche un nouveau token, invalide l'ancien, et sort sans
démarrer le serveur) :

```bash
# Native binary / Binaire natif
./bullshark --new-owner-token

# Docker
docker exec -u bun bullshark /sharkord --new-owner-token
```

See [docs/server-administration.md](./docs/server-administration.md) for the full
owner-token lifecycle, the security model, and upgrade notes.  
Voir [docs/server-administration.md](./docs/server-administration.md) pour le cycle
de vie complet du token owner, le modèle de sécurité et les notes de mise à jour.

---

## Differences from Sharkord / Différences avec Sharkord

Bullshark is a gaming-focused fork. We diverge from upstream intentionally:

- **Faster bug fixes** on anything that impacts voice stability
- **Gaming features** outside Sharkord's scope: PTT, global hotkeys, soundboard, noise suppression, in-game overlay
- **Bilingual documentation** — French and English, because sovereignty is a European concern too
- **No artificial scope restrictions** — we build what gamers need

We sync selectively from upstream — core fixes yes, vision conflicts no.

---

## Roadmap

### Foundation / Fondations
- [x] Fork established
- [ ] `fix` Audio stability — voice freeze after 10s (#695 upstream)
- [ ] `fix` Emoji reactions on Firefox (#728 upstream)
- [ ] `fix` Global hotkeys mute/unmute (#678 upstream)

### Sovereignty / Souveraineté
- [ ] `docs` HTTPS guide — Caddy + OVH DNS (no Cloudflare dependency)
- [ ] `docs` HTTPS guide — Caddy + Hetzner DNS
- [ ] `docs` Deployment guides — OVH, Hetzner, Raspberry Pi, bare metal
- [ ] `feat` Replace any remaining US-dependent defaults with EU-sovereign alternatives

### Gaming features / Fonctionnalités gaming
- [ ] `feat` Push-to-Talk + VAD advanced
- [ ] `feat` Client-side noise suppression
- [ ] `feat` Soundboard
- [ ] `feat` Voice channel grid UI
- [ ] `feat` In-game overlay

### Platform / Plateforme
- [ ] `feat` Roles & permissions granular
- [ ] `feat` PWA mobile optimized
- [ ] `feat` Threads & discussion channels

### Release
- [ ] `release` v0.1.0 stable — first Bullshark release

---

## Contributing / Contribuer

**EN** — Open to contributions. Read [CONTRIBUTING.md](./CONTRIBUTING.md) before opening a PR. Convention: `feat(issue): description` / `fix(issue): description`, always target `development`, issue first.

**FR** — Ouvert aux contributions. Lis [CONTRIBUTING.md](./CONTRIBUTING.md) avant d'ouvrir une PR. Convention : `feat(issue): description` / `fix(issue): description`, toujours cibler `development`, issue en premier.

---

## Built on / Construit sur

[Sharkord](https://github.com/Sharkord/sharkord) · [Bun](https://bun.sh) · [Mediasoup](https://mediasoup.org) · [tRPC](https://trpc.io) · [React](https://react.dev) · [Drizzle ORM](https://orm.drizzle.team) · [ShadCN UI](https://ui.shadcn.com)

---

## License

MIT — see [LICENSE](./LICENSE)

Original work © Sharkord contributors — [Support the creator](https://ko-fi.com/B0B71U3476)  
Fork © 2025 Neckript/Bullshark contributors

---

<div align="center">

*Your server. Your data. Your sovereignty.*  
*Ton serveur. Tes données. Ta souveraineté.*

</div>
