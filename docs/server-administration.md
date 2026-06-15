# Server administration / Administration du serveur

How the Bullshark server bootstraps administrator access, and how to recover or
rotate it.

Comment le serveur Bullshark amorce l'accès administrateur, et comment le
récupérer ou le faire tourner.

---

## The owner token / Le token owner

**EN** — Admin (owner) access is granted through a single **owner token**. On the
**first launch**, Bullshark generates a random token (32 bytes, CSPRNG) and prints
it **once** in the server console:

**FR** — L'accès administrateur (owner) est accordé via un unique **token owner**.
Au **premier lancement**, Bullshark génère un token aléatoire (32 octets, CSPRNG)
et l'affiche **une seule fois** dans la console du serveur :

```
🚨🚨 I M P O R T A N T 🚨🚨
────────────────────────────────────────────────────
This server has been started for the first time.
Please save this access token somewhere safe, ...
────────────────────────────────────────────────────
zBwdbBl9byuW03HMdYCkBW2pqUPuT_0VP946Gy4ESNM
────────────────────────────────────────────────────
```

**EN** — Paste this token in the web UI (the "secret token" prompt) to grant your
account the **Owner** role. Anyone holding it can take over the server, so store
it like a password. The server only ever keeps a SHA-256 **hash** of it — the
plaintext is shown once and never again.

**FR** — Colle ce token dans l'interface web (l'invite « secret token ») pour
attribuer le rôle **Owner** à ton compte. Quiconque le détient peut prendre le
contrôle du serveur : garde-le comme un mot de passe. Le serveur n'en conserve
qu'un **hash** SHA-256 — le texte en clair n'est montré qu'une fois.

---

## Regenerating the token / Régénérer le token

**EN** — Lost the token, or want to revoke the old one? Run the server binary with
the `--new-owner-token` flag. It generates a fresh token, prints it once,
**invalidates the previous one**, and exits **without starting the server**. It
needs host (shell) access — the same trust level as running the server itself.

**FR** — Token perdu, ou tu veux révoquer l'ancien ? Lance le binaire serveur avec
le flag `--new-owner-token`. Il génère un nouveau token, l'affiche une fois,
**invalide le précédent**, et sort **sans démarrer le serveur**. Il faut un accès
shell à l'hôte — le même niveau de confiance que faire tourner le serveur.

### Native binary / Binaire natif

```bash
./bullshark --new-owner-token
```

### Docker

**EN** — Run a second, one-shot process inside the running container (it shares the
same database file):

**FR** — Lance un second process one-shot dans le conteneur en cours d'exécution
(il partage le même fichier de base de données) :

```bash
docker exec -u bun -e HOME=/home/bun sharkord /sharkord --new-owner-token
```

> **EN** — Replace `sharkord` with your container name (`docker ps` to find it). The
> `-u bun -e HOME=/home/bun` part matters: without it the command runs as `root`
> (`HOME=/root`) and would target an empty `/root/.config/sharkord` database instead
> of your server's. Do **not** use the from-source command below for a Dockerized
> server — it targets a different (dev) database.
>
> **FR** — Remplace `sharkord` par le nom de ton conteneur (`docker ps` pour le
> trouver). Le `-u bun -e HOME=/home/bun` est important : sans ça la commande tourne
> en `root` (`HOME=/root`) et viserait une base vide `/root/.config/sharkord` au lieu
> de celle de ton serveur. N'utilise **pas** la commande « depuis les sources »
> ci-dessous pour un serveur Docker — elle vise une autre base (celle de dev).

### From source (development) / Depuis les sources (développement)

```bash
cd apps/server
bun src/index.ts --new-owner-token
```

> **EN** — The database must already exist. On a brand-new install, start the server
> once first (which seeds it and prints the initial token); otherwise the command
> prints a "database is not initialized yet" message and exits.
>
> **FR** — La base de données doit déjà exister. Sur une install toute neuve,
> démarre le serveur une fois d'abord (ça l'initialise et affiche le token
> initial) ; sinon la commande affiche un message « database is not initialized
> yet » et s'arrête.

---

## Security model / Modèle de sécurité

**EN**

- The owner token is **separate** from the server's signing secret. Regenerating a
  token therefore **does not** invalidate existing user sessions (JWTs) or signed
  file URLs — only the previous owner token stops working.
- The "secret token" claim endpoint is **rate-limited** and uses a **constant-time**
  comparison, so the token cannot be brute-forced or timing-attacked.
- The token (plaintext) is only ever written to **stdout** — never to log files.

**FR**

- Le token owner est **séparé** du secret de signature du serveur. Régénérer un
  token **n'invalide donc pas** les sessions utilisateurs existantes (JWT) ni les
  URLs de fichiers signées — seul l'ancien token owner cesse de fonctionner.
- L'endpoint de claim du « secret token » est **rate-limité** et utilise une
  comparaison à **temps constant** : le token ne peut être ni brute-forcé ni
  attaqué par timing.
- Le token (en clair) n'est écrit que sur **stdout** — jamais dans des fichiers de
  log.

---

## Upgrading an existing server / Mise à jour d'un serveur existant

**EN** — The release that introduced the dedicated owner token ships an **additive**
database migration (it only adds a column and backfills it). Upgrading is safe on a
populated database: existing data is untouched, and any owner token you printed
before keeps working until you regenerate it.

**FR** — La version qui a introduit le token owner dédié embarque une migration de
base de données **additive** (elle ajoute seulement une colonne et la remplit).
La mise à jour est sûre sur une base peuplée : les données existantes sont
intactes, et tout token owner imprimé auparavant reste valide jusqu'à ce que tu le
régénères.
