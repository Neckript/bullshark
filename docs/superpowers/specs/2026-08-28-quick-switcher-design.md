# Sélecteur rapide (Ctrl+K) — design

- Date : 2026-08-28
- Statut : validé en chat sur maquette, prêt pour le plan d'implémentation
- Chantier 5 du programme « rendre Bullshark beau », le dernier

Maquette avant/après validée :
https://claude.ai/code/artifact/3fabb463-b31b-4a1e-8753-f11ff14f0c6a

## Problème

Le geste le plus fréquent de l'application — changer de salon — n'a aucune
issue au clavier. Il faut viser une ligne dans la colonne de gauche, catégorie
dépliée, à la souris.

L'audit fondateur du programme disait « chantier 5 : Ctrl+K absent ». C'est
faux, et ce constat a déjà été corrigé une fois : `Ctrl+K` **existe et est
pris**. Vérifié sur `main` à `f757827` :

- `apps/client/src/components/top-bar/server-search.tsx:17-22` pose un
  `keydown` sur `window` et ouvre `Dialog.SEARCH` sur `Ctrl+K` / `Cmd+K`.
- Ce dialogue (`components/dialogs/search/index.tsx:45`) fait `h-[86vh]` et
  `lg:min-w-7xl`, n'affiche rien sous 2 caractères
  (`search/hooks.ts:11`, `MIN_QUERY_LENGTH = 2`), attend 300 ms
  (`DEBOUNCE_MS`), interroge `trpc.messages.search` puis pagine 12 résultats
  par page.
- Il ne se pilote pas au clavier : les résultats sont des cartes cliquables,
  il n'y a ni ligne active, ni `↑`/`↓`, ni `↵`.

C'est une bonne surface pour retrouver une phrase. C'est la mauvaise surface
sur la meilleure touche.

Le chantier ne crée donc pas un raccourci, il en **réattribue** un.

## Contraintes structurantes relevées dans le code

Trois faits contraignent le design ; ils ont été vérifiés avant d'écrire cette
spec, pas supposés.

**1. Un seul dialogue à la fois.** `features/dialogs/slice` ne garde qu'un
`openDialog` ; `DialogsProvider` (`components/dialogs/index.tsx:44`) rend un
unique composant. Le sélecteur est donc un dialogue de plus dans la même
carte, et passer du sélecteur à la recherche de contenu est un remplacement,
pas un empilement. C'est ce qui rend la porte de sortie (§G) triviale.

**2. La liste des conversations privées n'est pas dans le magasin.** Elle vit
en `useState` local de `components/left-sidebar/direct-messages/index.tsx:60`,
alimentée par `trpc.dms.get` et un abonnement `trpc.dms.onConversationOpen`.
Un deuxième consommateur imposerait soit de la remonter dans Redux, soit de
dupliquer requête et abonnement. **Aucun des deux n'est fait** : le sélecteur
liste des **personnes** (déjà dans le magasin) et `trpc.dms.open` — idempotent,
il ouvre la conversation existante ou la crée — donne le `channelId` au moment
du `↵`. Conséquence assumée en §« Hors périmètre ».

**3. `useSelectChannel` mélange deux responsabilités.**
`components/left-sidebar/hooks.ts:59` renvoie bien la fonction de sélection,
mais le même hook porte un `useEffect` de montage (lignes 105-138) qui lit
`?channelId=` de l'URL, le retire de l'historique, puis applique l'auto-join du
dernier salon. Monter ce hook depuis le sélecteur **rejouerait cet effet à
chaque ouverture de la palette**. La fonction doit être extraite avant d'être
réutilisée (§F).

**4. Un dialogue est monté hors du fournisseur vocal.** `DialogsProvider` est
rendu dans `main.tsx:48`, tandis que `VoiceProvider` n'enveloppe que le contenu
de `screens/server-view/index.tsx:78`. Un dialogue qui appellerait `useVoice()`
recevrait donc la **valeur par défaut du contexte**
(`voice-provider/index.tsx:157`), dont `init` est un `Promise.resolve()` vide :
rejoindre un vocal depuis la palette échouerait en silence, sans erreur ni
type qui le signale. Le dépôt a déjà rencontré et résolu ce problème pour les
raccourcis de coupure micro : `voice-provider/controls-bridge.ts` est un pont
de module posé par le fournisseur, dont le commentaire dit mot pour mot
« may live outside VoiceProvider ». Il n'expose aujourd'hui que
`setMicMuted` et `setSoundMuted` ; le chantier l'étend (§F).

## Direction retenue

