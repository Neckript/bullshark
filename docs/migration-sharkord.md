# Migrating from Sharkord / Migrer depuis Sharkord

**EN** — Bullshark is a fork of Sharkord. An existing Sharkord instance can be
moved over without losing its database, uploads or configuration, because both
projects share the same data directory layout. This guide covers the Docker
Compose on bare metal case.

**FR** — Bullshark est un fork de Sharkord. Une instance Sharkord existante peut
être reprise sans perdre sa base, ses fichiers ou sa configuration, parce que les
deux projets partagent la même structure de répertoire de données. Ce guide
traite le cas Docker Compose sur machine nue.

---

## 1. Scope — read this first / Périmètre — à lire en premier

**EN** — This guide applies to **Sharkord v0.0.23 and earlier, only**. On
v0.0.24 or later, migrating this way **destroys your database silently**. The
reason is worth understanding before you touch anything.

**FR** — Ce guide s'applique à **Sharkord v0.0.23 et antérieures, uniquement**.
En v0.0.24 ou plus récente, migrer ainsi **détruit ta base en silence**. La
raison mérite d'être comprise avant de toucher à quoi que ce soit.

### Why v0.0.23 is the line / Pourquoi la limite est à v0.0.23

**EN** — Both projects share migrations `0000` through `0016`
(`0016_new_black_tom`, 2026-05-16) — identical names, identical content. Sharkord
v0.0.22 and v0.0.23 both stop exactly there, which is why they migrate cleanly:
Bullshark simply applies its own `0017`…`0029` on top.

From `0017` on, the two projects reused **the same numbers for different
migrations**:

**FR** — Les deux projets partagent les migrations `0000` à `0016`
(`0016_new_black_tom`, 2026-05-16) — noms identiques, contenu identique. Sharkord
v0.0.22 et v0.0.23 s'arrêtent exactement là, d'où une migration propre :
Bullshark applique simplement ses `0017`…`0029` par-dessus.

À partir de `0017`, les deux projets ont réutilisé **les mêmes numéros pour des
migrations différentes** :

| #       | Bullshark                        | Sharkord                                        |
| ------- | -------------------------------- | ----------------------------------------------- |
| 0016    | `new_black_tom` (2026-05-16)     | `new_black_tom` (2026-05-16) — same / identique |
| 0017    | `dizzy_blizzard` (2026-06-01)    | `banner_color_to_profile_color` (2026-08-06)    |
| 0018    | `material_puppet_master`         | `message_parent_reply_foreign_keys`             |
| …       | …                                | …                                               |
| 0029    | `panoramic_payback` (2026-10-01) | `oidc_flow_storage` (2026-08-30)                |
| 0030–35 | —                                | `plugin_*`, `grant_send_voice_reaction`         |

### Why it fails silently / Pourquoi l'échec est silencieux

**EN** — Drizzle's SQLite migrator does not compare hashes of what was already
applied. It reads **one row** — the most recent — and applies every migration
dated after it (`sqlite-core/dialect.cjs`, drizzle-orm 0.44.7):

**FR** — Le migrateur SQLite de drizzle ne compare aucun hash de ce qui a déjà
été appliqué. Il lit **une seule ligne** — la plus récente — et applique tout ce
qui est daté après (`sqlite-core/dialect.cjs`, drizzle-orm 0.44.7) :

```js
SELECT id, hash, created_at FROM __drizzle_migrations ORDER BY created_at DESC LIMIT 1
if (!lastDbMigration || Number(lastDbMigration[2]) < migration.folderMillis) { /* apply */ }
```

**EN** — So on a Sharkord v0.0.27 database, the latest applied migration is dated
2026-09-04. Bullshark then skips every one of its own migrations older than that
date — `0017` (2026-06-01) through `0026` (2026-08-08), **ten migrations, with no
error and no log line** — and applies only `0027`, `0028` and `0029` on top of a
schema they were never written for. You get a server that starts and is wrong.

**FR** — Donc sur une base Sharkord v0.0.27, la dernière migration appliquée date
du 2026-09-04. Bullshark saute alors toutes ses propres migrations antérieures à
cette date — `0017` (2026-06-01) à `0026` (2026-08-08), **dix migrations, sans
erreur et sans ligne de log** — et n'applique que `0027`, `0028` et `0029` sur un
schéma pour lequel elles n'ont jamais été écrites. Tu obtiens un serveur qui
démarre et qui est faux.

### Check your version / Vérifie ta version

```bash
# the image tag your stack runs / le tag de l'image que ta stack utilise
grep -i 'image:.*sharkord' docker-compose.yml

# the decisive number: how many migrations the database has applied
# le chiffre décisif : combien de migrations la base a appliquées
sqlite3 /opt/sharkord/data/db.sqlite \
  "select count(*) from __drizzle_migrations;"
```

