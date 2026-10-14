<div align="center">

# 🦈 Bullshark

**Ta voix. Tes données. Ton serveur.**

[![Fork of Sharkord](https://img.shields.io/badge/fork%20of-Sharkord-gray?style=flat-square)](https://github.com/Sharkord/sharkord)
[![License MIT](https://img.shields.io/badge/license-MIT-green?style=flat-square)](./LICENSE)
[![Built with Bun](https://img.shields.io/badge/built%20with-Bun-black?style=flat-square)](https://bun.sh)
[![Self-hosted](https://img.shields.io/badge/self--hosted-first-purple?style=flat-square)](#)
[![Status Beta](https://img.shields.io/badge/status-beta-orange?style=flat-square)](#état)

[English](./README.md) · **Français**

</div>

---

## C'est quoi Bullshark ?

Bullshark c'est une plateforme de communication auto-hébergée et open source pour les gamers qui pensent que leurs conversations leur appartiennent — pas à une entreprise, pas à un cloud américain, pas à quiconque d'autre. Tu l'installes. Tu le fais tourner. Tu en es le seul maître. Chaque message, chaque paquet vocal, chaque fichier reste sur ta machine et nulle part ailleurs.

> Bullshark est un fork orienté gaming de [Sharkord](https://github.com/Sharkord/sharkord), construit et maintenu par la communauté, pour la communauté.
>
> 💙 Soutiens le créateur original de Sharkord : [ko-fi.com/diogomartino](https://ko-fi.com/B0B71U3476)

---

## État

Bullshark est en **bêta** depuis la v0.1.0. Le cœur est complet : texte, vocal, partage d'écran, modération, plugins, PWA et appli desktop. Les mises à jour conservent tes données : les migrations de la base s'appliquent automatiquement au démarrage du serveur. Il reste sûrement quelques angles à arrondir, signale-les dans les issues. Avant une grosse mise à jour, fais une sauvegarde depuis les paramètres du serveur (propriétaire uniquement).

---

## La souveraineté avant tout

Quand tu utilises Discord, tes conversations transitent par des serveurs que tu ne contrôles pas, dans un pays où tu ne vis pas, appartenant à une entreprise que tu ne peux pas auditer. Ils peuvent les lire, en extraire des données, les transmettre aux autorités, fermer ton serveur du jour au lendemain, ou simplement changer leurs conditions quand ça leur chante.

Avec Bullshark, rien de tout ça n'existe. Il n'y a pas de « serveurs Bullshark ». Il n'y a aucune entreprise entre toi et tes données. Ton serveur tourne sur ton matériel, dans ton pays, sous tes règles. Un VPS dans ta ville, une machine dans ton salon, un Raspberry Pi sous ton bureau — là où tu l'héberges, là sont tes données. Point final.

---

## Pourquoi Bullshark ?

| | Discord | TeamSpeak | **Bullshark** |
|---|---|---|---|
| Auto-hébergé | ✗ | ✓ | ✓ |
| Tu choisis où vivent tes données | ✗ | ✓ | ✓ |
| Aucune visibilité pour une entreprise | ✗ | ✗ | ✓ |
| Soumis au Cloud Act américain | ✓ | ✓ | ✗ |
| Pas de mises à jour ni de CGU imposées | ✗ | ✗ | ✓ |
| Impossible à fermer de l'extérieur | ✗ | ✗ | ✓ |
| Gratuit pour toujours, sans Nitro | Nitro $$$ | ✓ | ✓ |
| Interface moderne | ✓ | ✗ | ✓ |
| Vocal + vidéo + partage d'écran | ✓ | partiel | ✓ |
| Open source et auditable | ✗ | ✗ | ✓ MIT |
| Zéro télémétrie | ✗ | ✗ | ✓ |
| Fonctions gaming (PTT, raccourcis globaux) | ✓ | partiel | ✓ |

---

## Fonctionnalités

- **Salons vocaux** — WebRTC à faible latence via Mediasoup
- **Chat texte** — messages enrichis, réactions, fils, partage de fichiers
- **Vidéo et partage d'écran** — intégrés, qualité adaptée à chaque spectateur
- **Push-to-Talk + détection de voix** — raccourcis configurables
- **Suppression de bruit** — traitée sur ta machine, rien n'en sort
- **Soundboard** — joue des sons directement dans les salons vocaux
- **Overlay en jeu** — vois qui parle sans quitter ton jeu (appli desktop)
- **Rôles et permissions** — contrôle fin par salon et par rôle
- **Outils de modération** — exclusions temporaires, mode lent, mise en sourdine serveur
- **Plugins** — enrichis ton serveur depuis la marketplace intégrée
- **Mobile** — PWA installable avec notifications push
- **Zéro télémétrie** — pas d'analytics, pas de pistage, aucun appel vers l'extérieur

---

## Démarrage rapide

### Linux (binaire natif)

```bash
curl -L https://github.com/Neckript/bullshark/releases/latest/download/bullshark-linux-x64 -o bullshark
chmod +x bullshark
./bullshark
```

Utilise `bullshark-linux-arm64` sur ARM (Raspberry Pi, etc.). Il n'y a pas encore de binaire natif Windows ou macOS : utilise Docker sur ces systèmes.

### Docker (Linux, Windows, macOS)

Aucune image pré-construite n'est publiée pour l'instant, construis-la depuis les sources :

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

Ouvre ensuite `http://localhost:4991` dans ton navigateur. Avant de l'exposer sur internet (HTTPS, ports, DNS), lis [docs/getting-started.md](./docs/getting-started.md).

> ⚠️ Au premier lancement, Bullshark affiche un **token owner** dans la console. C'est ta clé maître — garde-la précieusement. Pour l'utiliser : connecte-toi, ouvre la Console des DevTools (`F12`) et lance `await useToken("LE_TOKEN")` — voir [docs/server-administration.md](./docs/server-administration.md).

Tu viens de Sharkord ? Voir [docs/migration-sharkord.md](./docs/migration-sharkord.md).

---

## Administration du serveur

Token owner perdu, ou besoin de le révoquer ? Régénères-en un avec le flag `--new-owner-token` (il affiche un nouveau token, invalide l'ancien, et sort sans démarrer le serveur) :

```bash
# Binaire natif
./bullshark --new-owner-token

# Docker (remplace "bullshark" par le nom de ton conteneur — voir `docker ps`)
docker exec -u bun -e HOME=/home/bun bullshark /bullshark --new-owner-token
```

> ⚠️ Pour un serveur Docker, lance-le toujours **dans le conteneur** comme ci-dessus — n'utilise **pas** `bun src/index.ts --new-owner-token` depuis les sources (ça vise une autre base, celle de dev, pas celle de ton conteneur).

Voir [docs/server-administration.md](./docs/server-administration.md) pour le cycle de vie complet du token owner, le modèle de sécurité et les notes de mise à jour.

---

## Différences avec Sharkord

Bullshark est un fork orienté gaming. On s'écarte de l'amont volontairement :

- **Corrections plus rapides** sur tout ce qui touche la stabilité du vocal
- **Fonctions gaming** hors du périmètre de Sharkord : PTT, raccourcis globaux, soundboard, suppression de bruit, overlay en jeu
- **Documentation bilingue** — anglais et français, parce que la souveraineté est aussi une affaire européenne
- **Pas de restriction de périmètre artificielle** — on construit ce dont les gamers ont besoin

On reprend l'amont au cas par cas — les correctifs du cœur oui, les conflits de vision non.

---

## Feuille de route

### Fondations
- [x] Fork établi
- [x] `fix` Stabilité audio — gel du vocal après 10 s (#695 en amont)
- [x] `fix` Réactions emoji sous Firefox (#728 en amont)
- [x] `feat` Raccourci global muet/actif — au niveau du système, configurable, via [Bullshark Desktop](https://github.com/Neckript/bullshark-desktop) (2026-07-03)

### Souveraineté
- [x] `docs` Guide HTTPS — Caddy + DNS OVH (sans dépendre de Cloudflare)
- [x] `docs` Guide HTTPS — Caddy + DNS Hetzner
- [ ] `docs` Guides de déploiement — OVH, Hetzner, Raspberry Pi, machine nue
- [ ] `feat` Remplacer les derniers réglages par défaut dépendant des États-Unis par des alternatives européennes

### Fonctions gaming
- [x] `feat` Push-to-Talk + détection de voix (modes de saisie configurables, touche PTT limitée à la fenêtre)
- [x] `feat` Suppression de bruit côté client (worklets RNNoise + porte de bruit)
- [x] `feat` Soundboard
- [x] `feat` Grille des salons vocaux
- [x] `feat` Overlay en jeu

### Plateforme
- [x] `feat` Rôles et permissions fins (par salon, par rôle)
- [x] `feat` Fils et salons de discussion
- [x] `feat` Sauvegarde du serveur — export/import (.zip) depuis l'interface, propriétaire uniquement (2026-06-17)
- [x] `feat` PWA optimisée pour le mobile

### Prochaines étapes
- [ ] `perf` Un vocal qui reste propre quand le processeur est saturé (jeux) : un seul contexte audio partagé, priorité système dans l'appli desktop
- [ ] `perf` Partage d'écran encodé par la carte graphique sous Windows
- [ ] `feat` Redondance audio (RED) pour le wifi faible et la 4G
- [ ] `feat` Importer un serveur Discord depuis un lien de modèle

### Versions
- [x] `release` v0.1.0 — bêta
- [ ] `release` v1.0.0 — stable

---

## Contribuer

Ouvert aux contributions. Lis [CONTRIBUTING.md](./CONTRIBUTING.md) avant d'ouvrir une PR. Convention : `feat(issue): description` / `fix(issue): description`, toujours cibler `development`, issue en premier.

---

## Construit sur

[Sharkord](https://github.com/Sharkord/sharkord) · [Bun](https://bun.sh) · [Mediasoup](https://mediasoup.org) · [tRPC](https://trpc.io) · [React](https://react.dev) · [Drizzle ORM](https://orm.drizzle.team) · [ShadCN UI](https://ui.shadcn.com)

---

## Licence

MIT — voir [LICENSE](./LICENSE)

Œuvre originale © contributeurs de Sharkord — [Soutenir le créateur](https://ko-fi.com/B0B71U3476)
Fork © 2025 contributeurs de Neckript/Bullshark

---

<div align="center">

*Ton serveur. Tes données. Ta souveraineté.*

</div>
