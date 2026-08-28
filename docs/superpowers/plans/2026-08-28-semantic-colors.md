# Couleurs sémantiques — plan d'implémentation

> **Pour les agents :** SOUS-COMPÉTENCE REQUISE : utiliser
> superpowers:subagent-driven-development (recommandé) ou
> superpowers:executing-plans pour exécuter ce plan tâche par tâche. Les étapes
> utilisent la syntaxe case à cocher (`- [ ]`).

**But :** supprimer la seconde palette du client — 105 usages des couleurs
Tailwind par défaut, qui n'obéissent à aucun thème — au profit de quatre
familles sémantiques dérivées des jetons.

**Architecture :** trois paires de jetons neuves (`--success`, `--warning`,
`--info`) rejoignent le `--destructive` existant dans les sept blocs de thème,
sont exposées à Tailwind par le bloc `@theme inline` où vivent déjà toutes les
couleurs, puis les 105 usages migrent par surface, des plus vues aux moins
vues. La teinte de chaque jeton reste fixe d'un thème à l'autre ; seuls la
clarté et le chroma s'adaptent au fond.

**Pile :** Tailwind 4.2.1, CSS `oklch`, React 19, `bun test`.

**Spec :** `docs/superpowers/specs/2026-08-28-semantic-colors-design.md`

## Contraintes globales

- Branche `feat/semantic-colors`, base `main` = `c48720b`.
- Prettier : `singleQuote: true`, `trailingComma: "none"`, `printWidth: 80`,
  `semi: true`. La CI casse sur `format:check`.
- Portes à zéro erreur avant chaque commit : `bun run format:check`,
  `bun run check-types`, `bun run lint`.
- Aucune dépendance nouvelle, **aucun thème nouveau**, et **aucune valeur de
  jeton existante modifiée**. On ajoute, on ne retouche pas.
- Le mappage passe par le bloc **`@theme inline`** (`index.css:25`), celui qui
  porte déjà toutes les couleurs. **Ne pas le déplacer vers `@theme static`**
  en croyant appliquer la leçon du chantier 2 : cette leçon vise les durées,
  où `inline` figerait la valeur et tuerait la garde `prefers-reduced-motion`.
  Pour une couleur, `inline` est justement ce qui fait marcher le changement de
  thème, la valeur inlinée étant elle-même un `var(--x)` que `.dark` et
  `.theme-*` redéfinissent.
- **Correspondance des familles**, valable pour toute la migration :

  | Palette Tailwind | Jeton | Occurrences |
  | --- | --- | --- |
  | `red-*` | `--destructive` | 42 |
  | `green-*` | `--success` | 30 |
  | `blue-*` | `--info` | 16 |
  | `yellow-*` | `--warning` | 12 |
  | `gray-*` | `--muted-foreground` | 3 |
  | `purple-*` | au cas par cas | 2 |

- **Premier plan ou fond, la question se pose à chaque remplacement.**
  `text-red-500` sur un message d'erreur devient `text-destructive`.
  `bg-red-500` sur une pastille de mention devient
  `bg-destructive text-destructive-foreground` — le fond seul laisserait le
  texte en blanc codé en dur, c'est-à-dire le défaut qu'on retire.
- Messages de commit en français, préfixe conventional-commit, et les deux
  lignes de fin :
  ```
  Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01YTbgCnmJFC1jPgAD4ukYEn
  ```

---

### Tâche 1 : poser le vocabulaire

**Fichiers :**

- Modifier : `apps/client/src/index.css` — le bloc `@theme inline` (ligne 25),
  puis les sept blocs de thème (`:root` 97, `.dark` 139,
  `.dark.theme-gaming-red` 180, `.dark.theme-deep-ocean` 210,
  `.dark.theme-midnight-purple` 240, `.dark.theme-bullshark` 270,
  `.dark.theme-custom` 302)

**Interfaces :**

- Consomme : rien.
- Produit : les utilitaires Tailwind `text-success`, `bg-success`,
  `text-success-foreground`, et les mêmes pour `warning`, `info`, plus
  `destructive-foreground`.

Aucune migration dans cette tâche : elle pose le vocabulaire et **prouve qu'il
n'est pas mort**. Les trois codes morts du programme beauté (police jamais
chargée, jeton sans consommateur, jeton figé) sont tous nés d'une étape comme
celle-ci que personne n'avait vérifiée dans le bundle.

- [ ] **Étape 1 : ajouter les valeurs aux sept blocs de thème**

