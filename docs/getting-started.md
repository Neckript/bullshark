# Getting started / Premiers pas

How to install, expose, and run a Bullshark server — for real, in a way that
actually works with voice, video, and screen share.

Comment installer, exposer et faire tourner un serveur Bullshark — pour de
vrai, d'une façon qui fait vraiment marcher le vocal, la vidéo et le partage
d'écran.

---

## 1. Before you start / Avant de commencer

**EN** — You need:
- A machine to host it: a VPS, a home server, a Raspberry Pi, anything that can stay online.
- Two ports reachable from the internet: **4991/tcp** (web app + API) and **40000** on **both tcp and udp** (WebRTC media — voice/video/screen share).
- A domain name pointed at your server, **or** an existing reverse proxy setup. This is not optional — see [section 3](#3-https-mandatory--https-obligatoire).

**FR** — Il te faut :
- Une machine pour l'héberger : un VPS, un serveur perso, un Raspberry Pi, tout ce qui peut rester en ligne.
- Deux ports joignables depuis internet : **4991/tcp** (app web + API) et **40000** en **tcp ET udp** (média WebRTC — vocal/vidéo/partage d'écran).
- Un nom de domaine pointé vers ton serveur, **ou** un reverse proxy déjà en place. Ce n'est pas optionnel — voir [section 3](#3-https-mandatory--https-obligatoire).

---

## 2. Installing the server / Installer le serveur

**EN** — Bullshark currently ships **native binaries for Linux only** (x64 and
arm64). There is no native Windows or macOS binary yet — on those platforms,
use Docker.

**FR** — Bullshark ne fournit pour l'instant des **binaires natifs que pour
Linux** (x64 et arm64). Pas de binaire natif Windows ou macOS pour l'instant —
sur ces plateformes, utilise Docker.

### Linux (native binary / binaire natif)

```bash
curl -L https://github.com/Neckript/bullshark/releases/latest/download/bullshark-linux-x64 -o bullshark
chmod +x bullshark
./bullshark
```

Use `bullshark-linux-arm64` instead of `bullshark-linux-x64` on ARM (Raspberry
Pi, etc.). / Utilise `bullshark-linux-arm64` à la place de
`bullshark-linux-x64` sur ARM (Raspberry Pi, etc.).

### Docker (Linux, Windows, macOS — via Docker Desktop)

**EN** — The most reliable way today is to build the image yourself from
source — this is exactly what the maintainer's own production deployment
does:

**FR** — La méthode la plus fiable aujourd'hui est de construire l'image
toi-même depuis les sources — c'est exactement ce que fait le déploiement en
production du mainteneur :

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

> ⚠️ A pre-built image may or may not be published to a public registry
> depending on the current release configuration — check the
> [repository](https://codeberg.org/The_Neckript/bullshark) for the latest
> instructions before assuming one exists.
> ⚠️ Une image pré-construite peut être publiée ou non sur un registre public
> selon la configuration de release en cours — vérifie le
> [dépôt](https://codeberg.org/The_Neckript/bullshark) pour les instructions à
> jour avant de supposer qu'elle existe.

**Windows/macOS-specific PUID/PGID note / note PUID/PGID Windows/macOS** —
running as root inside the container, you can remap the internal user to
match your host user via `-e PUID=1000 -e PGID=1000` to avoid file permission
issues on the mounted `./data` volume. / en tournant en root dans le
conteneur, tu peux remapper l'utilisateur interne pour correspondre à ton
utilisateur hôte via `-e PUID=1000 -e PGID=1000`, pour éviter des soucis de
permissions sur le volume `./data` monté.

Then open `http://localhost:4991` — but see section 3 before exposing this to
the internet. / Ouvre ensuite `http://localhost:4991` — mais lis la section 3
avant d'exposer ça sur internet.

---

## 3. HTTPS — mandatory / HTTPS — obligatoire

**EN** — This is not optional and it's the step people miss. Browsers only
allow microphone, camera, and screen-share access on a **secure context**:
HTTPS, or `localhost`. Access your server over plain `http://` from any other
address and Bullshark itself will show a warning on the login screen — voice,
video, and screen share will not work at all, even though text chat will.

**FR** — Ce n'est pas optionnel, et c'est l'étape que tout le monde loupe. Les
navigateurs n'autorisent l'accès au micro, à la caméra et au partage d'écran
que dans un **contexte sécurisé** : HTTPS, ou `localhost`. Accède à ton
serveur en `http://` depuis n'importe quelle autre adresse et Bullshark
affichera lui-même un avertissement sur l'écran de connexion — le vocal, la
vidéo et le partage d'écran ne fonctionneront pas du tout, même si le chat
texte continuera de marcher.

**EN** — Bullshark itself does **not** terminate TLS — put a reverse proxy in
front of it. [Caddy](https://caddyphp.com) is the simplest option: it
provisions and renews Let's Encrypt certificates automatically, zero config
beyond your domain name.

**FR** — Bullshark lui-même **ne** termine **pas** le TLS — mets un reverse
proxy devant. [Caddy](https://caddyserver.com) est l'option la plus simple :
il provisionne et renouvelle les certificats Let's Encrypt automatiquement,
zéro config à part ton nom de domaine.

`Caddyfile`:
```
chat.example.com {
    reverse_proxy localhost:4991
}
```

That's it — Caddy handles ACME, redirects, and renewal on its own. Point your
domain's `A`/`AAAA` record at the server first. / C'est tout — Caddy gère
l'ACME, les redirections et le renouvellement tout seul. Pointe d'abord
l'enregistrement `A`/`AAAA` de ton domaine vers le serveur.

**Important / Important** — only the **web port (4991)** goes through the
HTTPS reverse proxy. The **WebRTC media port (40000, tcp+udp)** carries raw
RTP traffic, not HTTP — it must stay directly exposed on the firewall/router,
not proxied. If your server sits behind NAT (home router, some VPS
providers), set `webRtc.announcedAddress` (or the
`BULLSHARK_WEBRTC_ANNOUNCED_ADDRESS` env var) to your public IP or domain, or
voice/video will fail to establish for remote users even with the port
forwarded. / seul le **port web (4991)** passe par le reverse proxy HTTPS. Le
**port média WebRTC (40000, tcp+udp)** transporte du RTP brut, pas du HTTP —
il doit rester exposé directement sur le pare-feu/routeur, pas proxifié. Si
ton serveur est derrière un NAT (routeur maison, certains hébergeurs VPS),
configure `webRtc.announcedAddress` (ou la variable d'environnement
`BULLSHARK_WEBRTC_ANNOUNCED_ADDRESS`) avec ton IP publique ou ton domaine,
sinon le vocal/vidéo échouera à s'établir pour les utilisateurs distants même
avec le port forwardé.

---

## 4. Configuration / Configuration

**EN** — Settings live in `config.ini` inside the server's data directory
(created automatically on first run), and can be overridden with environment
variables — handy for Docker.

**FR** — La config vit dans `config.ini` dans le répertoire de données du
serveur (créé automatiquement au premier lancement), et peut être surchargée
par des variables d'environnement — pratique avec Docker.

| Env var / Variable d'env | Config key / Clé config | Default / Défaut | What it does / Ce que ça fait |
|---|---|---|---|
| `BULLSHARK_PORT` | `server.port` | `4991` | Web app / API port |
| `BULLSHARK_DEBUG` | `server.debug` | `false` | Verbose logging / logs verbeux |
| `BULLSHARK_AUTOUPDATE` | `server.autoupdate` | `false` | Auto-update the server binary / mise à jour automatique du binaire |
| `BULLSHARK_WEBRTC_PORT` | `webRtc.port` | `40000` | WebRTC media port (tcp+udp) / port média WebRTC (tcp+udp) |
| `BULLSHARK_WEBRTC_ANNOUNCED_ADDRESS` | `webRtc.announcedAddress` | *(auto-detected public IP)* | Public IP/domain to announce to peers — **required behind NAT** / IP publique ou domaine à annoncer aux pairs — **obligatoire derrière un NAT** |
| `BULLSHARK_WEBRTC_MAX_BITRATE` | `webRtc.maxBitrate` | `30000000` (30 Mbps) | Max bitrate per stream / débit max par flux |
| `BULLSHARK_MARKETPLACE_REGISTRY_URL` | `plugins.marketplaceRegistryUrl` | official registry | Plugin marketplace source — set to `''` to disable it / source du registre de plugins — mets `''` pour le désactiver |

---

## 5. First launch: claiming ownership / Premier lancement : récupérer l'accès owner

**EN** — On first launch, Bullshark prints a one-time **owner token** in the
server console/logs (with Docker: `docker compose logs` or `docker logs`,
since the container runs detached and you won't see it any other way). Full
recovery/rotation procedure: [docs/server-administration.md](./server-administration.md).

**FR** — Au premier lancement, Bullshark affiche un **token owner** unique
dans la console/les logs du serveur (avec Docker : `docker compose logs` ou
`docker logs`, car le conteneur tourne en détaché et tu ne le verras pas
autrement). Procédure complète de récupération/rotation :
[docs/server-administration.md](./server-administration.md).

---

## 6. Data & backups / Données & sauvegardes

**EN** — All server data (database, uploaded files, sounds, config) lives in
one directory: `/home/bun/.config/bullshark` in the container (mount this as
a volume, as shown above), or the OS-appropriate config directory when
running the native binary. Server owners can export/import a full backup
(`.zip`) directly from the web UI (Server Settings → Backup) — no manual
file/database wrangling needed.

**FR** — Toutes les données serveur (base de données, fichiers envoyés,
sons, config) vivent dans un seul répertoire : `/home/bun/.config/bullshark`
dans le conteneur (monte-le en volume, comme montré plus haut), ou le
répertoire de config approprié à l'OS quand tu lances le binaire natif. Les
propriétaires de serveur peuvent exporter/importer une sauvegarde complète
(`.zip`) directement depuis l'UI web (Paramètres serveur → Sauvegarde) —
aucune manipulation manuelle de fichiers/base de données nécessaire.

---

## Links / Liens

- Server (Codeberg, source of truth / source de vérité): https://codeberg.org/The_Neckript/bullshark
- Server (GitHub mirror / miroir GitHub): https://github.com/Neckript/bullshark
- Desktop app / App desktop (Codeberg): https://codeberg.org/The_Neckript/bullshark-desktop
- Desktop app / App desktop (GitHub): https://github.com/Neckript/bullshark-desktop
- Server administration / Administration serveur: [server-administration.md](./server-administration.md)
- Original project / Projet d'origine — Sharkord: https://github.com/Sharkord/sharkord (support the creator / soutiens le créateur: https://ko-fi.com/B0B71U3476)
