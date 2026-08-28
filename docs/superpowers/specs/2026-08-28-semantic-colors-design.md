# Couleurs sémantiques — design

- Date : 2026-08-28
- Statut : validé en chat, prêt pour le plan d'implémentation
- Chantier B du programme « l'appli desktop n'est pas aussi propre que Discord »
- Dépend du chantier A pour un seul point, signalé en §F

## Problème

Bullshark a un système de thèmes soigné — cinq thèmes plus un thème sur mesure,
tous en `oklch`, tous dérivés de jetons. Et il a, à côté, **une seconde palette
qui n'obéit à aucun d'eux** : les couleurs par défaut de Tailwind, écrites
directement dans les composants.

Relevé sur `main` à `c48720b`, dans `apps/client/src` et `packages/ui/src` :

| Famille | Occurrences | Ce que ça désigne |
| --- | --- | --- |
| `red-*` | 42 | erreur, micro coupé, mention, danger |
| `green-*` | 30 | en ligne, connecté, actif |
| `blue-*` | 16 | vidéo active, information |
| `yellow-*` | 12 | inactif, dégradé, avertissement |
| `gray-*` | 3 | texte secondaire |
| `purple-*` | 2 | greffons |

**105 occurrences dans 22 fichiers.** Un `text-green-400` reste exactement le
même vert que le thème soit bleu, rouge, violet ou clair : il ne descend
d'aucun jeton, il ne s'adapte à rien.

C'est ce que l.user a désigné le 2026-08-28 en disant que l'appli n'était pas
aussi « propre » que Discord, après avoir écarté la densité et la structure des
bandeaux. Trois autres coupables de la même famille, hors Tailwind :

- **Les ascenseurs** (`index.css:360-367`) : six gris codés en dur, en paire
  clair/sombre au lieu des jetons — d'où une barre grise neutre dans un thème
  bleu. C'est la barre visible sur la capture de l.user.
- **`components/user-popover/index.tsx:94`** : `user.bannerColor || '#5865f2'`.
  C'est le blurple de Discord, en dur, comme couleur de bannière par défaut de
  Bullshark.
- **`.../devices/microphone-test-level-bar.tsx:152`** : un marqueur
  `bg-white/90` et une ombre `rgba(0,0,0,0.25)`, hors de tout thème.

## Ce qui n'est pas un défaut, et ne doit pas être touché

Le relevé brut trouve 44 couleurs littérales de plus. La très grande majorité
sont des **données**, pas de la décoration : couleur d'un rôle, couleur d'un
pseudo, échantillons du sélecteur de thèmes, valeurs par défaut de l'éditeur de
thème sur mesure. Elles appartiennent à l'utilisateur, pas au système.

Deux cas limites à laisser tels quels, pour que personne ne les « corrige » :

- `components/empty-state/index.tsx:18-19` : `#000` à l'intérieur d'un
  `radial-gradient` servant de masque. Ici le noir est un canal alpha, pas une
  couleur.
- `helpers/resolve-name-color.ts:5` et `.../profile/index.tsx:125` : `#ffffff`
  employé comme **sentinelle** signifiant « pas de couleur choisie ». Le
  remplacer par un jeton casserait la comparaison.

## Direction retenue

Un vocabulaire sémantique de trois jetons neufs, à côté du `--destructive` qui
existe déjà, puis la migration des 105 usages. Même forme que le chantier 2
(mouvement) : on pose des jetons, on migre, et on **prouve dans le bundle** que
les utilitaires les référencent au lieu de les figer.

## A. Le vocabulaire

Trois paires neuves, sur le modèle exact de `--destructive` :

| Jeton | Remplace | Sens |
| --- | --- | --- |
| `--success` / `--success-foreground` | `green-*` | en ligne, connecté, réussi |
| `--warning` / `--warning-foreground` | `yellow-*` | inactif, dégradé, attention |
| `--info` / `--info-foreground` | `blue-*` | information, flux vidéo actif |

`red-*` va sur `--destructive`, qui existe dans les sept blocs de thème.
`gray-*` (3 occurrences) va sur `--muted-foreground`. `purple-*` (2
occurrences, greffons) va sur `--primary` — à vérifier au cas par cas, ce sont
les deux seules dont le sens n'est pas évident.