`Ctrl+K` ouvre un **sélecteur rapide** : une barre ancrée haut, jamais plus
grande que son contenu, alimentée **uniquement par le magasin déjà chargé**.
Zéro requête réseau à l'ouverture, zéro état de chargement, zéro pagination.
La recherche de contenu garde son dialogue et passe sur `Ctrl+Maj+F`.

Périmètre tranché par l.user : **navigation seule**. Pas d'actions, pas de
commandes de plugins.

## A. Le partage des raccourcis

Les deux liaisons vont dans `components/hotkeys-controller/index.tsx`, qui
possède déjà les raccourcis globaux `Ctrl+Maj+M` et `Ctrl+Maj+D` et le suivi
des modificateurs. `server-search.tsx` **perd son `useEffect`** : plus aucun
composant de surface ne pose son propre écouteur global.

| Touche | Effet |
| --- | --- |
| `Ctrl+K` / `Cmd+K` | Ouvre le sélecteur ; une seconde pression le referme |
| `Ctrl+Maj+F` / `Cmd+Maj+F` | Ouvre la recherche de contenu |

`Ctrl+Maj+F` et non `Ctrl+F` : `Ctrl+F` est la recherche dans la page du
navigateur, et l'application desktop est un Electron où l'intercepter
surprendrait. `Ctrl+Maj+F` est libre dans le dépôt (les seuls `ctrl+shift`
existants sont `M` et `D`).

Deux gardes sur la bascule :

- Ignorer si `event.repeat` (maintenir la touche ne doit pas clignoter).
- Ne rien faire tant que la connexion au serveur n'est pas établie
  (`connectedSelector`) : le magasin est vide, la palette n'aurait rien à
  montrer.

Le bouton de la barre du haut garde son rôle et son libellé ; seul son badge
passe de `Ctrl+K` à `Ctrl+Maj+F`. Il reste le seul point d'entrée souris de la
recherche de contenu.

## B. Les sources de données

Tout vient de sélecteurs existants ou d'un seul sélecteur neuf.

**Salons.** Il existe `visibleChannelsInCategorySelector`
(`features/server/selectors.ts:100`) mais pas d'équivalent global. On ajoute à
côté, sur le même modèle et avec le même `canViewChannel`
(`features/server/helpers.ts:8`) :

```ts
export const visibleChannelsSelector = createSelector(
  [channelsSelector, channelPermissionsSelector, isOwnUserOwnerSelector],
  (channels, channelPermissions, isOwner) =>
    channels.filter(
      (channel) =>
        !channel.isDm &&
        canViewChannel(channel, channelPermissions, isOwner)
    )
);
```

Un salon privé non autorisé ne doit jamais apparaître dans la palette : c'est
la seule règle de sécurité du chantier, et elle est déjà écrite ailleurs — on
la réutilise, on ne la réécrit pas.

Le `!channel.isDm` n'est pas décoratif non plus. **Les salons de conversation
privée vivent dans la même liste** `state.server.channels` : le seed en
fabrique un nommé « DM Channel », de type `VOICE`, `private`, `categoryId`
nul (`apps/server/src/__tests__/seed.ts:280`). S'ils n'apparaissent nulle part
dans la colonne gauche, c'est uniquement parce qu'elle passe par
`channelsByCategoryIdSelector`, qui filtre sur `categoryId`. Un sélecteur
global qui oublierait ce filtre listerait « DM Channel » comme un salon vocal
à rejoindre. Le dépôt le sait déjà ailleurs
(`features/server/channels/selectors.ts:123`).

**Catégories.** `useCategories()`
(`features/server/categories/hooks.ts:5`) donne le nom affiché à droite d'une
ligne de salon, par `channel.categoryId`.

**Personnes.** `filteredUsersSelector`
(`features/server/users/selectors.ts:38`) exclut déjà l'utilisateur courant et
les comptes supprimés, et trie par statut puis nom. Le sélecteur ajoute le
filtre `!user.banned`, comme le fait la liste de démarrage de conversation
(`direct-messages/index.tsx:105`).

**Non-lus.** `useUnreadMessagesCount(channelId)`
(`features/server/hooks.ts:133`) pour la pastille des salons.

**Vocaux occupés.** `useVoiceUsersByChannelId(channelId)`
(`features/server/hooks.ts:126`) pour le décompte à droite d'un salon vocal.

**Récents.** Nouvelle clé `LocalStorageKey.RECENT_TARGETS`
(`helpers/storage.ts`), sur le modèle de `RECENT_EMOJIS` déjà présent. Une
liste ordonnée du plus récent au plus ancien, plafonnée à **8** entrées :

