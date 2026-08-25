# Langage de mouvement — design

- Date : 2026-08-25
- Statut : validé en chat sur maquette, prêt pour le plan d'implémentation
- Chantier 2 du programme « rendre Bullshark beau »

Maquette avant/après validée :
https://claude.ai/code/artifact/305a5836-985d-48c6-aa87-2864973d1e10

## Problème

Les chantiers 1, 3 et 4 ont donné au client une identité, une scène vocale et
une première impression. Le mouvement, lui, n'a jamais été traité : il n'existe
aucun jeton de durée ni de courbe, chaque valeur est écrite à la main, et la
garde d'accessibilité couvre un seul sélecteur de toute l'application.

Chiffres relevés dans `apps/client/src` le 2026-08-25, sur `main` à `f9916ed` :

- **149** déclarations de mouvement (`transition-*`, `animate-*`, `duration-*`)
  réparties dans **55** fichiers.
- **7** durées distinctes en dur : `duration-200` (×17), `300` (×6), `500` (×3),
  `150` (×3), `75`, `700`, `1000`.
- **19** courbes explicites seulement, dont **17** `ease-in-out`. Tout le reste
  hérite d'un défaut : `cubic-bezier(0.4, 0, 0.2, 1)` pour les transitions
  Tailwind, et le `ease` nu de `tw-animate-css` pour les composants de
  `packages/ui` (`--animate-in` retombe sur
  `var(--tw-animation-duration, var(--tw-duration, .15s)) var(--tw-ease, ease)`).
- **21** `transition-all`, qui animent aussi les propriétés qu'on ne visait pas.
- **5** boucles infinies sans garde : `speaking-glow-low|medium|high`
  (`index.css:543-551`), `eye-blink` et `wf-loop` (keyframes inline dans
  `left-sidebar/waveform.tsx`).
- **1** seul sélecteur sous `prefers-reduced-motion` : `.connect-halo`
  (`index.css:628`), livré par le chantier 4.

Deux conséquences distinctes, et c'est la seconde qui porte le chantier.

**Ça se sent comme de la latence.** `ease-in-out` est plat au départ : rien ne
bouge pendant les premières dizaines de millisecondes, donc le geste parait
ignoré. C'est la courbe, pas la durée, qui est en cause.

**La garde d'accessibilité est une règle qu'on peut oublier d'écrire.** C'est
exactement ce qui s'est passé : quatre chantiers, une seule garde. Tant que
`prefers-reduced-motion` est un bloc que le développeur doit penser à ajouter à
la fin, il sera oublié la fois suivante.

## Contrainte structurante

**La garde doit être portée par le jeton, pas par une règle séparée.** C'est
l'idée qui fait tenir le chantier en une couche de thème plutôt qu'en 55
fichiers de rustines : si choisir le bon jeton suffit à être gardé, on ne peut
plus oublier la garde.

D'où la séparation en **deux familles de durée** :

- ce qui **fond** (opacité, couleur) : un fondu n'est pas un mouvement, il reste
  actif en mouvement réduit, sinon l'interface parait saccadée ;
- ce qui **bouge** (`transform`, position, échelle) : cette famille seule tombe
  à zéro en mouvement réduit, avec les distances de déplacement.

Piège vérifié : `index.css:25` déclare `@theme inline`, et `inline` fige la
valeur dans l'utilitaire généré, ce qui rendrait toute redéfinition par media
query sans effet. **Les jetons de mouvement doivent aller dans un bloc `@theme`
non-inline**, séparé de l'existant.

## Direction retenue

Une échelle courte, une courbe de sortie unique, et quatre signatures visibles.
Rien à installer : Tailwind 4.2.1 et `tw-animate-css` 1.4.0 sont déjà là.

Vérifié dans Tailwind 4.2.1 : l'utilitaire `duration-*` lit le namespace
`--transition-duration-*` et `ease-*` lit `--ease-*`. Les jetons deviennent donc
de vrais utilitaires nommés (`duration-base`, `ease-out`), pas des
`duration-[var(...)]`.

## A. Les jetons

Dans un nouveau bloc `@theme` non-inline de `apps/client/src/index.css`.

### Durées

