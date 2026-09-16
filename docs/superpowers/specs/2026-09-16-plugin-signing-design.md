# Signature des plugins — design

- Date : 2026-09-16
- Statut : validé en chat avec l.user (2026-09-16), implémentation serveur MVP en cours
- Chantier sécurité : ferme la dernière racine de confiance ouverte de l'audit 2026-09-11
- Dépendance runtime : aucune (Ed25519 est natif dans Bun/Node)

## Problème

Installer un plugin exécute du code serveur. Le flux actuel
(`apps/server/src/routers/plugins/install-plugin.ts` →
`apps/server/src/helpers/downloads.ts` `downloadPlugin`) télécharge l'archive
depuis `downloadUrl` puis vérifie son `checksum`. Mais **`downloadUrl` et
`checksum` viennent tous deux de la même entrée de registry**
(`fetchMarketplaceVersion`, `apps/server/src/helpers/marketplace.ts`). Un
registry compromis (ou un MITM sur le registry) sert donc une archive
malveillante ET son checksum correspondant : la vérification passe. Le checksum
ne protège que l'intégrité du transport, pas contre une source compromise.

C'est le seul item délibérément reporté de l'audit sécurité du 2026-09-11 : la
vraie protection supply-chain = plugins signés cryptographiquement, vérifiés
contre une clé publique épinglée **hors du registry**, que le registry ne peut
pas forger faute de la clé privée.

## Ce qui existe déjà et qu'il faut réutiliser

- **Ed25519 natif.** Bun/Node exposent `crypto` (sign/verify Ed25519) sans
  aucune dépendance. Pas de minisign, pas de libsodium à ajouter.
- **Le point d'entrée unique est déjà là.** `downloadPlugin` est le seul
  chemin d'installation (install + update passent par lui). Une seule étape de
  vérif y couvre tout — même leçon que le funnel `saveFile` de l'audit fichiers.
- **`assertPublicHttpsUrl`** (`helpers/assert-safe-endpoint.ts`) durcit déjà
  `downloadUrl` (https + refus des cibles internes). La signature s'ajoute
  par-dessus, elle ne le remplace pas.
- **Le schéma de version est extensible.** `zMarketplacePluginVersion`
  (`packages/shared/src/plugins/marketplace.ts`) porte déjà `checksum`,
  `size`, `timestamp` ; on y ajoute un champ `signature` optionnel.
- **Le champ `verified: boolean`** existe déjà sur `zMarketplacePlugin` — la
  signature lui donne enfin un sens vérifiable côté serveur.

## Décisions (tranchées avec l.user le 2026-09-16)

1. **Racine de confiance = clé projet unique.** Une seule paire de clés
   Bullshark. La clé privée est un secret CI, la clé publique est **épinglée
   en dur dans le code serveur** (constante). Le pipeline de publication du
   registry officiel (`bullshark-plugins`) signe chaque archive au moment de
   la publication. **L'auteur de plugin ne gère aucune clé** : il soumet son
   plugin comme aujourd'hui, la signature est apposée côté projet. C'est le
   plus simple pour les deux côtés et ça ferme le trou pour le registry par
   défaut (99 % des cas).
2. **Registries tiers/perso restés possibles.** Un opérateur qui pointe vers
   son propre registry peut épingler sa/ses propres clés publiques via une
   variable d'environnement, en plus (ou à la place) de la clé projet.
3. **Ce qui est signé = les octets bruts de l'archive téléchargée.** Signature
   détachée Ed25519 sur le `.archive` complet — couvre manifest + entrées d'un
   coup, rien à recomposer. Le `checksum` reste comme garde d'intégrité rapide
   et dédup, mais n'est plus l'ancre de confiance.
4. **Rollout warn-puis-enforce.** Un flag d'enforcement (défaut `false` au
   lancement) : tant qu'il est off, un plugin non signé ou à signature
   invalide s'installe quand même mais log un avertissement et remonte un état
   « non vérifié » à l'UI. Une fois les plugins officiels signés, on bascule le
   défaut à `true`. Aucune casse immédiate.