Dans **`:root`** (thème clair, fond blanc — les couleurs doivent être sombres
pour contraster, et leur premier plan clair) :

```css
  --success: oklch(0.55 0.15 150);
  --success-foreground: oklch(0.98 0 0);
  --warning: oklch(0.62 0.14 85);
  --warning-foreground: oklch(0.98 0 0);
  --info: oklch(0.55 0.16 240);
  --info-foreground: oklch(0.98 0 0);
  --destructive-foreground: oklch(0.98 0 0);
```

Dans **`.dark`** et dans les **cinq blocs de thème sombre** (`theme-gaming-red`,
`theme-deep-ocean`, `theme-midnight-purple`, `theme-bullshark`,
`theme-custom`), les mêmes six lignes, avec les valeurs sombres — les couleurs
sont claires pour ressortir sur un fond sombre, et leur premier plan est sombre :

```css
  --success: oklch(0.72 0.17 150);
  --success-foreground: oklch(0.15 0.02 150);
  --warning: oklch(0.8 0.15 85);
  --warning-foreground: oklch(0.18 0.03 85);
  --info: oklch(0.7 0.14 240);
  --info-foreground: oklch(0.15 0.02 240);
  --destructive-foreground: oklch(0.98 0 0);
```

**Les six mêmes valeurs dans les six blocs sombres, sans variation.** C'est la
règle du §B de la spec : un succès reste vert dans le thème rouge, sinon il se
lit comme une erreur. Ne pas être tenté de faire tourner la teinte comme le
fait `--speaking` : `--speaking` est une aura décorative, ces jetons portent un
sens.

**`.dark.theme-custom` reçoit exactement les mêmes valeurs littérales**, sans
passer par la syntaxe de couleur relative que ce bloc utilise pour tout le
reste. Un succès dérivé de `--custom-accent` serait rouge si l'utilisateur
choisit un accent rouge.

`--destructive` existe déjà partout et **n'est pas touché** ; seul son premier
plan est ajouté.

- [ ] **Étape 2 : exposer les jetons à Tailwind**

Dans le bloc `@theme inline` (`index.css:25`), auprès des autres couleurs :

```css
  --color-success: var(--success);
  --color-success-foreground: var(--success-foreground);
  --color-warning: var(--warning);
  --color-warning-foreground: var(--warning-foreground);
  --color-info: var(--info);
  --color-info-foreground: var(--info-foreground);
  --color-destructive-foreground: var(--destructive-foreground);
```

- [ ] **Étape 3 : prouver dans le bundle construit que les jetons vivent**

C'est l'étape que le programme beauté a appris à ne jamais sauter.

```bash
cd apps/client && bun run build
grep -rn "text-success{" dist/assets/*.css
grep -rc -- "--success:" dist/assets/*.css
```

Attendu, et à vérifier ligne à ligne :

1. `.text-success{color:var(--success)}` — la règle **référence** le jeton. Si
   elle contient une valeur `oklch(...)` figée à la place, le mappage a été mis
   dans `@theme static` au lieu d'`inline`, et le changement de thème ne
   fonctionnera pas.
2. `--success:` apparaît **7 fois**, une par bloc de thème. Un compte inférieur
   signale un bloc oublié.

Si un utilitaire n'est pas généré du tout, c'est que Tailwind ne voit encore
aucun consommateur : c'est attendu à ce stade, et ce sera vrai dès la tâche 2.
Dans ce cas, écrire temporairement `<div className="text-success" />` dans un
composant, refaire le build, vérifier, puis retirer.

- [ ] **Étape 4 : portes et commit**

```bash
bun run format:check && bun run check-types && bun run lint
git add apps/client/src/index.css
git commit -m "feat(client): poser le vocabulaire de couleurs semantiques"
```

---

### Tâche 2 : migrer le panneau vocal

**Fichiers :**

- Modifier : `components/left-sidebar/voice-control.tsx` (15 occurrences)
- Modifier : `components/channel-view/voice/external-stream-card.tsx` (9)
- Modifier : `components/left-sidebar/stats-popover.tsx` (8)
- Modifier : `components/left-sidebar/external-stream.tsx` (3)
- Modifier : `components/channel-view/voice/stream-settings-popover.tsx` (1)
- Modifier : `components/channel-view/voice/screen-share-card.tsx` (1)

**Interfaces :**

- Consomme : les utilitaires de la tâche 1.
- Produit : rien qu'une autre tâche importe.

