# Chantier A — Couper le cordon réseau avec Sharkord

Premier des trois chantiers qui rendent Bullshark indépendant de Sharkord, dont
il est un fork (point de fork : `d8def12`, 2026-05-22, Sharkord v0.0.22).

- **Chantier A (cette spec)** — supprimer toute dépendance réseau à
  l'infrastructure Sharkord, et reprendre le correctif de sécurité amont.
  **Aucun renommage**, pour que rapatrier de l'amont reste possible pendant ce
  chantier.
- **Chantier B (à venir)** — le renommage : `@sharkord/*` → `@bullshark/*`,
  globales `window.__SHARKORD_*`, variables `SHARKORD_*`, clés de stockage,
  répertoire de configuration, noms des binaires.
- **Chantier C (à venir)** — la chaîne d'outils : forks de `plugin-builder` et
  `plugin-example`, distribution du SDK, contrat de compatibilité par capacités.

---

## Le problème

Une revue du code menée le 2026-08-31 a établi trois faits vérifiés.

**1. La marketplace repose entièrement sur Sharkord.**
`packages/shared/src/plugins/marketplace.ts:4` code en dur
`https://raw.githubusercontent.com/Sharkord/plugins/refs/heads/main/plugins.json`.
Cette URL est consommée aux deux bouts : le client pour afficher le catalogue
(`marketplace/hooks.ts:23`) et le serveur pour résoudre la version à installer
(`helpers/marketplace.ts:12`). Le badge « vérifié » affiché à l'utilisateur est
le champ `verified` de leur JSON : c'est Sharkord qui décide de ce que les
utilisateurs de Bullshark voient comme sûr. Si leur dépôt change de forme ou
disparaît, la marketplace tombe sans repli.

**2. Le JSON du registre n'est jamais validé.** Les deux consommateurs font
`(await response.json()) as TMarketplaceEntry[]` — un transtypage, pas une
vérification. Un registre malformé casse l'interface, et rien ne garantit la
forme des champs qui alimentent ensuite le téléchargement. Le `checksum` est
bien vérifié après téléchargement (`helpers/downloads.ts:78`), mais il provient
du registre lui-même : qui contrôle le registre contrôle les deux.

**3. Chaque navigateur d'utilisateur appelle GitHub directement.** Ouvrir
l'onglet marketplace fait partir une requête depuis le poste de l'utilisateur
vers `raw.githubusercontent.com`. Cela révèle à un tiers l'adresse IP de chaque
utilisateur de chaque serveur Bullshark, sans que personne l'ait choisi.

**4. Une énumération de comptes est ouverte sur l'écran de connexion.**
`apps/server/src/http/login.ts` renvoie une erreur sur le champ `password`
(`Invalid password`, ligne 260) quand l'identité existe, et une erreur portant
sur le champ `identity` quand elle n'existe pas (ligne 168). Le temps de réponse
diffère aussi : le chemin « identité inconnue » ne fait aucun hachage argon2. Un
attaquant énumère donc les comptes existants. L'amont a corrigé cela le
2026-07-04 (`c786521`) ; Bullshark ne l'a jamais repris.

Par ailleurs, `apps/client/src/screens/connect/index.tsx`,
`global-error-boundary.tsx`, `plugin-install-confirm/index.tsx` et
`packages/plugin-sdk/README.md` renvoient les utilisateurs vers
`sharkord.com` ou `github.com/Sharkord/sharkord` : un utilisateur de Bullshark
qui clique sur « signaler un problème » ouvre une issue chez un autre projet.

---

## Objectifs

À la fin de ce chantier :

1. Aucun code de Bullshark n'appelle une infrastructure Sharkord à l'exécution.
2. L'URL du registre est une donnée de configuration du serveur, pas une
   constante ; sa valeur par défaut est un dépôt Bullshark.
3. Le navigateur de l'utilisateur ne contacte plus jamais l'hôte du registre :
   le serveur seul le fait.