| Jeton                             | Valeur | Pour                                                        |
| --------------------------------- | ------ | ----------------------------------------------------------- |
| `--transition-duration-fast`      | 120ms  | Fondu et couleur sous le curseur : survol, appui            |
| `--transition-duration-base`      | 200ms  | Fondu par défaut : menus, infobulles, panneaux              |
| `--transition-duration-slow`      | 320ms  | Fondu des grandes surfaces : dialogues, tiroirs, dépôt      |
| `--transition-duration-move-fast` | 120ms  | Déplacement court : appui qui s'enfonce, bascule            |
| `--transition-duration-move-base` | 200ms  | Déplacement par défaut : message qui monte, menu qui glisse |
| `--transition-duration-move-slow` | 320ms  | Déplacement ample : tiroir, barre vocale, plein écran       |

Les deux familles ont volontairement les mêmes valeurs : elles ne diffèrent que
par leur comportement en mouvement réduit. Le nom encode l'intention, pas une
durée différente.

Amendement d'implémentation (2026-08-25) : quatre jetons du vocabulaire n'ont
pas encore de consommateur après le chantier 2 — `--transition-duration-slow`,
`--transition-duration-move-fast`, `--ease-in`, `--ease-move`. C'est une tension
assumée avec la vérification §3 (« aucun jeton sans usage ») : `@theme static`
émet le vocabulaire complet exprès, pour que la migration « au fil de l'eau »
des autres surfaces puisse s'appuyer dessus sans re-toucher le thème. À
consommer ou à retirer lors de cette migration.

Deux distances, et deux seulement, pour que rien ne dérive :

| Jeton    | Valeur | Pour                                                   |
| -------- | ------ | ------------------------------------------------------ |
| `--rise` | 6px    | Montée d'un élément qui apparait dans le flux          |
| `--lift` | 12px   | Arrivée d'une surface ancrée à un bord (barre, tiroir) |

S'y ajoute `--pop-from`, l'échelle de départ du seul effet à rebond du chantier
: `0.6` par défaut, `1` en mouvement réduit.

`--rise`, `--lift` et `--pop-from` sont des variables CSS ordinaires (déclarées
dans `:root`), pas des jetons `@theme` : elles sont consommées en
`translate-y-[var(--rise)]` et `scale-[var(--pop-from)]`.

### Courbes

| Jeton         | Valeur                              | Pour                                                                               |
| ------------- | ----------------------------------- | ---------------------------------------------------------------------------------- |
| `--ease-out`  | `cubic-bezier(0.16, 1, 0.3, 1)`     | Tout ce qui entre ou répond à un geste. Le cas par défaut.                         |
| `--ease-in`   | `cubic-bezier(0.4, 0, 1, 1)`        | Tout ce qui sort. On ne soigne pas une sortie.                                     |
| `--ease-move` | `cubic-bezier(0.65, 0, 0.35, 1)`    | Ce qui se déplace en restant à l'écran : redimensionnement, réordonnancement.      |
| `--ease-pop`  | `cubic-bezier(0.34, 1.56, 0.64, 1)` | Le dépassement. **Réservé aux réactions et à la soundboard, nulle part ailleurs.** |

`--ease-out` et `--ease-in` **écrasent les jetons Tailwind du même nom**, donc
les 2 `ease-out` déjà présents dans le client changent de courbe : c'est voulu.

`--ease-in-out` n'est **pas** redéfini. Les 17 usages existants sont migrés vers
`ease-out`, et la classe reste disponible pour un futur va-et-vient.

## B. La garde

Un seul bloc. Amendement d'implémentation (2026-08-25) : il est placé en **fin
de fichier**, pas immédiatement après les jetons. Les variables des jetons sont
émises par `@theme` dans une couche `@layer`, et du CSS hors couche l'emporte
toujours sur du CSS en couche quel que soit l'ordre source ; placer la garde
hors couche, en fin de fichier, est donc ce qui lui permet de redéfinir les
jetons. Vérifié dans le bundle : `--transition-duration-move-base` y passe bien
de `.2s` à `.01ms`.

```css
@media (prefers-reduced-motion: reduce) {
  :root {
    --transition-duration-move-fast: 0.01ms;
    --transition-duration-move-base: 0.01ms;
    --transition-duration-move-slow: 0.01ms;
    --rise: 0px;
    --lift: 0px;
    --pop-from: 1;
  }
}
```

Tout ce qui consomme `duration-move-*`, `--rise` ou `--lift` est gardé sans que
personne n'ait à y penser. C'est le coeur du chantier.

### Le filet de sécurité

Les boucles décoratives n'utilisent aucun jeton de durée : elles ont leur propre
`animation`. Le filet cible donc précisément ce qui nuit, à savoir la répétition
infinie, et rien d'autre :

