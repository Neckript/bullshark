# Chantier B — La chaîne d'outils de plugins

Le chantier A a coupé les liens avec Sharkord. Il a laissé derrière lui un
registre de plugins vide et, surtout, aucun moyen de le remplir : personne à
l'extérieur du monorepo ne peut écrire un plugin Bullshark aujourd'hui.

Ce chantier construit ce qui manque — la distribution du SDK, le builder, un
plugin d'exemple — et remplace le contrat de compatibilité par des capacités
déclarées, ce que le chantier A avait explicitement remis à plus tard.

---

## Le problème

Une revue du code et des dépôts amont menée le 2026-09-01 a établi six faits
vérifiés.

**1. Le SDK ne se distribue pas.** `packages/plugin-sdk/package.json` déclare
`"main": "src/index.ts"` et `"types": "src/index.ts"` : le paquet livre du
TypeScript brut. Il est référencé en `workspace:*` et n'a jamais été publié
nulle part. Écrire un plugin exige donc de cloner Bullshark en entier et de
travailler dans le monorepo. Aucun paquet du monorepo n'a d'étape de build —
tous sont consommés en source via la résolution workspace — donc construire le
SDK est de l'infrastructure entièrement nouvelle, pas l'activation d'un
mécanisme existant.

**2. npm ne sait pas installer depuis un sous-dossier d'un dépôt git.** Une
dépendance `git+https://codeberg.org/The_Neckript/bullshark.git` installerait le
monorepo complet, pas `packages/plugin-sdk`. Le SDK distribué doit vivre dans
son propre dépôt, quelle que soit la méthode de distribution retenue.

**3. Le builder amont est cassé pour Bullshark.**
`plugin-builder/src/helpers/bundle.ts` réécrit les imports React vers
`window.__SHARKORD_REACT__`, `__SHARKORD_REACT_JSX__`,
`__SHARKORD_REACT_DOM__`… Le chantier A a renommé ces globales en
`__BULLSHARK_*`. Tout plugin construit avec le builder amont produirait un
bundle client qui lit des globales inexistantes. C'est la conséquence directe et
attendue du renommage de l'ABI.

**4. Le schéma du manifest existe en trois copies tenues à la main.**
`packages/shared/src/plugins/index.ts` porte `zPluginManifest` ; le builder
amont en garde une copie dans `src/statics.ts`, avec deux commentaires qui
disent l'aveu : « this type should match with the one in sharkord » et « this
type should match with the one in the plugin registry repo ». Trois définitions
de la même chose, aucune vérification. Ajouter un champ au manifest — ce que ce
chantier va précisément faire — demande aujourd'hui trois modifications
coordonnées sans filet.

**5. Le SDK impose mediasoup à tous les auteurs.**
`packages/plugin-sdk/src/index.ts` réexporte douze types de `mediasoup/types`
(`Router`, `Producer`, `Transport`, `RtpParameters`…) et déclare `mediasoup` en
devDependency. mediasoup embarque un worker C++ compilé. Un auteur qui écrit un
plugin de chat, sans la moindre ligne de code vocal, devrait l'installer pour
que ses types résolvent.

**6. La compatibilité est un entier unique.** `PLUGIN_SDK_VERSION = 1`
(`packages/shared/src/plugins/index.ts:190`) est comparé en égalité stricte à
trois endroits : `apps/server/src/plugins/index.ts:194`, et
`marketplace-item.tsx:53` et `:66` côté client. Le moindre ajout au SDK oblige à
incrémenter cet entier, ce qui invalide d'un coup tous les plugins existants —
y compris ceux qui n'utilisent pas la partie modifiée.

Un septième point, mineur mais à corriger au passage : le builder amont exige
que **les deux** points d'entrée existent (`bundle.ts` lève si `src/server/index.ts`
ou `src/client/index.ts` manque), alors que le serveur et `docs/plugins/overview.md`
les traitent tous deux comme optionnels.

---

## Objectifs

1. Un auteur extérieur écrit, construit et installe un plugin sans jamais
   cloner Bullshark.