**Les `-foreground` ne sont pas optionnels.** Sur les 105 usages, une partie
sont des fonds (`bg-red-500` sur les pastilles de mention, `bg-green-500` sur
les points de présence) qui portent du texte. Sans la paire, la migration
remplacerait un fond mais laisserait le texte en blanc codé en dur —
exactement le défaut qu'on retire.

Noter que `--destructive-foreground` **n'existe pas** aujourd'hui : le chantier
l'ajoute aussi, pour que les quatre familles aient la même forme.

## B. La règle qui décide des valeurs par thème

C'est la seule vraie question de conception du chantier, et le dépôt contient
déjà les deux réponses possibles :

- `--destructive` vaut la **même** valeur dans les six thèmes sombres et ne
  change que pour le thème clair. Il ne suit pas la teinte du thème.
- `--speaking` **change de teinte à chaque thème** : 150, 200, 30, 120, 45
  selon le thème (`index.css:128, 163, 199, 229, 259, 289`).

Les deux sont justes, pour des raisons opposées. `--speaking` est une **aura
décorative** : la teindre aux couleurs du thème l'intègre. Les couleurs
sémantiques, elles, portent un **sens que l'utilisateur doit reconnaître sans
apprendre** : un succès vert-devenu-rouge dans le thème « gaming red » se
lirait comme une erreur.

**Règle retenue : la teinte est fixe, la clarté et le chroma s'adaptent au
fond.** Un succès est vert dans tous les thèmes ; il est simplement plus clair
sur un fond sombre et plus soutenu sur un fond clair, pour garder son contraste.
Concrètement : une valeur par jeton pour les six thèmes sombres, une autre pour
le thème clair — la structure que `--destructive` a déjà.

**Le thème sur mesure ne dérive pas ces jetons.** `.dark.theme-custom`
(`index.css:302`) construit tout à partir de `--custom-accent` par la syntaxe de
couleur relative. Appliquer ça aux couleurs sémantiques donnerait un « succès »
de la teinte choisie par l'utilisateur — un succès rouge si son accent est
rouge. Les quatre jetons sémantiques y reprennent donc les valeurs de `.dark`,
sans dérivation.

## C. Le mappage Tailwind, et le piège hérité du chantier 2

Les jetons rejoignent le bloc `@theme inline` existant (`index.css:25`), auprès
des autres couleurs :

```css
  --color-success: var(--success);
  --color-success-foreground: var(--success-foreground);
  --color-warning: var(--warning);
  --color-warning-foreground: var(--warning-foreground);
  --color-info: var(--info);
  --color-info-foreground: var(--info-foreground);
  --color-destructive-foreground: var(--destructive-foreground);
```

**`inline` est correct ici, et c'est contre-intuitif.** Le chantier 2 a laissé
dans ce fichier un commentaire en capitales disant « `@theme static` et SURTOUT
PAS `inline` », parce que `inline` aurait figé les durées et tué la garde
`prefers-reduced-motion`. La règle ne se transpose pas : pour une couleur,
`inline` est précisément ce qui fait marcher le changement de thème, puisque la
valeur inlinée est elle-même un `var(--success)` que la classe `.dark` ou
`.theme-*` redéfinit. Toutes les couleurs existantes du fichier sont déjà dans
ce bloc. **Ne pas déplacer les couleurs vers `static` en croyant appliquer la
leçon du chantier 2.**

## D. Les trois coupables hors Tailwind

**Les ascenseurs.** Les six variables `--scrollbar-*` disparaissent au profit
des jetons : piste en `--background`, pouce en `--muted-foreground` avec
opacité, pouce survolé plus opaque. Retenir la leçon du chantier 1 :
`--border` vaut `oklch(1 0 0 / 10%)` dans tous les thèmes sombres et est
invisible sur une forme pleine — pour toute forme, `--muted-foreground` avec
opacité, jamais `--border`.

**Le blurple.** `'#5865f2'` devient `--primary`. Une bannière sans couleur
choisie prend l'accent du serveur, ce qui est le comportement qu'on attendait
depuis le début.

**Le marqueur du testeur de micro.** `bg-white/90` devient `--foreground` avec
la même opacité ; l'ombre `rgba(0,0,0,0.25)` devient `--background` avec
opacité, pour qu'elle reste un cerne de séparation dans le thème clair aussi.

## E. La migration, fichier par fichier

Vingt-deux fichiers. Les surfaces les plus vues d'abord, pour que le bénéfice
soit visible tôt si le chantier est interrompu :