```css
@media (prefers-reduced-motion: reduce) {
  *:not([data-motion-keep]):not([data-motion-keep] *) {
    animation-iteration-count: 1 !important;
  }
}
```

`data-motion-keep` est posé sur les **deux** surfaces dont la boucle porte de
l'information et qu'aucune autre règle ne traite, et nulle part ailleurs :

- `Spinner` (`packages/ui/src/components/spinner.tsx`) : un chargement figé se
  lit comme une panne ;
- `TypingDots` (`apps/client/src/components/typing-dots/index.tsx`) : idem.

L'indicateur de parole porte de l'information lui aussi, mais sa classe est
posée dynamiquement par `use-audio-level.ts` : il est traité par une règle CSS
explicite (juste en dessous) plutôt que par un attribut, ce qui évite de plomber
le composant consommateur. `animation: none` y neutralise l'animation sans que
le `!important` du filet ait quoi que ce soit à contredire.

Les squelettes (`animate-pulse`) ne sont **pas** marqués : figés, ils restent
parfaitement lisibles comme squelettes.

### Les cinq boucles existantes

- `speaking-effect-low|medium|high` : la pulsation est coupée par un
  `animation: none` explicite et remplacée par un anneau fixe en
  `var(--speaking)`, qui dit la même chose sans clignoter.
- `eye-blink` et `wf-loop` (`left-sidebar/waveform.tsx`) : décoratifs, coupés
  par le filet. Leurs keyframes sont sorties du `<style>` inline vers
  `index.css` au passage, pour être gardables et greppables comme les autres.
- `connect-drift-a|b` : déjà gardées par le chantier 4, laissées telles quelles.

## C. Les six surfaces

### 1. Survol d'une ligne de la colonne gauche

`channels.tsx:183` n'a **aucune** transition : le survol est instantané, alors
que 37 autres endroits du client adoucissent leurs couleurs. C'est
l'incohérence, pas la vitesse, qui se voit.

Ajouter `transition-colors duration-fast ease-out` aux **quatre** lignes soeurs
alignées au chantier 1 : `channels.tsx:183`, `direct-messages/index.tsx:43`,
`dm-button.tsx:27`, `plugin-buttons.tsx:31`.

### 2. Menus, popovers, infobulles

13 occurrences d'`animate-in` dans `packages/ui`, sans aucun `duration-*` ni
`ease-*`, donc à 150ms sur `ease`.