2. Le SDK est distribué en artefact construit et versionné, consommable en une
   ligne de `package.json`.
3. La compatibilité repose sur des capacités déclarées : un plugin ne casse que
   si la capacité précise qu'il utilise disparaît.
4. mediasoup n'est plus une dépendance obligatoire pour écrire un plugin.
5. Le schéma du manifest a **une** définition, celle du SDK, que le builder
   importe au lieu de la recopier.
6. Le registre `bullshark-plugins` reçoit sa première entrée réelle.

### Hors périmètre

- **Le bac à sable d'exécution.** Un plugin serveur tourne avec les droits du
  processus serveur. Les capacités déclarées de ce chantier restreignent la
  surface d'API offerte, pas les droits système : un plugin qui n'a pas déclaré
  `voice` n'a pas `ctx.voice`, mais il garde `fs`. C'est une amélioration réelle
  et une défense en profondeur, ce n'est pas un bac à sable, et
  `docs/plugins/security.md` doit continuer à le dire sans ambiguïté.
- **La signature cryptographique des plugins.** Le `checksum` du registre
  garantit l'intégrité du téléchargement, pas l'identité de l'auteur.
- **La publication sur npm.** Décision prise ci-dessous, et volontairement
  réversible.

---

## Architecture

### S1 — Rendre le SDK constructible

La surface runtime du SDK est minuscule, et c'est ce qui rend tout le reste
abordable. En dehors des types, `packages/plugin-sdk` n'exporte que :

- deux enums, `FileSaveType` et `PluginSlot` ;
- une constante, `PLUGIN_SDK_VERSION` ;
- trois fabriques, `createRegisterAction`, `createCallAction`,
  `createRegisterCommand`.

Tout le reste — `PluginContext`, `EventPayloads`, `ServerEvent`, les contrats
d'actions et de commandes — s'efface à la compilation. L'artefact construit sera
donc de l'ordre de quelques kilo-octets de JavaScript, plus un fichier de
déclarations.

Ajout d'un script `build` à `packages/plugin-sdk` :

```
bun build src/index.ts --outdir dist --format esm --target node --external mediasoup
tsc --emitDeclarationOnly --declaration --outDir dist
```

Deux contraintes qui ne sont pas négociables :

- **`@bullshark/shared` doit être inliné.** C'est une dépendance `workspace:*`
  qui ne résoudra jamais chez un auteur extérieur. Le bundle doit embarquer les
  enums qu'il en tire. Les types, eux, sont aplatis par `tsc` dans le `.d.ts`.
- **mediasoup reste externe** — voir S2 pour ce qu'on en fait.

### S2 — Détacher mediasoup

Les douze types mediasoup ne concernent que `ctx.voice`. Ils sortent de l'entrée
principale et passent dans un sous-chemin dédié :

```
@bullshark/plugin-sdk         -> aucune dépendance
@bullshark/plugin-sdk/voice   -> réexporte les types mediasoup
```

`mediasoup` devient une `peerDependency` **optionnelle**
(`peerDependenciesMeta: { mediasoup: { optional: true } }`). Un auteur de plugin
de chat ne l'installe pas et ne voit jamais d'erreur ; un auteur de plugin vocal
l'ajoute et importe depuis `/voice`.

`PluginContext.voice` conserve sa forme, mais ses types mediasoup sont référencés
par import de type depuis le sous-chemin. Un plugin qui ne déclare pas la
capacité `voice` ne reçoit de toute façon pas `ctx.voice` à l'exécution (S3),
donc l'absence des types ne le gêne pas.

### S3 — Les capacités déclarées

C'est le cœur du chantier, et le moment est le bon : le registre est vide, il
n'y a aucun plugin à migrer.

**Deux axes, pas un.** Remplacer purement et simplement `sdkVersion` serait une
erreur : deux choses distinctes peuvent casser indépendamment.