```ts
type TRecentTarget =
  | { kind: 'channel'; id: number }
  | { kind: 'user'; id: number };
```

Écrite à chaque ouverture réussie **depuis la palette uniquement**. Ne pas
l'accrocher à la sélection de salon en général : le but est de mémoriser une
intention de navigation, pas de refléter le clic de la colonne gauche, et
brancher l'écriture dans `selectChannel` la ferait grossir à chaque
`?channelId=` et à chaque auto-join au démarrage. À la lecture, toute entrée
dont la cible n'existe plus (salon supprimé, membre parti, salon devenu
invisible) est ignorée silencieusement puis purgée.

## C. Correspondance et classement

Correspondance **floue par sous-séquence** : les lettres de la requête doivent
apparaître dans l'ordre, pas nécessairement contiguës — `gnl` trouve
`général`. Comparaison en minuscules, après `normalize('NFD')` et retrait des
diacritiques, pour que `general` trouve `général` (le serveur est
francophone ; les 7 locales du client rendent la question générale).

Les caractères retenus sont **mis en gras** dans le nom affiché. C'est le seul
retour qui explique pourquoi une ligne est là.

Score, du plus fort au plus faible, à égalité de score l'ordre naturel de la
source :

1. égalité exacte du nom ;
2. le nom commence par la requête ;
3. la requête est contiguë quelque part dans le nom ;
4. sous-séquence dispersée — départage par l'écart total entre les lettres
   trouvées, le plus resserré d'abord.

Les groupes s'affichent dans un ordre fixe : **Salons**, **Vocaux**,
**Personnes**. Fixe et non par score : la stabilité de la position vaut mieux
qu'un classement optimal, parce qu'un utilisateur qui tape trois lettres et
appuie sur `↵` sans lire doit pouvoir apprendre le geste. Requête vide, un
seul groupe : **Récents**.

Plafond de **8 lignes par groupe**. Au-delà, l'utilisateur doit préciser sa
requête, pas dérouler.

## D. Anatomie d'une ligne

Trois formes, une seule grille : glyphe, nom, complément, pastille.

| Genre | Glyphe | Complément à droite | Pastille |
| --- | --- | --- | --- |
| Salon texte | `#` | nom de la catégorie | non-lus |
| Salon vocal | icône haut-parleur | nombre de personnes présentes | — |
| Personne | avatar | statut (en ligne / hors ligne) | — |

Le nom de catégorie n'est pas décoratif : deux salons peuvent porter le même
nom dans deux catégories, c'est la seule chose qui les sépare.

Forme : `rounded-pill`, `px-2.5 py-1.5`, ligne active en `bg-accent
text-accent-foreground` — exactement la ligne de la colonne gauche
(`channels.tsx:183`, `dm-button.tsx:27`), pour que la palette soit reconnue
comme faisant partie de la même application. Transition de couleur en
`duration-fast ease-out`, les jetons du chantier 2.

Le glyphe de la ligne active prend `text-primary`. C'est l'unique usage de
l'accent dans la surface.

## E. Clavier et focus

| Touche | Effet |
| --- | --- |
| `↑` `↓` | Déplace la ligne active en sautant les en-têtes de groupe ; boucle en haut et en bas |
| `↵` | Ouvre la ligne active |
| `Échap` | Ferme sans rien changer |
| toute saisie | Remet la ligne active sur la première ligne |

Le champ garde le focus en permanence ; la ligne active est un état, pas un
focus DOM. Accessibilité : `role="listbox"` sur la liste, `role="option"` +
`aria-selected` sur les lignes, `aria-activedescendant` sur le champ, et
défilement de la ligne active dans la vue via `scrollIntoView({ block:
'nearest' })`.

Le survol souris déplace aussi la ligne active — sinon deux surbrillances
coexistent et l'on ne sait plus ce que `↵` va ouvrir.

## F. Ouvrir une cible

**Salon (texte ou vocal).** En deux temps, imposés par les contraintes 3 et 4.

D'abord le pont vocal. `controls-bridge.ts` gagne un troisième membre, posé
par le même `useEffect` que les deux autres
(`voice-provider/index.tsx:1210`) :

```ts
type TVoiceControlsBridge = {
  setMicMuted: (muted: boolean) => Promise<void>;
  setSoundMuted: (muted: boolean) => Promise<void>;
  joinChannel: (channelId: number) => Promise<void>;
};
```

`joinChannel` porte la moitié vocale de l'actuel `useSelectChannel` : `joinVoice`
puis `init(response, channelId)`, et sur chacun des deux échecs, retour de la
sélection à `undefined` et `toast.error`. Elle est écrite là où `init` existe
vraiment, dans le fournisseur.

