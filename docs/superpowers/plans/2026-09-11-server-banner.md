# Bannière de serveur — plan d'implémentation

> **Pour les agents :** SOUS-COMPÉTENCE REQUISE : utiliser
> superpowers:subagent-driven-development (recommandé) ou
> superpowers:executing-plans pour exécuter ce plan tâche par tâche. Les étapes
> utilisent la syntaxe case à cocher (`- [ ]`).

**But :** donner au serveur une bannière large façon Discord, distincte du
logo carré et de la bannière de profil utilisateur, affichée sous le nom du
serveur dans la sidebar gauche et réglable depuis Réglages → Général.

**Architecture :** la bannière de serveur est le pendant exact du **logo** côté
stockage (`settings.logoId` → `settings.bannerId`, même table, même cycle de
vie `removeFile` + `updateSettings`) et le pendant exact de la **bannière de
profil** côté surface (upload fichier + import GIF Klipy). Le chemin serveur
est donc un `applyServerBanner()` calqué sur `applyProfileMedia()`, appelé par
deux routes : `others.changeServerBanner` (upload) et
`gifs.importToServerBanner` (Klipy). La diffusion se fait par
`TPublicServerSettings` : `publishSettings()` republie déjà `getPublicSettings()`
sur `SERVER_SETTINGS_UPDATE`, donc ajouter `banner` à ce type suffit pour que
tous les membres connectés voient le changement en direct, sans nouvel event.

**Pile :** Bun, Drizzle (SQLite), tRPC, React 19, Tailwind 4, i18next
(7 locales). Aucune dépendance nouvelle.

**Spec :** `docs/superpowers/specs/2026-09-03-server-banner-design.md`

## Contraintes globales

- Branche `feat/server-banner`, base `main` = `a831b04`.
- Portes à zéro erreur avant chaque commit :
  - depuis `apps/client` : `bun run format:check && bun run check-types && bun run lint`
  - depuis `apps/server` : `bun run check-types && bun run lint && bun test`
- `bun run format` reformate TOUT le monorepo (dérive préexistante) : ne le
  lancer que ciblé (`npx prettier --write <fichiers>`), sinon vérifier
  `git status` et rendre les fichiers non concernés avant de committer.
- Messages de commit en français **sans accents**, `type(scope): résumé`.
- Tout texte affiché passe par i18next dans les **7** locales :
  `cs, en, es, fr, it, ru, zh`. Ne pas recopier les chaînes en dur de
  `logo-manager.tsx` / `banner-manager.tsx` : ces deux fichiers sont une
  dette existante, pas un modèle à suivre sur ce point.
- Périmètre strict de la spec : pas de recadrage interactif, pas de couleur de
  repli, pas de bannière par salon/rôle.

## Décisions déjà tranchées (spec du 2026-09-03) — ne pas relitiger

| Sujet | Décision |
| --- | --- |
| Emplacement | sous `<h2>{serverName}</h2>` dans `left-sidebar/index.tsx`, avant le bandeau « aucun propriétaire » |
| Format | 960×540 (16:9), rendu `cover` sur la largeur courante de la sidebar (200–400 px), hauteur dérivée du ratio |
| GIF animé | dans la v1, via une route dédiée `gifs.importToServerBanner` |
| Quota statique | nouveau réglage `storageMaxServerBannerSize` |
| Quota animé | réutilise `storageMaxAnimatedImageSize` (générique) |
| Repli | aucun : pas de bannière ⇒ aucun espace occupé |
| Droits | `Permission.MANAGE_SETTINGS` |

## Points à confirmer en implémentant

1. **`changeLogo` n'a aujourd'hui aucune garde de permission.**
   `apps/server/src/routers/others/change-logo.ts` est un `protectedProcedure`
   nu, alors que `getSettings` et `updateSettings` appellent
   `ctx.needsPermission(Permission.MANAGE_SETTINGS)`. N'importe quel membre
   authentifié peut donc remplacer le logo du serveur. La tâche 3 corrige ce
   trou **dans un commit séparé** et la nouvelle route bannière naît avec la
   garde.
2. **Permission « image animée ».** `applyProfileMedia` exige
   `Permission.ANIMATED_AVATAR` pour un GIF de profil. Pour la bannière de
   serveur, on ne l'exige **pas** : `MANAGE_SETTINGS` est déjà un droit
   d'administration, exiger en plus une permission cosmétique de membre n'a
   pas de sens. Décision d'implémentation, à signaler si elle déplaît.