**EN** — **17 is the only safe answer.** Anything higher means you are past the
shared chain: **stop here**, keep your backup, and open an issue with that count
and your version. Do not improvise — restoring a silently corrupted schema costs
far more than waiting for a supported path.

**FR** — **17 est la seule réponse sûre.** Tout chiffre supérieur signifie que tu
es au-delà de la chaîne commune : **arrête-toi ici**, garde ta sauvegarde, et
ouvre une issue avec ce nombre et ta version. N'improvise pas — restaurer un
schéma corrompu en silence coûte bien plus cher que d'attendre un chemin
supporté.

---

## 2. Back up / Sauvegarder

**EN** — Everything that is state lives in the data directory. Nothing outside it
needs saving. Stop the stack first: a SQLite file copied while the server writes
to it is not a backup.

**FR** — Tout ce qui est état vit dans le répertoire de données. Rien en dehors
n'a besoin d'être sauvegardé. Arrête la stack d'abord : un fichier SQLite copié
pendant que le serveur écrit dedans n'est pas une sauvegarde.

```bash
docker compose down
tar czf ~/sharkord-backup-$(date +%F).tar.gz -C /opt/sharkord data
```

**EN** — Verify the archive is not empty before continuing:

**FR** — Vérifie que l'archive n'est pas vide avant de continuer :

```bash
tar tzf ~/sharkord-backup-$(date +%F).tar.gz | head
```

---

## 3. Point Bullshark at the existing data / Pointer Bullshark sur les données existantes

**EN** — The directory layout is unchanged between the two projects:

**FR** — La structure du répertoire est identique entre les deux projets :

```
db.sqlite      the whole database / toute la base
public/        served uploads / fichiers servis
uploads/ tmp/  upload staging / fichiers en transit
logs/
interface/<server version>/
drizzle/       migrations
mediasoup/     the worker binary / le binaire du worker
plugins/
tls/           cert.pem, key.pem
config.ini
```

**EN** — So you keep the same host directory. Build the Bullshark image and mount
that directory where Bullshark expects its data. There is no pre-built image to
pull — you build it from source, which is what the maintainer's own production
deployment does:

**FR** — Tu gardes donc le même répertoire hôte. Construis l'image Bullshark et
monte ce répertoire là où Bullshark attend ses données. Il n'y a pas d'image
pré-construite à télécharger — tu la construis depuis les sources, c'est ce que
fait le déploiement en production du mainteneur :

```bash
git clone https://codeberg.org/The_Neckript/bullshark.git
cd bullshark
docker build -t bullshark:local .
```

```yaml
services:
  bullshark:
    image: bullshark:local
    volumes:
      # your existing data, at Bullshark's default path
      # tes données existantes, au chemin par défaut de Bullshark
      - /opt/sharkord/data:/home/bun/.config/bullshark
    ports:
      - "127.0.0.1:4991:4991" # web/API — reachable by Caddy only / joignable par Caddy seul
      - "40000:40000/tcp" # WebRTC — public
      - "40000:40000/udp" # WebRTC — public
```

**EN** — Mounting at `/home/bun/.config/bullshark` means you need no data-path
variable at all: that is where Bullshark resolves its data directory in
production. If you would rather mount somewhere else, set `BULLSHARK_DATA_PATH`
to that path instead.

**FR** — Monter sur `/home/bun/.config/bullshark` t'évite toute variable de
chemin : c'est là que Bullshark résout son répertoire de données en production.
Si tu préfères monter ailleurs, définis plutôt `BULLSHARK_DATA_PATH` sur ce
chemin.

**EN** — Bullshark still reads `SHARKORD_DATA_PATH` as a fallback, with a warning
in the logs, so an untouched deployment does not wake up on an empty directory.
That fallback exists to stop you losing data on the first boot, not to be kept —
drop it once the mount above is in place.

**FR** — Bullshark lit encore `SHARKORD_DATA_PATH` en repli, avec un
avertissement dans les logs, pour qu'un déploiement laissé tel quel ne redémarre
pas sur un répertoire vide. Ce repli existe pour t'éviter de perdre tes données
au premier démarrage, pas pour être conservé — supprime-le une fois le montage
ci-dessus en place.

---

## 4. Rename your environment variables / Renommer tes variables d'environnement

**EN** — Every variable was renamed from `SHARKORD_` to `BULLSHARK_`. **Only
`SHARKORD_DATA_PATH` kept a compatibility fallback.** Every other `SHARKORD_*`
variable is read by nothing at all — no error, no warning, no log line. A server
carried over without this step runs with settings that silently never apply.

**FR** — Toutes les variables ont été renommées de `SHARKORD_` vers
`BULLSHARK_`. **Seule `SHARKORD_DATA_PATH` a conservé une reprise de l'ancien
nom.** Toute autre variable `SHARKORD_*` n'est lue par rien — pas d'erreur, pas
d'avertissement, pas de ligne de log. Un serveur repris sans cette étape tourne
avec des réglages qui ne s'appliquent jamais, en silence.