| | Ce que ça couvre | Quand ça bouge |
| --- | --- | --- |
| `sdkVersion` | Le **format** : nom du manifest, arborescence `server/index.js` + `client/index.js`, noms des globales `window.__BULLSHARK_*` | Très rarement. Le chantier A l'aurait incrémenté s'il y avait eu des plugins. |
| `capabilities` | La **surface d'API** : ce que `PluginContext` expose | À chaque évolution du SDK |

`sdkVersion` reste donc, mais rétréci à son vrai rôle et documenté comme tel. Il
garde la valeur `1`. `capabilities` porte désormais toute la compatibilité fine.

**Le manifest gagne un champ.** `zPluginManifest` (`packages/shared/src/plugins/index.ts`)
accueille :

```
capabilities: z.array(zCapability).default([])
```

Les capacités reprennent les espaces de noms de `PluginContext`, qui sont déjà
la bonne granularité :

```
events  actions  commands  messages  settings  data  ui
voice
hooks.onBeforeFileSave
client.slots
```

`voice` est isolée parce qu'elle est la seule à tirer une dépendance lourde.
`hooks.onBeforeFileSave` est nommée finement parce que chaque hook est un point
d'interception distinct, et qu'en ajouter un ne doit pas élargir rétroactivement
ce qu'un plugin existant peut intercepter. `client.slots` couvre le rendu de
composants React ; elle est la seule capacité côté client.

`logger`, `log`, `debug`, `error` et `path` ne sont pas des capacités : ils sont
toujours fournis, ne donnent accès à rien, et les exiger n'ajouterait que du
bruit dans chaque manifest.

**Le serveur applique le moindre privilège.**
`apps/server/src/plugins/index.ts` construit aujourd'hui un `PluginContext`
complet pour chaque plugin. Il construira désormais un contexte **restreint aux
capacités déclarées** : un plugin qui n'a pas déclaré `voice` n'a pas la
propriété `ctx.voice`. Ce n'est plus seulement une vérification de version,
c'est un modèle de permissions — et c'est ce qui justifie d'appeler ça des
capacités plutôt que des étiquettes.

Le serveur expose la liste de ce qu'il sait fournir. Au chargement,
`verifySdkVersion` est remplacé par `verifyCapabilities` :

- une capacité déclarée inconnue du serveur → refus, avec un message qui **nomme
  la capacité manquante** et non un numéro de version ;
- une capacité connue → la branche correspondante est ajoutée au contexte.

Côté client, `marketplace-item.tsx` remplace ses deux comparaisons
`sdkVersion === PLUGIN_SDK_VERSION` par la même vérification d'inclusion, et
affiche la capacité fautive plutôt qu'un « incompatible » opaque.

**Le registre suit.** `zMarketplacePluginVersion` gagne `capabilities`, pour que
la marketplace puisse filtrer avant téléchargement. Le format reste celui que le
chantier A a figé, augmenté d'un champ optionnel : les entrées sans
`capabilities` sont traitées comme n'en déclarant aucune.

### S4 — Le dépôt de distribution du SDK

`codeberg.org/The_Neckript/bullshark-plugin-sdk`, créé le 2026-09-01, branche
`main`.

**Le monorepo reste la source de vérité.** Le dépôt de distribution ne se
modifie jamais à la main : il reçoit le produit de `S1`, poussé par une étape de
CI, sur le modèle de ce que `release.yml` fait déjà pour le miroir Codeberg.

Il contient :

```
package.json      name: @bullshark/plugin-sdk, main: dist/index.js
dist/             le build committé
README.md         installation, exemple minimal, lien vers docs/plugins
LICENSE           MIT
```

**Le build est committé, et c'est délibéré.** Versionner un artefact de build
est normalement une mauvaise pratique. Ici c'est l'inverse : il s'agit d'un
dépôt de *distribution*, pas de développement. L'alternative — livrer les
sources avec un script `prepare` que npm exécute à l'installation d'une
dépendance git — fait dépendre chaque installation de plugin de la résolution
correcte des devDependencies du SDK, et échoue de façon opaque quand elle rate.
Un `dist/` de quelques kilo-octets, lisible en revue, coûte moins cher que ce
mode de panne.