37 occurrences. C'est la dette explicitement notée à la fin du chantier 3
(« couleurs en dur de voice-control/stats-popover »), et ce sont les surfaces
qu'un joueur regarde le plus.

- [ ] **Étape 1 : relever ce qui est à changer**

```bash
grep -nE "(text|bg|border|ring)-(red|green|blue|yellow|amber|orange|purple|pink|emerald|sky|slate|gray|zinc)-[0-9]{2,3}" \
  apps/client/src/components/left-sidebar/voice-control.tsx \
  apps/client/src/components/channel-view/voice/external-stream-card.tsx \
  apps/client/src/components/left-sidebar/stats-popover.tsx \
  apps/client/src/components/left-sidebar/external-stream.tsx \
  apps/client/src/components/channel-view/voice/stream-settings-popover.tsx \
  apps/client/src/components/channel-view/voice/screen-share-card.tsx
```

Attendu : 37 lignes.

- [ ] **Étape 2 : remplacer, en décidant à chaque fois**

Appliquer la table de correspondance des contraintes globales. Exemples réels
tirés de ces fichiers :

```tsx
// external-stream-card.tsx : un casque actif, couleur de premier plan
- <Headphones className="size-10 text-green-400" />
+ <Headphones className="size-10 text-success" />

// external-stream-card.tsx : une pastille pleine, donc un fond
- <div className="absolute inset-0 rounded-full animate-pulse bg-green-500" />
+ <div className="absolute inset-0 rounded-full animate-pulse bg-success" />

// external-stream-card.tsx : micro coupé ou non
- className={isMuted ? 'text-red-400' : 'text-green-400'}
+ className={isMuted ? 'text-destructive' : 'text-success'}

// external-stream-card.tsx : flux vidéo actif
- <Video className="size-3 text-blue-400" />
+ <Video className="size-3 text-info" />
```

**Quand la couleur est un fond qui porte du texte**, ajouter le premier plan :
`bg-success` devient `bg-success text-success-foreground`. Un fond seul laisse
le texte hériter d'une couleur qui n'a pas été pensée pour lui.

Les nuances Tailwind (`-400` contre `-500`) disparaissent : le jeton porte
désormais la nuance juste pour chaque thème. Ne pas essayer de les reproduire
avec des opacités.

- [ ] **Étape 3 : vérifier que le compte est à zéro sur ces six fichiers**

Relancer le grep de l'étape 1.
Attendu : aucune ligne.

- [ ] **Étape 4 : portes et commit**

```bash
bun run format:check && bun run check-types && bun run lint
git add apps/client/src/components/left-sidebar apps/client/src/components/channel-view/voice
git commit -m "refactor(client): migrer le panneau vocal vers les couleurs semantiques"
```

---

### Tâche 3 : migrer la présence et les mentions

**Fichiers :**

- Modifier : `components/left-sidebar/user-control.tsx` (8 occurrences)
- Modifier : `components/user-status/index.tsx` (3)
- Modifier : `components/mention-chip/index.tsx` (2)
- Modifier : `components/left-sidebar/channels.tsx` (2)
- Modifier : `components/unread-count/index.tsx` (1)

**Interfaces :**

- Consomme : les utilitaires de la tâche 1.
- Produit : rien qu'une autre tâche importe.

16 occurrences. Ce sont les points de couleur les plus regardés de
l'application : présence en ligne, mentions non lues.

- [ ] **Étape 1 : relever ce qui est à changer**

```bash
grep -nE "(text|bg|border|ring)-(red|green|blue|yellow|amber|orange|purple|pink|emerald|sky|slate|gray|zinc)-[0-9]{2,3}" \
  apps/client/src/components/left-sidebar/user-control.tsx \
  apps/client/src/components/user-status/index.tsx \
  apps/client/src/components/mention-chip/index.tsx \
  apps/client/src/components/left-sidebar/channels.tsx \
  apps/client/src/components/unread-count/index.tsx
```

Attendu : 16 lignes.

- [ ] **Étape 2 : remplacer**

La correspondance des états de présence :

| État | Avant | Après |
| --- | --- | --- |
| en ligne | `bg-green-500` | `bg-success` |
| inactif | `bg-yellow-400` / `bg-yellow-500` | `bg-warning` |
| hors ligne | `bg-gray-*` | `bg-muted-foreground` |
| ne pas déranger | `bg-red-500` | `bg-destructive` |

`unread-count/index.tsx:19` est un cas de fond porteur de texte, déjà écrit
correctement pour `--primary` mais pas pour la mention :