Sur chacune : ajouter `duration-base ease-out` (l'utilitaire `duration-*` de
Tailwind 4 alimente `--tw-duration`, et `ease-*` alimente `--tw-ease`, que
`tw-animate-css` lit) et passer `zoom-in-95`/`zoom-out-95` à `zoom-in-98` /
`zoom-out-98`. Les `slide-in-from-*-2` (8px, dans le sens de l'ancrage) sont
conservés tels quels.

Choix assumé : on modifie 13 classes plutôt que de redéfinir `--animate-in` et
`--animate-out` dans notre `@theme`. Une redéfinition serait plus courte mais
recopierait la définition interne de la bibliothèque, qui casserait en silence à
la prochaine mise à jour.

### 3. Arrivée d'un message

**La liste n'est pas virtualisée** : `channel-view/text/index.tsx:232` fait un
`groupedMessages.map()` ordinaire (`react-virtuoso` ne sert qu'au sélecteur
d'emoji). Le risque n'est donc pas le scintillement d'une fenêtre virtuelle mais
le **remontage** : un groupe qui se reforme parce qu'un message le rejoint
rejouerait l'animation sur des messages déjà lus, et la pagination la rejouerait
sur tout l'historique.

Règle : **l'animation se déclenche sur l'identifiant du message, jamais sur le
rendu.** Un hook retient l'identifiant le plus élevé connu au montage du salon ;
seuls les messages d'identifiant strictement supérieur, et arrivés pendant que
le composant est monté, reçoivent la classe d'entrée, une seule fois. Ni au
premier rendu, ni au changement de salon, ni à la pagination.

Animation : fondu plus `translateY(var(--rise))`, en
`duration-move-base ease-out`.

### 4. Réaction ajoutée

`message-reactions.tsx` n'a aucune transition : la pastille apparait sèchement.

Même règle que pour les messages, appliquée à la pastille : la première peinture
d'une réaction déjà présente n'anime rien ; seule une réaction qui apparait
pendant que le message est à l'écran fait son entrée, en
`scale(var(--pop-from))` vers 1, `duration-move-base ease-pop`.

`--pop-from` vaut `0.6`, et `1` en mouvement réduit : le dépassement disparait
de lui-même, il ne reste qu'un fondu.

### 5. Barre de contrôles vocale

`controls-bar.tsx:45` : `transition-all duration-300 ease-in-out` avec
`translate-y-10`, soit 40px. C'est précisément ce qui avait ressemblé à un
défaut sur la capture du chantier 3 : 40px de décalage contre un `bottom-8` de
32px font sortir la barre du conteneur `overflow-hidden` de
`voice/index.tsx:146` en cours de fondu.

Remplacer par `transition-[opacity,transform] duration-move-base ease-out` et
`translate-y-[var(--lift)]` (12px). Le `transition-all` disparait au passage :
il faisait aussi transiter `gap` et la couleur.

### 6. Indicateur de parole

Traité en B. Rien de plus ici.

## D. Migration des valeurs existantes

Sur les **surfaces touchées par ce chantier uniquement** :

- `duration-150|200|300|500|700|1000` → `duration-fast|base|slow` selon
  l'intention, ou `duration-move-*` si la propriété animée est un `transform` ;
- `ease-in-out` → `ease-out` pour tout ce qui entre ou répond à un geste ;
- `transition-all` → la liste explicite des propriétés animées.

Les autres occurrences restent en l'état : leur conversion est mécanique, sans
risque, et sera faite au fil de l'eau plutôt que dans une revue de branche déjà
chargée.

## Vérification

Les portes (`format:check`, `check-types`, `lint`) ne peuvent pas attraper ce
qui casse dans ce genre de chantier. Ce programme en a déjà fait trois fois
l'expérience : la police Geist jamais chargée, `--sidebar` sans consommateur, la
zone de dépôt qui ne s'abonnait à rien. **Vérifier dans le bundle construit, pas
seulement au vert des portes.**

1. **Les jetons sortent en `var()`, pas en littéral.** Grep dans le CSS
   construit : `.duration-move-base` doit contenir
   `var(--transition-duration-move-base)`. S'il contient `200ms` en dur, le bloc
   `@theme` a été traité comme `inline` et **toute la garde est morte**. Repli
   dans ce cas : déclarer les durées en variables CSS ordinaires et fournir les
   utilitaires via `@utility`.
2. **La garde s'applique.** Le bloc `@media (prefers-reduced-motion: reduce)`
   est présent dans le bundle et redéfinit bien les trois `move-*`.
3. **Les jetons ont des consommateurs.** Chaque jeton ajouté est grepé dans le
   client : aucun ne doit rester sans usage (leçon C2 du chantier 1).
4. **Les courbes écrasent bien celles de Tailwind.** `.ease-out` dans le bundle
   vaut `cubic-bezier(0.16, 1, 0.3, 1)` et non `cubic-bezier(0, 0, 0.2, 1)`.
5. **`tw-animate-css` obéit.** Sur un popover, `--tw-duration` et `--tw-ease`
   sont bien posés par les nouvelles classes.
6. **Test E2E** sur l'animation d'arrivée de message : l'assertion qui compte
   est qu'un message de l'historique ne porte **pas** la classe d'entrée après
   pagination. C'est le seul défaut de ce chantier qu'aucune relecture
   n'attrapera, comme la zone de dépôt du chantier 4.
7. **Validation visuelle par l.user sur le Kimsufi**, y compris avec le réglage
   système de mouvement réduit activé.

## Hors périmètre, assumé

- **Pas de transitions de vue.** Animer le changement de salon veut dire animer
  le remplacement de toute la liste des messages, rendue d'un bloc. Gros risque
  de à-coups, gain incertain, sans rapport avec le reste du chantier.
- **Pas de bibliothèque d'animation.** Rien à installer.
- **Pas de réécriture des composants de `packages/ui`.** Ils sont déjà
  cohérents, ils reçoivent seulement durée et courbe.
- **Pas de chasse aux 21 `transition-all`** hors des surfaces traitées ici.
- **Dettes des chantiers précédents non reprises ici** : `rounded-pill` que
  twMerge ne connait pas, `--edge-hi` sans effet en thème clair, Geist en latin
  seul sans `unicode-range`, couleurs en dur de `voice-control.tsx` et
  `stats-popover.tsx`.