**Consommation.** L'auteur écrit :

```json
"dependencies": {
  "@bullshark/plugin-sdk": "git+https://codeberg.org/The_Neckript/bullshark-plugin-sdk.git#v1.0.0"
}
```

Un tag par version, aligné sur la version du monorepo.

**Le coût, dit franchement.** Les plages sémantiques ne fonctionnent pas sur des
tags git : `^1.2.0` n'a pas de sens ici, les auteurs épinglent une version exacte
et mettent à jour à la main. C'est le vrai prix de ce choix. Il est accepté
parce qu'il n'y a aujourd'hui aucun auteur de plugin, et parce que la portée
`@bullshark` est libre sur npm (vérifié le 2026-09-01 : `@bullshark/plugin-sdk`
renvoie 404) — publier sur npm plus tard reste une étape de CI supplémentaire et
une ligne à changer chez les auteurs. On commence par l'option qu'on peut
quitter ; l'inverse casserait les installations existantes.

### S5 — Le builder

Fork de `Sharkord/plugin-builder` vers
`codeberg.org/The_Neckript/bullshark-plugin-builder`. Le fork est justifié
plutôt qu'une réécriture : `bundle.ts` encode une connaissance non triviale et
correcte du problème React (réécriture des imports bare vers les globales de
l'hôte, `process.env.NODE_ENV` forcé en production pour que le JSX passe par
`jsx/jsxs` et non `jsxDEV`).

Quatre changements :

1. **Les globales.** `__SHARKORD_*` → `__BULLSHARK_*` dans `bundle.ts`. Sans ça
   rien ne fonctionne.
2. **Le schéma cesse d'être recopié.** `src/statics.ts` supprime ses trois
   schémas dupliqués et importe `zPluginManifest` et `zMarketplacePluginVersion`
   depuis `@bullshark/plugin-sdk`. Le builder devient le premier consommateur
   externe du SDK — ce qui en fait aussi le premier test réel de sa
   distribution.
3. **La publication quitte GitHub.** `@octokit/rest`, `github-release.ts` et
   `resolve-github-repository.ts` sont remplacés par l'API Forgejo de Codeberg,
   déjà utilisée par `release.yml` du monorepo. La dépendance `@octokit/rest`
   disparaît.
4. **Les deux points d'entrée deviennent optionnels**, conformément au serveur
   et à `docs/plugins/overview.md`. Un plugin purement serveur ou purement
   client est légitime. Le builder refuse seulement le cas où *aucun* des deux
   n'existe.

Le builder valide aussi les `capabilities` du manifest contre la liste du SDK,
et échoue à la construction plutôt qu'à l'installation.

### S6 — Le plugin d'exemple

Fork de `Sharkord/plugin-example` vers
`codeberg.org/The_Neckript/bullshark-plugin-example`. Il porte déjà la structure
complète : `src/server`, `src/client` avec composants et store, `src/contracts`
pour les actions et commandes typées, `manifest.json`, `build.ts`, `publish.ts`.

Adaptations : dépendance au SDK distribué au lieu du workspace, `capabilities`
déclarées dans son `manifest.json`, globales renommées dans `src/global.d.ts`,
et publication via Codeberg.

Il devient le test de bout en bout du chantier : s'il se construit avec le
builder distribué, s'installe depuis le registre et se charge sur le serveur,
la chaîne fonctionne.

### S7 — La première entrée du registre

`bullshark-plugins/plugins.json` passe de `[]` à une entrée : le plugin
d'exemple, avec ses `capabilities`, son `checksum` et son `downloadUrl` pointant
sur la release Codeberg produite en S6.

C'est ce qui ferme la boucle ouverte par le chantier A : la marketplace cesse
d'être une vitrine vide.

Le `README.md` du dépôt de registre documente le format d'entrée et la
procédure de soumission — une demande d'ajout sur Codeberg, revue à la main. Pas
d'automatisation : avec zéro plugin, un processus automatique serait de
l'infrastructure sans usage.