1. **Panneau vocal** — `channel-view/voice/external-stream-card.tsx`,
   `screen-share-card.tsx`, `stream-settings-popover.tsx`,
   `left-sidebar/voice-control.tsx`, `external-stream.tsx`,
   `stats-popover.tsx`. C'est la dette explicitement notée au chantier 3.
2. **Présence et mentions** — `user-status/index.tsx`, `mention-chip/index.tsx`,
   `unread-count/index.tsx`, `left-sidebar/user-control.tsx`,
   `left-sidebar/channels.tsx`.
3. **Paquet `@sharkord/ui`** — `alert.tsx`, `color.tsx`, `group.tsx`. Toucher
   le paquet partagé en dernier parmi les surfaces vues, parce qu'il porte sur
   plusieurs écrans à la fois.
4. **Écrans de réglage et d'administration** —
   `server-settings/users/table-user.tsx`,
   `user-settings/devices/microphone-test-level-bar.tsx`,
   `channel-view/text/overrides/command.tsx`,
   `dialogs/plugin-commands/response.tsx`,
   `plugin-slot-renderer/error-boundary.tsx`,
   `plugin-slot-debug-wrapper.tsx`, `user-popover/index.tsx`,
   `screens/disconnected/index.tsx`.

La correspondance n'est pas mécanique partout : `text-red-500` sur un message
d'erreur et `bg-red-500` sur une pastille de mention deviennent l'un
`text-destructive`, l'autre `bg-destructive text-destructive-foreground`.
Chaque remplacement demande de regarder si la couleur est un **premier plan**
ou un **fond**.

## F. La bannière du shell — dépend du chantier A

`bullshark-desktop`, `src/preload/bridge.ts:14-22` : le shell injecte sa
bannière de compatibilité en DOM brut, avec `system-ui` comme police,
`#c0392b` ou `#f0ad4e` comme fond, `#222222` ou `#ffffff` comme texte et sa
propre ombre. Elle est collée par-dessus une application en Geist et thémée —
c'est le même défaut, dans l'autre dépôt.

**Elle ne peut pas être corrigée seule** : le shell ne connaît pas les couleurs
du thème courant. Le chantier A construit précisément le canal qui les lui
apprend (`setTitleBarColors` sur le pont, §C de sa spec). La bannière est donc
traitée **après** le chantier A, en réutilisant ce canal, et son changement vit
dans le dépôt `bullshark-desktop`.

## Vérification

Portes habituelles à zéro erreur : `format:check`, `check-types`, `lint`.

**Une porte neuve, et elle est le cœur de la vérification** — un grep qui doit
rendre zéro :

```bash
grep -rE "(text|bg|border|ring)-(red|green|blue|yellow|amber|orange|purple|pink|emerald|sky|slate|gray|zinc)-[0-9]{2,3}" \
  apps/client/src packages/ui/src --include=*.tsx
```

Il vaut 105 aujourd'hui. Il doit valoir 0 à la fin, et c'est la seule preuve
que la migration est complète plutôt que partielle.

**Vérification centrale dans le bundle construit**, leçon des trois codes morts
du programme beauté : après `bun run build`, confirmer que la feuille émise
contient bien `.text-success{color:var(--success)}` et non une valeur `oklch`
figée, et que `--success` est redéfini dans chaque bloc de thème. Un jeton
correctement déclaré mais figé par l'utilitaire est exactement le défaut qui a
failli passer au chantier 2.

**Vérification visuelle par l.user**, la seule qui juge le résultat : ouvrir le
panneau vocal et la liste des membres **dans au moins deux thèmes de teintes
opposées** — `bullshark` (bleu) et `gaming-red` (rouge) — et confirmer que les
états de présence et de micro restent lisibles et reconnaissables dans les
deux. C'est le point où une teinte fixe mal choisie se verrait.

## Hors périmètre, assumé

- **Les couleurs de données** (rôles, pseudos, échantillons de thème) ne sont
  pas touchées. Elles appartiennent à l'utilisateur.
- **`--speaking` garde sa dérivation par thème.** C'est une aura décorative, la
  règle du §B ne s'y applique pas, et le chantier 3 l'a déjà traitée.
- **Aucun nouveau thème**, aucune retouche des palettes existantes. On ajoute
  des jetons, on n'en modifie aucun.
- **Le contraste n'est pas audité formellement.** On choisit des valeurs
  lisibles et l.user tranche à l'œil sur deux thèmes ; un audit de contraste
  systématique serait un chantier à part.