3. **URLs signées.** La bannière est visible uniquement après authentification,
   donc contrairement au logo elle n'est **pas** exemptée du régime d'URL
   signée dans `http/public.ts` — elle passe par `signFile()` comme la
   bannière de profil. Conséquence héritée de ce régime : le jeton expire au
   bout de `storageSignedUrlsTtlSeconds`, comme pour tous les avatars et
   bannières existants. Pas de mécanisme de rafraîchissement inventé ici.

---

### Tâche 1 : socle partagé — types, constantes, schéma, migration

**Fichiers :**

- Modifier : `packages/shared/src/plugins/hooks.ts`
- Modifier : `packages/shared/src/statics/storage.ts`
- Modifier : `packages/shared/src/types.ts`
- Modifier : `apps/server/src/db/schema.ts`
- Créer : `apps/server/src/db/migrations/0027_*.sql` (généré)

**Interfaces :**

- Produit : `FileSaveType.SERVER_BANNER`,
  `STORAGE_DEFAULT_MAX_SERVER_BANNER_SIZE`, `STORAGE_MAX_SERVER_BANNER_SIZE`,
  `settings.bannerId`, `settings.storageMaxServerBannerSize`, et les champs
  `banner` sur `TJoinedSettings` / `TPublicServerSettings`.

- [ ] **Étape 1 : nouveau type de sauvegarde de fichier**

Dans `packages/shared/src/plugins/hooks.ts`, ajouter à `FileSaveType` :

```ts
  SERVER_BANNER = 'server_banner',
```

Le placer juste après `SERVER_LOGO` — l'enum est sérialisée en base par sa
valeur, l'ordre des membres n'a pas d'importance mais le voisinage est lisible.

- [ ] **Étape 2 : constantes de quota**

Dans `packages/shared/src/statics/storage.ts`, à côté des constantes bannière
existantes :

```ts
export const STORAGE_DEFAULT_MAX_SERVER_BANNER_SIZE = 4 * 1024 * 1024; // 4MB
export const STORAGE_MAX_SERVER_BANNER_SIZE = 100 * 1024 * 1024; // 100MB (plafond du curseur admin)
```

- [ ] **Étape 3 : colonnes**

Dans `apps/server/src/db/schema.ts`, table `settings`, après `logoId` :

```ts
    bannerId: integer('banner_id').references(() => files.id, {
      onDelete: 'set null'
    }),
```

et à côté de `storageMaxBannerSize` :

```ts
    storageMaxServerBannerSize: integer('storage_max_server_banner_size')
      .notNull()
      .default(4 * 1024 * 1024),
```

Le `.default()` est **obligatoire** : la colonne est `notNull` et la table
existe déjà en production, une migration sans défaut échouerait sur les bases
en place.

- [ ] **Étape 4 : types partagés**

Dans `packages/shared/src/types.ts`, ajouter `'storageMaxServerBannerSize'` à
la liste du `Pick<TSettings, …>` de `TPublicServerSettings`, puis ajouter au
bloc d'extension (celui qui porte déjà `webRtcMaxBitrate` et `klipyEnabled`) :

```ts
  banner: TFile | null;
```

`TJoinedSettings` porte déjà `logo` de la même façon : y ajouter `banner` au
même endroit.

- [ ] **Étape 5 : générer la migration**

Depuis `apps/server` : `bun run db:gen`, puis `bun run db:check`. Vérifier que
le `.sql` produit ne contient **que** les deux `ALTER TABLE` attendus — la
génération drizzle recrée parfois des tables entières si le schéma a dérivé ;
dans ce cas s'arrêter et le signaler plutôt que de committer la migration.

- [ ] **Étape 6 : semences**

Ajouter `storageMaxServerBannerSize: STORAGE_DEFAULT_MAX_SERVER_BANNER_SIZE`
dans `apps/server/src/db/seed.ts` et `apps/server/src/__tests__/seed.ts`, à
côté de `storageMaxBannerSize`.

**Commit :** `feat(shared): ajouter le socle de la banniere de serveur`

---

### Tâche 2 : serveur — lecture, signature et diffusion

**Fichiers :**

- Modifier : `apps/server/src/db/queries/server.ts`
- Modifier : `apps/server/src/utils/file-manager.ts`

**Interfaces :**

- Consomme : `settings.bannerId`, `settings.storageMaxServerBannerSize` (tâche 1).
- Produit : `getSettings().banner`, `getPublicSettings().banner`, la validation
  de taille pour `FileSaveType.SERVER_BANNER`.

- [ ] **Étape 1 : joindre la bannière dans `getSettings`**

Dans `apps/server/src/db/queries/server.ts`, calquer exactement le bloc `logo`
existant pour `bannerId`, et retourner `banner: banner ?? null` à côté de
`logo`.