4. Le contenu du registre est validé avant d'être utilisé.
5. Un registre vide, injoignable ou malformé dégrade proprement — catalogue vide
   avec un message clair, jamais d'écran cassé.
6. L'énumération de comptes par l'écran de connexion est fermée, avec des tests.
7. Les liens visibles par l'utilisateur pointent vers Bullshark.
8. **Aucun identifiant `sharkord` n'est renommé** : ni les paquets, ni les
   globales, ni les variables d'environnement, ni les chemins.

### Hors périmètre, explicitement

- Tout renommage (chantier B) et toute migration de données associée.
- La chaîne d'outils de construction de plugins (chantier C).
- Le contrat de compatibilité par capacités (chantier C). Ce chantier laisse
  `PLUGIN_SDK_VERSION = 1` tel quel.
- Les 25 autres commits amont non repris. Seul le correctif d'énumération est
  rapatrié ici, parce qu'il concerne un serveur en production.
- La ligne `Copyright (c) 2025 Sharkord Team` du `LICENSE` : elle **reste**. La
  licence MIT l'exige, et l'indépendance technique n'efface pas l'attribution.

---

## Architecture

### A1 — Le registre devient une ressource du serveur

Aujourd'hui, client et serveur récupèrent le registre chacun de leur côté, avec
deux implémentations distinctes de la même chose. Le client passe à une
procédure tRPC ; le serveur devient le seul à parler à l'hôte du registre.

Nouveau module `apps/server/src/helpers/marketplace.ts`, réécrit :

```
fetchMarketplaceRegistry(): Promise<TMarketplaceEntry[]>
  - lit l'URL depuis la configuration
  - URL vide  -> rend [] sans requête (marketplace désactivée)
  - requête HTTP ; échec -> lève une erreur explicite
  - valide le corps avec un schéma zod ; invalide -> lève une erreur explicite
  - mémorise le résultat pendant 5 minutes

fetchMarketplaceVersion(pluginId, version)  // signature inchangée
  - s'appuie désormais sur fetchMarketplaceRegistry()
```

Le cache de 5 minutes existe parce que le client refait la requête à chaque
montage de l'onglet, et que `install` et `update` la refont encore. Sans lui, on
frappe l'hôte du registre plusieurs fois pour un seul geste de l'utilisateur.

Nouvelle procédure `plugins.getMarketplace`, dans
`apps/server/src/routers/plugins/get-marketplace.ts`, calquée sur
`install-plugin.ts` : `protectedProcedure`, `ctx.needsPermission(Permission.MANAGE_PLUGINS)`,
rend `TMarketplaceEntry[]`. La marketplace est déjà une vue d'administration :
elle n'élargit aucun accès.

Elle prend une seule entrée, `{ refresh?: boolean }`. À `true`, elle ignore le
cache et le remplit à nouveau — c'est ce que le bouton « rafraîchir » existant
de l'interface envoie. C'est le seul moyen de vider le cache : rien d'autre ne
l'expose.

Côté client, `marketplace/hooks.ts` remplace son `fetch` par cette requête tRPC.
Le tri des versions et la recherche restent côté client, inchangés.

### A2 — Le schéma de validation