| Sharkord                            | Bullshark                            |
| ----------------------------------- | ------------------------------------ |
| `SHARKORD_DATA_PATH`                | `BULLSHARK_DATA_PATH`                |
| `SHARKORD_PORT`                     | `BULLSHARK_PORT`                     |
| `SHARKORD_WEBRTC_PORT`              | `BULLSHARK_WEBRTC_PORT`              |
| `SHARKORD_WEBRTC_ANNOUNCED_ADDRESS` | `BULLSHARK_WEBRTC_ANNOUNCED_ADDRESS` |
| `SHARKORD_WEBRTC_MAX_BITRATE`       | `BULLSHARK_WEBRTC_MAX_BITRATE`       |
| `SHARKORD_TLS_MODE`                 | `BULLSHARK_TLS_MODE`                 |
| `SHARKORD_TRUST_PROXY`              | `BULLSHARK_TRUST_PROXY`              |
| `SHARKORD_AUTOUPDATE`               | `BULLSHARK_AUTOUPDATE`               |
| `SHARKORD_MARKETPLACE_REGISTRY_URL` | `BULLSHARK_MARKETPLACE_REGISTRY_URL` |
| `SHARKORD_DEBUG`                    | `BULLSHARK_DEBUG`                    |

**EN** — The rename is a plain prefix swap, so this catches the leftovers:

**FR** — Le renommage est un simple échange de préfixe, donc ceci attrape les
oubliés :

```bash
grep -c '^SHARKORD_' .env # anything but 0 is dead config / autre chose que 0 = réglage mort
sed -i 's/^SHARKORD_/BULLSHARK_/' .env
```

---

## 5. Start and verify / Démarrer et vérifier

**EN** — Migrations run on their own at boot, against your existing database.

**FR** — Les migrations se lancent seules au démarrage, sur ta base existante.

```bash
docker compose up -d
docker compose logs -f
```

Three things to confirm / Trois choses à confirmer :

1. **EN** — No migration error in the logs, and the server reaches the line that
   says it is listening.
   **FR** — Aucune erreur de migration dans les logs, et le serveur atteint la
   ligne qui dit qu'il écoute.
2. **EN** — No `SHARKORD_DATA_PATH` deprecation warning. If you see one, step 3
   did not take.
   **FR** — Aucun avertissement de dépréciation sur `SHARKORD_DATA_PATH`. Si tu
   en vois un, l'étape 3 n'a pas pris.
3. **EN** — Log in with an existing account and open a channel that had history.
   Messages, uploads and roles are all in the database you kept.
   **FR** — Connecte-toi avec un compte existant et ouvre un salon qui avait de
   l'historique. Messages, fichiers et rôles sont tous dans la base que tu as
   gardée.

**EN** — If the boot fails, restore and nothing is lost:

**FR** — Si le démarrage échoue, restaure et rien n'est perdu :

```bash
docker compose down
rm -rf /opt/sharkord/data
tar xzf ~/sharkord-backup-<date>.tar.gz -C /opt/sharkord
```

---

## 6. What does not carry over / Ce qui ne suit pas

**EN** — Two things are not in the data directory and do not migrate.

**FR** — Deux choses ne sont pas dans le répertoire de données et ne migrent pas.

**Browser storage / Stockage du navigateur.** Storage keys were renamed along
with everything else, so each user's browser forgets its local preferences and
session. Everyone logs in again once. Nothing server-side is affected. / Les clés
de stockage ont été renommées comme le reste, donc le navigateur de chaque
utilisateur oublie ses préférences locales et sa session. Chacun se reconnecte
une fois. Rien côté serveur n'est touché.

**Sharkord plugins / Les plugins Sharkord.** The plugin ABI is a set of browser
globals, renamed from `window.__SHARKORD_*` to `window.__BULLSHARK_*`. A plugin
built against Sharkord will not find what it expects and will not load. Files
left in `plugins/` are inert, not harmful — reinstall from the Bullshark
marketplace. / L'ABI des plugins est un jeu de globales de navigateur, renommées
de `window.__SHARKORD_*` vers `window.__BULLSHARK_*`. Un plugin construit pour
Sharkord ne trouve pas ce qu'il attend et ne se charge pas. Les fichiers restés
dans `plugins/` sont inertes, pas nuisibles — réinstalle depuis la marketplace
Bullshark.

---

## 7. Next / Ensuite

**EN** — Your instance is now a Bullshark instance. For HTTPS, DNS and the
provider-specific setup, see
[`dns-providers.md`](dns-providers.md) and
[`getting-started.md`](getting-started.md) section 3.

**FR** — Ton instance est maintenant une instance Bullshark. Pour HTTPS, le DNS
et la configuration par hébergeur, voir
[`dns-providers.md`](dns-providers.md) et
[`getting-started.md`](getting-started.md) section 3.