```tsx
- hasMention && 'bg-red-500 text-white',
+ hasMention && 'bg-destructive text-destructive-foreground',
```

C'est exactement le cas que la règle « fond ou premier plan » vise : le
`text-white` codé en dur disparaît avec le fond.

- [ ] **Étape 3 : vérifier que le compte est à zéro sur ces cinq fichiers**

Relancer le grep de l'étape 1.
Attendu : aucune ligne.

- [ ] **Étape 4 : portes et commit**

```bash
bun run format:check && bun run check-types && bun run lint
git add apps/client/src/components
git commit -m "refactor(client): migrer la presence et les mentions vers les couleurs semantiques"
```

---

### Tâche 4 : migrer le paquet `@sharkord/ui`

**Fichiers :**

- Modifier : `packages/ui/src/components/alert.tsx` (8 occurrences)
- Modifier : `packages/ui/src/components/color.tsx` (2)
- Modifier : `packages/ui/src/components/group.tsx` (1)

**Interfaces :**

- Consomme : les utilitaires de la tâche 1.
- Produit : les variantes d'`alert.tsx`, dont le nom ne doit pas changer — des
  appelants les nomment.

11 occurrences, mais dans le paquet partagé : un changement y porte sur
plusieurs écrans à la fois. Le traiter séparément permet de le juger seul.

- [ ] **Étape 1 : relever ce qui est à changer**

```bash
grep -nE "(text|bg|border|ring)-(red|green|blue|yellow|amber|orange|purple|pink|emerald|sky|slate|gray|zinc)-[0-9]{2,3}" \
  packages/ui/src/components/alert.tsx \
  packages/ui/src/components/color.tsx \
  packages/ui/src/components/group.tsx
```

Attendu : 11 lignes.

- [ ] **Étape 2 : vérifier d'abord que le paquet voit les jetons**

Les jetons sont déclarés dans `apps/client/src/index.css`, pas dans le paquet.
Avant de remplacer quoi que ce soit, confirmer que `packages/ui` consomme bien
la même feuille — chercher comment `alert.tsx` accède aujourd'hui à
`bg-destructive` ou `text-muted-foreground`, qui sont dans la même situation.

S'il s'avère que le paquet a sa propre déclaration de thème, **s'arrêter et le
signaler** : cela voudrait dire que les jetons doivent être déclarés à deux
endroits, ce que ce plan n'a pas prévu.

- [ ] **Étape 3 : remplacer**

Les onze occurrences tiennent en quatre lignes. `alert.tsx:14` en concentre
huit à lui seul, et c'est le cas le plus instructif du chantier : la variante
`info` est construite en double, une fois pour le thème clair et une fois pour
le sombre. **Le jeton rend cette duplication inutile**, puisqu'il vaut déjà une
valeur différente par thème.

```tsx
// packages/ui/src/components/alert.tsx:14 — 8 occurrences, dont 4 variantes dark:
-        info: 'bg-blue-50 dark:bg-blue-950/50 border-blue-200 dark:border-blue-800 text-blue-900 dark:text-blue-100 [&>svg]:text-current *:data-[slot=alert-description]:text-blue-700 *:data-[slot=alert-description]:dark:text-blue-300'
+        info: 'bg-info/10 border-info/30 text-info [&>svg]:text-current *:data-[slot=alert-description]:text-info/80'
```

```tsx
// packages/ui/src/components/color.tsx:29 — bordure d'erreur
-              error && '!border-red-500'
+              error && '!border-destructive'
```

```tsx
// packages/ui/src/components/color.tsx:45 — message d'erreur
-      {error && <span className="text-sm text-red-500 mt-1">{error}</span>}
+      {error && <span className="text-sm text-destructive mt-1">{error}</span>}
```

```tsx
// packages/ui/src/components/group.tsx:40 — astérisque de champ requis
-              {label} {required && <span className="text-red-500">*</span>}
+              {label} {required && <span className="text-destructive">*</span>}
```

`alert.tsx` porte des variantes nommées : migrer les couleurs **sans renommer
les variantes**, des appelants s'en servent. La variante `info` garde son nom.

- [ ] **Étape 4 : vérifier que le compte est à zéro sur ces trois fichiers**

Relancer le grep de l'étape 1.
Attendu : aucune ligne.

- [ ] **Étape 5 : portes et commit**

```bash
bun run format:check && bun run check-types && bun run lint
git add packages/ui/src/components
git commit -m "refactor(ui): migrer le paquet partage vers les couleurs semantiques"
```