Dans `packages/shared/src/plugins/marketplace.ts`, les types `TMarketplace*`
deviennent des schémas zod, et les types en sont dérivés. Le paquet dépend déjà
de zod (`packages/shared` l'utilise dans `plugins/index.ts`).

Une entrée invalide ne fait pas tomber tout le registre : les entrées sont
validées une par une, les invalides sont écartées avec un avertissement dans le
journal du serveur, et le reste s'affiche. Un registre entièrement illisible
(JSON invalide, ou pas un tableau) est une erreur, et l'interface montre son
message de repli existant `marketplaceFetchError`.

### A3 — L'URL devient configurable

Ajout dans `zConfig` (`apps/server/src/config.ts`) :

```
plugins: z.object({
  marketplaceRegistryUrl: z.string()   // '' = marketplace désactivée
})
```

Valeur par défaut :
`https://codeberg.org/The_Neckript/bullshark-plugins/raw/branch/main/plugins.json`
(forme d'URL brute de Codeberg vérifiée : HTTP 200, `text/plain`).

Surcharge d'environnement : `BULLSHARK_MARKETPLACE_REGISTRY_URL`, ajoutée à la
table de `applyEnvOverrides`. **Ce nouveau nom porte déjà le préfixe Bullshark**
alors que les six variables existantes gardent `SHARKORD_` : une variable neuve
n'a aucune compatibilité à préserver, et la renommer plus tard au chantier B
coûterait une migration pour rien. Le mélange est temporaire et assumé.

Un `marketplaceRegistryUrl` vide désactive la marketplace : `getMarketplace`
rend `[]`, et l'onglet affiche l'état vide existant. C'est l'état attendu tant
que le dépôt de registre n'a pas de contenu.

### A4 — Le dépôt de registre

Nouveau dépôt `bullshark-plugins`, sur Codeberg (`The_Neckript/bullshark-plugins`)
avec miroir GitHub, contenant :

- `plugins.json` — un tableau JSON vide au départ : `[]`
- `README.md` — le format d'une entrée et la marche à suivre pour proposer un
  plugin

Le format d'entrée reste celui d'aujourd'hui (`plugin` + `versions[]`), pour que
le chantier C n'ait pas à le redéfinir. Les binaires restent hébergés par les
auteurs, comme aujourd'hui ; le registre ne porte que des métadonnées et des
empreintes.

**Ce dépôt est créé à la main par l'utilisateur**, pas par le code : il faut un
compte Codeberg. La spec fournit le contenu exact des deux fichiers.

### A5 — Les liens visibles

| Fichier | Aujourd'hui | Devient |
| --- | --- | --- |
| `apps/client/src/screens/connect/index.tsx` | `github.com/Sharkord/sharkord` | `codeberg.org/The_Neckript/bullshark` |
| `apps/client/src/components/error-boundary/global-error-boundary.tsx` | `github.com/Sharkord/sharkord/issues` | `codeberg.org/The_Neckript/bullshark/issues` |
| `apps/client/src/components/dialogs/plugin-install-confirm/index.tsx` | `sharkord.com/docs/plugins/security` | `codeberg.org/The_Neckript/bullshark/src/branch/main/docs/plugins/security.md` |
| `packages/plugin-sdk/README.md` | `sharkord.com/docs/plugins/overview` | `codeberg.org/The_Neckript/bullshark/src/branch/main/docs/plugins/overview.md` |
| `.github/ISSUE_TEMPLATE/question.yml` | `sharkord.com/docs/common-questions` | `codeberg.org/The_Neckript/bullshark` (le dépôt ; Bullshark n'a pas de FAQ, et en inventer une n'est pas le sujet de ce chantier) |

Bullshark n'a pas de site de documentation. Les deux liens de documentation de
plugins pointeront vers des fichiers Markdown du dépôt, `docs/plugins/security.md`
et `docs/plugins/overview.md`, **à écrire dans ce chantier** — courts, mais
réels : un lien qui promet une page de sécurité et n'en montre aucune est pire
que pas de lien du tout.

Les mentions de `github.com/Sharkord/sharkord` dans `README.md`,
`CONTRIBUTING.md` et les workflows CI sont de la documentation de projet, pas
des liens montrés à l'utilisateur : elles sont corrigées aussi, mais elles ne
portent aucun risque.

### A6 — Le correctif d'énumération

Reprise adaptée de `c786521`. Le fichier de Bullshark a divergé (il porte un
contrôle « identité réservée » que l'amont n'a pas), donc c'est une reprise
manuelle, pas un `cherry-pick`.

Trois changements dans `apps/server/src/http/login.ts` :

1. Un message unique `Invalid credentials`, porté par le champ `identity`, pour
   les deux cas « identité inconnue » et « mot de passe faux ». Aujourd'hui les
   deux diffèrent par le message **et** par le champ visé.
2. Sur le chemin « identité inconnue », exécuter une vérification argon2 contre
   un condensat factice calculé une seule fois et mémorisé, afin que les deux
   chemins prennent le même temps. Sans cela, le message unique ne sert à rien :
   le chronomètre répond à sa place.
3. Déplacer le contrôle `existingUser.banned` **après** la vérification du mot
   de passe. Aujourd'hui il est avant (ligne 217) : un attaquant qui soumet un
   mot de passe quelconque distingue « compte banni » de « compte inexistant »,
   ce qui rétablit l'énumération que les deux premiers points viennent de
   fermer.

Le message « identité réservée » (ligne 129) reste tel quel : il concerne des
noms réservés connus de tous, il ne révèle l'existence d'aucun compte.

La tentative sur identité inconnue est journalisée avec l'IP, comme l'amont.

---

## Tests

Le dépôt teste avec `bun test`. Chaque point ci-dessous est un test qui échoue
avant le changement.

**Registre (serveur)**
- une URL vide rend `[]` sans faire aucune requête
- une réponse HTTP non-OK lève une erreur explicite
- un corps qui n'est pas un tableau lève une erreur explicite
- une entrée invalide est écartée, les entrées valides sont rendues
- deux appels rapprochés ne déclenchent qu'une seule requête HTTP (cache)
- `fetchMarketplaceVersion` trouve toujours la bonne version via le cache

**Configuration**
- `BULLSHARK_MARKETPLACE_REGISTRY_URL` prend le pas sur `config.ini`
- la valeur par défaut est l'URL Codeberg

**Connexion** — en miroir des tests amont, adaptés à notre fichier
- identité inconnue et mot de passe faux rendent le **même** message sur le
  **même** champ
- un compte banni ne se distingue pas d'un compte inexistant tant que le mot de
  passe est faux
- un compte banni avec le **bon** mot de passe rend bien le message de
  bannissement
- les tests existants de `login.test.ts` passent toujours

**Client**
- le crochet du marketplace passe par tRPC et ne fait plus de `fetch` direct

---

## Risques

**Le serveur devient un relais de téléchargement de métadonnées.** C'est voulu,
mais cela veut dire qu'un serveur Bullshark sans accès sortant n'a plus de
marketplace du tout, là où auparavant le navigateur de l'utilisateur pouvait y
arriver seul. C'est le bon compromis : la fuite d'IP de tous les utilisateurs
vers un tiers est un coût permanent, l'absence de marketplace sur un serveur
isolé est un cas rare et déjà à moitié cassé (le serveur ne pourrait pas
télécharger les plugins non plus).

**Le cache de 5 minutes retarde l'apparition d'un plugin fraîchement publié.**
Le bouton « rafraîchir » existant vide le cache, ce qui donne une porte de
sortie immédiate.

**La marketplace sera vide après ce chantier.** C'est le choix assumé
(registre propre, pas de reprise des plugins Sharkord). Tant que le chantier C
n'a pas livré la chaîne d'outils, personne ne peut y ajouter quoi que ce soit.
Si cette période doit durer, il vaudra mieux masquer l'onglet plutôt que de
montrer une vitrine vide — mais c'est une décision d'interface à prendre au
chantier C, pas ici.

**Le correctif de connexion change des messages d'erreur visibles.** Un
utilisateur qui se trompe de mot de passe verra désormais « Invalid credentials »
sur le champ identité, plus « Invalid password » sur le champ mot de passe.
C'est moins précis, et c'est exactement le but.

Il n'y a **rien à traduire** : ces messages sont des chaînes anglaises produites
par le serveur (`HttpValidationError`) que le client affiche telles quelles
(`screens/connect/index.tsx:82` range `data.errors` dans son état, sans passer
par `t()`). Les sept locales du client ne les couvrent pas aujourd'hui et ne les
couvriront pas davantage après. C'est une limite existante de l'écran de
connexion, notée ici pour qu'on ne la redécouvre pas ; la corriger est un autre
chantier.
