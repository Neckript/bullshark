# Chantier A — Effacer Sharkord

Bullshark est un fork de Sharkord (point de fork `d8def12`, 2026-05-22, Sharkord
v0.0.22). Ce chantier supprime toute trace de Sharkord : les dépendances réseau,
les identifiants, les chemins, les clés de stockage et les liens.

Un second chantier suivra — **chantier B, la chaîne d'outils de plugins** : forks
de `plugin-builder` et `plugin-example`, distribution du SDK, et contrat de
compatibilité par capacités déclarées. Il est séparé parce qu'il crée du code
neuf dans de nouveaux dépôts, là où celui-ci ne fait que transformer l'existant.

---

## Le problème

Une revue du code menée le 2026-08-31 a établi cinq faits vérifiés.

**1. La marketplace repose entièrement sur Sharkord.**
`packages/shared/src/plugins/marketplace.ts:4` code en dur
`https://raw.githubusercontent.com/Sharkord/plugins/refs/heads/main/plugins.json`.
Cette URL est consommée aux deux bouts : le client pour afficher le catalogue
(`marketplace/hooks.ts:23`) et le serveur pour résoudre la version à installer
(`helpers/marketplace.ts:12`). Le badge « vérifié » montré à l'utilisateur est
le champ `verified` de leur JSON : c'est Sharkord qui décide de ce que les
utilisateurs de Bullshark voient comme sûr.

**2. Le JSON du registre n'est jamais validé.** Les deux consommateurs font
`(await response.json()) as TMarketplaceEntry[]` — un transtypage, pas une
vérification. Le `checksum` est bien contrôlé après téléchargement
(`helpers/downloads.ts:78`), mais il provient du registre lui-même : qui
contrôle le registre contrôle les deux.

**3. Chaque navigateur d'utilisateur appelle GitHub directement.** Ouvrir
l'onglet marketplace fait partir une requête depuis le poste de l'utilisateur
vers `raw.githubusercontent.com`, révélant son adresse IP à un tiers.

**4. Une énumération de comptes est ouverte sur l'écran de connexion.**
`apps/server/src/http/login.ts` renvoie `Invalid password` sur le champ
`password` (ligne 260) quand l'identité existe, et une erreur sur le champ
`identity` quand elle n'existe pas (ligne 168). Le temps de réponse diffère
aussi : le chemin « identité inconnue » ne fait aucun hachage argon2. L'amont a
corrigé cela le 2026-07-04 (`c786521`) ; Bullshark ne l'a jamais repris.

**5. Le nom Sharkord est partout.** 510 imports `@sharkord/shared`, 181
`@sharkord/ui`, 16 variables d'environnement, 7 globales de navigateur, 36 clés
de stockage, les répertoires de données, les noms des binaires compilés, et des
liens qui envoient les utilisateurs de Bullshark ouvrir des issues chez un autre
projet.

---

## Objectifs

1. Le mot `sharkord` n'apparaît plus nulle part dans le dépôt, à une exception
   près, ci-dessous.
2. Aucun code de Bullshark n'appelle une infrastructure Sharkord à l'exécution.
3. Le navigateur de l'utilisateur ne contacte plus l'hôte du registre : le
   serveur seul le fait, et valide ce qu'il reçoit.
4. L'énumération de comptes est fermée, avec des tests.
5. **Aucune donnée n'est perdue** : ni la configuration des serveurs déployés,
   ni les préférences des utilisateurs dans leur navigateur.

### La seule exception, et elle n'est pas négociable

`LICENSE` porte `Copyright (c) 2025 Sharkord Team`. **Cette ligne reste.** La
licence MIT sous laquelle Bullshark a hérité de ce code exige que la mention de
copyright soit conservée dans toute copie. La retirer rendrait la distribution
de Bullshark illicite. L'indépendance technique est totale ; l'attribution
légale ne s'efface pas.

C'est la seule occurrence de « Sharkord » qui subsistera dans le dépôt.

### Hors périmètre

- La chaîne d'outils de plugins (chantier B).
- Le contrat de compatibilité par capacités (chantier B) : ce chantier laisse
  `PLUGIN_SDK_VERSION = 1`.
- Les 25 autres commits amont non repris. Seul le correctif d'énumération est
  rapatrié, parce qu'il concerne un serveur en production.

---

## Architecture

### S1 — Le correctif de sécurité, en premier

**Cette étape passe avant le renommage, et l'ordre n'est pas négociable.** Une
fois `@sharkord/*` renommé, tout rapatriement depuis l'amont devient un exercice
de résolution de conflits sur des centaines de fichiers. Ce correctif se reprend
proprement aujourd'hui ; demain, non.