---

## Ordre d'exécution

1. **S1** et **S2**, le SDK constructible et détaché de mediasoup. Rien d'autre
   n'est possible avant.
2. **S3**, les capacités. Elles changent `zPluginManifest`, que S5 va importer ;
   les faire avant évite de forker le builder deux fois.
3. **S4**, le dépôt de distribution, alimenté par la CI. Première publication
   `v1.0.0`.
4. **S5**, le builder, premier consommateur externe du SDK.
5. **S6**, l'exemple, construit avec le builder de S5.
6. **S7**, l'entrée de registre, produite par S6.

Chaque étape consomme la précédente. C'est voulu : à la fin, la chaîne a été
parcourue une fois de bout en bout par le chantier lui-même, pas seulement
décrite.

---

## Tests

**SDK construit**
- le bundle n'importe plus rien de `@bullshark/shared`
- `FileSaveType`, `PluginSlot`, `PLUGIN_SDK_VERSION` et les trois fabriques sont
  exportés et utilisables depuis le `dist/`
- le `.d.ts` type-checke seul, sans le monorepo
- l'entrée principale ne référence pas `mediasoup` ; `/voice` le fait

**Capacités**
- un manifest sans `capabilities` charge, et son contexte n'expose que le socle
- une capacité inconnue du serveur → refus nommant la capacité
- un plugin sans `voice` n'a pas `ctx.voice`
- un plugin avec `voice` l'a
- `hooks.onBeforeFileSave` non déclarée → le hook n'est jamais appelé
- la marketplace masque une entrée dont une capacité manque, et dit laquelle
- une entrée de registre sans `capabilities` est traitée comme n'en déclarant
  aucune

**Builder**
- le bundle client référence `__BULLSHARK_*` et aucun `__SHARKORD_*`
- aucune copie de React dans le bundle client
- plugin serveur seul : construit ; plugin client seul : construit ; aucun des
  deux : refusé
- `capabilities` invalide → échec à la construction

**Bout en bout**
- l'exemple se construit avec le builder distribué, depuis un répertoire vierge,
  sans le monorepo
- il s'installe depuis le registre et se charge

**Portes existantes** : typecheck, lint, tests, build.

---

## Risques

**Le dépôt de distribution peut diverger du monorepo.** Si une publication de CI
échoue à moitié, `bullshark-plugin-sdk` porte une version qui ne correspond à
aucun état du monorepo, et le diagnostic est pénible. Mitigation : la
publication est atomique — un seul commit portant `dist/` et `package.json` — et
le tag n'est posé qu'après.

**Trois dépôts de plus à maintenir.** SDK, builder, exemple s'ajoutent au
monorepo et au registre. C'est le coût structurel d'une chaîne d'outils
consommable de l'extérieur ; le seul moyen de l'éviter serait de renoncer à
l'objectif du chantier.

**Les capacités peuvent donner un faux sentiment de sécurité.** « Ce plugin ne
déclare que `messages` » se lit facilement comme « ce plugin ne peut que lire et
écrire des messages ». C'est faux : le code serveur garde l'accès au système de
fichiers et au réseau. `docs/plugins/security.md` doit l'énoncer explicitement,
juste à côté de la liste des capacités, sans quoi ce chantier aura rendu
Bullshark moins sûr en le rendant plus rassurant.

**L'épinglage manuel des versions va faire du bruit.** Sans plages sémantiques,
chaque publication du SDK demandera à chaque auteur de plugin de modifier son
`package.json`. Avec un plugin, c'est invisible ; avec vingt, ce sera le
déclencheur naturel du passage à npm.

**Le chantier ne se valide qu'à la fin.** Chaque étape consomme la précédente,
donc une erreur de conception en S1 ou S3 ne se révèle qu'en S6, quand l'exemple
tente de se construire pour de bon. C'est le prix de la vérification de bout en
bout ; il est réduit en écrivant les tests de chaque étape avant de passer à la
suivante, pas en réordonnant.