- [ ] **Étape 2 : exposer la bannière aux membres**

Dans le même fichier, `getPublicSettings` : ajouter
`storageMaxServerBannerSize: settings.storageMaxServerBannerSize` et

```ts
    banner: signFile(
      settings.banner,
      settings.storageSignedUrlsEnabled,
      settings.storageSignedUrlsTtlSeconds
    ),
```

`signFile` vient de `../../helpers/files-crypto` (il gère déjà le cas `null`).
Ne **pas** ajouter `bannerId` à l'exemption d'URL signée de
`http/public.ts` : cette exemption existe parce que le logo s'affiche avant
authentification, ce qui n'est pas le cas de la bannière.

Rien d'autre à faire pour le temps réel : `publishSettings()` republie déjà
`getPublicSettings()` sur `SERVER_SETTINGS_UPDATE`.

- [ ] **Étape 3 : borner la taille**

Dans `apps/server/src/utils/file-manager.ts`, `validateFinalFileSize` :

- ajouter `FileSaveType.SERVER_BANNER` à la liste du premier bloc (celui qui
  détourne les images animées vers `storageMaxAnimatedImageSize`), aux côtés
  de `AVATAR`, `BANNER` et `ROLE_ICON` ;
- ajouter en fin de fonction le bloc statique :

```ts
    if (
      type === FileSaveType.SERVER_BANNER &&
      tempFile.size > settings.storageMaxServerBannerSize
    ) {
      throw new Error(
        `Server banner file exceeds the configured maximum size of ${settings.storageMaxServerBannerSize / (1024 * 1024)} MB`
      );
    }
```

**Commit :** `feat(server): lire, signer et diffuser la banniere de serveur`

---

### Tâche 3 : serveur — garde de permission manquante sur `changeLogo`

**Fichiers :**

- Modifier : `apps/server/src/routers/others/change-logo.ts`
- Modifier : `apps/server/src/routers/__tests__/others.test.ts`

Correctif de sécurité indépendant de la fonctionnalité, isolé dans son propre
commit pour rester lisible dans l'historique et rétroportable.

- [ ] **Étape 1 : poser la garde**

En tête du `.mutation(...)` de `changeLogoRoute`, avant toute lecture :

```ts
    await ctx.needsPermission(Permission.MANAGE_SETTINGS);
```

(importer `Permission` depuis `@bullshark/shared`, déjà importé pour
`FileSaveType`.)

- [ ] **Étape 2 : test de non-régression**

Ajouter dans `apps/server/src/routers/__tests__/others.test.ts` un cas
vérifiant qu'un membre sans `MANAGE_SETTINGS` reçoit une erreur sur
`changeLogo`. Suivre le gabarit des tests de permission déjà présents dans ce
fichier.

**Commit :** `fix(server): reserver le changement de logo aux gestionnaires de reglages`

---

### Tâche 4 : serveur — routes de la bannière

**Fichiers :**

- Créer : `apps/server/src/routers/others/apply-server-banner.ts`
- Créer : `apps/server/src/routers/others/change-server-banner.ts`
- Créer : `apps/server/src/routers/gifs/import-to-server-banner.ts`
- Modifier : `apps/server/src/routers/others/index.ts`
- Modifier : `apps/server/src/routers/gifs/index.ts`

**Interfaces :**

- Consomme : `FileSaveType.SERVER_BANNER`, `getSettings().banner`,
  `downloadGif` (`../gifs/download-gif`).
- Produit : `trpc.others.changeServerBanner({ fileId? })`,
  `trpc.gifs.importToServerBanner({ gifId })`.

- [ ] **Étape 1 : helper partagé**

`apply-server-banner.ts`, calqué sur `users/apply-profile-media.ts` mais à
l'échelle serveur — la garde de permission vit **ici**, pour qu'aucune des
deux routes ne puisse l'oublier :

```ts
import { FileSaveType, Permission } from '@bullshark/shared';
import { removeFile } from '../../db/mutations/files';
import { updateSettings } from '../../db/mutations/server';
import { publishSettings } from '../../db/publishers';
import { getSettings } from '../../db/queries/server';
import { fileManager } from '../../utils/file-manager';
import type { Context } from '../../utils/trpc';

// Pendant serveur de applyProfileMedia : meme cycle de vie que le logo
// (removeFile + updateSettings), partage par l'upload et l'import GIF.
// Volontairement sans garde ANIMATED_AVATAR : MANAGE_SETTINGS est deja un
// droit d'administration.
const applyServerBanner = async (
  ctx: Context,
  fileId: string | undefined
): Promise<void> => {
  await ctx.needsPermission(Permission.MANAGE_SETTINGS);

  if (fileId && !fileManager.temporaryFileHasMimeType(fileId, 'image/')) {
    throw new Error('Invalid file type. Please try again.');
  }

  const settings = await getSettings();

  if (settings.bannerId) {
    await removeFile(settings.bannerId);
    await updateSettings({ bannerId: null });
  }

  if (fileId) {
    const newFile = await fileManager.saveFile(
      fileId,
      ctx.userId,
      FileSaveType.SERVER_BANNER
    );

    await updateSettings({ bannerId: newFile.id });
  }

  publishSettings();
};

export { applyServerBanner };
```

