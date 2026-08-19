# Identité visuelle du shell — plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Donner au shell de Bullshark une identité propre — une seule famille de caractères, des angles plus ronds, du relief par liseré clair et des colonnes latérales qui reculent — sans toucher au serveur.

**Architecture :** Six jetons CSS dans `apps/client/src/index.css` portent l'essentiel. Le rayon se propage seul, puisque les 108 fichiers qui utilisent `rounded-*` passent tous par l'échelle Tailwind dérivée de `--radius`. Seules six surfaces du shell demandent une édition ciblée : la ligne de salon, le libellé de catégorie, le panneau utilisateur, la barre du haut, l'en-tête de salon et la zone de saisie.

**Tech Stack :** Tailwind v4 (`@theme inline`), CSS `oklch()` avec syntaxe relative, React 19, `@fontsource/geist-sans`, bun.

**Spec :** `docs/superpowers/specs/2026-08-19-shell-identity-design.md`

## Global Constraints

- **Aucun harnais de test dans `apps/client`.** Pas de script `test`, aucun fichier de test. Le cycle TDD habituel ne s'applique pas ici : chaque tâche se termine par les trois portes ci-dessous, puis par une vérification visuelle décrite explicitement. Ne pas inventer de framework de test pour ce chantier.
- **Les trois portes, à lancer depuis la racine du dépôt :** `bun run check-types` (0 erreur), `bun run lint` (0 erreur ; deux avertissements préexistants sur `mod-view-sheet/context.tsx` et `voice-provider/volume-control-context.tsx` restent et ne comptent pas), `bun run format:check` (propre — c'est la porte qui casse la CI).
- **Lancer `bun run format` avant chaque commit.** La CI casse sur prettier.
- **Branche :** `feat/shell-identity`, déjà créée depuis `development`, la spec y est commitée en `41febd0`.
- **Zéro touche serveur.** Aucun fichier hors `apps/client/` ne doit être modifié. Aucune migration.
- **Les cinq thèmes doivent rester cohérents :** `gaming-red`, `deep-ocean`, `midnight-purple`, `bullshark`, `custom`.
- **Ne pas retirer les six polices existantes** (Orbitron, Rajdhani, Exo 2, Bebas Neue, Press Start 2P, Share Tech Mono) : elles servent aux pseudos personnalisés via `getNicknameFontFamily`.

## Vérification visuelle

Plusieurs tâches demandent de regarder le résultat. Le serveur de développement n'existe pas à la racine : il est déclaré dans `apps/client`. Il se lance donc ainsi :

```bash
cd apps/client && bun run dev
```

Le client est alors servi sur `http://localhost:5173`. Si aucun serveur Bullshark n'est joignable, l'écran de connexion suffit pour contrôler la typographie et les rayons ; les tâches qui exigent la colonne des salons sont signalées et se contrôlent sur le serveur Kimsufi après déploiement.

---

### Task 1 : la police

**Files:**
- Modify: `apps/client/package.json` (bloc `dependencies`)
- Modify: `apps/client/src/index.css:1-10` (imports) et le bloc `@theme inline` à partir de la ligne 21

**Interfaces:**
- Consumes: rien.
- Produces: les jetons `--font-sans` et `--font-display`, consommés par les tâches 5 et 6. Tailwind expose automatiquement l'utilitaire `font-sans` à partir de `--font-sans`, et `font-display` à partir de `--font-display`.

- [ ] **Step 1 : ajouter la dépendance**

```bash
cd apps/client && bun add @fontsource/geist-sans@5.3.0
```

- [ ] **Step 2 : importer les graisses utilisées**

Dans `apps/client/src/index.css`, juste après `@import 'tw-animate-css';` (ligne 2), avant les six polices existantes :

```css
@import '@fontsource/geist-sans/400.css';
@import '@fontsource/geist-sans/500.css';
@import '@fontsource/geist-sans/600.css';
@import '@fontsource/geist-sans/700.css';
```

N'importer que ces quatre graisses. Le paquet en contient neuf ; les cinq autres alourdiraient le bundle sans servir.

- [ ] **Step 3 : déclarer les jetons de typographie**

Dans le bloc `@theme inline`, à la suite des jetons `--radius-*` :

```css
  --font-sans: 'Geist', 'Helvetica Neue', Helvetica, Arial, sans-serif;
  --font-display: 'Geist', 'Helvetica Neue', Helvetica, Arial, sans-serif;
```

La pile de repli compte : si Geist ne se charge pas, on retombe sur une grotesque proche et non sur une empattement système.

- [ ] **Step 4 : appliquer la famille au document**

Dans le bloc `@layer base` existant (ligne 12), ajouter :

```css
  body {
    font-family: var(--font-sans);
  }
```

- [ ] **Step 5 : lancer les portes**

```bash
bun run format && bun run check-types && bun run lint && bun run format:check
```

Attendu : 0 erreur partout, seulement les deux avertissements connus.

- [ ] **Step 6 : vérification visuelle**

Lancer `cd apps/client && bun run dev`, ouvrir `http://localhost:5173`. L'écran de connexion doit s'afficher en Geist. Contrôle rapide dans les outils de développement : sur `<body>`, la propriété calculée `font-family` doit commencer par `Geist`, et l'onglet Réseau doit montrer quatre fichiers `geist-sans` chargés, pas neuf.

- [ ] **Step 7 : commit**

```bash
git add apps/client/package.json apps/client/src/index.css bun.lock
git commit -m "feat(client): set Geist as the interface typeface"
```

---

### Task 2 : les angles

**Files:**
- Modify: `apps/client/src/index.css` — bloc `@theme inline` (ligne 21) et `:root` (ligne 60)

**Interfaces:**
- Consumes: rien.
- Produces: `--radius` à `0.75rem` et le nouvel utilitaire Tailwind `rounded-pill`, consommé par la tâche 4.

- [ ] **Step 1 : arrondir le rayon de base**

Dans `:root`, remplacer :

```css
  --radius: 0.625rem;
```

par :

```css
  --radius: 0.75rem;
```

Ne toucher à aucune autre déclaration. Les quatre dérivées `--radius-sm/md/lg/xl` du bloc `@theme inline` suivent seules.

- [ ] **Step 2 : ajouter la pastille**

Dans le bloc `@theme inline`, à la suite de `--radius-xl` :

```css
  --radius-pill: 999px;
```

Tailwind expose alors l'utilitaire `rounded-pill`.

- [ ] **Step 3 : lancer les portes**

```bash
bun run format && bun run check-types && bun run lint && bun run format:check
```

- [ ] **Step 4 : vérification visuelle**

Avec le serveur de développement lancé, sur l'écran de connexion : la carte centrale, les champs et le bouton doivent être visiblement plus ronds qu'avant. Rien ne doit être déformé ni rogné — un rayon trop grand sur un élément court produit une forme en gélule involontaire. Regarder en particulier les petits boutons de la barre de langue.

- [ ] **Step 5 : commit**

```bash
git add apps/client/src/index.css
git commit -m "feat(client): round the corners and add a pill radius"
```

---

### Task 3 : le relief et les colonnes latérales

C'est la tâche la plus délicate du plan : elle touche les cinq thèmes, et le thème utilisateur peut casser sur un fond très sombre.

**Files:**
- Modify: `apps/client/src/index.css` — `.dark` (ligne 94) puis les cinq blocs de thème : `.dark.theme-gaming-red` (135), `.dark.theme-deep-ocean` (164), `.dark.theme-midnight-purple` (193), `.dark.theme-bullshark` (222), `.dark.theme-custom` (252)

**Interfaces:**
- Consumes: rien.
- Produces: le jeton `--edge-hi`, consommé par les tâches 4, 5 et 6.

- [ ] **Step 1 : déclarer le liseré**

Dans `:root` (ligne 60), ajouter :

```css
  --edge-hi: oklch(1 0 0 / 5%);
```

Une seule déclaration : la valeur est du blanc translucide, elle fonctionne sur les cinq fonds sombres.

- [ ] **Step 2 : inverser `--sidebar` dans les quatre thèmes fixes**

Aujourd'hui chaque thème pose un `--sidebar` **plus clair** que son `--background`. On l'assombrit. Valeurs exactes, une ligne à remplacer par thème :

| Bloc | Ligne | Aujourd'hui | Remplacer par |
| --- | --- | --- | --- |
| `.dark.theme-gaming-red` | 153 | `--sidebar: oklch(0.15 0.015 20);` | `--sidebar: oklch(0.095 0.015 20);` |
| `.dark.theme-deep-ocean` | 182 | `--sidebar: oklch(0.16 0.045 240);` | `--sidebar: oklch(0.105 0.045 240);` |
| `.dark.theme-midnight-purple` | 211 | `--sidebar: oklch(0.15 0.045 285);` | `--sidebar: oklch(0.095 0.045 285);` |
| `.dark.theme-bullshark` | 240 | `--sidebar: oklch(0.16 0.021 235);` | `--sidebar: oklch(0.115 0.021 235);` |

Chaque valeur vaut la luminance du `--background` du même thème moins 0,025. Ne pas toucher aux autres jetons `--sidebar-*` (accent, bordure, texte) : ils restent valides.

- [ ] **Step 3 : traiter le thème par défaut**

Dans `.dark` (ligne 94), `--background` vaut `oklch(0.145 0 0)` et `--sidebar` vaut `oklch(0.205 0 0)`. Remplacer par :

```css
  --sidebar: oklch(0.12 0 0);
```

- [ ] **Step 4 : traiter le thème utilisateur avec un plancher**

Dans `.dark.theme-custom` (ligne 252), la ligne actuelle est :

```css
  --sidebar: oklch(from var(--custom-bg, #181818) calc(l + 0.02) c h);
```

La remplacer par :

```css
  --sidebar: oklch(from var(--custom-bg, #181818) max(0.04, calc(l - 0.025)) c h);
```

Le plancher évite qu'un membre ayant choisi un fond presque noir se retrouve avec une colonne à luminance nulle.

- [ ] **Step 5 : vérifier que le plancher fonctionne vraiment**

C'est le point à ne pas prendre pour acquis : `max()` à l'intérieur de `oklch(from ...)` est une combinaison peu courante. Lancer `cd apps/client && bun run dev`, ouvrir l'écran des thèmes, créer un thème personnalisé avec un fond `#050505`, et regarder la colonne de gauche. Elle doit rester visible, distincte du noir absolu.

Si la colonne devient noire ou si la couleur ne s'applique pas du tout, c'est que la syntaxe n'est pas supportée. Repli à appliquer dans ce cas :

```css
  --sidebar: color-mix(in oklch, var(--custom-bg, #181818) 88%, black);
```

Noter dans le message de commit laquelle des deux formes a été retenue.

- [ ] **Step 6 : lancer les portes**

```bash
bun run format && bun run check-types && bun run lint && bun run format:check
```

- [ ] **Step 7 : vérification visuelle des cinq thèmes**

Toujours sous le serveur de développement, passer les cinq thèmes l'un après l'autre depuis les paramètres. Dans chacun, la colonne de gauche doit être **plus sombre** que la zone centrale. Le contraste du texte des salons doit rester lisible : c'est le point où l'inversion peut casser, puisque `--sidebar-foreground` n'a pas bougé.

- [ ] **Step 8 : commit**

```bash
git add apps/client/src/index.css
git commit -m "feat(client): push the side columns behind the reading surface"
```

---

### Task 4 : les salons en pastille

**Files:**
- Modify: `apps/client/src/components/left-sidebar/channels.tsx:182-190` (composant `ItemWrapper`)

**Interfaces:**
- Consumes: `--radius-pill` (tâche 2) via `rounded-pill`, `--edge-hi` (tâche 3).
- Produces: rien.

- [ ] **Step 1 : remplacer les classes de la ligne de salon**

Le bloc actuel :

```tsx
        className={cn(
          'flex w-full items-center gap-2 rounded px-2 py-1.5 text-sm text-muted-foreground hover:bg-accent hover:text-accent-foreground select-none cursor-pointer',
          {
            'bg-accent text-accent-foreground': isSelected,
            'cursor-default opacity-50 hover:bg-transparent hover:text-muted-foreground':
              disabled
          },
          className
        )}
```

Le remplacer par :

```tsx
        className={cn(
          'flex w-full items-center gap-2 rounded-pill px-2.5 py-1.5 text-sm text-muted-foreground hover:bg-accent hover:text-accent-foreground select-none cursor-pointer',
          {
            'bg-primary/15 text-foreground font-semibold shadow-[inset_0_1px_0_var(--edge-hi)]':
              isSelected,
            'cursor-default opacity-50 hover:bg-transparent hover:text-muted-foreground':
              disabled
          },
          className
        )}
```

Trois changements, tous voulus : `rounded` devient `rounded-pill` ; le retrait horizontal passe de `px-2` à `px-2.5` parce qu'une pastille a besoin d'un peu plus d'air aux extrémités ; et l'état sélectionné passe de la surface neutre `bg-accent` à un remplissage teinté par la couleur de marque, avec le liseré clair. C'est l'application concrète de la règle « l'accent signale un état » de la spec.

- [ ] **Step 2 : lancer les portes**

```bash
bun run format && bun run check-types && bun run lint && bun run format:check
```

- [ ] **Step 3 : vérification visuelle**

Cette tâche demande une connexion à un serveur, puisqu'il faut la liste des salons. Si aucun serveur local n'est disponible, la reporter à la passe sur le Kimsufi et le noter.

Points à contrôler : la pastille sélectionnée est teintée et non grise ; le survol d'un salon non sélectionné reste discret ; un nom de salon long ne déborde pas de la pastille ; le compteur de non-lus reste aligné à droite.

- [ ] **Step 4 : commit**

```bash
git add apps/client/src/components/left-sidebar/channels.tsx
git commit -m "feat(client): turn channel rows into pills"
```

---

### Task 5 : les libellés de section et l'en-tête de salon

**Files:**
- Modify: `apps/client/src/components/left-sidebar/categories.tsx:87`
- Modify: `apps/client/src/components/channel-view/text/text-top-bar.tsx:58`

**Interfaces:**
- Consumes: `--font-display` (tâche 1).
- Produces: rien.

- [ ] **Step 1 : aligner les libellés de catégorie sur ceux des membres**

La colonne des membres (`components/right-sidebar/index.tsx:58`) utilise déjà `text-xs font-semibold uppercase tracking-wide text-muted-foreground`. La colonne de gauche, elle, n'a ni capitales ni approche. Dans `categories.tsx`, la ligne 87 :

```tsx
      <div className="mb-1 flex w-full items-center px-2 py-1 text-xs font-semibold text-muted-foreground">
```

devient :

```tsx
      <div className="mb-1 flex w-full items-center px-2 py-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
```

Deux classes ajoutées, rien d'autre. Les deux colonnes se répondent enfin.

- [ ] **Step 2 : passer le nom du salon en police d'affichage**

Dans `text-top-bar.tsx`, la ligne 58 :

```tsx
            <span className="font-bold truncate max-w-40">{info.name}</span>
```

devient :

```tsx
            <span className="font-display font-bold tracking-[-0.01em] truncate max-w-40">
              {info.name}
            </span>
```

Pas de capitales ici : la spec réserve les capitales aux petits libellés de section.

- [ ] **Step 3 : lancer les portes**

```bash
bun run format && bun run check-types && bun run lint && bun run format:check
```

- [ ] **Step 4 : vérification visuelle**

Contrôler que `font-display` produit bien une famille appliquée et non une classe inconnue silencieusement ignorée : dans les outils de développement, la propriété calculée `font-family` du nom de salon doit commencer par `Geist`. Si elle affiche la police héritée, c'est que Tailwind n'a pas généré l'utilitaire à partir du jeton, et il faut alors écrire `font-[family-name:var(--font-display)]` à la place.

Contrôler aussi la lisibilité des libellés de catégorie en capitales sur les noms longs, en français comme dans les six autres langues : les capitales rallongent le texte et peuvent le tronquer.

- [ ] **Step 5 : commit**

```bash
git add apps/client/src/components/left-sidebar/categories.tsx apps/client/src/components/channel-view/text/text-top-bar.tsx
git commit -m "feat(client): give sections and channel headers their own type treatment"
```

---

### Task 6 : le relief des panneaux et la zone de saisie

**Files:**
- Modify: `apps/client/src/components/top-bar/index.tsx:27`
- Modify: `apps/client/src/components/left-sidebar/user-control.tsx:34`
- Modify: `apps/client/src/components/message-compose/index.tsx:245`

**Interfaces:**
- Consumes: `--edge-hi` (tâche 3), `--radius` (tâche 2).
- Produces: rien.

- [ ] **Step 1 : liseré sur la barre du haut**

Ligne 27, ajouter la classe d'ombre interne à la fin de la liste existante :

```tsx
    <div className="hidden lg:grid h-12 w-full grid-cols-[1fr_minmax(320px,1.4fr)_1fr] items-center border-b border-border bg-card px-4 transition-all duration-300 ease-in-out gap-2 shadow-[inset_0_1px_0_var(--edge-hi)]">
```

- [ ] **Step 2 : liseré sur le panneau utilisateur**

Ligne 34 :

```tsx
    <div className="flex items-center justify-between h-14 px-2 bg-muted/20 border-t border-border">
```

devient :

```tsx
    <div className="flex items-center justify-between h-14 px-2 bg-muted/20 border-t border-border shadow-[inset_0_1px_0_var(--edge-hi)]">
```

- [ ] **Step 3 : transformer la zone de saisie en boîte**

Ligne 245, le conteneur est aujourd'hui une barre pleine largeur sans rayon :

```tsx
        className="compose-container relative shrink-0 min-h-14 flex flex-col pb-[env(safe-area-inset-bottom)] bg-white/[0.03]"
```

devient :

```tsx
        className="compose-container relative shrink-0 min-h-14 flex flex-col mx-3 mb-3 rounded-[var(--radius)] border border-border pb-[env(safe-area-inset-bottom)] bg-white/[0.03] shadow-[inset_0_1px_0_var(--edge-hi)]"
```

- [ ] **Step 4 : lancer les portes**

```bash
bun run format && bun run check-types && bun run lint && bun run format:check
```

- [ ] **Step 5 : vérification visuelle, dont le mobile**

L'étape 3 est la seule du plan qui change une mise en page et non une décoration. Le conteneur portait `pb-[env(safe-area-inset-bottom)]` pour la zone sûre des iPhone ; en lui ajoutant `mb-3`, la marge et la zone sûre s'additionnent.

À contrôler dans le simulateur mobile des outils de développement, en format iPhone : la boîte de saisie ne doit pas flotter trop haut au-dessus du bord, et l'encoche du bas ne doit pas la recouvrir. Si l'écart est trop grand, remplacer `mb-3` par `mb-[max(0.75rem,env(safe-area-inset-bottom))]` et retirer la classe `pb-[env(safe-area-inset-bottom)]`.

Contrôler aussi que le glisser-déposer d'un fichier et l'état `uploading` (qui pose `bg-muted` sur la ligne intérieure) restent corrects dans la boîte arrondie.

- [ ] **Step 6 : commit**

```bash
git add apps/client/src/components/top-bar/index.tsx apps/client/src/components/left-sidebar/user-control.tsx apps/client/src/components/message-compose/index.tsx
git commit -m "feat(client): lift panels with a top highlight and box the composer"
```

---

### Task 7 : passe complète et livraison

**Files:** aucun fichier modifié par défaut. Cette tâche est une revue ; les corrections éventuelles se font dans le fichier concerné.

**Interfaces:**
- Consumes: le travail des six tâches précédentes.
- Produces: la branche prête à être déployée sur le Kimsufi.

- [ ] **Step 1 : portes complètes depuis la racine**

```bash
bun run check-types && bun run lint && bun run format:check
```

- [ ] **Step 2 : vérifier qu'aucun fichier serveur n'a bougé**

```bash
git diff --stat development..HEAD -- . ':(exclude)apps/client' ':(exclude)docs'
```

Attendu : aucune sortie. Si un fichier apparaît, c'est une erreur, la spec interdit toute touche serveur.

- [ ] **Step 3 : contrôle du bundle**

```bash
cd apps/client && bun run build
```

Relever la taille du CSS et des polices émises. Geist en quatre graisses doit ajouter de l'ordre de 60 à 120 Ko. Si l'augmentation dépasse largement cela, c'est que les neuf graisses ont été importées et il faut revenir à la tâche 1.

- [ ] **Step 4 : passe visuelle sur les cinq thèmes**

Pour chacun des cinq thèmes : colonne de gauche plus sombre que le centre, pastille de salon teintée, libellés de section en capitales des deux côtés, liseré clair visible en haut de la barre et du panneau utilisateur, zone de saisie en boîte arrondie.

- [ ] **Step 5 : contrôle de contraste**

C'est le risque nommé dans la spec. Geist n'a pas la même hauteur d'x que la police système. Regarder de près les horodatages, les libellés de section et le texte des salons non sélectionnés. Si un texte est devenu difficile à lire, la correction se fait sur `--muted-foreground` du thème concerné, pas sur les tailles de police.

- [ ] **Step 6 : pousser la branche**

```bash
git push origin feat/shell-identity && git push github feat/shell-identity
```

- [ ] **Step 7 : livrer la commande de déploiement**

L'utilisateur ne lance rien sur son poste : tout se passe sur le Kimsufi. Lui donner la séquence, en remplaçant la branche :

```bash
cd ~/bullshark && git fetch origin && git reset --hard origin/feat/shell-identity && bun install && ( cd apps/server && bun run build ) && docker build -t bullshark:local . && docker compose up -d --build && echo "DEPLOYED: $(git log --oneline -1)"
```

Lui rappeler de vider le cache Safari ou de resupprimer la PWA de l'écran d'accueil : le service worker sert l'ancien bundle sinon, et il conclura que rien n'a changé.

- [ ] **Step 8 : attendre sa validation avant tout merge**

Ne pas fusionner sur `development` ni sur `main` sans son accord explicite après essai sur le serveur.