---

### Tâche 5 : migrer les écrans de réglage et d'administration

**Fichiers :**

- Modifier : `components/dialogs/plugin-commands/response.tsx` (18 occurrences)
- Modifier : `components/plugin-slot-renderer/error-boundary.tsx` (7)
- Modifier : `components/server-screens/user-settings/devices/microphone-test-level-bar.tsx` (5)
- Modifier : `screens/disconnected/index.tsx` (3)
- Modifier : `components/user-popover/index.tsx` (2)
- Modifier : `components/server-screens/server-settings/users/table-user.tsx` (2)
- Modifier : `components/plugin-slot-renderer/plugin-slot-debug-wrapper.tsx` (2)
- Modifier : `components/channel-view/text/overrides/command.tsx` (2)

**Interfaces :**

- Consomme : les utilitaires de la tâche 1.
- Produit : rien qu'une autre tâche importe.

41 occurrences, les surfaces les moins vues. `response.tsx` en concentre 18 à
lui seul.

- [ ] **Étape 1 : relever ce qui est à changer**

```bash
grep -nE "(text|bg|border|ring)-(red|green|blue|yellow|amber|orange|purple|pink|emerald|sky|slate|gray|zinc)-[0-9]{2,3}" \
  apps/client/src/components/dialogs/plugin-commands/response.tsx \
  apps/client/src/components/plugin-slot-renderer/error-boundary.tsx \
  apps/client/src/components/plugin-slot-renderer/plugin-slot-debug-wrapper.tsx \
  apps/client/src/components/server-screens/user-settings/devices/microphone-test-level-bar.tsx \
  apps/client/src/components/server-screens/server-settings/users/table-user.tsx \
  apps/client/src/components/user-popover/index.tsx \
  apps/client/src/components/channel-view/text/overrides/command.tsx \
  apps/client/src/screens/disconnected/index.tsx
```

Attendu : 41 lignes.

- [ ] **Étape 2 : remplacer, en traitant les deux `purple-*` à part**

Les deux occurrences `purple-*` sont dans les fichiers de greffons
(`plugin-slot-*`) et ne portent pas un des quatre sens du vocabulaire : ce sont
des marques visuelles de débogage. Les passer à `--primary`, et si le rendu
devient ambigu (une marque de débogage qui ressemble à un élément normal),
préférer `--muted-foreground` et le dire dans le rapport.

- [ ] **Étape 3 : vérifier que le compte est à zéro sur ces huit fichiers**

Relancer le grep de l'étape 1.
Attendu : aucune ligne.

- [ ] **Étape 4 : portes et commit**

```bash
bun run format:check && bun run check-types && bun run lint
git add apps/client/src
git commit -m "refactor(client): migrer les ecrans de reglage vers les couleurs semantiques"
```

---

### Tâche 6 : les trois coupables hors Tailwind, et la porte à zéro

**Fichiers :**

- Modifier : `apps/client/src/index.css:355-380` (les ascenseurs)
- Modifier : `apps/client/src/components/user-popover/index.tsx:94` (le blurple)
- Modifier : `.../devices/microphone-test-level-bar.tsx:152` (le marqueur blanc)

**Interfaces :**

- Consomme : les jetons existants.
- Produit : rien qu'une autre tâche importe.

- [ ] **Étape 1 : les ascenseurs**

Les six variables `--scrollbar-*-color-*` (`index.css:360-367`) et les règles
qui les consomment disparaissent au profit des jetons. Une seule paire de
règles suffit, sans distinction clair/sombre : les jetons s'en chargent.

```css
* {
  scrollbar-width: thin;
  scrollbar-color: color-mix(in oklch, var(--muted-foreground) 45%, transparent)
    var(--background);
}
```

Et les équivalents WebKit (`::-webkit-scrollbar-thumb`,
`::-webkit-scrollbar-track`) sur le même modèle, avec un pouce plus opaque au
survol.

**Ne pas peindre le pouce avec `--border`.** Leçon du chantier 1 :
`--border` vaut `oklch(1 0 0 / 10%)` dans tous les thèmes sombres, invisible
sur une forme pleine. Pour toute forme, `--muted-foreground` avec opacité.

- [ ] **Étape 2 : le blurple de Discord**

`components/user-popover/index.tsx:94` :

```tsx
- background: user.bannerColor || '#5865f2'
+ background: user.bannerColor || 'var(--primary)'
```

