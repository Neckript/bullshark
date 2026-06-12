# Héritage live des permissions de catégorie (cascade pure)

**Date:** 2026-06-12
**Statut:** Validé (design), prêt pour plan d'implémentation
**Approche:** A — Cascade pure (remplace le modèle copie/template)

## Contexte

Les permissions de catégorie existent déjà (tables `category_role_permissions` /
`category_user_permissions`, queries, routes get/update/delete, éditeur client + i18n
7 langues). Le modèle actuel est un **modèle copie/template** :

- À la création d'un canal dans une catégorie, les overrides de la catégorie sont
  **copiés** dans le canal (`add-channel.ts` → `copyCategoryPermissionsToChannel`).
- Le bouton « Appliquer aux canaux » (`categories/apply-permissions.ts`) **copie
  destructivement** les overrides de la catégorie dans tous les canaux enfants
  (`delete` des overrides canal existants puis réinsertion).
- La résolution à l'exécution (`getAllChannelUserPermissions`, `getPermissions`) ne
  lit **que** les overrides au niveau canal. La catégorie ne participe pas au calcul
  live.

**Objectif :** passer à un **héritage live (cascade)** où la catégorie participe à la
résolution runtime, le canal ayant priorité, la catégorie comblant les trous. On
supprime le modèle copie.

### Source de vérité

`getAllChannelUserPermissions(userId)` est la **source unique** : utilisée à la fois
pour l'enforcement serveur (`hasChannelPermission` dans `utils/wss.ts`) et le push des
permissions au client. Le second chemin, `getPermissions(...)`, gère la visibilité
`VIEW_CHANNEL` via `getChannelsForUser` et `channelUserCan`. Les deux doivent cascader.

### Stockage (inchangé)

Un override existe **par cible (role/user)** et matérialise **une ligne `allow`
(true/false) par permission** dès qu'il existe. Il n'y a pas d'état « neutre » par
permission. La granularité de cascade est donc **par présence de cible**, pas par
permission isolée : une cible a un override (→ toutes ses permissions viennent de ce
niveau) ou n'en a pas (→ on descend d'un niveau).

## Modèle de résolution

Précédence effective pour (user U, permission P, canal C) — **type-first (style
Discord)** : les overrides user battent toujours les overrides role ; dans chaque type,
le canal bat la catégorie.

1. Override **user du canal** (U) → valeur de P
2. Override **user de la catégorie** parente (U) → valeur de P
3. Override **role du canal** (un des rôles de U, allow-wins entre rôles) → valeur de P
4. Override **role de la catégorie** (allow-wins entre rôles) → valeur de P
5. Défaut `false`

Court-circuits inchangés et prioritaires sur tout ce qui précède :
- Rôle OWNER → toutes permissions `true`.
- Canal non privé (public) → `true`.
- Canal DM → `true` si participant, sinon `false`.
- Canal sans catégorie (`categoryId` null) → étapes 2 et 4 sautées.

## Changements serveur

### Resolver central

Nouveau `resolveChannelPermissions` dans `apps/server/src/db/queries/` appliquant la
cascade ci-dessus. Charge les overrides canal **et** catégorie, plus le mapping
canal→catégorie (`channels.categoryId`). Tous les chemins de résolution consomment ce
resolver pour éviter toute divergence.

### Fonctions modifiées

- **`getAllChannelUserPermissions(userId)`** (`db/queries/channels.ts`) — étendre pour
  charger `categoryUserPermissions` / `categoryRolePermissions` et le mapping
  canal→catégorie, puis appliquer la cascade type-first.
- **`getPermissions(userId, roleIds, permission, channelId?)`** — même cascade, pour la
  visibilité `VIEW_CHANNEL` (`getChannelsForUser`) et `channelUserCan`.

### Suppressions (modèle copie)

- **`add-channel.ts`** — retirer l'appel `copyCategoryPermissionsToChannel`. L'héritage
  étant live, un nouveau canal hérite automatiquement de sa catégorie.
- **`categories/apply-permissions.ts`** (route `applyPermissionsToChannels`) —
  supprimer la route et son entrée dans `categories/index.ts`.
- **`copyCategoryPermissionsToChannel`** (`db/queries/categories.ts`) — supprimer si
  plus aucun appelant après les deux points ci-dessus.

### Publication live des changements de catégorie

`categories/update-permission.ts` et `categories/delete-permissions.ts` ne publient
rien aujourd'hui. Sous cascade live, une modification d'override catégorie change les
permissions effectives de tous les canaux enfants pour les membres de la cible éditée.

- Nouveau helper `getAffectedOnlineUserIdsForCategoryTarget(target)` : retourne les
  utilisateurs en ligne **membres de la cible éditée** (role → ses membres ; user →
  lui). Sur-approximation correcte et simple (on republie aux membres de la cible).
- Après mutation dans les deux routes : appeler `publishChannelPermissions(...)` avec
  ces utilisateurs.

## Changements client

- **`category-settings/permissions/index.tsx`** — retirer le bouton « Appliquer aux
  canaux », son handler `onApplyToChannels`, et l'appel mutation associé.
- Éditeurs inchangés en lecture : l'éditeur de **catégorie** édite les overrides
  catégorie ; l'éditeur de **canal** édite les overrides canal. Ils n'affichent pas la
  valeur cascadée (on édite le niveau propre).
- **i18n** — supprimer les clés devenues inutiles (`applyCategoryPerms*` :
  `applyCategoryPermsButton`, `applyCategoryPermsConfirmTitle`,
  `applyCategoryPermsConfirmBody`, `applyCategoryPermsSuccess`,
  `applyCategoryPermsFailed`) dans les 7 locales.
- Retirer du hook `useAdminCategoryPermissions` / `hooks.ts` tout ce qui ne sert plus
  qu'au bouton supprimé (si applicable).

## Flux de données

Modif perm catégorie → recalcul effectif (cascade) pour les membres en ligne de la
cible → push WS → les clients rafraîchissent l'UI de tous les canaux enfants. **Aucune
écriture dans les tables canal.**

## Tests

- **Unitaires resolver** : chaque niveau de précédence (1→5) ; allow-wins entre rôles ;
  canal-user masque catégorie ; canal sans catégorie (`categoryId` null) ; catégorie
  comble les trous ; court-circuits OWNER / public / DM inchangés ; cas type-first
  (category-user bat channel-role).
- **`category-permissions.test.ts`** (étendre) : modif perm catégorie → effet sur perms
  effectives d'un canal enfant ; suppression override catégorie → retour au défaut /
  niveau inférieur.
- **Régression** : `getChannelsForUser` avec override `VIEW_CHANNEL` au niveau
  catégorie révèle/masque correctement le canal.

## Hors scope (YAGNI)

- **Migration des copies existantes** : on laisse tel quel. Les overrides canal déjà
  copiés (anciens commits) restent et continuent de gagner sur la catégorie
  (comportement correct sous cascade). Aucune migration. Conséquence assumée : un canal
  ayant des overrides copiés ne révèle l'héritage live qu'après suppression manuelle de
  ces overrides.
- Indicateur visuel « hérité de la catégorie » dans l'éditeur de canal.
- Toggle synced/unsynced par canal (approche B rejetée).

## Cas limite documenté

Avec type-first, un **override user au niveau catégorie** bat un **override role au
niveau canal** (étape 2 avant étape 3). C'est le comportement Discord choisi
explicitement : un override ciblant un utilisateur précis prime sur un override de rôle,
quel que soit le niveau.