## Design

### 1. Schéma partagé (`packages/shared/src/plugins/marketplace.ts`)

Ajouter à `zMarketplacePluginVersion` :

```ts
// Signature Ed25519 détachée (base64) des octets de l'archive, apposée par le
// pipeline de publication du registry. Absente = entrée non signée (chemin warn).
signature: z.string().optional()
```

Optionnel pour que les entrées existantes restent valides (chemin warn).

### 2. Config serveur (`apps/server/src/config.ts`, section `plugins`)

- `signingPublicKeys: string[]` — clés publiques Ed25519 de confiance (base64,
  format SPKI/raw à figer). Valeur par défaut = `[PROJECT_PLUGIN_SIGNING_KEY]`,
  une constante épinglée. L'env `BULLSHARK_PLUGIN_SIGNING_KEYS`
  (séparé par virgules) **ajoute** des clés (registry perso).
- `requireSignedPlugins: boolean` — env `BULLSHARK_REQUIRE_SIGNED_PLUGINS`,
  défaut `false` au lancement.

### 3. Vérification (`apps/server/src/helpers/downloads.ts`)

Nouveau helper `verifyPluginSignature(archiveBytes, signature, publicKeys)` :
`crypto.verify(null, archiveBytes, key, sigBytes)` sur chaque clé de confiance,
`true` si une passe. Dans `downloadPlugin`, après le checksum et **avant
l'extraction** :

- `requireSignedPlugins` et (pas de signature OU verify échoue) → `throw`
  (refus, archive nettoyée par le `finally` existant).
- sinon, signature absente/invalide → `logger.warn` + on retourne l'état de
  vérification à l'appelant pour l'UI. Signature valide → info + état vérifié.

`downloadPlugin` prend la `signature` en paramètre (fournie par
`install-plugin.ts` / `update-plugin.ts` depuis `versionData.signature`) et
retourne un statut de signature (`verified` | `unsigned` | `invalid`).

### 4. Outillage de signature (côté projet, hors ce repo pour l'essentiel)

- **Génération de clés** : un script one-off `scripts/generate-plugin-keypair.ts`
  (Ed25519 via `crypto.generateKeyPairSync`). La privée devient un secret CI,
  la publique est collée dans la constante épinglée.
- **Signature à la publication** : le repo registry `bullshark-plugins` signe
  chaque archive avec la clé privée et écrit `signature` dans l'entrée. Cette
  intégration vit dans ce repo-là ; ici on ne fait que **vérifier**. La spec la
  note comme point d'intégration, elle n'est pas dans la portée code de ce repo.
- **Signature locale (registry tiers)** : documenter la commande de signature
  (`crypto.sign` sur l'archive) pour qu'un opérateur de registry perso puisse
  signer avec sa propre clé. MVP : un script réutilisable, pas d'UI.

### 5. UI marketplace (`apps/client/.../server-settings/plugins/marketplace/`)

Badge « signé / vérifié » vs « non vérifié » sur l'item et dans le flux
d'install, dérivé du statut de signature. Minimal : réutiliser le style du
badge `verified` existant, ne pas inventer d'écran.

## Portée

**Dans la portée (ce repo) :** champ `signature` du schéma, config
(`signingPublicKeys` + `requireSignedPlugins` + constante clé publique),
`verifyPluginSignature` + branchement dans `downloadPlugin`, propagation du
statut vers l'UI, badge, tests. Script de génération de clés.

**Hors portée (documenté, pas codé ici) :** le pipeline de signature du repo
`bullshark-plugins`, la rotation de clés, un modèle multi-auteurs (clés par
auteur). Ces éléments peuvent venir plus tard sans casser ce design.

## Questions ouvertes

Aucune bloquante. À confirmer au moment du plan :
- Format exact d'encodage de la clé publique épinglée (SPKI base64 vs raw 32
  octets) — détail d'implémentation, tranché dans le plan.
- Faut-il un script de signature versionné ici pour les registries tiers, ou
  une simple doc suffit pour le MVP.