- [ ] **Étape 2 : route d'upload**

`change-server-banner.ts` : `protectedProcedure`, input
`z.object({ fileId: z.string().optional() })`, corps = un seul appel à
`applyServerBanner(ctx, input.fileId)`.

- [ ] **Étape 3 : route d'import Klipy**

`import-to-server-banner.ts`, calqué sur `gifs/import-to-profile.ts` — même
enveloppe `rateLimitedProcedure` (10 requêtes / 60 s, `logLabel:
'gifs.importToServerBanner'`), input `z.object({ gifId: z.string().min(1).max(200) })`,
corps :

```ts
    const tempFile = await downloadGif(input.gifId, ctx.userId);

    await applyServerBanner(ctx, tempFile.id);
```

- [ ] **Étape 4 : brancher les routeurs**

`changeServerBanner: changeServerBannerRoute` dans `othersRouter`,
`importToServerBanner: importToServerBannerRoute` dans `gifsRouter`.

- [ ] **Étape 5 : tests**

Dans `apps/server/src/routers/__tests__/others.test.ts` : un membre sans
`MANAGE_SETTINGS` est refusé ; un administrateur pose puis retire la bannière
et `getPublicSettings()` reflète les deux états.

**Commit :** `feat(server): ajouter les routes de banniere de serveur`

---

### Tâche 5 : i18n — clés des 7 locales

**Fichiers :**

- Modifier : `apps/client/src/i18n/locales/{cs,en,es,fr,it,ru,zh}/settings.json`

- [ ] **Étape 1 : ajouter les clés**

Namespace `settings`, à côté de `maxBannerSizeLabel` / `serverInfoTitle` :

| clé | fr |
| --- | --- |
| `serverBannerLabel` | Bannière du serveur |
| `serverBannerDesc` | Image large affichée sous le nom du serveur. 960×540 (16:9) recommandé. |
| `serverBannerUpdated` | Bannière du serveur mise à jour |
| `serverBannerRemoved` | Bannière du serveur supprimée |
| `serverBannerError` | Impossible de mettre à jour la bannière du serveur. |
| `removeServerBanner` | Supprimer la bannière |
| `maxServerBannerSizeLabel` | Taille maximale de la bannière du serveur |
| `maxServerBannerSizeDesc` | Taille maximale du fichier de bannière que les gestionnaires du serveur peuvent définir. Les images animées utilisent le réglage dédié. |

Traduire dans les 6 autres locales. Vérifier que chaque fichier reste un JSON
valide et trié comme ses voisins.

**Commit :** `feat(client): ajouter les libelles de la banniere de serveur`

---

### Tâche 6 : client — réglage de quota dans Stockage

**Fichiers :**

- Modifier : `apps/server/src/routers/others/update-settings.ts`
- Modifier : `apps/server/src/routers/others/get-storage-settings.ts`
- Modifier : `apps/client/src/features/server/admin/hooks.ts`
- Modifier : `apps/client/src/components/server-screens/server-settings/storage/index.tsx`
- Modifier : `apps/client/src/components/server-screens/server-settings/storage/presets.ts`

- [ ] **Étape 1 : accepter le réglage côté serveur**

`update-settings.ts` : `storageMaxServerBannerSize: z.number().min(0).optional()`
dans le schéma zod, et le report correspondant dans l'objet passé à
`updateSettings`. `get-storage-settings.ts` : renvoyer le champ.

- [ ] **Étape 2 : presets**

`presets.ts` : `MAX_SERVER_BANNER_SIZE_PRESETS` avec 1 / 3 / 10 MB (copie de
`MAX_BANNER_SIZE_PRESETS`, conformément à la spec), exporté.

- [ ] **Étape 3 : formulaire**

`useAdminStorage` : valeur par défaut
`STORAGE_DEFAULT_MAX_SERVER_BANNER_SIZE`, report dans `submit`, entrée
`filesize(...)` dans `labels`. Ajouter le champ à `TStorageSettings`.

- [ ] **Étape 4 : contrôle**