Ensuite la sélection, extraite en fonction autonome de
`features/server/channels/actions.ts`, sans hook et donc appelable de partout :

```ts
export const selectChannel = async (channelId: number) => { ... }
```

Elle lit le salon dans `store.getState()`, pose `setSelectedChannelId(channel.id)`
**avant** toute attente réseau — la vue affiche le salon pendant la connexion,
comme aujourd'hui —, mémorise `LAST_SELECTED_CHANNEL` pour un salon non vocal,
et, pour un salon vocal différent du salon vocal courant
(`currentVoiceChannelIdSelector`), appelle
`getVoiceControlsBridge()?.joinChannel(channel.id)`. Pont absent, rien ne se
passe : c'est la sémantique déjà retenue pour les raccourcis de coupure micro,
et le seul cas où le pont est nul est celui où l'on n'est pas dans la vue
serveur — où il n'y a de toute façon pas de vocal à rejoindre.

Les deux appelants passent alors par le même chemin. `useSelectChannel` perd
son `useVoice()` et sa moitié vocale, garde le `useEffect` de montage
(URL `?channelId=`, auto-join) et renvoie la fonction extraite. La colonne
gauche continue de l'appeler et ne change pas de comportement.

Le sélecteur appelle en plus `setDmsOpen(false)` et efface le DM sélectionné,
comme le fait déjà `jumpToMessage` (`features/server/actions.ts:129`) quand il
atterrit sur un salon de serveur : ouvrir un salon depuis la palette alors que
la vue des messages privés est ouverte doit ramener sur le serveur.

Ouvrir un salon vocal **rejoint le vocal**. C'est le comportement du clic dans
la colonne gauche, pas une invention du chantier.

**Personne.** `trpc.dms.open.mutate({ userId })` → `setDmsOpen(true)` et
`setSelectedDmChannelId(result.channelId)`. En cas d'échec, `toast.error` avec
le message déjà traduit `couldNotOpenDM`, et la palette **reste ouverte** :
c'est la seule action qui touche le réseau, elle ne doit pas fermer la surface
sur une erreur.

Dans les deux cas, la cible est poussée en tête des récents, puis
`closeDialogs()`.

## G. La porte de sortie vers la recherche de contenu

Dès que la requête n'est pas vide, une ligne fixe est ajoutée en bas de la
liste, séparée par un filet : **« Chercher "…" dans les messages »**, avec le
badge `Ctrl+Maj+F` à droite. Elle est la ligne active par défaut **quand rien
d'autre ne correspond**.

`↵` dessus fait `openDialog(Dialog.SEARCH, { initialQuery })`. Comme un seul
dialogue est monté à la fois, le sélecteur disparaît de lui-même.

Cela demande une seule modification au dialogue existant : accepter un
`initialQuery` optionnel et en amorcer `useSearch`. Le `useEffect` de
`search/hooks.ts:18` remet `query` à `''` quand `isOpen` est faux ; l'amorçage
se fait donc à l'ouverture, pas dans un `useState` initial, sinon la valeur est
écrasée. Sans la prop, le dialogue se comporte exactement comme aujourd'hui.

## H. États

| Situation | Ce qui s'affiche |
| --- | --- |
| Champ vide, récents connus | Groupe « Récents », jusqu'à 8 lignes |
| Champ vide, aucun récent | Groupes complets, plafonnés à 8 lignes chacun |
| Requête avec résultats | Groupes filtrés + la porte de sortie |
| Requête sans résultat | La porte de sortie seule, ligne active |

Il n'y a **pas d'état de chargement** : c'est le point de la surface. Si un
jour il en faut un, c'est que la palette a quitté le magasin.

## Fichiers touchés

Neufs :

- `components/dialogs/quick-switcher/index.tsx` — le dialogue
- `components/dialogs/quick-switcher/hooks.ts` — requête, filtrage, ligne active
- `components/dialogs/quick-switcher/row.tsx` — la ligne, trois genres
- `components/dialogs/quick-switcher/matching.ts` — sous-séquence et score, pur
- `components/dialogs/quick-switcher/recents.ts` — lecture/écriture localStorage
- `packages/e2e/tests/quick-switcher.pw.ts`

Modifiés :

- `components/dialogs/dialogs.ts` et `components/dialogs/index.tsx` — un membre
  `QUICK_SWITCHER` de plus dans l'énumération et dans la carte