`#5865f2` est la couleur de marque de Discord. Une bannière sans couleur
choisie prend désormais l'accent du serveur.

- [ ] **Étape 3 : le marqueur du testeur de micro**

`.../devices/microphone-test-level-bar.tsx:152` :

```tsx
- className="... rounded-full bg-white/90 shadow-[0_0_0_1px_rgba(0,0,0,0.25)]"
+ className="... rounded-full bg-foreground/90 shadow-[0_0_0_1px_var(--background)]"
```

L'ombre devient un cerne de la couleur du fond, ce qui la fait marcher aussi
en thème clair — où une ombre noire sur un marqueur blanc n'avait aucun sens.

- [ ] **Étape 4 : la porte qui prouve la migration**

C'est la vérification centrale de tout le chantier :

```bash
grep -rE "(text|bg|border|ring|from|to|via|shadow|outline|decoration|accent|caret|divide|fill|stroke)-(red|green|blue|yellow|amber|orange|purple|pink|emerald|sky|slate|gray|zinc|cyan|teal|indigo|violet|lime|rose|fuchsia|stone|neutral)-[0-9]{2,3}" \
  apps/client/src packages/ui/src --include=*.tsx | wc -l
```

Ce compte valait **105** avant le chantier. Il doit valoir **0**. Toute autre
valeur signifie une migration partielle, c'est-à-dire l'incohérence qu'on
voulait supprimer, en plus petit. La liste de familles ci-dessus omettait à
l'origine `cyan`, `teal`, `indigo`, `violet`, `lime`, `rose`, `fuchsia`,
`stone` et `neutral` ; cette omission a produit un faux négatif qui a laissé
passer un `text-cyan-400`, d'où leur ajout.

**La liste des préfixes est plus large que celle des tâches 2 à 5, et c'est
voulu.** Les greps de relevé ne cherchaient que `text|bg|border|ring` ; la
tâche 2 a découvert des bornes de dégradé (`from-green-500`, `to-emerald-500`)
qu'aucun de ces greps ne voyait. Une porte qui ne couvre que ce qu'on savait
chercher ne prouve rien.

Vérifier aussi qu'aucun gris d'ascenseur ne subsiste :

```bash
grep -n "scrollbar-.*color" apps/client/src/index.css
```

Attendu : plus aucune variable de couleur d'ascenseur, seulement les règles qui
consomment les jetons.

- [ ] **Étape 5 : reconstruire et revérifier le bundle**

```bash
cd apps/client && bun run build
grep -rn "text-success{" dist/assets/*.css
```

Attendu : `.text-success{color:var(--success)}`, et non une couleur figée. Les
utilitaires ont maintenant de vrais consommateurs, la règle doit exister.

- [ ] **Étape 6 : portes et commit**

```bash
bun run format:check && bun run check-types && bun run lint
git add apps/client/src
git commit -m "fix(client): retirer les dernieres couleurs hors theme"
```

---

## Après les 6 tâches

1. Revue de branche complète. Lui donner le compte du grep (0) et lui demander
   de vérifier qu'aucun remplacement n'a confondu un fond et un premier plan —
   c'est la seule erreur que ce chantier peut produire en masse.
2. Pousser sur **les deux** remotes : `git push origin feat/semantic-colors` et
   `git push github feat/semantic-colors`.
3. Déploiement pour l.user, qui valide :

```bash
cd ~/bullshark && git fetch origin && git reset --hard origin/feat/semantic-colors && bun install && ( cd apps/server && bun run build ) && docker build -t bullshark:local . && docker compose up -d --build
```

Vider le cache Safari ou resupprimer la PWA, sinon l'ancien bundle est servi.

**La validation ne se fait pas dans un seul thème.** Ouvrir le panneau vocal et
la liste des membres dans **`bullshark` (bleu) et `gaming-red` (rouge)** et
confirmer que présence, micro coupé et mentions restent lisibles et
reconnaissables dans les deux. C'est le seul point où une teinte fixe mal
choisie se verrait — et c'est la décision de conception centrale du chantier.

## Hors périmètre de ce plan

**La bannière de compatibilité du shell** (`bullshark-desktop`,
`src/preload/bridge.ts:14-22`) relève du même défaut mais vit dans l'autre
dépôt, et elle ne peut pas être corrigée seule : le shell ne connaît pas les
couleurs du thème. Le chantier A construit le canal qui les lui apprend. Elle
sera traitée après lui, dans le dépôt desktop.