`storage/index.tsx` : un `<Group>` `maxServerBannerSizeLabel` /
`maxServerBannerSizeDesc` immédiatement après celui de `maxBannerSize`, avec
`StorageSizeControl` borné par `STORAGE_MAX_SERVER_BANNER_SIZE` /
`STORAGE_MIN_FILE_SIZE` et `presets={MAX_SERVER_BANNER_SIZE_PRESETS}`.

**Commit :** `feat(client): ajouter le quota de banniere de serveur aux reglages de stockage`

---

### Tâche 7 : client — gestionnaire dans Réglages → Général

**Fichiers :**

- Créer : `apps/client/src/components/server-screens/server-settings/general/server-banner-manager.tsx`
- Modifier : `apps/client/src/components/server-screens/server-settings/general/index.tsx`
- Modifier : `apps/client/src/features/server/admin/hooks.ts`

**Interfaces :**

- Consomme : `trpc.others.getSettings` (qui renvoie désormais `banner`),
  `trpc.others.changeServerBanner`, `trpc.gifs.importToServerBanner`.

- [ ] **Étape 1 : exposer la bannière au formulaire**

`useAdminGeneral` : `const [banner, setBanner] = useState<TFile | null>(null)`,
`setBanner(settings.banner)` dans `fetchSettings`, `banner` dans le retour —
strictement le même traitement que `logo`.

- [ ] **Étape 2 : composant**

`server-banner-manager.tsx` : structure de `banner-manager.tsx` (aperçu
cliquable, bouton Supprimer conditionnel, bouton GIF si `klipyEnabled`), avec
trois différences :

1. tous les libellés passent par `useTranslation('settings')` ;
2. l'aperçu est en 16:9 (`aspect-[16/9] w-80`) et non en 320×96 ;
3. les mutations visent `others.changeServerBanner` et
   `gifs.importToServerBanner`, et appellent `refetch()` après succès (comme
   `LogoManager` — l'écran d'administration lit `getSettings`, il ne reçoit
   pas `SERVER_SETTINGS_UPDATE`).

Le sélecteur de fichier accepte `.gif,.jpg,.jpeg,.png,.webp` comme la bannière
de profil, pas `image/*` : les formats hors liste sont refusés côté serveur.

- [ ] **Étape 3 : brancher**

`general/index.tsx` : `<ServerBannerManager banner={banner} refetch={refetch} />`
juste après `<LogoManager …>`.

**Commit :** `feat(client): gerer la banniere de serveur dans les reglages`

---

### Tâche 8 : client — affichage dans la sidebar gauche

**Fichiers :**

- Modifier : `apps/client/src/components/left-sidebar/index.tsx`

- [ ] **Étape 1 : rendre la bannière**

Entre le `<div>` d'en-tête (nom du serveur + `ServerDropdownMenu`) et le bloc
`{!serverHasOwner && …}` :

```tsx
      {publicSettings?.banner && (
        <div
          className="w-full aspect-[16/9] shrink-0 border-b border-border bg-cover bg-center"
          style={{
            backgroundImage: `url(${getFileUrl(publicSettings.banner)})`
          }}
        />
      )}
```

`shrink-0` est nécessaire : la sidebar est une colonne flex dont la liste des
salons porte `flex-1`, sans quoi la bannière serait écrasée quand la liste est
longue. Pas de repli quand `banner` est `null` — le bloc disparaît entièrement,
conformément à la spec.

`getFileUrl` s'importe depuis `@/helpers/get-file-url` ; il gère déjà le jeton
d'URL signée.

**Commit :** `feat(client): afficher la banniere sous le nom du serveur`

---

### Tâche 9 : vérification de bout en bout

- [ ] **Étape 1 : portes**

Les trois portes client et les trois portes serveur, à zéro erreur.

- [ ] **Étape 2 : scénario réel**

Déployer sur le Kimsufi et vérifier, connecté en administrateur :

1. Réglages → Stockage affiche le nouveau curseur et le sauvegarde.
2. Réglages → Général accepte un PNG 960×540 ; la bannière apparaît dans la
   sidebar **sans rechargement** (c'est le test de `publishSettings`), et sur
   une seconde session ouverte en parallèle.
3. Le bouton GIF (si Klipy est configuré) pose un GIF animé qui s'anime.
4. Supprimer la bannière la fait disparaître, la sidebar se referme sans trou.
5. Redimensionner la sidebar de 200 à 400 px : la bannière suit en 16:9 sans
   déformation.
6. Un fichier plus lourd que le quota est refusé avec un message clair.
7. Un membre non administrateur ne voit aucun contrôle et l'appel direct à
   `others.changeServerBanner` est refusé.