Reprise adaptée de `c786521` — reprise manuelle et non `cherry-pick`, le fichier
ayant divergé (Bullshark porte un contrôle « identité réservée » absent de
l'amont). Trois changements dans `apps/server/src/http/login.ts` :

1. Un message unique `Invalid credentials`, porté par le champ `identity`, pour
   « identité inconnue » comme pour « mot de passe faux ». Aujourd'hui les deux
   diffèrent par le message **et** par le champ visé.
2. Sur le chemin « identité inconnue », vérifier argon2 contre un condensat
   factice calculé une fois et mémorisé, pour que les deux chemins prennent le
   même temps. Sans cela le message unique ne sert à rien : le chronomètre
   répond à sa place.
3. Déplacer le contrôle `existingUser.banned` **après** la vérification du mot de
   passe. Il est aujourd'hui avant (ligne 217) : un attaquant qui soumet un mot
   de passe quelconque distingue « banni » de « inexistant », ce qui rétablit à
   lui seul l'énumération que les deux premiers points ferment.

Le message « identité réservée » (ligne 129) reste : il concerne des noms
réservés connus de tous et ne révèle l'existence d'aucun compte.

La tentative sur identité inconnue est journalisée avec l'IP, comme l'amont.

### S2 — Le registre devient une ressource du serveur

Client et serveur récupèrent aujourd'hui le registre chacun de leur côté, avec
deux implémentations de la même chose. Le client passe à une procédure tRPC ; le
serveur devient le seul à parler à l'hôte du registre.

`apps/server/src/helpers/marketplace.ts` est réécrit :

```
fetchMarketplaceRegistry(options?: { refresh?: boolean })
  - lit l'URL depuis la configuration
  - URL vide  -> rend [] sans requête (marketplace désactivée)
  - requête HTTP ; échec -> erreur explicite
  - valide chaque entrée avec zod ; les invalides sont écartées avec un
    avertissement au journal, les valides sont rendues
  - un corps qui n'est pas un tableau -> erreur explicite
  - mémorise le résultat 5 minutes ; refresh:true ignore le cache

fetchMarketplaceVersion(pluginId, version)   // signature inchangée
  - s'appuie sur fetchMarketplaceRegistry()
```

Le cache existe parce que le client refait la requête à chaque montage de
l'onglet, et que `install` et `update` la refont encore.

Nouvelle procédure `plugins.getMarketplace` dans
`apps/server/src/routers/plugins/get-marketplace.ts`, calquée sur
`install-plugin.ts` : `protectedProcedure`,
`ctx.needsPermission(Permission.MANAGE_PLUGINS)`, entrée `{ refresh?: boolean }`,
rend `TMarketplaceEntry[]`. La marketplace est déjà une vue d'administration :
aucun accès n'est élargi. Le bouton « rafraîchir » existant envoie
`refresh: true` — c'est le seul moyen de vider le cache.

Dans `packages/shared/src/plugins/marketplace.ts`, les types `TMarketplace*`
deviennent des schémas zod dont les types sont dérivés (le paquet utilise déjà
zod dans `plugins/index.ts`). La constante `MARKETPLACE_REGISTRY_URL` disparaît :
l'URL n'est plus une constante partagée mais une donnée de configuration du
serveur.

Côté client, `marketplace/hooks.ts` remplace son `fetch` par la requête tRPC. Le
tri des versions et la recherche restent côté client, inchangés.

**Configuration.** Ajout dans `zConfig` (`apps/server/src/config.ts`) :

```
plugins: z.object({
  marketplaceRegistryUrl: z.string()   // '' = marketplace désactivée
})
```

Défaut : `https://codeberg.org/The_Neckript/bullshark-plugins/raw/branch/main/plugins.json`
(forme d'URL brute de Codeberg vérifiée : HTTP 200, `text/plain`). Surcharge
d'environnement `BULLSHARK_MARKETPLACE_REGISTRY_URL`.

Le dépôt `bullshark-plugins` est créé par l'utilisateur sur Codeberg et GitHub.
Il contient `plugins.json` valant `[]` et un `README.md` décrivant le format
d'une entrée. Le format reste celui d'aujourd'hui (`plugin` + `versions[]`),
pour que le chantier B n'ait pas à le redéfinir.

Tant que ce fichier vaut `[]`, la marketplace s'affiche vide. C'est l'état
attendu jusqu'au chantier B.

### S3 — Le renommage, par catégorie

| Catégorie | Occurrences | De → vers |
| --- | --- | --- |
| Paquets de l'espace de travail | ~700 | `@sharkord/{shared,ui,plugin-sdk,server,scripts,e2e}` → `@bullshark/…` |
| Globales du navigateur (ABI) | 7 | `window.__SHARKORD_*` → `window.__BULLSHARK_*` |
| Variables d'environnement | 16 | `SHARKORD_*` → `BULLSHARK_*` |
| Clés de stockage navigateur | 36 | `sharkord-*` → `bullshark-*` |
| Noms de travailleurs audio | 2 | `sharkord-noise-gate`, `sharkord-audio-meter` |
| Répertoire de données | 3 | `…/sharkord` → `…/bullshark` |
| Binaires compilés | 5 | `sharkord-linux-x64`… → `bullshark-…` |
| Identifiants internes | ~16 | `diskSharkordUsed`, `sharkordUsedSpace`, `TSharkordState` |
| Action CI | 1 dossier | `.github/actions/build-sharkord` → `build-bullshark` |
| Liens et documentation | ~25 | voir S6 |

Le renommage des paquets et des identifiants internes est mécanique et sans
risque : le typage et les tests le prouvent. **Les quatre catégories qui
demandent autre chose qu'un remplacement de texte sont traitées ci-dessous.**

Les globales `window.__SHARKORD_*` sont l'interface binaire des plugins : les
bundles publiés contiennent ces noms en dur. Les renommer casse tout plugin
existant. C'est accepté et voulu — le registre Bullshark démarre vide, il n'y a
aucun plugin à préserver, et le chantier B reconstruit la chaîne d'outils aux
nouveaux noms.

### S4 — Migration des données du serveur

`apps/server/src/helpers/paths.ts` calcule le répertoire de données. En
production c'est `getAppDataPath()/sharkord` ; il devient
`getAppDataPath()/bullshark`.

Au démarrage, avant toute lecture : si le nouveau répertoire n'existe pas et que
l'ancien existe, renommer l'ancien en nouveau, et le journaliser. Un seul essai,
jamais de fusion — si les deux existent, le nouveau fait autorité et l'ancien est
laissé intact, à charge de l'administrateur de trancher.

`SHARKORD_DATA_PATH` devient `BULLSHARK_DATA_PATH`. L'ancienne variable est
encore lue **pendant cette version seulement**, avec un avertissement au
journal ; sans cela, tout déploiement qui la définit se réveillerait sur une base
vide.

### S5 — Le piège Docker, à ne pas manquer

`Dockerfile:24` crée `/home/bun/.config/sharkord` et `docker-entrypoint.sh:4`
pose `DATA_DIR="/home/bun/.config/sharkord"`. Les deux deviennent `bullshark`.

**Danger :** si un déploiement monte un volume **sur ce chemin précis**, la
migration automatique de S4 déplacerait les données de l'intérieur du volume
vers un répertoire du conteneur, qui disparaît au redémarrage suivant. Les
données seraient perdues sans erreur visible.

Le chantier ne peut pas deviner la forme du `docker-compose.yml` de chaque
déploiement. Il fournit donc :

- la migration automatique, qui couvre le cas d'un volume monté sur le parent
  (`/home/bun/.config`) — le cas sain ;
- une note de version explicite : **vérifier son `docker-compose.yml` avant de
  monter en version**, et si le volume vise `/home/bun/.config/sharkord`,
  changer la cible en `/home/bun/.config/bullshark` **avant** de démarrer le
  nouveau conteneur ;
- un refus de démarrer avec un message clair si le nouveau répertoire est vide
  alors qu'un ancien répertoire non vide existe **et** n'est pas inscriptible —
  c'est la signature exacte d'un volume mal ciblé.

### S6 — Migration du stockage navigateur

36 clés `sharkord-*` deviennent `bullshark-*`. Sans migration, chaque
utilisateur perd ses préférences et sa session au premier chargement.

Au démarrage du client, une fois et avant toute lecture : pour chaque clé de
`LocalStorageKey`, si la clé `bullshark-*` est absente et que la `sharkord-*`
existe, recopier la valeur puis supprimer l'ancienne. `VITE_UI_THEME` n'est pas
concernée, elle n'a jamais porté le préfixe.

La migration est idempotente et se fait en une passe. Elle est écrite dans un
module à part avec ses propres tests, pas dispersée dans les appelants.

### S7 — Liens et documentation

| Fichier | Aujourd'hui | Devient |
| --- | --- | --- |
| `screens/connect/index.tsx` | `github.com/Sharkord/sharkord` | `codeberg.org/The_Neckript/bullshark` |
| `error-boundary/global-error-boundary.tsx` | `…/sharkord/issues` | `codeberg.org/The_Neckript/bullshark/issues` |
| `dialogs/plugin-install-confirm/index.tsx` | `sharkord.com/docs/plugins/security` | `codeberg.org/The_Neckript/bullshark/src/branch/main/docs/plugins/security.md` |
| `packages/plugin-sdk/README.md` | `sharkord.com/docs/plugins/overview` | `…/docs/plugins/overview.md` |
| `.github/ISSUE_TEMPLATE/question.yml` | `sharkord.com/docs/common-questions` | `codeberg.org/The_Neckript/bullshark` |
| `README.md`, `CONTRIBUTING.md`, workflows CI | `github.com/Sharkord/sharkord` | dépôt Bullshark |

Bullshark n'a pas de site de documentation. `docs/plugins/security.md` et
`docs/plugins/overview.md` sont **écrits dans ce chantier** — courts mais réels.
Un lien qui promet une page de sécurité et n'en montre aucune est pire que pas de
lien.

---

## Ordre d'exécution

1. **S1**, le correctif de sécurité, seul et commité seul — pendant que le
   rapatriement amont est encore possible.
2. **S2**, le registre. Il touche des fichiers que S3 va renommer ; le faire
   avant évite de réécrire du code déjà renommé.
3. **S6** et **S4**, les deux migrations, écrites et testées **avant** le
   renommage qui les rend nécessaires. Une migration livrée après la rupture
   qu'elle répare n'a jamais servi à personne.
4. **S3**, le renommage, catégorie par catégorie, une catégorie par commit.
5. **S5** et **S7**, Docker et les liens.
6. La note de version, qui reprend l'avertissement Docker mot pour mot.

---

## Tests

Le dépôt teste avec `bun test`. Chaque point est un test qui échoue avant le
changement.

**Connexion** — en miroir des tests amont, adaptés à notre fichier
- identité inconnue et mot de passe faux rendent le même message sur le même champ
- un compte banni ne se distingue pas d'un compte inexistant tant que le mot de
  passe est faux
- un compte banni avec le **bon** mot de passe rend bien le message de bannissement
- les tests existants de `login.test.ts` passent toujours

**Registre**
- URL vide → `[]`, aucune requête émise
- réponse non-OK → erreur explicite
- corps qui n'est pas un tableau → erreur explicite
- entrée invalide écartée, entrées valides rendues
- deux appels rapprochés → une seule requête HTTP
- `refresh: true` → nouvelle requête
- `BULLSHARK_MARKETPLACE_REGISTRY_URL` prend le pas sur `config.ini`

**Migration du stockage navigateur**
- une clé ancienne seule est recopiée puis supprimée
- une clé nouvelle déjà présente n'est pas écrasée par l'ancienne
- deux exécutions successives donnent le même état (idempotence)
- une clé absente des deux côtés ne crée rien

**Migration des données serveur**
- ancien répertoire seul → renommé, journalisé
- les deux présents → le nouveau est gardé, l'ancien intact, aucun écrasement
- aucun des deux → création normale
- `SHARKORD_DATA_PATH` encore honorée, avec avertissement

**Renommage**
- `grep -ri sharkord` sur le dépôt ne rend plus que la ligne du `LICENSE`
- les portes existantes passent : typecheck, lint, tests, build

---

## Risques

**La marketplace sera vide.** C'est le choix assumé. Tant que le chantier B n'a
pas livré la chaîne d'outils, personne ne peut y ajouter quoi que ce soit. Si
cette période doit durer, mieux vaudra masquer l'onglet que montrer une vitrine
vide — décision à prendre au chantier B, pas ici.

**Aucun plugin existant ne fonctionnera plus.** Conséquence directe du
renommage de l'ABI. Aucun plugin n'est installé sur le serveur de référence ;
à vérifier avant de monter en version sur tout autre déploiement.

**Rapatrier de l'amont devient impraticable.** Après ce chantier, un
`cherry-pick` depuis Sharkord touchera des chemins et des identifiants qui
n'existent plus. C'est le prix de l'indépendance, accepté. C'est pour cela que
le correctif de sécurité passe en premier.

**Le serveur devient un relais pour les métadonnées de plugins.** Un serveur
sans accès sortant n'a plus de marketplace, là où le navigateur pouvait
auparavant y arriver seul. Le compromis est bon : ce serveur ne pourrait pas
télécharger les plugins non plus.

**Les messages d'erreur de connexion changent, et rien ne les traduit.** Ce sont
des chaînes anglaises produites par le serveur (`HttpValidationError`) que le
client affiche telles quelles — `screens/connect/index.tsx:82` range
`data.errors` dans son état sans passer par `t()`. Les sept locales ne les
couvrent pas aujourd'hui et ne les couvriront pas davantage après. Limite
existante, notée ici pour qu'on ne la redécouvre pas ; la corriger est un autre
chantier.