- `components/hotkeys-controller/index.tsx` — les deux liaisons
- `components/top-bar/server-search.tsx` — `useEffect` retiré, badge changé
- `components/dialogs/search/index.tsx` et `search/hooks.ts` — `initialQuery`
- `components/left-sidebar/hooks.ts` — `useSelectChannel` scindé
- `features/server/channels/actions.ts` — `selectChannel` extraite
- `components/voice-provider/controls-bridge.ts` et
  `components/voice-provider/index.tsx` — `joinChannel` ajouté au pont
- `features/server/selectors.ts` — `visibleChannelsSelector`
- `helpers/storage.ts` — `RECENT_TARGETS`
- `i18n/locales/{cs,en,es,fr,it,ru,zh}/dialogs.json` et `topbar.json`

Le découpage en cinq fichiers n'est pas cosmétique : `matching.ts` et
`recents.ts` sont purs et testables sans rendu, ce qui laisse au test E2E la
seule chose qu'il sait vraiment prouver, le geste de bout en bout.

## Vérification

Portes habituelles : `bun run format:check`, `check-types`, `lint` à zéro
erreur. Rappel du dépôt : `docs/**/*.md` n'est couvert par aucun
`format:check`, ce fichier est formaté à la main.

Tests unitaires sur les deux modules purs : sous-séquence trouvée et rejetée,
insensibilité aux diacritiques, ordre des quatre niveaux de score, plafond et
purge des récents.

`packages/e2e/tests/quick-switcher.pw.ts`, quatre cas qui comptent :

1. `Ctrl+K` ouvre le sélecteur, `Échap` le ferme et laisse le salon courant
   inchangé.
2. Taper le nom d'un salon puis `↵` change de salon — le geste entier.
3. `↑`/`↓` déplacent la surbrillance sans jamais s'arrêter sur un en-tête de
   groupe.
4. **Un salon privé non autorisé n'apparaît jamais**, même en tapant son nom
   exact. C'est le seul test à valeur de sécurité de la suite.

Rappels de la maison, dans l'ordre où ils ont mordu :

- vider `packages/e2e/e2e-data` avant chaque exécution, et lire « N passed »
  plutôt que le code de sortie, qui vaut 1 même au vert ;
- un run interrompu laisse un `bun` vivant sur le port 4991 qui bloque tous les
  suivants ; la commande pour le tuer est à donner à l.user ;
- ne rien bâtir sur `infinite-scroll.pw.ts`, `describe.skip` pour cause de
  flakiness.

**Vérification centrale, tirée des trois codes morts du programme** (police
`Geist` jamais chargée, `--sidebar` sans consommateur, jetons figés par
`inline`) : après implémentation, prouver dans l'application réelle que
`Ctrl+K` n'ouvre plus l'ancien dialogue et que `Ctrl+Maj+F` l'ouvre. Les portes
ne peuvent pas attraper deux écouteurs `keydown` concurrents sur `window` — si
celui de `server-search.tsx` survit, les deux dialogues se disputent la touche
et le dernier monté gagne. Grep de contrôle avant de déclarer fini : plus
aucune occurrence de `'k'` dans un `keydown` hors `hotkeys-controller`.

Deuxième vérification de la même famille, sur le pont vocal : rejoindre un
salon vocal **depuis la palette**, dans l'application réelle. C'est le seul
chemin que ni les portes ni les tests ne couvrent, et un `useVoice()` oublié y
échouerait sans rien dire — le contexte par défaut résout `init` en une
promesse vide, donc le type est bon, l'appel réussit, et il ne se passe rien.
Contrôle statique associé : `useVoice` ne doit apparaître nulle part sous
`components/dialogs/`.

## Hors périmètre, assumé

- **Aucune action** dans la palette (couper le micro, changer de thème, ouvrir
  les paramètres). Décidé par l.user : elle amène quelque part, elle ne fait
  rien. Les groupes étant déjà nommés et ordonnés, en ajouter un plus tard ne
  casse rien.
- **Aucune commande de plugin.** Une commande à arguments réclame un
  formulaire ; c'est une deuxième surface, pas une ligne de liste.
- **Pas de pastille de non-lus sur les personnes.** Le compte est indexé par
  salon (`useUnreadMessagesCount(channelId)`) et le `channelId` d'un DM n'est
  connu qu'après `trpc.dms.open`. Le lever demanderait de remonter la liste des
  conversations dans le magasin (contrainte 2) — un refactor qui déborde ce
  chantier. Les salons, eux, ont bien leur pastille.
- **Pas de recherche de message dans la palette.** Les deux surfaces restent
  distinctes, reliées par la porte de sortie du §G.
- **Le badge `Ctrl+K` n'est pas affiché sur mobile** ; la surface reste
  accessible au doigt via la colonne gauche, inchangée.
